import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { join } from "node:path";
import type { ChangedScopeEvidence } from "./scope.js";
import {
  GATE_EVIDENCE_TYPES,
  SEVERITIES,
  STATUSES,
  type AnalyzerCoverage,
  type Confidence,
  type Finding,
  type GateEvidence,
  type ModuleDecision,
  type PlannedCheck,
  type ProjectProfile,
  type RuntimeEvidence,
  type Severity,
  type Status,
  type ToolRecord
} from "./types.js";
import {
  assertModuleDecisions,
  assertPlannedChecks,
  assertRuntimeEvidence,
  assertToolRecords
} from "./ledger.js";
import { assertFindings } from "./finding.js";
import { assertEvidenceArtifacts } from "./evidence-envelope.js";
import { assertNoSymlinkPath, utcNow } from "./utils.js";
import type { CompositionResult } from "./composition.js";

export const REPORT_SCHEMA_VERSION = 3;

export type ExecutionRecord = {
  command: string[];
  exitCode: number;
  output: string;
  started_at?: string;
  duration_ms?: number;
};

/**
 * Reproducibility record for the machine and mode that produced a report.
 *
 * Versions are only ever observed, never inferred: anything unavailable is omitted rather than
 * guessed, so a missing field means "not determined" and never "assumed current".
 */
export type ReportEnvironment = {
  operating_system: string;
  platform: string;
  architecture: string;
  node: string;
  forge: string;
  offline: boolean;
  allow_run: boolean;
  inspection_budget_bytes?: number;
  inventory_exclusions?: string[];
};

/**
 * Provenance of a report that was read from an older schema.
 *
 * The migration only ever states what was absent. It never back-fills a ledger, because a
 * legacy report that recorded no planned checks is evidence that planning was not tracked, not
 * evidence that every check ran.
 */
export type ReportMigration = {
  from_schema_version: number;
  to_schema_version: typeof REPORT_SCHEMA_VERSION;
  /** Best-effort classification of the writing release, always labelled as an inference. */
  detected_origin: string;
  absent_ledgers: string[];
  notes: string[];
};

/* -------------------------------------------------------------------------- */
/* Status-aware finding aggregation                                            */
/* -------------------------------------------------------------------------- */

/**
 * Verdict classes. Severity in this schema is *potential impact* (`docs/FINDING_SCHEMA.md`), not a
 * verdict, so severity alone never says whether anything was proven. Status carries the verdict,
 * and any count that mixes the two is unreadable: an analyzer may legitimately record CRITICAL
 * potential impact with LOW confidence and `NOT_VERIFIED` status, and a severity-only rollup then
 * reports that unproven possibility as a confirmed critical defect.
 *
 * These classes keep the two axes separate. Nothing here changes a finding's status, severity, or
 * confidence, and nothing here relaxes a gate — an unverified critical still blocks release in
 * `gates.ts`. It only stops presentation from asserting more than the evidence supports.
 */
export const FINDING_STATUS_CLASSES = [
  "confirmed",
  "evidence_gap",
  "passed",
  "not_applicable",
  "superseded"
] as const;
export type FindingStatusClass = (typeof FINDING_STATUS_CLASSES)[number];

const STATUS_CLASS: Record<Status, FindingStatusClass> = {
  FAIL: "confirmed",
  WARNING: "confirmed",
  NOT_VERIFIED: "evidence_gap",
  BLOCKED: "evidence_gap",
  PASS: "passed",
  NOT_APPLICABLE: "not_applicable",
  SUPERSEDED: "superseded"
};

const STATUS_CLASS_MEANING: Record<FindingStatusClass, string> = {
  confirmed: "a defect was demonstrated (FAIL, WARNING)",
  evidence_gap:
    "potential impact recorded, verdict not established (NOT_VERIFIED, BLOCKED); never a confirmed defect",
  passed: "checked and clean (PASS)",
  not_applicable: "outside the audited capability (NOT_APPLICABLE)",
  superseded: "retracted history, not an active verdict (SUPERSEDED)"
};

export type SeverityCounts = Record<Severity, number>;
export type ConfidenceCounts = Record<Confidence, number>;

export type StatusClassSummary = {
  total: number;
  /** The exact statuses folded into this class, with their own counts. */
  by_status: Partial<Record<Status, number>>;
  /** Potential impact within this class only. Never comparable across classes. */
  by_severity: SeverityCounts;
  by_confidence: ConfidenceCounts;
};

export type FindingSummary = {
  total: number;
  by_status: Partial<Record<Status, number>>;
  /**
   * Severity is only ever reported inside a verdict class. There is deliberately no top-level
   * `by_severity`: publishing one would reintroduce exactly the number this aggregation exists to
   * prevent, and any consumer reading it would have no way to tell proven from unproven.
   */
  by_class: Record<FindingStatusClass, StatusClassSummary>;
  /** The count a defect total may quote: demonstrated defects only. */
  confirmed_defects: number;
  /** Confirmed critical and high defects. Excludes every NOT_VERIFIED and BLOCKED finding. */
  confirmed_critical: number;
  confirmed_high: number;
  /**
   * Unproven findings whose *potential* impact is critical or high. These block a release through
   * the Ship gate exactly as before; they are counted here so a reader sees them without them being
   * added to the confirmed totals.
   */
  unverified_critical_or_high: number;
};

function emptySeverityCounts(): SeverityCounts {
  return Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as SeverityCounts;
}

function emptyClassSummary(): StatusClassSummary {
  return {
    total: 0,
    by_status: {},
    by_severity: emptySeverityCounts(),
    by_confidence: { HIGH: 0, MEDIUM: 0, LOW: 0 }
  };
}

/**
 * Aggregates findings on both axes at once.
 *
 * Every number this returns is derived from the findings passed in, so it can be recomputed at any
 * time and can never drift from the finding list it describes. A status the schema does not know is
 * counted as an evidence gap rather than silently dropped, because an unrecognised verdict is
 * precisely the case that must not be read as "clean".
 */
export function summarizeFindings(findings: readonly Finding[]): FindingSummary {
  const byClass = Object.fromEntries(
    FINDING_STATUS_CLASSES.map((name) => [name, emptyClassSummary()])
  ) as Record<FindingStatusClass, StatusClassSummary>;
  const byStatus: Partial<Record<Status, number>> = {};
  for (const finding of findings) {
    const status: Status = STATUSES.includes(finding.status) ? finding.status : "NOT_VERIFIED";
    const bucket = byClass[STATUS_CLASS[status]];
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    bucket.total += 1;
    bucket.by_status[status] = (bucket.by_status[status] ?? 0) + 1;
    if (SEVERITIES.includes(finding.severity)) bucket.by_severity[finding.severity] += 1;
    if (finding.confidence in bucket.by_confidence) bucket.by_confidence[finding.confidence] += 1;
  }
  const confirmed = byClass.confirmed;
  const gaps = byClass.evidence_gap;
  return {
    total: findings.length,
    by_status: byStatus,
    by_class: byClass,
    confirmed_defects: confirmed.total,
    confirmed_critical: confirmed.by_severity.CRITICAL,
    confirmed_high: confirmed.by_severity.HIGH,
    unverified_critical_or_high: gaps.by_severity.CRITICAL + gaps.by_severity.HIGH
  };
}

/**
 * Returns the report with its summary recomputed from its own findings.
 *
 * Serialization goes through this so the JSON a consumer reads and the Markdown a person reads are
 * derived from the same finding list in the same call, and neither can carry a stale rollup.
 */
export function withFindingSummary(report: AuditReport): AuditReport {
  return { ...report, summary: summarizeFindings(report.findings) };
}

export type ReportLedgers = {
  tools?: ToolRecord[];
  planned_checks?: PlannedCheck[];
  runtime_evidence?: RuntimeEvidence[];
  module_decisions?: ModuleDecision[];
  compositions?: CompositionResult[];
};

export type AuditReport = {
  schema_version: typeof REPORT_SCHEMA_VERSION;
  generated_at: string;
  root: string;
  revision?: string;
  environment?: ReportEnvironment;
  scope: string;
  profile: ProjectProfile;
  findings: Finding[];
  /**
   * Status-aware rollup of `findings`. Always derived, never authored: a reader that buckets
   * `findings` by severity alone counts unproven potential impact as confirmed defects.
   */
  summary?: FindingSummary;
  execution: ExecutionRecord[];
  assumptions: string[];
  residual_risk: string[];
  scope_evidence?: ChangedScopeEvidence;
  gate_evidence: GateEvidence[];
  analyzer_coverage: AnalyzerCoverage[];
  /** Provenance of every tool whose output this report relies on. */
  tools: ToolRecord[];
  /** Checks the run intended to perform, with the outcome of each. */
  planned_checks: PlannedCheck[];
  /** Evidence gathered by observing the running system. */
  runtime_evidence: RuntimeEvidence[];
  /** Why each module was or was not audited, on independent capability and selection axes. */
  module_decisions: ModuleDecision[];
  /** Deterministic provider context selected and suppressed for each audited module. */
  compositions: CompositionResult[];
  migration?: ReportMigration;
};

export async function writeReport(
  report: AuditReport,
  outputDirectory?: string
): Promise<string[]> {
  assertFindings(report.findings);
  const directory = outputDirectory ?? join(report.root, ".forge");
  await assertNoSymlinkPath(report.root, directory);
  await mkdir(directory, { recursive: true });
  const jsonPath = join(directory, "report.json");
  const markdownPath = join(directory, "report.md");
  await assertNoSymlinkPath(report.root, jsonPath);
  await assertNoSymlinkPath(report.root, markdownPath);
  assertReportLedgers(report);
  const published = withFindingSummary(report);
  await writeFile(jsonPath, `${JSON.stringify(published, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(published), "utf8");
  return [jsonPath, markdownPath];
}

/**
 * Reads a report of any supported schema version and returns it in the current schema.
 *
 * Migration happens in memory only. The file on disk is left exactly as written, so reading an
 * old report can never destroy the original evidence; callers that genuinely want to rewrite it
 * must pass the migrated value to `writeReport` themselves.
 */
export async function readReport(root: string, path: string): Promise<AuditReport> {
  await assertNoSymlinkPath(root, path);
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  const migrated = migrateReport(value);
  assertFindings(migrated.findings);
  assertGateEvidence(migrated.gate_evidence);
  assertAnalyzerCoverage(migrated.analyzer_coverage);
  assertReportLedgers(migrated);
  return migrated;
}

/**
 * Upgrades a parsed report to the current schema without inventing data.
 *
 * Identity fields (`generated_at`, `root`, `revision`, `scope`) are preserved verbatim so the
 * migrated report still describes the run that produced it. Every ledger the source lacked is
 * left empty and named in `migration.absent_ledgers`.
 */
export function migrateReport(value: unknown): AuditReport {
  if (!isMigratableReport(value)) throw new Error("Unsupported or invalid Fullstack Forge report");
  const source = value as Record<string, unknown>;
  const from = source.schema_version as number;
  if (from > REPORT_SCHEMA_VERSION)
    throw new Error(
      `Report schema version ${from} is newer than the supported version ${REPORT_SCHEMA_VERSION}.`
    );
  const absent: string[] = [];
  const take = <T>(field: string): T[] => {
    const current = source[field];
    if (Array.isArray(current)) return current as T[];
    absent.push(field);
    return [];
  };
  const gateEvidence = take<GateEvidence>("gate_evidence");
  const analyzerCoverage = take<AnalyzerCoverage>("analyzer_coverage");
  const tools = take<ToolRecord>("tools");
  const plannedChecks = take<PlannedCheck>("planned_checks");
  const runtimeEvidence = take<RuntimeEvidence>("runtime_evidence");
  const moduleDecisions = take<ModuleDecision>("module_decisions");
  const compositions = take<CompositionResult>("compositions");
  const base = source as unknown as AuditReport;
  const migrated: AuditReport = {
    ...base,
    schema_version: REPORT_SCHEMA_VERSION,
    gate_evidence: gateEvidence,
    analyzer_coverage: analyzerCoverage,
    tools,
    planned_checks: plannedChecks,
    runtime_evidence: runtimeEvidence,
    module_decisions: moduleDecisions,
    compositions,
    // Recomputed rather than carried over. A summary written by an older release cannot be trusted
    // to separate verdicts, and it is a pure projection of findings the report already contains, so
    // deriving it invents nothing.
    summary: summarizeFindings(Array.isArray(base.findings) ? base.findings : [])
  };
  const untrustedGateEvidence = gateEvidence.filter((evidence) => evidence.envelope === undefined);
  if (from === REPORT_SCHEMA_VERSION && absent.length === 0 && untrustedGateEvidence.length === 0)
    return migrated;
  migrated.migration = {
    from_schema_version: from,
    to_schema_version: REPORT_SCHEMA_VERSION,
    detected_origin: classifyLegacyOrigin(source),
    absent_ledgers: absent,
    notes: [
      ...(absent.length === 0
        ? []
        : [
            `The source report recorded no ${absent.join(", ")}. These ledgers are empty because the writing release did not track them, which is not evidence that the corresponding checks ran or passed.`
          ]),
      ...(moduleDecisions.length === 0
        ? [
            "Module applicability cannot be reconstructed from this report: it predates the capability and selection axes, so a module absent from its findings may have been inapplicable, unaudited, or out of scope."
          ]
        : []),
      ...(untrustedGateEvidence.length === 0
        ? []
        : [
            `${untrustedGateEvidence.length} typed gate evidence record(s) predate the v0.3 verified evidence envelope. They remain visible as historical diagnostics but cannot satisfy Ship gates.`
          ]),
      "Migration was performed in memory; the source file was not modified."
    ]
  };
  return migrated;
}

/**
 * Classifies which release most likely wrote a legacy report, from the fields it carries.
 *
 * This is stated as an inference in the report text because no release stamped its own version
 * into the schema before the environment record existed.
 *
 * The classification is deliberately no more precise than the evidence allows. v0.1.7 changed
 * offline command policy and analyzer protection, but it did not add, remove, or alter a single
 * report field, so a v0.1.7 report is byte-indistinguishable from a v0.1.6 report at the schema
 * level. Reporting such a report as "v0.1.6" would be a fabricated precision, so both releases are
 * named in one classification rather than guessing between them. The v0.1.7 execution ledger lives
 * in ship results and tool output, not in `AuditReport`, so it cannot be used as a discriminator
 * either.
 */
function classifyLegacyOrigin(source: Record<string, unknown>): string {
  if (source.schema_version === REPORT_SCHEMA_VERSION)
    return `schema ${REPORT_SCHEMA_VERSION} report missing one or more ledgers`;
  if (source.schema_version === 2)
    return "schema 2 report written before composition provenance was recorded";
  const findings = Array.isArray(source.findings) ? (source.findings as Finding[]) : [];
  const hasInstanceIdentity = findings.some(
    (finding) => finding.instance_id !== undefined || finding.evidence_snapshot !== undefined
  );
  if (source.environment !== undefined || source.revision !== undefined)
    return "inferred v0.1.6-or-v0.1.7-compatible schema 1 report (carries an environment or revision record; v0.1.7 changed no report field, so the two releases are not distinguishable from a report alone)";
  if (Array.isArray(source.gate_evidence) || Array.isArray(source.analyzer_coverage))
    return "inferred v0.1.5-compatible schema 1 report (carries typed gate evidence or analyzer coverage)";
  if (hasInstanceIdentity)
    return "inferred v0.1.4-compatible schema 1 report (carries finding instance identity)";
  return "inferred v0.1.3-compatible schema 1 report (no instance identity, typed evidence, or environment record)";
}

function isMigratableReport(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.schema_version === "number" &&
    Number.isInteger(candidate.schema_version) &&
    candidate.schema_version >= 1 &&
    typeof candidate.generated_at === "string" &&
    typeof candidate.root === "string" &&
    typeof candidate.scope === "string" &&
    typeof candidate.profile === "object" &&
    candidate.profile !== null &&
    Array.isArray(candidate.findings) &&
    Array.isArray(candidate.execution) &&
    Array.isArray(candidate.assumptions) &&
    Array.isArray(candidate.residual_risk) &&
    (candidate.gate_evidence === undefined || Array.isArray(candidate.gate_evidence)) &&
    (candidate.analyzer_coverage === undefined || Array.isArray(candidate.analyzer_coverage)) &&
    (candidate.tools === undefined || Array.isArray(candidate.tools)) &&
    (candidate.planned_checks === undefined || Array.isArray(candidate.planned_checks)) &&
    (candidate.runtime_evidence === undefined || Array.isArray(candidate.runtime_evidence)) &&
    (candidate.module_decisions === undefined || Array.isArray(candidate.module_decisions))
  );
}

function assertReportLedgers(report: AuditReport): void {
  assertGateEvidence(report.gate_evidence);
  assertAnalyzerCoverage(report.analyzer_coverage);
  assertToolRecords(report.tools);
  assertPlannedChecks(report.planned_checks);
  assertRuntimeEvidence(report.runtime_evidence);
  assertModuleDecisions(report.module_decisions);
  assertCompositionResults(report.compositions);
}

function assertCompositionResults(results: CompositionResult[]): void {
  if (!Array.isArray(results)) throw new Error("Invalid composition provenance");
  const tiers = new Set(["forge-contract", "primary", "overlay", "supplemental"]);
  for (const result of results) {
    const budget: unknown = result.budget;
    if (
      typeof result.module !== "string" ||
      !Array.isArray(result.selected) ||
      !Array.isArray(result.suppressed) ||
      !Array.isArray(result.missing) ||
      budget === null ||
      typeof budget !== "object"
    )
      throw new Error("Invalid composition provenance");
    if (
      result.workflow !== undefined &&
      !["build", "audit", "fix", "verify", "ship"].includes(result.workflow)
    )
      throw new Error(`Invalid composition workflow for ${result.module}`);
    if (result.eager !== undefined || result.deferred !== undefined) {
      if (!Array.isArray(result.eager) || !Array.isArray(result.deferred))
        throw new Error(`Invalid composition load stages for ${result.module}`);
      const selectedKeys = new Set(
        result.selected.map(
          (source) => `${source.tier}\u0000${source.provider}\u0000${source.skill}`
        )
      );
      for (const source of [...result.eager, ...result.deferred]) {
        const key = `${source.tier}\u0000${source.provider}\u0000${source.skill}`;
        if (!selectedKeys.has(key))
          throw new Error(`Composition load stage is not selected for ${result.module}`);
      }
    }
    for (const source of [...result.selected, ...result.suppressed]) {
      if (
        !tiers.has(source.tier) ||
        typeof source.provider !== "string" ||
        typeof source.skill !== "string" ||
        typeof source.reason !== "string"
      )
        throw new Error(`Invalid composition source for ${result.module}`);
    }
    if (
      result.selected.some((source) => typeof source.runtimePath !== "string") ||
      result.missing.some((path) => typeof path !== "string")
    )
      throw new Error(`Invalid composition runtime paths for ${result.module}`);
  }
}

export function createReport(
  root: string,
  profile: ProjectProfile,
  findings: Finding[],
  scope: string,
  execution: ExecutionRecord[] = [],
  assumptions: string[] = [],
  residualRisk: string[] = [],
  scopeEvidence?: ChangedScopeEvidence,
  gateEvidence: GateEvidence[] = [],
  analyzerCoverage: AnalyzerCoverage[] = [],
  revision?: string,
  environment?: ReportEnvironment,
  ledgers: ReportLedgers = {}
): AuditReport {
  // One logical conclusion per scope: retract synthetic non-applicability before asserting, so a
  // report can never publish both "module does not apply" and a verdict produced by that module.
  const reconciled = reconcileApplicabilityConclusions(findings);
  assertNoContradictoryApplicability(reconciled);
  const sorted = sortFindings(deduplicateFindings(reconciled));
  return {
    schema_version: REPORT_SCHEMA_VERSION,
    generated_at: utcNow(),
    root,
    scope,
    ...(environment === undefined ? {} : { environment }),
    profile,
    findings: sorted,
    summary: summarizeFindings(sorted),
    execution,
    assumptions,
    residual_risk: residualRisk,
    ...(scopeEvidence === undefined ? {} : { scope_evidence: scopeEvidence }),
    gate_evidence: structuredClone(gateEvidence),
    analyzer_coverage: structuredClone(analyzerCoverage),
    tools: structuredClone(ledgers.tools ?? []),
    planned_checks: structuredClone(ledgers.planned_checks ?? []),
    runtime_evidence: structuredClone(ledgers.runtime_evidence ?? []),
    module_decisions: structuredClone(ledgers.module_decisions ?? []),
    compositions: structuredClone(ledgers.compositions ?? []),
    ...(revision === undefined ? {} : { revision })
  };
}

/** True for the synthetic "this module does not apply" finding, whatever produced it. */
function isSyntheticApplicabilityFinding(finding: Finding): boolean {
  return (
    finding.status === "NOT_APPLICABLE" &&
    /module.*not applicable|applicability/iu.test(finding.title)
  );
}

/**
 * True when a finding demonstrates that its module was actually inspected.
 *
 * Any concrete verdict — a defect, a warning, or an explicit coverage limitation — proves the
 * module applied, because a module that does not apply is never analysed.
 */
function provesApplicability(finding: Finding): boolean {
  if (finding.status === "SUPERSEDED") return false;
  return ["FAIL", "WARNING", "NOT_VERIFIED", "PASS", "BLOCKED"].includes(finding.status);
}

/**
 * Retracts a synthetic non-applicability verdict when the same report proves the module applied.
 *
 * This is the report-wide form of the supersession rule already applied to ingested agent
 * findings: for one logical conclusion in one scope there may be exactly one active verdict. The
 * retracted entry is preserved as `SUPERSEDED` so the history stays auditable, and distinct
 * findings that merely share a section are never touched.
 */
function reconcileApplicabilityConclusions(findings: Finding[]): Finding[] {
  const reconciled = findings.map((finding) => structuredClone(finding));
  for (const section of new Set(reconciled.map((finding) => finding.section))) {
    const scoped = reconciled.filter((finding) => finding.section === section);
    const synthetic = scoped.filter(isSyntheticApplicabilityFinding);
    if (synthetic.length === 0) continue;
    const proof = scoped.find(
      (finding) => !isSyntheticApplicabilityFinding(finding) && provesApplicability(finding)
    );
    if (proof === undefined) continue;
    for (const finding of synthetic) {
      finding.status = "SUPERSEDED";
      finding.superseded_by = proof.instance_id ?? proof.id;
      finding.retraction_reason = `The ${section} module was inspected in this run, so a non-applicability verdict cannot remain active.`;
    }
  }
  return reconciled;
}

function assertNoContradictoryApplicability(findings: Finding[]): void {
  const active = findings.filter((finding) => finding.status !== "SUPERSEDED");
  for (const section of new Set(active.map((finding) => finding.section))) {
    const scoped = active.filter((finding) => finding.section === section);
    if (
      scoped.some(isSyntheticApplicabilityFinding) &&
      scoped.some(
        (finding) => !isSyntheticApplicabilityFinding(finding) && provesApplicability(finding)
      )
    )
      throw new Error(
        `Contradictory active applicability conclusions for '${section}'; supersede the weaker finding before reporting.`
      );
  }
}

/**
 * Captures only directly observable facts about the current process. `forge` reads the packaged
 * version; when it cannot be read the field reports `unknown` rather than a plausible value.
 */
export function captureEnvironment(options: {
  offline: boolean;
  allowRun: boolean;
  version: string;
  inspectionBudgetBytes?: number;
  excludes?: readonly string[];
}): ReportEnvironment {
  return {
    operating_system: `${platform()} ${release()}`,
    platform: platform(),
    architecture: arch(),
    node: process.versions.node,
    forge: options.version,
    offline: options.offline,
    allow_run: options.allowRun,
    ...(options.inspectionBudgetBytes === undefined
      ? {}
      : { inspection_budget_bytes: options.inspectionBudgetBytes }),
    ...(options.excludes === undefined || options.excludes.length === 0
      ? {}
      : { inventory_exclusions: [...options.excludes] })
  };
}

/** Legacy reports carry no environment record; that absence is stated, never back-filled. */
function renderEnvironment(environment: ReportEnvironment | undefined): string {
  if (environment === undefined) return "- Not recorded (report predates the environment ledger).";
  return [
    `- Operating system: ${environment.operating_system}`,
    `- Platform/architecture: ${environment.platform}/${environment.architecture}`,
    `- Node: ${environment.node}`,
    `- Fullstack Forge: ${environment.forge}`,
    `- Offline mode: ${environment.offline ? "enabled" : "disabled"}`,
    `- Project-command execution authorized: ${environment.allow_run ? "yes" : "no"}`,
    ...(environment.inspection_budget_bytes === undefined
      ? []
      : [`- Repository text-inspection budget: ${environment.inspection_budget_bytes} bytes`]),
    ...(environment.inventory_exclusions === undefined
      ? []
      : [`- Repository exclusions: ${environment.inventory_exclusions.join(", ")}`])
  ].join("\n");
}

export function renderMarkdown(report: AuditReport): string {
  const counts = new Map<string, number>();
  for (const finding of report.findings)
    counts.set(finding.status, (counts.get(finding.status) ?? 0) + 1);
  const summary =
    [...counts.entries()].map(([status, count]) => `- ${status}: ${count}`).join("\n") ||
    "- No findings were recorded.";
  const verdictSummary = renderVerdictSummary(summarizeFindings(report.findings));
  const activeFindings = report.findings.filter((finding) => finding.status !== "SUPERSEDED");
  const supersededFindings = report.findings.filter((finding) => finding.status === "SUPERSEDED");
  const findings =
    activeFindings.map(renderFinding).join("\n\n") ||
    "No findings were recorded. This is not evidence of a pass.";
  const superseded =
    supersededFindings.map(renderFinding).join("\n\n") || "No superseded findings were recorded.";
  const execution = report.execution
    .map((record) => {
      const timing = [
        record.started_at === undefined ? undefined : `started ${record.started_at}`,
        record.duration_ms === undefined ? undefined : `${record.duration_ms} ms`
      ]
        .filter((value): value is string => value !== undefined)
        .join(", ");
      return `- \`${record.command.join(" ")}\` → exit ${record.exitCode}${timing.length === 0 ? "" : ` (${timing})`}: ${compact(record.output)}`;
    })
    .join("\n");
  const assumptions =
    report.assumptions.map((value) => `- ${value}`).join("\n") || "- None recorded.";
  const residual =
    report.residual_risk.map((value) => `- ${value}`).join("\n") || "- None recorded.";
  const typedEvidence =
    report.gate_evidence.map(renderGateEvidence).join("\n") || "- No typed gate evidence recorded.";
  const analyzerCoverage =
    report.analyzer_coverage.map(renderAnalyzerCoverage).join("\n") ||
    "- No analyzer coverage records were applicable.";
  const moduleDecisions =
    report.module_decisions.map(renderModuleDecision).join("\n") ||
    "- No module decisions were recorded. Module applicability is therefore unstated, not proven.";
  const compositions =
    report.compositions.map(renderComposition).join("\n\n") ||
    "- No composition provenance was recorded. Provider context selection is therefore unstated.";
  const plannedChecks =
    report.planned_checks.map(renderPlannedCheck).join("\n") ||
    "- No planned checks were recorded. This is not evidence that every check ran.";
  const runtimeEvidence =
    report.runtime_evidence.map(renderRuntimeEvidence).join("\n") ||
    "- No runtime evidence was recorded. Nothing in this report reflects observed runtime behavior.";
  const tools =
    report.tools.map(renderToolRecord).join("\n") ||
    "- No tool provenance was recorded, so the trust and version of the producing tools is unstated.";
  const remediation = report.findings
    .filter((finding) => finding.status === "FAIL" || finding.status === "WARNING")
    .map(
      (finding, index) =>
        `${index + 1}. **${finding.severity} ${finding.instance_id ?? finding.id}** — ${finding.recommendation} (${finding.safe_fix ? "candidate safe fix" : "manual review or approval required"})`
    )
    .join("\n");
  const notRun = report.findings
    .filter((finding) => ["BLOCKED", "NOT_VERIFIED"].includes(finding.status))
    .map((finding) => `- ${finding.instance_id ?? finding.id}: ${finding.verification.join("; ")}`)
    .join("\n");
  const changedScope =
    report.scope_evidence === undefined
      ? "- Not a Git-aware changed-scope report."
      : `- Base: \`${report.scope_evidence.base_ref}\` (${report.scope_evidence.base_commit})
- Merge base: \`${report.scope_evidence.merge_base}\`
- Changed paths: ${report.scope_evidence.changed_files.length}
- Included paths after impact expansion: ${report.scope_evidence.included_files.length}
- Affected applications: ${report.scope_evidence.affected_applications.map((application) => application.name).join(", ") || "none"}

${report.scope_evidence.included_files.map((item) => `- \`${item.path}\`: ${item.reasons.join("; ")}`).join("\n")}`;
  return `# Fullstack Forge report

- Generated: ${report.generated_at}
- Scope: ${report.scope}
- Root: \`${report.root}\`
- Revision: \`${report.revision ?? "legacy/unrecorded"}\`

## Environment

${renderEnvironment(report.environment)}

## Schema and migration

${renderMigration(report)}

## Status summary

${summary}

## Severity by verdict

${verdictSummary}

## Detected profile

${report.profile.detections.map((detection) => `- **${detection.name}** (${detection.confidence}): ${detection.evidence.join(", ")}`).join("\n") || "- No technologies detected."}

## Changed-scope evidence

${changedScope}

## Findings

${findings}

## Superseded historical findings

${superseded}

## Prioritized remediation plan

${remediation || "- No FAIL or WARNING finding requires remediation in this report."}

## Execution ledger

${execution || "- No project command was executed."}

## Module applicability decisions

${moduleDecisions}

## Composed specialist context

${compositions}

## Planned checks

${plannedChecks}

## Runtime evidence

${runtimeEvidence}

## Tool inventory

${tools}

## Typed gate evidence

${typedEvidence}

## Analyzer coverage and missing adapters

${analyzerCoverage}

## Checks not run or not verified

${notRun || "- None recorded."}

## Assumptions

${assumptions}

## Residual risk

${residual}
`;
}

/**
 * Renders severity strictly inside its verdict class, and states the contract in the document.
 *
 * The reading this prevents is the one a severity-only table invites: "1 CRITICAL" next to a
 * finding that was never verified. The unverified critical/high line is printed even when zero, so
 * its absence is a fact about the run and not an omission from the template.
 */
function renderVerdictSummary(summary: FindingSummary): string {
  const rows = FINDING_STATUS_CLASSES.map((name) => {
    const bucket = summary.by_class[name];
    const severities = SEVERITIES.filter((severity) => bucket.by_severity[severity] > 0)
      .map((severity) => `${severity} ${bucket.by_severity[severity]}`)
      .join(", ");
    return `- **${name}** (${STATUS_CLASS_MEANING[name]}) — ${bucket.total} finding(s)${
      severities.length === 0 ? "" : `; potential impact: ${severities}`
    }`;
  });
  return [
    `- Confirmed defects: ${summary.confirmed_defects} (CRITICAL ${summary.confirmed_critical}, HIGH ${summary.confirmed_high}). Only these are proven defects.`,
    `- Unverified or blocked findings whose potential impact is CRITICAL or HIGH: ${summary.unverified_critical_or_high}. These are evidence gaps, not confirmed defects; they still block release through the Ship open-findings gate.`,
    "- Severity in this report is potential impact, not a verdict. A severity total that mixes verdict classes is not a defect count.",
    ...rows
  ].join("\n");
}

function renderMigration(report: AuditReport): string {
  const header = `- Schema version: ${report.schema_version}`;
  if (report.migration === undefined)
    return `${header}\n- Written directly at the current schema version; no migration was applied.`;
  return [
    header,
    `- Migrated from schema version ${report.migration.from_schema_version}`,
    `- Source classification: ${report.migration.detected_origin}`,
    `- Ledgers absent from the source: ${report.migration.absent_ledgers.join(", ") || "none"}`,
    ...report.migration.notes.map((note) => `- ${note}`)
  ].join("\n");
}

/**
 * Renders both axes explicitly. The applicability line is spelled out because "not audited" and
 * "does not exist" are the two claims a reader is most likely to conflate.
 */
function renderModuleDecision(decision: ModuleDecision): string {
  const applicability =
    decision.selection_status === "SELECTED"
      ? "audited in this run"
      : (decision.applicability_status ??
            (decision.capability_status === "ABSENT"
              ? "NOT_APPLICABLE"
              : "APPLICABLE_UNPROVEN")) === "NOT_APPLICABLE"
        ? "not applicable in the bounded scanned scope"
        : "NOT audited in this run — this is not evidence that the module is inapplicable";
  return `- **${decision.module}** — capability ${decision.capability_status}; selection ${decision.selection_status}${decision.explicitly_selected === true ? " (explicitly selected)" : ""}; ${applicability}. Reasons: ${decision.reasons.join("; ")}. Evidence: ${decision.evidence.join("; ") || "none recorded"}`;
}

function renderComposition(result: CompositionResult): string {
  const selected = result.selected
    .map(
      (source) =>
        `  - **${source.tier}** \`${source.runtimePath}\` (${source.provider}/${source.skill}): ${source.reason}`
    )
    .join("\n");
  const suppressed = result.suppressed
    .map((source) => `  - **${source.tier}** ${source.provider}/${source.skill}: ${source.reason}`)
    .join("\n");
  const missing = result.missing.map((path) => `  - \`${path}\``).join("\n");
  const eager = (result.eager ?? result.selected)
    .map((source) => `  - \`${source.runtimePath}\``)
    .join("\n");
  const deferred = (result.deferred ?? [])
    .map((source) => `  - \`${source.runtimePath}\``)
    .join("\n");
  return [
    `- **${result.module}** (${result.mode}; ${result.outputClassification}; workflow ${result.workflow ?? "legacy/build"})`,
    `  - Budget: primary ${result.budget.maxPrimarySkills}, overlays ${result.budget.maxOverlays}, supplemental ${result.budget.maxSupplemental}`,
    "  - Eager load:",
    eager || "  - None.",
    "  - Deferred load (on demand):",
    deferred || "  - None.",
    "  - Selected:",
    selected || "  - None beyond the Forge contract.",
    "  - Suppressed:",
    suppressed || "  - None.",
    "  - Missing runtime paths:",
    missing || "  - None."
  ].join("\n");
}

function renderPlannedCheck(check: PlannedCheck): string {
  return `- **${check.check_id}** (${check.module}) — ${check.status}${check.reason === undefined ? "" : `: ${check.reason}`}; command \`${check.command?.join(" ") ?? "none recorded"}\`; source ${check.source}; authorization required: ${check.requires_authorization ? "yes" : "no"}; network policy ${check.network_policy}`;
}

function renderRuntimeEvidence(evidence: RuntimeEvidence): string {
  const artifacts = evidence.artifacts
    ?.map((artifact) => `\`${artifact.path}\` (${artifact.sha256}; ${artifact.media_type})`)
    .join(", ");
  const renderedArtifacts =
    artifacts ??
    (evidence.artifact_paths.map((path) => `\`${path}\``).join(", ") || "none captured");
  return `- **${evidence.evidence_id}** (${evidence.evidence_type}) — ${evidence.status} at revision \`${evidence.revision}\`; artifacts: ${renderedArtifacts}; hashes: ${evidence.hashes.join(", ") || "none recorded"}; limitations: ${evidence.limitations.join("; ") || "none recorded"}`;
}

function renderToolRecord(tool: ToolRecord): string {
  return `- **${tool.name}** (\`${tool.tool_id}\`) — ${tool.ownership}, ${tool.trust}; version ${tool.version} (${tool.version_source}); invocation \`${tool.invocation?.join(" ") ?? "not recorded"}\`; limitations: ${tool.limitations.join("; ") || "none recorded"}`;
}

function renderGateEvidence(evidence: GateEvidence): string {
  const envelope =
    evidence.envelope === undefined
      ? "no v0.3 envelope (untrusted diagnostic)"
      : `${evidence.envelope.domain}/${evidence.envelope.producer}@${evidence.envelope.producer_version}; contract ${evidence.envelope.contract}; artifacts ${evidence.envelope.artifacts.map((artifact) => `${artifact.path}:${artifact.sha256}:${artifact.media_type}`).join(", ")}`;
  return `- **${evidence.evidence_type} / ${evidence.status}** — producer \`${evidence.producer}\`, revision \`${evidence.revision}\`, scope ${evidence.scope.map((path) => `\`${path}\``).join(", ") || "none"}; envelope ${envelope}; absence proves success: ${evidence.absence_proves_success ? "yes" : "no"}; relevant instances: ${evidence.relevant_instance_ids.join(", ") || "none"}; limitations: ${evidence.limitations.join("; ")}`;
}

function renderAnalyzerCoverage(coverage: AnalyzerCoverage): string {
  return `- **${coverage.status}** module=${coverage.module}; language=${coverage.language}; framework=${coverage.framework}; coverage=${coverage.coverage}; analyzer=${coverage.analyzer_id}; required adapter=${coverage.required_adapter ?? "none"}; supported shapes=${coverage.supported_shapes.join(", ") || "none"}; unsupported shapes=${coverage.unsupported_shapes.join(", ") || "none"}`;
}

function assertGateEvidence(values: GateEvidence[]): void {
  const errors: string[] = [];
  for (const [index, value] of values.entries()) {
    if (!GATE_EVIDENCE_TYPES.includes(value.evidence_type))
      errors.push(`[${index}] invalid evidence_type`);
    if (
      typeof value.producer !== "string" ||
      value.producer.length === 0 ||
      typeof value.timestamp !== "string" ||
      value.timestamp.length === 0 ||
      !Number.isFinite(Date.parse(value.timestamp)) ||
      typeof value.revision !== "string" ||
      value.revision.length === 0
    )
      errors.push(`[${index}] producer, timestamp, and revision are required`);
    if (
      !Array.isArray(value.scope) ||
      !value.scope.every((path) => typeof path === "string" && isSafeReportPath(path)) ||
      !Array.isArray(value.relevant_instance_ids) ||
      !value.relevant_instance_ids.every(
        (id) => typeof id === "string" && /^FF-[A-Z0-9-]+-[0-9]{3,}(?::[a-f0-9]{8,})?$/u.test(id)
      )
    )
      errors.push(`[${index}] scope and relevant_instance_ids must be arrays`);
    if (
      !Array.isArray(value.limitations) ||
      value.limitations.length === 0 ||
      !value.limitations.every((item) => typeof item === "string" && item.length > 0)
    )
      errors.push(`[${index}] limitations must be a non-empty array`);
    if (!["PASS", "FAIL", "BLOCKED", "NOT_VERIFIED", "NOT_APPLICABLE"].includes(value.status))
      errors.push(`[${index}] invalid status`);
    if (typeof value.absence_proves_success !== "boolean")
      errors.push(`[${index}] absence_proves_success must be boolean`);
    if (value.envelope !== undefined) {
      try {
        assertEvidenceArtifacts(value.envelope.artifacts);
      } catch (error) {
        errors.push(`[${index}] invalid evidence envelope: ${(error as Error).message}`);
      }
    }
  }
  if (errors.length > 0) throw new Error(`Invalid typed gate evidence:\n${errors.join("\n")}`);
}

function assertAnalyzerCoverage(values: AnalyzerCoverage[]): void {
  const errors: string[] = [];
  for (const [index, value] of values.entries()) {
    if (!["PASS", "NOT_VERIFIED"].includes(value.status))
      errors.push(`[${index}] invalid analyzer coverage status`);
    if (!["executable", "partial", "none"].includes(value.coverage))
      errors.push(`[${index}] invalid analyzer coverage level`);
    for (const field of ["module", "language", "framework", "analyzer_id"] as const)
      if (typeof value[field] !== "string" || value[field].length === 0)
        errors.push(`[${index}] ${field} must be a non-empty string`);
    for (const field of ["supported_shapes", "unsupported_shapes"] as const)
      if (
        !Array.isArray(value[field]) ||
        !value[field].every((shape) => typeof shape === "string" && shape.length > 0)
      )
        errors.push(`[${index}] ${field} must be a string array`);
    if (
      value.coverage === "executable"
        ? value.status !== "PASS" || value.required_adapter !== undefined
        : value.status !== "NOT_VERIFIED" ||
          typeof value.required_adapter !== "string" ||
          value.required_adapter.length === 0
    )
      errors.push(`[${index}] analyzer coverage status and required adapter are inconsistent`);
  }
  if (errors.length > 0) throw new Error(`Invalid analyzer coverage:\n${errors.join("\n")}`);
}

function isSafeReportPath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\0") &&
    !/^(?:[A-Za-z]:|[\\/]{1,2})/u.test(value) &&
    !value
      .split(/[\\/]+/u)
      .some((part) => part === "" || part === "." || part === ".." || part.includes(":"))
  );
}

function renderFinding(finding: Finding): string {
  const locations = finding.location
    .map(
      (location) => `\`${location.path}${location.line === undefined ? "" : `:${location.line}`}\``
    )
    .join(", ");
  return `### ${finding.id}: ${finding.title}

- Section: ${finding.section}
- Module / producer: ${finding.module ?? finding.section} / ${finding.producer ?? (finding.analyzer_id === undefined ? "legacy/unspecified" : "forge-analyzer")}
- Evidence type / revision: ${finding.evidence_type ?? "legacy/unspecified"} / ${finding.revision ?? "legacy/unspecified"}
- Binding state: ${finding.binding_state ?? "legacy/unrecorded"}
- Rule / instance: ${finding.id} / ${finding.instance_id ?? "legacy report (no instance ID)"}
- Supersession: supersedes ${finding.supersedes?.join(", ") || "none"}; superseded by ${finding.superseded_by ?? "none"}; reason ${finding.retraction_reason ?? "none"}
- Severity / confidence / status: **${finding.severity} / ${finding.confidence} / ${finding.status}**
- Location: ${locations || "No code location"}
- Evidence: ${finding.evidence.join("; ")}
- Explanation: ${finding.explanation ?? finding.title}
- Impact: ${finding.impact}
- Recommendation: ${finding.recommendation}
- Safe automatic fix: ${finding.safe_fix ? "yes" : "no"} (${finding.safe_fix_classification ?? "legacy boolean classification"})
- Verification: ${finding.verification.join("; ")}
- Commands executed: ${finding.commands_executed?.map((entry) => `${entry.command} (exit ${entry.exit_code})`).join("; ") || "None recorded"}
- Remaining limitations: ${finding.remaining_limitations?.join("; ") || "None recorded"}
- Standards: ${finding.standards.join(", ") || "None"}`;
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const finding of findings) {
    // Machine-readable findings preserve instance-level state. A finding carrying an
    // instance identity merges only with the same instance; legacy
    // findings without one keep the previous section/title/recommendation key.
    const key =
      finding.instance_id ??
      `${finding.section}\u0000${finding.title}\u0000${finding.recommendation}`;
    const current = byKey.get(key);
    if (current === undefined) {
      byKey.set(key, structuredClone(finding));
      continue;
    }
    current.location = unique(
      [...current.location, ...finding.location],
      (location) => `${location.path}:${location.line ?? ""}`
    );
    current.evidence = [...new Set([...current.evidence, ...finding.evidence])];
    current.verification = [...new Set([...current.verification, ...finding.verification])];
    current.standards = [...new Set([...current.standards, ...finding.standards])];
  }
  return [...byKey.values()];
}

/**
 * Orders findings by verdict class first, then by potential impact within the class.
 *
 * Sorting on severity alone put every unproven CRITICAL above every confirmed HIGH, so the head of
 * the list — which is what a reader skims, and what `simple-cli` slices for its "top actions" —
 * read as the worst confirmed defects while containing findings that prove nothing. Class ordering
 * fixes the reading without touching any finding's status, severity, or confidence, and without
 * removing anything from the list.
 */
function sortFindings(findings: Finding[]): Finding[] {
  const classRank = new Map(FINDING_STATUS_CLASSES.map((value, index) => [value, index]));
  const severity = new Map(SEVERITIES.map((value, index) => [value, index]));
  const confidence = new Map(["HIGH", "MEDIUM", "LOW"].map((value, index) => [value, index]));
  const rank = (finding: Finding): number => classRank.get(STATUS_CLASS[finding.status]) ?? 99;
  return findings.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (severity.get(a.severity) ?? 99) - (severity.get(b.severity) ?? 99) ||
      (confidence.get(a.confidence) ?? 99) - (confidence.get(b.confidence) ?? 99) ||
      a.id.localeCompare(b.id)
  );
}

function unique<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const candidate = key(value);
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

function compact(value: string): string {
  const compacted = value.replace(/\s+/gu, " ").trim();
  return compacted.length > 240 ? `${compacted.slice(0, 237)}...` : compacted || "no output";
}
