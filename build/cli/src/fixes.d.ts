import { type ExecutionRecord } from "./report.js";
export type FixRisk = "safe" | "risky";
export type FixRegistryEntry = {
    fix_id: string;
    supported_finding_pattern: string;
    section: string;
    description: string;
    risk: FixRisk;
    preconditions: string[];
    affected_files: string;
    expected_original_state: string;
    planned_edits: string;
    verification: string;
    rollback: string;
};
export type FixOperation = {
    fix_id: string;
    finding_id: string;
    section: string;
    risk: FixRisk;
    path: string;
    expected_sha256: string;
    resulting_sha256: string;
    description: string;
    verification: string;
    rollback: string;
};
export type FixResult = {
    status: "PASS" | "BLOCKED" | "FAIL";
    dry_run: boolean;
    operations: FixOperation[];
    changed_files: string[];
    blocked_findings: Array<{
        finding_id: string;
        reason: string;
    }>;
    execution: ExecutionRecord[];
    report_paths: string[];
};
export declare const FIX_REGISTRY: readonly FixRegistryEntry[];
export declare function executeFixes(rootInput: string, section: string, options: {
    dryRun: boolean;
    severity?: string;
    allowRun?: boolean;
}): Promise<FixResult>;
