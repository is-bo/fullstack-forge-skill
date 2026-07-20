import { type ModuleDecision, type NetworkPolicy, type PlannedCheck, type PlannedCheckStatus, type RuntimeEvidence, type ToolRecord } from "./types.js";
export type PlannedCheckInput = {
    check_id: string;
    module: string;
    source: string;
    command?: string[];
    requires_authorization: boolean;
    network_policy: NetworkPolicy;
    status?: PlannedCheckStatus;
    reason?: string;
};
/**
 * Creates a validated planned check. A check starts as NOT_RUN unless the caller can already
 * prove a different outcome, so planning alone never implies execution.
 */
export declare function createPlannedCheck(input: PlannedCheckInput): PlannedCheck;
/** Appends a planned check, merging by `check_id` without ever strengthening an outcome. */
export declare function appendPlannedCheck(ledger: PlannedCheck[], check: PlannedCheck): PlannedCheck[];
/**
 * Records that a planned check actually executed. The check must not already be BLOCKED or
 * NOT_APPLICABLE: a blocked check that later reports a result would erase the block.
 */
export declare function recordExecutedCheck(ledger: PlannedCheck[], checkId: string, detail?: {
    reason?: string;
    command?: string[];
}): PlannedCheck[];
/** Records that a planned check could not run. A reason is mandatory. */
export declare function recordBlockedCheck(ledger: PlannedCheck[], checkId: string, reason: string): PlannedCheck[];
/**
 * Appends runtime evidence. Re-recording the same `evidence_id` merges artifact paths, hashes,
 * and limitations, but never upgrades a BLOCKED or NOT_VERIFIED record to PASS.
 */
export declare function appendRuntimeEvidence(ledger: RuntimeEvidence[], evidence: RuntimeEvidence): RuntimeEvidence[];
/** Appends a module decision, merging reasons and evidence for a module already decided. */
export declare function appendModuleDecision(ledger: ModuleDecision[], decision: ModuleDecision): ModuleDecision[];
/** Appends a tool provenance record, merging limitations for a tool already recorded. */
export declare function appendToolRecord(ledger: ToolRecord[], tool: ToolRecord): ToolRecord[];
export declare function assertPlannedChecks(values: PlannedCheck[]): void;
export declare function assertRuntimeEvidence(values: RuntimeEvidence[]): void;
export declare function assertModuleDecisions(values: ModuleDecision[]): void;
export declare function assertToolRecords(values: ToolRecord[]): void;
/** Artifact paths must stay repository-relative so a report can never point outside the project. */
export declare function isSafeLedgerPath(value: string): boolean;
