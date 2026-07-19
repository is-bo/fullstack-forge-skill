import { CONFIDENCES, FIX_ATTEMPT_STATUSES, SEVERITIES, STATUSES, type Finding } from "./types.js";

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
  return errors;
}

export function assertFindings(values: unknown[]): asserts values is Finding[] {
  const errors = values.flatMap((value, index) =>
    validateFinding(value).map((error) => `[${index}] ${error}`)
  );
  if (errors.length > 0) throw new Error(`Invalid findings:\n${errors.join("\n")}`);
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
