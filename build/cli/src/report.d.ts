import type { ChangedScopeEvidence } from "./scope.js";
import { type AnalyzerCoverage, type Finding, type GateEvidence, type ProjectProfile } from "./types.js";
export type ExecutionRecord = {
    command: string[];
    exitCode: number;
    output: string;
    started_at?: string;
    duration_ms?: number;
};
export type AuditReport = {
    schema_version: 1;
    generated_at: string;
    root: string;
    revision?: string;
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
export declare function createReport(root: string, profile: ProjectProfile, findings: Finding[], scope: string, execution?: ExecutionRecord[], assumptions?: string[], residualRisk?: string[], scopeEvidence?: ChangedScopeEvidence, gateEvidence?: GateEvidence[], analyzerCoverage?: AnalyzerCoverage[], revision?: string): AuditReport;
export declare function renderMarkdown(report: AuditReport): string;
