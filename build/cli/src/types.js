export const STATUSES = [
    "PASS",
    "FAIL",
    "WARNING",
    "NOT_APPLICABLE",
    "NOT_VERIFIED",
    "BLOCKED"
];
export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
export const CONFIDENCES = ["HIGH", "MEDIUM", "LOW"];
export const FINDING_PRODUCERS = [
    "forge-analyzer",
    "forge-command",
    "agent-reviewed-source",
    "agent-runtime-verification",
    "external-tool",
    "human-decision"
];
export const FINDING_EVIDENCE_TYPES = [
    "source-review",
    "runtime-verification",
    "command-output",
    "external-tool-output",
    "human-decision"
];
export const FIX_ATTEMPT_STATUSES = ["PLANNED", "APPLIED", "BLOCKED", "ROLLED_BACK"];
export const GATE_EVIDENCE_TYPES = [
    "secret-scan",
    "dependency-audit",
    "lockfile-inspection",
    "license-scan",
    "authorization-evaluation",
    "tenant-isolation-evaluation",
    "upload-security-evaluation",
    "application-security-static-analysis",
    "migration-validation",
    "project-test",
    "release-artifact-validation"
];
/**
 * Module applicability is deliberately expressed as two independent axes.
 *
 * `capability_status` answers "does this capability exist in the project at all?" and is the ONLY
 * axis that may justify NOT_APPLICABLE. `selection_status` answers "did this run audit it?" and
 * never proves absence: a module skipped because its files did not change, or because a risk
 * filter narrowed the run, is unaudited — not inapplicable.
 */
export const MODULE_CAPABILITY_STATUSES = ["PRESENT", "ABSENT", "UNKNOWN"];
export const MODULE_SELECTION_STATUSES = [
    "SELECTED",
    "OUT_OF_CHANGED_SCOPE",
    "EXCLUDED_BY_RISK",
    "NOT_REQUESTED"
];
export const PLANNED_CHECK_STATUSES = ["RUN", "NOT_RUN", "BLOCKED", "NOT_APPLICABLE"];
export const NETWORK_POLICIES = ["OFFLINE_SAFE", "NETWORK_REQUIRED", "UNKNOWN"];
export const RUNTIME_EVIDENCE_STATUSES = ["PASS", "FAIL", "BLOCKED", "NOT_VERIFIED"];
export const TOOL_OWNERSHIPS = ["forge-owned", "project-owned", "external"];
export const TOOL_TRUST_LEVELS = ["trusted", "untrusted", "unknown"];
export const TOOL_VERSION_SOURCES = ["observed", "declared", "unknown"];
//# sourceMappingURL=types.js.map