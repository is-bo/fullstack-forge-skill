import { join } from "node:path";
import { runNamedAnalyzer } from "./analyzers.js";
import { detectProjectCommands } from "./discovery.js";
import { inventoryLimitationFinding } from "./inventory-evidence.js";
import { createReport, readReport, writeReport } from "./report.js";
import { canonicalDirectory, readTextIfPresent, resolveInside, runFile, utcNow, workingTreeRevision } from "./utils.js";
export async function verifyFindings(rootInput, section, profile, options) {
    const root = await canonicalDirectory(rootInput);
    const previous = await readReport(root, join(root, ".forge", "report.json"));
    if ((await canonicalDirectory(previous.root)) !== root)
        throw new Error("The previous report root does not match the selected repository root.");
    const revision = await workingTreeRevision(root, options.inventory);
    const previousRevision = previous.revision;
    const revisionChanged = previousRevision === undefined || previousRevision !== revision;
    const commands = await detectProjectCommands(root);
    const execution = [];
    const findings = [];
    for (const original of previous.findings) {
        if (section !== "all" && original.section !== section) {
            const finding = structuredClone(original);
            if (revisionChanged)
                markStale(finding, previousRevision, revision);
            findings.push(finding);
            continue;
        }
        const finding = structuredClone(original);
        const actions = finding.verification_plan?.actions ?? [];
        if (actions.length === 0) {
            if (revisionChanged || finding.status === "FAIL" || finding.status === "WARNING") {
                const originalStatus = finding.status;
                finding.status = "NOT_VERIFIED";
                finding.evidence.push(revisionChanged
                    ? `${utcNow()}: prior status ${originalStatus} came from revision ${previousRevision ?? "legacy/unrecorded"}; current revision ${revision} differs and no finding-specific executable verification plan was recorded.`
                    : `${utcNow()}: no finding-specific executable verification plan was recorded; the original evidence remains preserved.`);
            }
            findings.push(finding);
            continue;
        }
        const statuses = [];
        for (const action of actions) {
            statuses.push(await executeAction(action, finding, root, commands, options, execution));
        }
        finding.status = combineStatuses(statuses);
        findings.push(finding);
    }
    const inventoryLimitation = inventoryLimitationFinding(profile, section);
    if (inventoryLimitation !== undefined)
        findings.push(inventoryLimitation);
    const report = createReport(root, profile, findings, `finding-specific verify ${section}`, execution, previous.assumptions, [
        ...previous.residual_risk,
        ...(revisionChanged
            ? [
                `The previous report revision (${previousRevision ?? "legacy/unrecorded"}) differs from the verified working-tree revision (${revision}); findings not directly rechecked were demoted to NOT_VERIFIED.`
            ]
            : [])
    ], revisionChanged ? undefined : previous.scope_evidence, revisionChanged
        ? previous.gate_evidence.map((evidence) => markGateEvidenceStale(evidence, previousRevision, revision))
        : previous.gate_evidence, previous.analyzer_coverage, revision);
    const reportPaths = options.dryRun ? [] : await writeReport(report);
    return { report, report_paths: reportPaths };
}
function markStale(finding, previousRevision, revision) {
    const originalStatus = finding.status;
    finding.status = "NOT_VERIFIED";
    finding.evidence.push(`${utcNow()}: prior status ${originalStatus} came from revision ${previousRevision ?? "legacy/unrecorded"}; section-specific Verify did not recheck it at current revision ${revision}.`);
}
function markGateEvidenceStale(evidence, previousRevision, revision) {
    const stale = {
        ...structuredClone(evidence),
        status: "NOT_VERIFIED",
        absence_proves_success: false,
        limitations: [
            ...evidence.limitations,
            `Prior status ${evidence.status} came from report revision ${previousRevision ?? "legacy/unrecorded"}; Verify did not reproduce this gate evidence at current revision ${revision}.`
        ]
    };
    delete stale.envelope;
    return stale;
}
async function executeAction(action, finding, root, commands, options, execution) {
    const { allowRun, dryRun } = options;
    if (action.type === "analyzer") {
        // Re-analysis is scoped to the paths the original evidence came from, so an unrelated
        // occurrence of the same rule elsewhere cannot re-fail a resolved instance.
        const scopePaths = action.scope_paths ??
            finding.evidence_snapshot?.map((snapshot) => snapshot.path) ??
            finding.location.map((location) => location.path);
        const run = scopePaths.length > 0
            ? await runNamedAnalyzer(action.analyzer_id, root, new Set(scopePaths))
            : await runNamedAnalyzer(action.analyzer_id, root);
        const reproduced = run.findings.find((candidate) => action.instance_id === undefined
            ? candidate.id === action.finding_id
            : candidate.instance_id === action.instance_id);
        if (reproduced !== undefined) {
            finding.evidence.push(`${utcNow()}: ${action.analyzer_id} reproduced ${action.finding_id}: ${reproduced.evidence.join("; ")}`);
            return "FAIL";
        }
        if (run.supported_files === 0) {
            finding.evidence.push(`${utcNow()}: ${action.analyzer_id} had no supported files; verification could not run.`);
            return "NOT_VERIFIED";
        }
        if (action.absence_proves_resolution) {
            const targets = finding.evidence_snapshot?.map((snapshot) => snapshot.path) ??
                finding.location.map((location) => location.path);
            const targetStates = await Promise.all(targets.map((path) => readTextIfPresent(resolveInside(root, path))));
            if (targetStates.some((content) => content === undefined)) {
                finding.evidence.push(`${utcNow()}: the original target disappeared, so structural absence was not treated as PASS.`);
                return "NOT_VERIFIED";
            }
            finding.evidence.push(`${utcNow()}: ${action.analyzer_id} parsed ${run.supported_files} supported file(s) and directly confirmed that the exact structural condition no longer exists.`);
            return "PASS";
        }
        finding.evidence.push(`${utcNow()}: ${action.analyzer_id} did not reproduce the pattern, but disappearance alone is not behavior-level proof.`);
        return "NOT_VERIFIED";
    }
    if (action.type === "manual") {
        finding.evidence.push(`${utcNow()}: manual verification remains required: ${action.procedure}`);
        return "NOT_VERIFIED";
    }
    const command = commands.find((candidate) => candidate.name === action.command);
    if (command === undefined) {
        finding.evidence.push(`${utcNow()}: project command '${action.command}' was not detected.`);
        return action.required ? "BLOCKED" : "NOT_VERIFIED";
    }
    if (!allowRun) {
        finding.evidence.push(`${utcNow()}: project command '${action.command}' requires explicit --allow-run after review.`);
        return "BLOCKED";
    }
    if (dryRun) {
        // A dry run must never execute anything, even when execution is authorized. It reports the
        // command that would have run and leaves the finding unverified.
        finding.evidence.push(`${utcNow()}: dry run planned '${command.executable} ${command.args.join(" ")}' but executed nothing.`);
        return "NOT_VERIFIED";
    }
    const started = Date.now();
    const startedAt = utcNow();
    const result = await runFile(command.executable, command.args, root, 10 * 60_000);
    const duration = Date.now() - started;
    execution.push({
        command: [command.executable, ...command.args],
        exitCode: result.exitCode,
        output: `${result.stdout}\n${result.stderr}`.trim(),
        started_at: startedAt,
        duration_ms: duration
    });
    finding.evidence.push(`${utcNow()}: ${command.executable} ${command.args.join(" ")} exited ${result.exitCode} after ${duration} ms.`);
    return result.exitCode === 0 ? "PASS" : "FAIL";
}
function combineStatuses(statuses) {
    const precedence = [
        "FAIL",
        "BLOCKED",
        "NOT_VERIFIED",
        "WARNING",
        "PASS",
        "NOT_APPLICABLE"
    ];
    return precedence.find((status) => statuses.includes(status)) ?? "NOT_VERIFIED";
}
//# sourceMappingURL=verification.js.map