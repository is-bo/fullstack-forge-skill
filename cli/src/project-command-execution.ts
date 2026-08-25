import { decideCommandExecution, ledgerRecord } from "./offline-policy.js";
import type { CommandLedgerRecord } from "./offline-policy.js";
import type { ExecutionRecord } from "./report.js";
import type { CommandDefinition } from "./types.js";
import { runFile, utcNow } from "./utils.js";

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
export async function executeProjectCommand(
  root: string,
  command: CommandDefinition,
  options: ProjectCommandExecutionOptions
): Promise<ProjectCommandExecutionResult> {
  const decision = decideCommandExecution(command, {
    offline: options.offline,
    forgeOwned: options.forgeOwned
  });
  if (!decision.permitted) {
    return {
      status: "BLOCKED",
      ledger: ledgerRecord(command, decision, "BLOCKED", options.offline)
    };
  }
  if (!options.allowRun) {
    return {
      status: "NOT_RUN",
      ledger: {
        ...ledgerRecord(command, decision, "NOT_RUN", options.offline),
        reason:
          "Execution requires explicit --allow-run after reviewing the local project script definition."
      }
    };
  }
  if (options.dryRun) {
    return {
      status: "NOT_RUN",
      ledger: {
        ...ledgerRecord(command, decision, "NOT_RUN", options.offline),
        reason: "Dry run planned the command but executed nothing."
      }
    };
  }

  const started = Date.now();
  const startedAt = utcNow();
  const result = await runFile(
    command.executable,
    command.args,
    root,
    options.timeoutMs ?? 10 * 60_000
  );
  const execution: ExecutionRecord = {
    command: [command.executable, ...command.args],
    exitCode: result.exitCode,
    output: `${result.stdout}\n${result.stderr}`.trim(),
    started_at: startedAt,
    duration_ms: Date.now() - started
  };
  return {
    status: "RAN",
    execution,
    ledger: ledgerRecord(command, decision, "RAN", options.offline, result.exitCode)
  };
}
