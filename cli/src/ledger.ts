import {
  ANALYZER_SUPPORT_STATUSES,
  MODULE_APPLICABILITY_STATUSES,
  MODULE_CAPABILITY_STATUSES,
  MODULE_SELECTION_STATUSES,
  NETWORK_POLICIES,
  PLANNED_CHECK_STATUSES,
  RUNTIME_EVIDENCE_STATUSES,
  TOOL_OWNERSHIPS,
  TOOL_TRUST_LEVELS,
  TOOL_VERSION_SOURCES,
  type ModuleDecision,
  type NetworkPolicy,
  type PlannedCheck,
  type PlannedCheckStatus,
  type RuntimeEvidence,
  type ToolRecord
} from "./types.js";

/**
 * Append-only ledgers for planned checks, runtime evidence, module decisions, and tool
 * provenance.
 *
 * Every function is pure: it validates its input, returns a new array, and never mutates the
 * ledger it was given. Order is the order of first append, so a report rendered twice from the
 * same ledger is byte-identical.
 *
 * The central invariant is that honesty only ever decreases. A check recorded as BLOCKED or
 * NOT_RUN can never later be rewritten as RUN, and runtime evidence recorded as BLOCKED or
 * NOT_VERIFIED can never later be rewritten as PASS. Re-recording a weaker outcome is allowed,
 * because discovering that a result was less certain than believed is a legitimate correction;
 * discovering the reverse is not, because the stronger claim was never observed.
 */

const HASH_PATTERN = /^(?:sha256:)?[a-f0-9]{64}$/u;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;

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
export function createPlannedCheck(input: PlannedCheckInput): PlannedCheck {
  const status = input.status ?? "NOT_RUN";
  const check: PlannedCheck = {
    check_id: input.check_id,
    module: input.module,
    ...(input.command === undefined ? {} : { command: [...input.command] }),
    source: input.source,
    status,
    ...(input.reason === undefined
      ? status === "NOT_RUN"
        ? { reason: "Planned but not yet executed." }
        : {}
      : { reason: input.reason }),
    requires_authorization: input.requires_authorization,
    network_policy: input.network_policy
  };
  assertPlannedChecks([check]);
  return check;
}

/** Appends a planned check, merging by `check_id` without ever strengthening an outcome. */
export function appendPlannedCheck(ledger: PlannedCheck[], check: PlannedCheck): PlannedCheck[] {
  assertPlannedChecks([check]);
  return mergeById(ledger, check, (entry) => entry.check_id, mergePlannedCheck);
}

/**
 * Records that a planned check actually executed. The check must not already be BLOCKED or
 * NOT_APPLICABLE: a blocked check that later reports a result would erase the block.
 */
export function recordExecutedCheck(
  ledger: PlannedCheck[],
  checkId: string,
  detail: { reason?: string; command?: string[] } = {}
): PlannedCheck[] {
  const current = findCheck(ledger, checkId);
  if (current.status === "BLOCKED" || current.status === "NOT_APPLICABLE")
    throw new Error(
      `Check '${checkId}' is recorded ${current.status}; it cannot be re-recorded as RUN.`
    );
  return replaceCheck(ledger, checkId, {
    ...current,
    ...(detail.command === undefined ? {} : { command: [...detail.command] }),
    status: "RUN",
    ...(detail.reason === undefined ? {} : { reason: detail.reason })
  });
}

/** Records that a planned check could not run. A reason is mandatory. */
export function recordBlockedCheck(
  ledger: PlannedCheck[],
  checkId: string,
  reason: string
): PlannedCheck[] {
  if (typeof reason !== "string" || reason.trim().length === 0)
    throw new Error(`Blocking check '${checkId}' requires a reason.`);
  const current = findCheck(ledger, checkId);
  return replaceCheck(ledger, checkId, { ...current, status: "BLOCKED", reason });
}

/**
 * Appends runtime evidence. Re-recording the same `evidence_id` merges artifact paths, hashes,
 * and limitations, but never upgrades a BLOCKED or NOT_VERIFIED record to PASS.
 */
export function appendRuntimeEvidence(
  ledger: RuntimeEvidence[],
  evidence: RuntimeEvidence
): RuntimeEvidence[] {
  assertRuntimeEvidence([evidence]);
  return mergeById(ledger, evidence, (entry) => entry.evidence_id, mergeRuntimeEvidence);
}

/** Appends a module decision, merging reasons and evidence for a module already decided. */
export function appendModuleDecision(
  ledger: ModuleDecision[],
  decision: ModuleDecision
): ModuleDecision[] {
  assertModuleDecisions([decision]);
  return mergeById(ledger, decision, (entry) => entry.module, mergeModuleDecision);
}

/** Appends a tool provenance record, merging limitations for a tool already recorded. */
export function appendToolRecord(ledger: ToolRecord[], tool: ToolRecord): ToolRecord[] {
  assertToolRecords([tool]);
  return mergeById(ledger, tool, (entry) => entry.tool_id, mergeToolRecord);
}

function mergeToolRecord(current: ToolRecord, next: ToolRecord): ToolRecord {
  return { ...current, ...next, limitations: union(current.limitations, next.limitations) };
}

function mergePlannedCheck(current: PlannedCheck, next: PlannedCheck): PlannedCheck {
  if (current.status !== next.status && next.status === "RUN")
    throw new Error(
      `Check '${current.check_id}' is recorded ${current.status}; it cannot be re-recorded as RUN.`
    );
  return {
    ...current,
    ...next,
    status: next.status === current.status ? current.status : next.status
  };
}

function mergeRuntimeEvidence(current: RuntimeEvidence, next: RuntimeEvidence): RuntimeEvidence {
  if (next.status === "PASS" && current.status !== "PASS")
    throw new Error(
      `Runtime evidence '${current.evidence_id}' is recorded ${current.status}; it cannot be re-recorded as PASS.`
    );
  return {
    ...current,
    status: next.status,
    revision: next.revision,
    artifact_paths: union(current.artifact_paths, next.artifact_paths),
    hashes: union(current.hashes, next.hashes),
    limitations: union(current.limitations, next.limitations)
  };
}

function mergeModuleDecision(current: ModuleDecision, next: ModuleDecision): ModuleDecision {
  return {
    ...current,
    capability_status: next.capability_status,
    ...(next.risk_status === undefined ? {} : { risk_status: next.risk_status }),
    ...(next.control_status === undefined ? {} : { control_status: next.control_status }),
    ...(next.applicability_status === undefined
      ? {}
      : { applicability_status: next.applicability_status }),
    ...(next.analyzer_support === undefined ? {} : { analyzer_support: next.analyzer_support }),
    selection_status: next.selection_status,
    reasons: union(current.reasons, next.reasons),
    evidence: union(current.evidence, next.evidence),
    ...(current.explicitly_selected === true || next.explicitly_selected === true
      ? { explicitly_selected: true }
      : {})
  };
}

function mergeById<T>(
  ledger: T[],
  value: T,
  key: (entry: T) => string,
  merge: (current: T, next: T) => T
): T[] {
  const identity = key(value);
  const index = ledger.findIndex((entry) => key(entry) === identity);
  if (index === -1) return [...ledger, structuredClone(value)];
  const merged = ledger.slice();
  const current = merged[index];
  if (current === undefined) return [...ledger, structuredClone(value)];
  merged[index] = structuredClone(merge(current, value));
  return merged;
}

function findCheck(ledger: PlannedCheck[], checkId: string): PlannedCheck {
  const current = ledger.find((entry) => entry.check_id === checkId);
  if (current === undefined) throw new Error(`No planned check '${checkId}' exists in the ledger.`);
  return current;
}

function replaceCheck(ledger: PlannedCheck[], checkId: string, next: PlannedCheck): PlannedCheck[] {
  assertPlannedChecks([next]);
  return ledger.map((entry) =>
    entry.check_id === checkId ? structuredClone(next) : structuredClone(entry)
  );
}

function union(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

export function assertPlannedChecks(values: PlannedCheck[]): void {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`[${index}] planned check must be an object`);
      continue;
    }
    if (typeof value.check_id !== "string" || !ID_PATTERN.test(value.check_id))
      errors.push(`[${index}] check_id must be a stable identifier`);
    else if (seen.has(value.check_id)) errors.push(`[${index}] duplicate check_id`);
    else seen.add(value.check_id);
    for (const field of ["module", "source"] as const)
      if (typeof value[field] !== "string" || value[field].trim().length === 0)
        errors.push(`[${index}] ${field} must be a non-empty string`);
    if (!(PLANNED_CHECK_STATUSES as readonly string[]).includes(value.status))
      errors.push(`[${index}] invalid planned check status`);
    else if (
      value.status !== "RUN" &&
      (typeof value.reason !== "string" || value.reason.length === 0)
    )
      errors.push(`[${index}] a check that did not run requires a reason`);
    if (
      value.command !== undefined &&
      (!Array.isArray(value.command) ||
        value.command.length === 0 ||
        !value.command.every((part) => typeof part === "string" && part.length > 0))
    )
      errors.push(`[${index}] command must be a non-empty array of non-empty strings`);
    if (typeof value.requires_authorization !== "boolean")
      errors.push(`[${index}] requires_authorization must be boolean`);
    if (!(NETWORK_POLICIES as readonly string[]).includes(value.network_policy))
      errors.push(`[${index}] invalid network_policy`);
  }
  if (errors.length > 0) throw new Error(`Invalid planned checks:\n${errors.join("\n")}`);
}

export function assertRuntimeEvidence(values: RuntimeEvidence[]): void {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`[${index}] runtime evidence must be an object`);
      continue;
    }
    if (typeof value.evidence_id !== "string" || !ID_PATTERN.test(value.evidence_id))
      errors.push(`[${index}] evidence_id must be a stable identifier`);
    else if (seen.has(value.evidence_id)) errors.push(`[${index}] duplicate evidence_id`);
    else seen.add(value.evidence_id);
    for (const field of ["evidence_type", "revision"] as const)
      if (typeof value[field] !== "string" || value[field].trim().length === 0)
        errors.push(`[${index}] ${field} must be a non-empty string`);
    if (!(RUNTIME_EVIDENCE_STATUSES as readonly string[]).includes(value.status))
      errors.push(`[${index}] invalid runtime evidence status`);
    if (
      !Array.isArray(value.artifact_paths) ||
      !value.artifact_paths.every((path) => typeof path === "string" && isSafeLedgerPath(path))
    )
      errors.push(`[${index}] artifact_paths must be safe repository-relative paths`);
    if (
      !Array.isArray(value.hashes) ||
      !value.hashes.every((hash) => typeof hash === "string" && HASH_PATTERN.test(hash))
    )
      errors.push(`[${index}] hashes must be lowercase sha256 digests`);
    if (
      !Array.isArray(value.limitations) ||
      !value.limitations.every((item) => typeof item === "string" && item.length > 0)
    )
      errors.push(`[${index}] limitations must be an array of non-empty strings`);
    // A partial or failed capture that states no limitation reads exactly like a clean result.
    else if (value.status !== "PASS" && value.limitations.length === 0)
      errors.push(`[${index}] non-PASS runtime evidence requires at least one limitation`);
  }
  if (errors.length > 0) throw new Error(`Invalid runtime evidence:\n${errors.join("\n")}`);
}

export function assertModuleDecisions(values: ModuleDecision[]): void {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`[${index}] module decision must be an object`);
      continue;
    }
    if (typeof value.module !== "string" || value.module.trim().length === 0)
      errors.push(`[${index}] module must be a non-empty string`);
    else if (seen.has(value.module)) errors.push(`[${index}] duplicate module decision`);
    else seen.add(value.module);
    if (!(MODULE_CAPABILITY_STATUSES as readonly string[]).includes(value.capability_status))
      errors.push(`[${index}] invalid capability_status`);
    if (
      value.risk_status !== undefined &&
      !(MODULE_CAPABILITY_STATUSES as readonly string[]).includes(value.risk_status)
    )
      errors.push(`[${index}] invalid risk_status`);
    if (
      value.control_status !== undefined &&
      !(MODULE_CAPABILITY_STATUSES as readonly string[]).includes(value.control_status)
    )
      errors.push(`[${index}] invalid control_status`);
    if (
      value.applicability_status !== undefined &&
      !(MODULE_APPLICABILITY_STATUSES as readonly string[]).includes(value.applicability_status)
    )
      errors.push(`[${index}] invalid applicability_status`);
    if (
      value.analyzer_support !== undefined &&
      !(ANALYZER_SUPPORT_STATUSES as readonly string[]).includes(value.analyzer_support)
    )
      errors.push(`[${index}] invalid analyzer_support`);
    if (!(MODULE_SELECTION_STATUSES as readonly string[]).includes(value.selection_status))
      errors.push(`[${index}] invalid selection_status`);
    if (
      !Array.isArray(value.reasons) ||
      value.reasons.length === 0 ||
      !value.reasons.every((item) => typeof item === "string" && item.length > 0)
    )
      errors.push(`[${index}] reasons must be a non-empty array of non-empty strings`);
    if (
      !Array.isArray(value.evidence) ||
      !value.evidence.every((item) => typeof item === "string" && item.length > 0)
    )
      errors.push(`[${index}] evidence must be an array of non-empty strings`);
    if (value.explicitly_selected !== undefined && typeof value.explicitly_selected !== "boolean")
      errors.push(`[${index}] explicitly_selected must be boolean when present`);
  }
  if (errors.length > 0) throw new Error(`Invalid module decisions:\n${errors.join("\n")}`);
}

export function assertToolRecords(values: ToolRecord[]): void {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`[${index}] tool record must be an object`);
      continue;
    }
    if (typeof value.tool_id !== "string" || !ID_PATTERN.test(value.tool_id))
      errors.push(`[${index}] tool_id must be a stable identifier`);
    else if (seen.has(value.tool_id)) errors.push(`[${index}] duplicate tool_id`);
    else seen.add(value.tool_id);
    for (const field of ["name", "version"] as const)
      if (typeof value[field] !== "string" || value[field].trim().length === 0)
        errors.push(`[${index}] ${field} must be a non-empty string`);
    if (!(TOOL_OWNERSHIPS as readonly string[]).includes(value.ownership))
      errors.push(`[${index}] invalid ownership`);
    if (!(TOOL_TRUST_LEVELS as readonly string[]).includes(value.trust))
      errors.push(`[${index}] invalid trust level`);
    if (!(TOOL_VERSION_SOURCES as readonly string[]).includes(value.version_source))
      errors.push(`[${index}] invalid version_source`);
    // An unverifiable version cannot be presented as a determined one.
    else if (value.version_source === "unknown" && value.version !== "unknown")
      errors.push(`[${index}] an unknown version source must record version 'unknown'`);
    if (
      value.invocation !== undefined &&
      (!Array.isArray(value.invocation) ||
        !value.invocation.every((part) => typeof part === "string" && part.length > 0))
    )
      errors.push(`[${index}] invocation must be an array of non-empty strings`);
    if (
      !Array.isArray(value.limitations) ||
      !value.limitations.every((item) => typeof item === "string" && item.length > 0)
    )
      errors.push(`[${index}] limitations must be an array of non-empty strings`);
    else if (value.trust !== "trusted" && value.limitations.length === 0)
      errors.push(`[${index}] a non-trusted tool requires at least one recorded limitation`);
  }
  if (errors.length > 0) throw new Error(`Invalid tool records:\n${errors.join("\n")}`);
}

/** Artifact paths must stay repository-relative so a report can never point outside the project. */
export function isSafeLedgerPath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\0") &&
    !/^(?:[A-Za-z]:|[\\/]{1,2})/u.test(value) &&
    !value
      .split(/[\\/]+/u)
      .some((part) => part === "" || part === "." || part === ".." || part.includes(":"))
  );
}

function isRecord(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
