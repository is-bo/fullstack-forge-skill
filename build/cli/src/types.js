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
//# sourceMappingURL=types.js.map