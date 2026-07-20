import type { ChangedScopeEvidence } from "./scope.js";
import { type AnalyzerCoverage, type Finding, type GateEvidence, type ModuleDecision, type PlannedCheck, type ProjectProfile, type RuntimeEvidence, type ToolRecord } from "./types.js";
export declare const REPORT_SCHEMA_VERSION = 2;
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
export type ReportLedgers = {
    tools?: ToolRecord[];
    planned_checks?: PlannedCheck[];
    runtime_evidence?: RuntimeEvidence[];
    module_decisions?: ModuleDecision[];
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
}): ReportEnvironment;
export declare function renderMarkdown(report: AuditReport): string;
