import { join } from "node:path";
import { runNamedAnalyzer } from "./analyzers.js";
import { detectProjectCommands } from "./discovery.js";
import {
  createReport,
  readReport,
  writeReport,
  type AuditReport,
  type ExecutionRecord
} from "./report.js";
import type { Finding, ProjectProfile, Status, VerificationAction } from "./types.js";
import {
  canonicalDirectory,
  readTextIfPresent,
  resolveInside,
  runFile,
  utcNow,
  workingTreeRevision
} from "./utils.js";

export type VerificationResult = {
  report: AuditReport;
  report_paths: string[];
};

export async function verifyFindings(
  rootInput: string,
  section: string,
  profile: ProjectProfile,
  options: { allowRun: boolean; dryRun: boolean }
): Promise<VerificationResult> {
  const root = await canonicalDirectory(rootInput);
  const previous = await readReport(root, join(root, ".forge", "report.json"));
  if ((await canonicalDirectory(previous.root)) !== root)
    throw new Error("The previous report root does not match the selected repository root.");
  const commands = await detectProjectCommands(root);
  const execution: ExecutionRecord[] = [];
  const findings: Finding[] = [];
  for (const original of previous.findings) {
    if (section !== "all" && original.section !== section) {
      findings.push(structuredClone(original));
      continue;
    }
    const finding = structuredClone(original);
    const actions = finding.verification_plan?.actions ?? [];
    if (actions.length === 0) {
      if (finding.status === "FAIL" || finding.status === "WARNING") {
        finding.status = "NOT_VERIFIED";
        finding.evidence.push(
          `${utcNow()}: no finding-specific executable verification plan was recorded; the original evidence remains preserved.`
        );
      }
      findings.push(finding);
      continue;
    }
    const statuses: Status[] = [];
    for (const action of actions) {
      statuses.push(await executeAction(action, finding, root, commands, options, execution));
    }
    finding.status = combineStatuses(statuses);
    findings.push(finding);
  }
  const report = createReport(
    root,
    profile,
    findings,
    `finding-specific verify ${section}`,
    execution,
    previous.assumptions,
    previous.residual_risk,
    previous.scope_evidence,
    previous.gate_evidence,
    previous.analyzer_coverage,
    await workingTreeRevision(root)
  );
  const reportPaths = options.dryRun ? [] : await writeReport(report);
  return { report, report_paths: reportPaths };
}

async function executeAction(
  action: VerificationAction,
  finding: Finding,
  root: string,
  commands: Awaited<ReturnType<typeof detectProjectCommands>>,
  options: { allowRun: boolean; dryRun: boolean },
  execution: ExecutionRecord[]
): Promise<Status> {
  const { allowRun, dryRun } = options;
  if (action.type === "analyzer") {
    // Re-analysis is scoped to the paths the original evidence came from, so an unrelated
    // occurrence of the same rule elsewhere cannot re-fail a resolved instance.
    const scopePaths =
      action.scope_paths ??
      finding.evidence_snapshot?.map((snapshot) => snapshot.path) ??
      finding.location.map((location) => location.path);
    const run =
      scopePaths.length > 0
        ? await runNamedAnalyzer(action.analyzer_id, root, new Set(scopePaths))
        : await runNamedAnalyzer(action.analyzer_id, root);
    const reproduced = run.findings.find((candidate) =>
      action.instance_id === undefined
        ? candidate.id === action.finding_id
        : candidate.instance_id === action.instance_id
    );
    if (reproduced !== undefined) {
      finding.evidence.push(
        `${utcNow()}: ${action.analyzer_id} reproduced ${action.finding_id}: ${reproduced.evidence.join("; ")}`
      );
      return "FAIL";
    }
    if (run.supported_files === 0) {
      finding.evidence.push(
        `${utcNow()}: ${action.analyzer_id} had no supported files; verification could not run.`
      );
      return "NOT_VERIFIED";
    }
    if (action.absence_proves_resolution) {
      const targets =
        finding.evidence_snapshot?.map((snapshot) => snapshot.path) ??
        finding.location.map((location) => location.path);
      const targetStates = await Promise.all(
        targets.map((path) => readTextIfPresent(resolveInside(root, path)))
      );
      if (targetStates.some((content) => content === undefined)) {
        finding.evidence.push(
          `${utcNow()}: the original target disappeared, so structural absence was not treated as PASS.`
        );
        return "NOT_VERIFIED";
      }
      finding.evidence.push(
        `${utcNow()}: ${action.analyzer_id} parsed ${run.supported_files} supported file(s) and directly confirmed that the exact structural condition no longer exists.`
      );
      return "PASS";
    }
    finding.evidence.push(
      `${utcNow()}: ${action.analyzer_id} did not reproduce the pattern, but disappearance alone is not behavior-level proof.`
    );
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
    finding.evidence.push(
      `${utcNow()}: project command '${action.command}' requires explicit --allow-run after review.`
    );
    return "BLOCKED";
  }
  if (dryRun) {
    // A dry run must never execute anything, even when execution is authorized. It reports the
    // command that would have run and leaves the finding unverified.
    finding.evidence.push(
      `${utcNow()}: dry run planned '${command.executable} ${command.args.join(" ")}' but executed nothing.`
    );
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
  finding.evidence.push(
    `${utcNow()}: ${command.executable} ${command.args.join(" ")} exited ${result.exitCode} after ${duration} ms.`
  );
  return result.exitCode === 0 ? "PASS" : "FAIL";
}

function combineStatuses(statuses: Status[]): Status {
  const precedence: Status[] = [
    "FAIL",
    "BLOCKED",
    "NOT_VERIFIED",
    "WARNING",
    "PASS",
    "NOT_APPLICABLE"
  ];
  return precedence.find((status) => statuses.includes(status)) ?? "NOT_VERIFIED";
}
