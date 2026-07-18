import type { Finding, ProjectProfile } from "./types.js";
export type ExecutionRecord = {
    command: string[];
    exitCode: number;
    output: string;
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
};
export declare function writeReport(report: AuditReport, outputDirectory?: string): Promise<string[]>;
export declare function readReport(path: string): Promise<AuditReport>;
export declare function createReport(root: string, profile: ProjectProfile, findings: Finding[], scope: string, execution?: ExecutionRecord[], assumptions?: string[], residualRisk?: string[]): AuditReport;
export declare function renderMarkdown(report: AuditReport): string;
