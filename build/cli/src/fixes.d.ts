import type { CommandLedgerRecord } from "./offline-policy.js";
import { type ExecutionRecord } from "./report.js";
export type FixRisk = "safe" | "risky";
export type BlockedFix = {
    finding_id: string;
    instance_id?: string;
    reason: string;
    risk?: FixRisk | "unsupported";
};
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
    instance_id?: string;
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
    blocked_findings: BlockedFix[];
    execution: ExecutionRecord[];
    command_ledger: CommandLedgerRecord[];
    report_paths: string[];
};
export declare const FIX_REGISTRY: readonly FixRegistryEntry[];
/**
 * Fix contract:
 *   `forge <section> fix`                  plans only and never mutates files.
 *   `forge <section> fix --safe`           executes bounded safe registry entries.
 *   `forge <section> fix --safe --dry-run` plans safe entries without writing.
 * Risky changes always require a separate, explicit, approval-bound mechanism and are never
 * implied by the absence of `--safe`.
 */
export declare function executeFixes(rootInput: string, section: string, options: {
    dryRun: boolean;
    safe?: boolean;
    severity?: string;
    allowRun?: boolean;
    offline?: boolean;
    forgeOwned?: boolean;
}): Promise<FixResult>;
