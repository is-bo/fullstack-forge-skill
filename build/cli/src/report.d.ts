import type { ChangedScopeEvidence } from "./scope.js";
import { type AnalyzerCoverage, type Finding, type GateEvidence, type ProjectProfile } from "./types.js";
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
export type AuditReport = {
    schema_version: 1;
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
};
export declare function writeReport(report: AuditReport, outputDirectory?: string): Promise<string[]>;
export declare function readReport(root: string, path: string): Promise<AuditReport>;
export declare function createReport(root: string, profile: ProjectProfile, findings: Finding[], scope: string, execution?: ExecutionRecord[], assumptions?: string[], residualRisk?: string[], scopeEvidence?: ChangedScopeEvidence, gateEvidence?: GateEvidence[], analyzerCoverage?: AnalyzerCoverage[], revision?: string, environment?: ReportEnvironment): AuditReport;
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
