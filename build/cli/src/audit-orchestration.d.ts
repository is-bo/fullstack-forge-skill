import type { ModuleSlug } from "./constants.js";
import type { ExecutionRecord } from "./report.js";
import { type EvidenceArtifact } from "./evidence-envelope.js";
import { type PolicyContext } from "./offline-policy.js";
import type { CommandDefinition, Finding, NetworkPolicy, PlannedCheck as LedgerPlannedCheck, RuntimeEvidence, ToolRecord } from "./types.js";
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
export declare const CANDIDATE_PROJECT_CHECKS: readonly ["format:check", "lint", "typecheck", "test", "build", "scan:secrets", "audit:dependencies", "check:licenses"];
export type CheckKind = "module-inspection" | "project-command" | "runtime-evidence";
/** A single unit of audit work, named before anything is executed. */
export type PlannedAuditCheck = {
    /** Stable identity used by `--check` and `--skip-check`; also the ledger key. */
    id: string;
    kind: CheckKind;
    name: string;
    description: string;
    /** True when the check may only run under explicit `--allow-run`. */
    requires_authorization: boolean;
    /**
     * Report-vocabulary network policy, obtained exclusively through
     * {@link plannedCheckNetworkPolicy}. Anything other than `OFFLINE_SAFE` is refused under
     * `--offline`.
     */
    network_policy: NetworkPolicy;
    /** Module attributed in the planned-check ledger. */
    module: string;
};
export type CheckOutcomeStatus = "EXECUTED" | "NOT_RUN";
export type CheckOutcome = {
    id: string;
    kind: CheckKind;
    status: CheckOutcomeStatus;
    exit_code?: number;
    /** Populated for every `NOT_RUN` outcome. A not-run check without a reason is a bug. */
    reason?: string;
    cause?: BlockedCause;
};
/**
 * Why a planned check did not run. These are distinct because they mean different things to a
 * reader: `unauthorized` and `offline-policy` are deliberate refusals by this tool, `deselected` is
 * the operator's own choice, and `unavailable`/`failed-closed` mean the evidence genuinely could not
 * be produced.
 */
export type BlockedCause = "unauthorized" | "offline-policy" | "deselected" | "unavailable" | "failed-closed";
export type RuntimeEvidenceRecord = {
    kind: "rendered-ui";
    status: string;
    /** Already redacted by the producing tool; never a raw URL. */
    url?: string;
    evidence_dir?: string;
    /** Collectors may provide legacy paths or captured path/hash/media-type tuples. */
    artifacts: Array<string | EvidenceArtifact>;
    limitations: string[];
    complete: boolean;
};
/**
 * Ledger boundary between orchestration and the report schema.
 *
 * Orchestration never writes report fields directly: it emits four kinds of fact and lets the sink
 * decide how to persist them. {@link ReportAuditLedger} is the shipped implementation writing the
 * v0.1.8 typed ledgers; the boundary remains so that orchestration logic stays independent of
 * schema evolution.
 */
export interface AuditLedgerSink {
    /** Called once per planned check, in deterministic order, before anything executes. */
    planCheck(check: PlannedAuditCheck): void;
    /** Called when a check ran to completion, with its execution record. */
    executed(check: PlannedAuditCheck, record: ExecutionRecord): void;
    /** Called when a planned check did not run, with the reason and its cause. */
    blocked(check: PlannedAuditCheck, reason: string, cause: BlockedCause): void;
    /** Called when runtime (non-static) evidence was collected or attempted. */
    runtimeEvidence(evidence: RuntimeEvidenceRecord): void;
}
export type CommandRunner = (command: CommandDefinition, root: string) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}>;
export type RuntimeEvidenceCollector = (input: {
    root: string;
    url: string;
    offline: boolean;
    allowRun: boolean;
    evidenceDir?: string;
}) => Promise<RuntimeEvidenceRecord>;
export type AuditOrchestrationInput = {
    root: string;
    /** Modules already selected by applicability and scope filtering. */
    modules: ModuleSlug[];
    commands: CommandDefinition[];
    allowRun: boolean;
    offline: boolean;
    dryRun: boolean;
    /** True only when the audited root is the Fullstack Forge package root itself. */
    forgeOwned?: boolean;
    url?: string;
    evidenceDir?: string;
    /** `--check`: when present, only these planned checks are eligible to run. */
    select?: string[];
    /** `--skip-check`: never run these, whatever else was selected. */
    skip?: string[];
    ledger: AuditLedgerSink;
    runCommand?: CommandRunner;
    collectRuntimeEvidence?: RuntimeEvidenceCollector;
};
export type AuditOrchestrationResult = {
    planned: PlannedAuditCheck[];
    outcomes: CheckOutcome[];
    execution: ExecutionRecord[];
    runtime_evidence: RuntimeEvidenceRecord[];
    /**
     * False when evidence was explicitly requested but could not be produced. Callers translate this
     * into a non-zero exit code so a run that silently proved nothing cannot look like a success.
     */
    evidence_complete: boolean;
};
/**
 * Builds the deterministic planned-check list.
 *
 * Determinism matters beyond tidiness: the planned list is reported evidence, so two audits of the
 * same checkout must produce byte-identical plans regardless of filesystem ordering. Modules are
 * sorted, commands follow the fixed allowlist order, and runtime evidence is always last.
 */
export declare function buildAuditPlan(input: {
    modules: ModuleSlug[];
    commands: CommandDefinition[];
    url?: string;
    /** Command-policy context. Defaults to the safe assumption: not Forge-owned. */
    policy?: PolicyContext;
}): PlannedAuditCheck[];
export declare function isNetworkDependent(command: CommandDefinition): boolean;
/**
 * Report-vocabulary network policy for a detected project command.
 *
 * The only route into `OFFLINE_SAFE` is {@link plannedCheckNetworkPolicy} applied to a structural
 * exemption proven by {@link classifyCommandNetworkPolicy}. Keyword scanning is applied afterwards
 * and can only escalate `UNKNOWN` to `NETWORK_REQUIRED`; it can never downgrade anything. An
 * arbitrary audited-project script with no network keywords therefore remains `UNKNOWN`.
 */
export declare function commandNetworkPolicy(command: CommandDefinition, context: PolicyContext): NetworkPolicy;
/**
 * Runs the audit lifecycle: plan, authorize, execute, record.
 *
 * Every planned check reaches exactly one of `executed` or `blocked` on the ledger. There is no path
 * on which a check is planned and then silently forgotten.
 */
export declare function orchestrateAudit(input: AuditOrchestrationInput): Promise<AuditOrchestrationResult>;
/**
 * Ledger implementation writing into the v0.1.8 report schema.
 *
 * Orchestration emits four kinds of fact; this class turns them into the typed `planned_checks`,
 * `runtime_evidence`, and `tools` ledgers using the append-only `cli/src/ledger.ts` API. Every
 * append is validated and order-stable, and the API itself refuses to rewrite a blocked or
 * unverified result as passing — so the honesty invariant is enforced by the ledger rather than by
 * this caller remembering to be careful.
 */
export declare class ReportAuditLedger implements AuditLedgerSink {
    private readonly revision;
    readonly planned: PlannedAuditCheck[];
    readonly execution: ExecutionRecord[];
    readonly runtime: RuntimeEvidenceRecord[];
    private readonly notRun;
    private plannedChecks;
    private runtimeLedger;
    private toolLedger;
    constructor(revision?: string);
    planCheck(check: PlannedAuditCheck): void;
    executed(check: PlannedAuditCheck, entry: ExecutionRecord): void;
    blocked(check: PlannedAuditCheck, reason: string, cause: BlockedCause): void;
    runtimeEvidence(evidence: RuntimeEvidenceRecord): void;
    /** Typed ledgers for the trailing `ledgers` argument of `createReport`. */
    ledgers(): {
        planned_checks: LedgerPlannedCheck[];
        runtime_evidence: RuntimeEvidence[];
        tools: ToolRecord[];
    };
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
    findings(): Finding[];
    /** Residual-risk lines describing what this audit did and did not prove at runtime. */
    residualRisk(): string[];
}
/** Repository-relative default location for orchestration-collected runtime evidence. */
export declare function defaultEvidenceDirectory(): string;
