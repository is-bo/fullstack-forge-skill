import {
  CONFIDENCES,
  FINDING_EVIDENCE_TYPES,
  FINDING_PRODUCERS,
  FIX_ATTEMPT_STATUSES,
  SEVERITIES,
  STATUSES,
  type Finding
} from "./types.js";

export function validateFinding(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["finding must be an object"];
  const required = [
    "id",
    "section",
    "title",
    "severity",
    "confidence",
    "status",
    "location",
    "evidence",
    "impact",
    "recommendation",
    "safe_fix",
    "verification",
    "standards"
  ];
  for (const field of required)
    if (!(field in value)) errors.push(`missing required field: ${field}`);
  if (typeof value.id !== "string" || !/^FF-[A-Z0-9-]+-[0-9]{3,}$/u.test(value.id)) {
    errors.push("id must match FF-<PREFIX>-<NNN>");
  }
  for (const field of ["section", "title", "impact", "recommendation"] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0)
      errors.push(`${field} must be a non-empty string`);
  }
  if (!SEVERITIES.includes(value.severity as never)) errors.push("invalid severity");
  if (!CONFIDENCES.includes(value.confidence as never)) errors.push("invalid confidence");
  if (!STATUSES.includes(value.status as never)) errors.push("invalid status");
  if (typeof value.safe_fix !== "boolean") errors.push("safe_fix must be boolean");
  if ("producer" in value && !FINDING_PRODUCERS.includes(value.producer as never))
    errors.push("invalid producer");
  if ("evidence_type" in value && !FINDING_EVIDENCE_TYPES.includes(value.evidence_type as never))
    errors.push("invalid evidence_type");
  for (const field of ["module", "explanation", "revision"] as const)
    if (field in value && (typeof value[field] !== "string" || value[field].length === 0))
      errors.push(`${field} must be a non-empty string`);
  if (
    "safe_fix_classification" in value &&
    value.safe_fix_classification !== "safe" &&
    value.safe_fix_classification !== "approval-required" &&
    value.safe_fix_classification !== "unsupported"
  )
    errors.push("invalid safe_fix_classification");
  if (
    value.safe_fix === true &&
    "safe_fix_classification" in value &&
    value.safe_fix_classification !== "safe"
  )
    errors.push("safe_fix=true requires safe_fix_classification=safe");
  if (value.safe_fix === false && value.safe_fix_classification === "safe")
    errors.push("safe_fix=false cannot use safe_fix_classification=safe");
  if ("commands_executed" in value && !validFindingCommands(value.commands_executed, errors))
    errors.push("commands_executed must be an array of command records");
  if (
    "remaining_limitations" in value &&
    (!Array.isArray(value.remaining_limitations) ||
      value.remaining_limitations.some((item) => typeof item !== "string" || item.length === 0))
  )
    errors.push("remaining_limitations must be an array of non-empty strings");
  for (const field of ["location", "evidence", "verification", "standards"] as const) {
    if (!Array.isArray(value[field])) errors.push(`${field} must be an array`);
  }
  if (Array.isArray(value.evidence) && value.evidence.length === 0)
    errors.push("evidence must not be empty");
  if (Array.isArray(value.verification) && value.verification.length === 0)
    errors.push("verification must not be empty");
  if (Array.isArray(value.location)) {
    for (const [index, location] of value.location.entries()) {
      if (!isRecord(location) || typeof location.path !== "string" || location.path.length === 0) {
        errors.push(`location[${index}] must contain a path`);
      }
      if (
        isRecord(location) &&
        "line" in location &&
        (!Number.isInteger(location.line) || Number(location.line) < 1)
      ) {
        errors.push(`location[${index}].line must be a positive integer`);
      }
    }
  }
  if (
    "analyzer_id" in value &&
    (typeof value.analyzer_id !== "string" || value.analyzer_id.length === 0)
  )
    errors.push("analyzer_id must be a non-empty string");
  if ("instance_id" in value) {
    if (
      typeof value.instance_id !== "string" ||
      !/^FF-[A-Z0-9-]+-[0-9]{3,}:[a-f0-9]{8,}$/u.test(value.instance_id)
    )
      errors.push("instance_id must match <rule id>:<hex digest>");
    else if (typeof value.id === "string" && !value.instance_id.startsWith(`${value.id}:`))
      errors.push("instance_id must be prefixed by its rule id");
  }
  if ("fix_attempts" in value) {
    if (!Array.isArray(value.fix_attempts)) errors.push("fix_attempts must be an array");
    else {
      for (const [index, attempt] of value.fix_attempts.entries()) {
        if (
          !isRecord(attempt) ||
          !FIX_ATTEMPT_STATUSES.includes(attempt.status as never) ||
          typeof attempt.reason !== "string" ||
          attempt.reason.length === 0 ||
          typeof attempt.attempted_at !== "string"
        ) {
          errors.push(`fix_attempts[${index}] must contain status, reason, and attempted_at`);
        }
      }
    }
  }
  if ("trace" in value) {
    if (!Array.isArray(value.trace)) errors.push("trace must be an array");
    else {
      for (const [index, trace] of value.trace.entries()) {
        if (
          !isRecord(trace) ||
          typeof trace.source !== "string" ||
          typeof trace.sink !== "string" ||
          typeof trace.description !== "string" ||
          trace.source.length === 0 ||
          trace.sink.length === 0 ||
          trace.description.length === 0
        ) {
          errors.push(`trace[${index}] must contain source, sink, and description`);
        }
      }
    }
  }
  if ("evidence_snapshot" in value) {
    if (!Array.isArray(value.evidence_snapshot)) errors.push("evidence_snapshot must be an array");
    else {
      for (const [index, snapshot] of value.evidence_snapshot.entries()) {
        if (
          !isRecord(snapshot) ||
          typeof snapshot.path !== "string" ||
          !isSafeEvidencePath(snapshot.path) ||
          typeof snapshot.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/u.test(snapshot.sha256)
        ) {
          errors.push(`evidence_snapshot[${index}] must contain a safe path and SHA-256 hash`);
        }
      }
    }
  }
  if ("verification_plan" in value) {
    if (!isRecord(value.verification_plan) || !Array.isArray(value.verification_plan.actions)) {
      errors.push("verification_plan must contain an actions array");
    } else if (value.verification_plan.actions.length === 0) {
      errors.push("verification_plan.actions must not be empty");
    } else {
      for (const [index, action] of value.verification_plan.actions.entries()) {
        if (!isVerificationAction(action))
          errors.push(`verification_plan.actions[${index}] is invalid`);
      }
    }
  }
  if (
    value.producer === "agent-reviewed-source" ||
    value.producer === "agent-rendered-review" ||
    value.producer === "agent-runtime-verification"
  )
    validateAgentAuthoredFinding(value, errors);
  return errors;
}

export function assertFindings(values: unknown[]): asserts values is Finding[] {
  const errors = values.flatMap((value, index) =>
    validateFinding(value).map((error) => `[${index}] ${error}`)
  );
  if (errors.length > 0) throw new Error(`Invalid findings:\n${errors.join("\n")}`);
}

export function assertAgentFindings(values: unknown[]): asserts values is Finding[] {
  assertFindings(values);
  const errors = values.flatMap((value, index) =>
    value.producer === "agent-reviewed-source" ||
    value.producer === "agent-rendered-review" ||
    value.producer === "agent-runtime-verification"
      ? []
      : [
          `[${index}] producer must be agent-reviewed-source, agent-rendered-review, or agent-runtime-verification`
        ]
  );
  if (errors.length > 0) throw new Error(`Invalid agent findings:\n${errors.join("\n")}`);
}

function validateAgentAuthoredFinding(value: Record<string, unknown>, errors: string[]): void {
  for (const field of ["module", "evidence_type", "explanation", "revision"] as const)
    if (typeof value[field] !== "string" || value[field].length === 0)
      errors.push(`${field} must be a non-empty string for agent-authored findings`);
  if (!("safe_fix_classification" in value))
    errors.push("safe_fix_classification is required for agent-authored findings");
  if (!Array.isArray(value.location) || value.location.length === 0)
    errors.push("agent-authored findings require at least one source location");
  else
    for (const [index, location] of value.location.entries())
      if (!isRecord(location) || !Number.isInteger(location.line) || Number(location.line) < 1)
        errors.push(`location[${index}].line is required for agent-authored findings`);
  if (!("commands_executed" in value))
    errors.push("commands_executed must be an array for agent-authored findings");
  if (!("remaining_limitations" in value))
    errors.push(
      "remaining_limitations must be an array of non-empty strings for agent-authored findings"
    );
  if (value.producer === "agent-reviewed-source" && value.evidence_type !== "source-review")
    errors.push("agent-reviewed-source requires evidence_type=source-review");
  if (value.producer === "agent-rendered-review") {
    if (value.evidence_type !== "rendered-review")
      errors.push("agent-rendered-review requires evidence_type=rendered-review");
    if (!validRenderedEvidence(value.rendered_evidence, errors))
      errors.push("agent-rendered-review requires rendered_evidence");
  }
  if (
    value.producer === "agent-runtime-verification" &&
    value.evidence_type !== "runtime-verification"
  )
    errors.push("agent-runtime-verification requires evidence_type=runtime-verification");
}

function validRenderedEvidence(value: unknown, errors: string[]): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  let valid = true;
  const kinds = ["screenshot", "viewport", "accessibility-tree", "browser-console"];
  const inputMethods = ["keyboard", "pointer", "touch", "assistive-technology"];
  for (const [index, item] of value.entries()) {
    if (
      !isRecord(item) ||
      !kinds.includes(String(item.kind)) ||
      typeof item.observed !== "string" ||
      item.observed.length === 0
    ) {
      errors.push(`rendered_evidence[${index}] is invalid`);
      valid = false;
      continue;
    }
    for (const field of ["artifact_path", "url", "state"] as const)
      if (field in item && (typeof item[field] !== "string" || item[field].length === 0)) {
        errors.push(`rendered_evidence[${index}].${field} must be a non-empty string`);
        valid = false;
      }
    if (
      "input_method" in item &&
      (typeof item.input_method !== "string" || !inputMethods.includes(item.input_method))
    ) {
      errors.push(`rendered_evidence[${index}].input_method is invalid`);
      valid = false;
    }
    if ("viewport" in item) {
      const viewport = item.viewport;
      if (
        !isRecord(viewport) ||
        !Number.isInteger(viewport.width) ||
        !Number.isInteger(viewport.height) ||
        Number(viewport.width) < 1 ||
        Number(viewport.height) < 1
      ) {
        errors.push(`rendered_evidence[${index}].viewport is invalid`);
        valid = false;
      }
    }
  }
  return valid;
}

function validFindingCommands(value: unknown, errors: string[]): boolean {
  if (!Array.isArray(value)) return false;
  let valid = true;
  for (const [index, command] of value.entries()) {
    if (
      !isRecord(command) ||
      typeof command.command !== "string" ||
      command.command.length === 0 ||
      !Number.isInteger(command.exit_code) ||
      ("output_summary" in command &&
        (typeof command.output_summary !== "string" || command.output_summary.length === 0))
    ) {
      valid = false;
      errors.push(`commands_executed[${index}] must contain command and integer exit_code`);
    }
  }
  return valid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeEvidencePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\0") &&
    !/^(?:[A-Za-z]:|[\\/]{1,2})/u.test(value) &&
    !value
      .split(/[\\/]+/u)
      .some((part) => part === "" || part === "." || part === ".." || part.includes(":"))
  );
}

function isVerificationAction(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "analyzer") {
    const instanceValid =
      !("instance_id" in value) ||
      (typeof value.instance_id === "string" &&
        /^FF-[A-Z0-9-]+-[0-9]{3,}:[a-f0-9]{8,}$/u.test(value.instance_id) &&
        typeof value.finding_id === "string" &&
        value.instance_id.startsWith(`${value.finding_id}:`));
    const scopeValid =
      !("scope_paths" in value) ||
      (Array.isArray(value.scope_paths) &&
        value.scope_paths.every(
          (path): path is string => typeof path === "string" && isSafeEvidencePath(path)
        ));
    return (
      typeof value.analyzer_id === "string" &&
      typeof value.finding_id === "string" &&
      typeof value.absence_proves_resolution === "boolean" &&
      instanceValid &&
      scopeValid
    );
  }
  if (value.type === "project-command")
    return typeof value.command === "string" && typeof value.required === "boolean";
  if (value.type === "manual") return typeof value.procedure === "string";
  return false;
}
