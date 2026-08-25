import type { CommandLedgerRecord } from "./offline-policy.js";
import type { ExecutionRecord } from "./report.js";
import type { CommandDefinition } from "./types.js";
export type ProjectCommandExecutionOptions = {
    allowRun: boolean;
    dryRun: boolean;
    offline: boolean;
    forgeOwned: boolean;
    timeoutMs?: number;
};
export type ProjectCommandExecutionResult = {
    status: "RAN" | "BLOCKED" | "NOT_RUN";
    ledger: CommandLedgerRecord;
    execution?: ExecutionRecord;
};
/**
 * The single policy boundary for audited-project commands outside Audit/Build/Ship orchestration.
 *
 * A caller receives a terminal ledger record on every path. `--offline` is evaluated before dry
 * run or authorization so a command that could never run under the active policy is reported as
 * BLOCKED rather than merely planned. Only a `RAN` result can carry execution evidence.
 */
export declare function executeProjectCommand(root: string, command: CommandDefinition, options: ProjectCommandExecutionOptions): Promise<ProjectCommandExecutionResult>;
