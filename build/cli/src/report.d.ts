import type { ChangedScopeEvidence } from "./scope.js";
import { type AnalyzerCoverage, type Confidence, type Finding, type GateEvidence, type ModuleDecision, type PlannedCheck, type ProjectProfile, type RuntimeEvidence, type Severity, type Status, type ToolRecord } from "./types.js";
import type { CompositionResult } from "./composition.js";
export declare const REPORT_SCHEMA_VERSION = 3;
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
export declare const FINDING_STATUS_CLASSES: readonly ["confirmed", "evidence_gap", "passed", "not_applicable", "superseded"];
export type FindingStatusClass = (typeof FINDING_STATUS_CLASSES)[number];
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
/**
 * Aggregates findings on both axes at once.
 *
 * Every number this returns is derived from the findings passed in, so it can be recomputed at any
 * time and can never drift from the finding list it describes. A status the schema does not know is
 * counted as an evidence gap rather than silently dropped, because an unrecognised verdict is
 * precisely the case that must not be read as "clean".
 */
export declare function summarizeFindings(findings: readonly Finding[]): FindingSummary;
/**
 * Returns the report with its summary recomputed from its own findings.
 *
 * Serialization goes through this so the JSON a consumer reads and the Markdown a person reads are
 * derived from the same finding list in the same call, and neither can carry a stale rollup.
 */
export declare function withFindingSummary(report: AuditReport): AuditReport;
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
export declare function writeReport(report: AuditReport, outputDirectory?: string): Promise<string[]>;
/**
 * Reads a report of any supported schema version and returns it in the current schema.
 *
 * Migration happens in memory only. The file on disk is left exactly as written, so reading an
 * old report can never destroy the original evidence; callers that genuinely want to rewrite it
 * must pass the migrated value to `writeReport` themselves.
 */
export declare function readReport(root: string, path: string): Promise<AuditReport>;
/**
 * Upgrades a parsed report to the current schema without inventing data.
 *
 * Identity fields (`generated_at`, `root`, `revision`, `scope`) are preserved verbatim so the
 * migrated report still describes the run that produced it. Every ledger the source lacked is
 * left empty and named in `migration.absent_ledgers`.
 */
export declare function migrateReport(value: unknown): AuditReport;
export declare function createReport(root: string, profile: ProjectProfile, findings: Finding[], scope: string, execution?: ExecutionRecord[], assumptions?: string[], residualRisk?: string[], scopeEvidence?: ChangedScopeEvidence, gateEvidence?: GateEvidence[], analyzerCoverage?: AnalyzerCoverage[], revision?: string, environment?: ReportEnvironment, ledgers?: ReportLedgers): AuditReport;
/**
 * Captures only directly observable facts about the current process. `forge` reads the packaged
 * version; when it cannot be read the field reports `unknown` rather than a plausible value.
 */
export declare function captureEnvironment(options: {
    offline: boolean;
    allowRun: boolean;
    version: string;
    inspectionBudgetBytes?: number;
    excludes?: readonly string[];
}): ReportEnvironment;
export declare function renderMarkdown(report: AuditReport): string;
