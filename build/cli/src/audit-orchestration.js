/**
 * Audit orchestration.
 *
 * A normal `forge <section> audit` used to be static-only: it inspected files and stopped. Anything
 * that required running a project command or a browser lived in separate `forge tool` invocations
 * whose results never reached the report. This module makes one audit invocation coherent: it
 * discovers what could be checked, decides what it is actually authorized to do, executes only that,
 * and records the rest as explicitly not run.
 *
 * The two rules that shape every decision here:
 *
 * 1. Absence of evidence is never a pass. A check that could not run becomes a `NOT_VERIFIED` or
 *    `BLOCKED` record with the reason attached, never silence.
 * 2. Nothing executes without explicit authorization. Project commands run only under `--allow-run`,
 *    only from a bounded read-only allowlist, and never as a shell string.
 */
import { join } from "node:path";
import { appendRuntimeEvidence, appendToolRecord, createPlannedCheck, recordBlockedCheck, recordExecutedCheck } from "./ledger.js";
import { bindRuntimeArtifacts } from "./evidence-envelope.js";
import { classifyCommandNetworkPolicy, plannedCheckNetworkPolicy } from "./offline-policy.js";
import { runFile, utcNow } from "./utils.js";
/**
 * Project scripts an audit may execute under `--allow-run`.
 *
 * The list is an allowlist rather than a denylist on purpose. A project can define a script with any
 * name and any behavior; `start`, `dev`, `serve`, `deploy`, and `publish` are not merely excluded,
 * they are unreachable. An audit never starts a server it does not understand, and the audit itself
 * therefore cannot become the thing that exposes or mutates the audited system.
 *
 * The order is the execution order and is fixed, so the planned-check list is deterministic across
 * machines and runs.
 */
export const CANDIDATE_PROJECT_CHECKS = [
    "format:check",
    "lint",
    "typecheck",
    "test",
    "build",
    "scan:secrets",
    "audit:dependencies",
    "check:licenses"
];
/**
 * Definitions whose execution demonstrably reaches the network.
 *
 * These patterns may only ESCALATE a command's classification from `UNKNOWN` to
 * `NETWORK_REQUIRED`. They may never do the reverse. Absence of a match proves nothing: an
 * arbitrary audited-project script with no recognizable keyword can still open a socket, so it
 * stays `UNKNOWN` and stays blocked under `--offline`. Only the structural exemptions in
 * `classifyCommandNetworkPolicy` can produce `OFFLINE_SAFE`, and `plannedCheckNetworkPolicy` is
 * the single bridge into this vocabulary.
 */
const NETWORK_DEPENDENT_PATTERNS = [
    /\bnpm\s+(?:audit|install|ci|publish|pack|view|outdated)\b/u,
    /\b(?:pnpm|yarn|bun)\s+(?:audit|install|add|publish|outdated)\b/u,
    /\bnpx\s/u,
    /\b(?:curl|wget)\b/u,
    /\bgit\s+(?:fetch|pull|push|clone|ls-remote)\b/u,
    /\bdocker\s+(?:pull|push)\b/u,
    /\bplaywright\s+install\b/u,
    /\bgh\s/u
];
/**
 * Builds the deterministic planned-check list.
 *
 * Determinism matters beyond tidiness: the planned list is reported evidence, so two audits of the
 * same checkout must produce byte-identical plans regardless of filesystem ordering. Modules are
 * sorted, commands follow the fixed allowlist order, and runtime evidence is always last.
 */
export function buildAuditPlan(input) {
    const policyContext = input.policy ?? { offline: false, forgeOwned: false };
    const planned = [];
    for (const slug of [...new Set(input.modules)].sort((a, b) => a.localeCompare(b))) {
        planned.push({
            id: `module:${slug}`,
            kind: "module-inspection",
            name: slug,
            description: `Static inspection of the ${slug} module`,
            requires_authorization: false,
            // Forge-owned static inspection reads checkout files in-process and spawns nothing.
            network_policy: "OFFLINE_SAFE",
            module: slug
        });
    }
    for (const name of CANDIDATE_PROJECT_CHECKS) {
        const command = input.commands.find((candidate) => candidate.name === name);
        if (command === undefined)
            continue;
        planned.push({
            id: `command:${name}`,
            kind: "project-command",
            name,
            description: `Project command '${name}' defined as: ${command.definition}`,
            requires_authorization: true,
            network_policy: commandNetworkPolicy(command, policyContext),
            module: "all"
        });
    }
    if (input.url !== undefined) {
        planned.push({
            id: "runtime:rendered-ui",
            kind: "runtime-evidence",
            name: "rendered-ui",
            description: "Rendered-UI capture of the supplied URL",
            requires_authorization: true,
            network_policy: "NETWORK_REQUIRED",
            module: "frontend"
        });
    }
    return planned;
}
export function isNetworkDependent(command) {
    return NETWORK_DEPENDENT_PATTERNS.some((pattern) => pattern.test(command.definition));
}
/**
 * Report-vocabulary network policy for a detected project command.
 *
 * The only route into `OFFLINE_SAFE` is {@link plannedCheckNetworkPolicy} applied to a structural
 * exemption proven by {@link classifyCommandNetworkPolicy}. Keyword scanning is applied afterwards
 * and can only escalate `UNKNOWN` to `NETWORK_REQUIRED`; it can never downgrade anything. An
 * arbitrary audited-project script with no network keywords therefore remains `UNKNOWN`.
 */
export function commandNetworkPolicy(command, context) {
    const policy = plannedCheckNetworkPolicy(classifyCommandNetworkPolicy(command, context));
    if (policy === "UNKNOWN" && isNetworkDependent(command))
        return "NETWORK_REQUIRED";
    return policy;
}
/**
 * Runs the audit lifecycle: plan, authorize, execute, record.
 *
 * Every planned check reaches exactly one of `executed` or `blocked` on the ledger. There is no path
 * on which a check is planned and then silently forgotten.
 */
export async function orchestrateAudit(input) {
    const planned = buildAuditPlan({
        modules: input.modules,
        commands: input.commands,
        policy: { offline: input.offline, forgeOwned: input.forgeOwned ?? false },
        ...(input.url === undefined ? {} : { url: input.url })
    });
    const known = new Set(planned.map((check) => check.id));
    const byName = new Map();
    for (const check of planned)
        byName.set(check.name, check.id);
    const select = resolveSelectors(input.select, known, byName, "--check");
    const skip = resolveSelectors(input.skip, known, byName, "--skip-check");
    for (const check of planned)
        input.ledger.planCheck(check);
    const outcomes = [];
    const execution = [];
    const runtimeEvidence = [];
    const runCommand = input.runCommand ?? defaultCommandRunner;
    const collect = input.collectRuntimeEvidence;
    let evidenceComplete = true;
    for (const check of planned) {
        if (skip.has(check.id)) {
            outcomes.push(record(input.ledger, check, "explicitly skipped with --skip-check", "deselected"));
            continue;
        }
        if (select.size > 0 && !select.has(check.id)) {
            outcomes.push(record(input.ledger, check, "not selected by --check", "deselected"));
            continue;
        }
        if (check.kind === "module-inspection") {
            // Static module inspection is performed by the caller; orchestration records that it was
            // planned and ran so the ledger describes the whole audit, not only its executable parts.
            outcomes.push({ id: check.id, kind: check.kind, status: "EXECUTED", exit_code: 0 });
            continue;
        }
        if (input.dryRun) {
            outcomes.push(record(input.ledger, check, "dry run: planned only, nothing was executed", "deselected"));
            continue;
        }
        if (!input.allowRun) {
            outcomes.push(record(input.ledger, check, check.kind === "project-command"
                ? "project-command execution requires explicit --allow-run after reviewing the local script definition"
                : "runtime evidence collection requires explicit --allow-run", "unauthorized"));
            evidenceComplete = evidenceComplete && check.kind !== "runtime-evidence";
            continue;
        }
        if (input.offline && check.network_policy !== "OFFLINE_SAFE") {
            outcomes.push(record(input.ledger, check, check.network_policy === "NETWORK_REQUIRED"
                ? `offline mode refuses '${check.name}' because its definition demonstrably reaches the network`
                : `offline mode refuses '${check.name}' because its network behaviour is UNKNOWN. Fullstack Forge implements no operating-system network isolation, so an arbitrary audited-project command can never be proven offline-safe by inspecting its text.`, "offline-policy"));
            if (check.kind === "runtime-evidence")
                evidenceComplete = false;
            continue;
        }
        if (check.kind === "project-command") {
            const command = input.commands.find((candidate) => candidate.name === check.name);
            if (command === undefined) {
                outcomes.push(record(input.ledger, check, "the detected command disappeared before execution", "unavailable"));
                continue;
            }
            const startedAt = utcNow();
            const started = Date.now();
            const result = await runCommand(command, input.root);
            const entry = {
                command: [command.executable, ...command.args],
                exitCode: result.exitCode,
                output: `${result.stdout}\n${result.stderr}`.trim(),
                started_at: startedAt,
                duration_ms: Date.now() - started
            };
            execution.push(entry);
            input.ledger.executed(check, entry);
            outcomes.push({
                id: check.id,
                kind: check.kind,
                status: "EXECUTED",
                exit_code: result.exitCode
            });
            continue;
        }
        // Runtime evidence.
        if (collect === undefined || input.url === undefined) {
            outcomes.push(record(input.ledger, check, "no runtime-evidence collector is available in this build", "unavailable"));
            evidenceComplete = false;
            continue;
        }
        const collected = await collect({
            root: input.root,
            url: input.url,
            offline: input.offline,
            allowRun: input.allowRun,
            ...(input.evidenceDir === undefined ? {} : { evidenceDir: input.evidenceDir })
        });
        let evidence = collected;
        try {
            // String-only collectors are v0.2-compatible diagnostics. A collector that supplies hashes
            // opts into v0.3 validation, which makes every persisted path/hash/media-type record atomic.
            if (collected.artifacts.every((artifact) => typeof artifact !== "string")) {
                evidence = {
                    ...collected,
                    artifacts: await bindRuntimeArtifacts(input.root, collected.artifacts)
                };
            }
        }
        catch (error) {
            // Preserve the collector's record and failure context, but prevent a swapped or missing
            // artifact from becoming complete runtime evidence.
            evidence = {
                ...collected,
                artifacts: [],
                limitations: [
                    ...collected.limitations,
                    `Runtime artifact validation failed: ${error.message}`
                ],
                complete: false
            };
        }
        runtimeEvidence.push(evidence);
        input.ledger.runtimeEvidence(evidence);
        if (evidence.complete) {
            outcomes.push({ id: check.id, kind: check.kind, status: "EXECUTED", exit_code: 0 });
        }
        else {
            // Fail closed: requested runtime evidence that came back incomplete is recorded as not run,
            // and the whole audit is marked as having unproven evidence.
            evidenceComplete = false;
            outcomes.push(record(input.ledger, check, `rendered evidence is ${evidence.status}: ${evidence.limitations[0] ?? "no usable capture was produced"}`, "failed-closed"));
        }
    }
    return {
        planned,
        outcomes,
        execution,
        runtime_evidence: runtimeEvidence,
        evidence_complete: evidenceComplete
    };
}
function record(ledger, check, reason, cause) {
    ledger.blocked(check, reason, cause);
    return { id: check.id, kind: check.kind, status: "NOT_RUN", reason, cause };
}
/**
 * Maps `--check`/`--skip-check` values onto planned check IDs.
 *
 * Both the full ID (`command:test`) and the bare name (`test`) are accepted. An unknown value is an
 * error rather than a silent no-op: an operator who misspells `--check lnit` must not be told the
 * audit passed with the lint check quietly absent.
 */
function resolveSelectors(values, known, byName, flag) {
    const resolved = new Set();
    for (const value of values ?? []) {
        const trimmed = value.trim();
        if (known.has(trimmed)) {
            resolved.add(trimmed);
            continue;
        }
        const byBareName = byName.get(trimmed);
        if (byBareName !== undefined) {
            resolved.add(byBareName);
            continue;
        }
        throw new Error(`Unknown ${flag} value '${value}'. Available checks: ${[...known].join(", ") || "none"}.`);
    }
    return resolved;
}
const defaultCommandRunner = async (command, root) => runFile(command.executable, command.args, root, 15 * 60_000);
/**
 * Ledger implementation writing into the v0.1.8 report schema.
 *
 * Orchestration emits four kinds of fact; this class turns them into the typed `planned_checks`,
 * `runtime_evidence`, and `tools` ledgers using the append-only `cli/src/ledger.ts` API. Every
 * append is validated and order-stable, and the API itself refuses to rewrite a blocked or
 * unverified result as passing — so the honesty invariant is enforced by the ledger rather than by
 * this caller remembering to be careful.
 */
export class ReportAuditLedger {
    revision;
    planned = [];
    execution = [];
    runtime = [];
    notRun = [];
    plannedChecks = [];
    runtimeLedger = [];
    toolLedger = [];
    constructor(revision = "unknown") {
        this.revision = revision;
    }
    planCheck(check) {
        this.planned.push(check);
        this.plannedChecks = [
            ...this.plannedChecks,
            createPlannedCheck({
                check_id: check.id,
                module: check.module,
                source: check.kind,
                requires_authorization: check.requires_authorization,
                network_policy: check.network_policy,
                reason: check.description
            })
        ];
    }
    executed(check, entry) {
        this.execution.push(entry);
        this.plannedChecks = recordExecutedCheck(this.plannedChecks, check.id, {
            command: entry.command,
            reason: `Executed with exit code ${entry.exitCode}.`
        });
        this.toolLedger = appendToolRecord(this.toolLedger, {
            tool_id: `project-command:${check.name}`,
            name: check.name,
            ownership: "project-owned",
            trust: "untrusted",
            version: "unknown",
            version_source: "unknown",
            invocation: entry.command,
            limitations: [
                "Project-defined command; Fullstack Forge did not author it and cannot attest to what it checked."
            ]
        });
    }
    blocked(check, reason, cause) {
        this.notRun.push({ check, reason, cause });
        // A check that was never authorized is not a defect: it stays NOT_RUN so it cannot enter the
        // `forge fix` candidate set. BLOCKED is reserved for the two policy refusals Forge itself made.
        this.plannedChecks =
            cause === "offline-policy" || cause === "failed-closed"
                ? recordBlockedCheck(this.plannedChecks, check.id, reason)
                : this.plannedChecks.map((entry) => entry.check_id === check.id ? { ...entry, status: "NOT_RUN", reason } : entry);
    }
    runtimeEvidence(evidence) {
        this.runtime.push(evidence);
        this.runtimeLedger = appendRuntimeEvidence(this.runtimeLedger, {
            evidence_id: `runtime:${evidence.kind}`,
            evidence_type: evidence.kind,
            status: evidence.complete
                ? "PASS"
                : evidence.status === "BLOCKED"
                    ? "BLOCKED"
                    : "NOT_VERIFIED",
            revision: this.revision,
            artifact_paths: evidence.artifacts.map((artifact) => typeof artifact === "string" ? artifact : artifact.path),
            hashes: evidence.artifacts.flatMap((artifact) => typeof artifact === "string" ? [] : [artifact.sha256]),
            artifacts: evidence.artifacts.flatMap((artifact) => typeof artifact === "string" ? [] : [artifact]),
            limitations: evidence.complete
                ? [...evidence.limitations]
                : [
                    ...evidence.limitations,
                    `Rendered capture reported ${evidence.status}; rendered-state criteria remain unproven.`
                ]
        });
    }
    /** Typed ledgers for the trailing `ledgers` argument of `createReport`. */
    ledgers() {
        return {
            planned_checks: this.plannedChecks,
            runtime_evidence: this.runtimeLedger,
            tools: this.toolLedger
        };
    }
    /**
     * Renders the ledger as findings for the current schema.
     *
     * Executed commands that failed become `FAIL`. Everything that did not run becomes
     * `NOT_VERIFIED`, with the precise cause in the evidence line.
     *
     * `NOT_VERIFIED` rather than `BLOCKED` is deliberate. In this schema `BLOCKED` marks a defect
     * whose remediation is obstructed, so `forge fix` treats it as a fix candidate; a check that was
     * never authorized is not a defect and must not enter the fix pipeline. Deselected checks are
     * summarized in one finding rather than one per check, because an operator's own `--skip-check`
     * is a scope statement.
     */
    findings() {
        const findings = [];
        const deselected = this.notRun.filter((entry) => entry.cause === "deselected");
        const refused = this.notRun.filter((entry) => entry.cause !== "deselected");
        for (const [index, entry] of refused.entries()) {
            findings.push({
                id: `FF-AUDIT-CHECK-${String(101 + index).padStart(3, "0")}`,
                section: "all",
                title: `Planned check '${entry.check.id}' did not run`,
                severity: "INFO",
                confidence: "HIGH",
                status: "NOT_VERIFIED",
                location: [{ path: ".forge/report.json" }],
                evidence: [
                    `check=${entry.check.id}; kind=${entry.check.kind}; cause=${entry.cause}; reason=${entry.reason}`
                ],
                impact: "Criteria that depend on this check are unproven and must not be represented as passing.",
                recommendation: entry.cause === "unauthorized"
                    ? "Review the command definition and re-run the audit with --allow-run to authorize it."
                    : entry.cause === "offline-policy"
                        ? "Re-run the audit without --offline on a machine where the network access is acceptable."
                        : "Make the required evidence available and repeat the audit.",
                safe_fix: false,
                verification: [`Re-run the audit and confirm '${entry.check.id}' reports EXECUTED.`],
                standards: ["Fullstack Forge evidence protocol"]
            });
        }
        for (const [index, entry] of this.execution.entries()) {
            if (entry.exitCode === 0)
                continue;
            findings.push({
                id: `FF-AUDIT-COMMAND-${String(101 + index).padStart(3, "0")}`,
                section: "all",
                title: `Authorized project command failed: ${entry.command.join(" ")}`,
                severity: "HIGH",
                confidence: "HIGH",
                status: "FAIL",
                location: [{ path: "package.json" }],
                evidence: [`exit ${entry.exitCode}: ${compact(entry.output)}`],
                impact: "A project-native check the audit was authorized to run reports a failure.",
                recommendation: "Resolve the failure reported by the command and repeat the audit.",
                safe_fix: false,
                verification: [`Re-run \`${entry.command.join(" ")}\` and confirm exit 0.`],
                standards: ["Fullstack Forge evidence protocol"]
            });
        }
        if (deselected.length > 0) {
            findings.push({
                id: "FF-AUDIT-SCOPE-001",
                section: "all",
                title: `${deselected.length} planned check(s) were excluded from this audit`,
                severity: "INFO",
                confidence: "HIGH",
                status: "NOT_VERIFIED",
                location: [{ path: ".forge/report.json" }],
                evidence: deselected.map((entry) => `${entry.check.id}: ${entry.reason}`),
                impact: "Excluded checks contribute no evidence to this report.",
                recommendation: "Re-run without the exclusion to obtain evidence for these checks.",
                safe_fix: false,
                verification: ["Re-run the audit with the excluded checks selected."],
                standards: ["Fullstack Forge evidence protocol"]
            });
        }
        return findings;
    }
    /** Residual-risk lines describing what this audit did and did not prove at runtime. */
    residualRisk() {
        const lines = [];
        for (const evidence of this.runtime) {
            lines.push(`Runtime evidence (${evidence.kind}) status ${evidence.status}: ${evidence.complete
                ? "captured completely"
                : "incomplete, so rendered-state criteria remain NOT_VERIFIED"}.`);
            lines.push(...evidence.limitations);
        }
        if (this.execution.length === 0)
            lines.push("No project command was executed, so project-native check results are absent.");
        return lines;
    }
}
function compact(value) {
    const compacted = value.replace(/\s+/gu, " ").trim();
    return compacted.length > 240 ? `${compacted.slice(0, 237)}...` : compacted || "no output";
}
/** Repository-relative default location for orchestration-collected runtime evidence. */
export function defaultEvidenceDirectory() {
    return join(".forge", "evidence");
}
