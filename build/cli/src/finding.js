import { CONFIDENCES, SEVERITIES, STATUSES } from "./types.js";
export function validateFinding(value) {
    const errors = [];
    if (!isRecord(value))
        return ["finding must be an object"];
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
        if (!(field in value))
            errors.push(`missing required field: ${field}`);
    if (typeof value.id !== "string" || !/^FF-[A-Z0-9-]+-[0-9]{3,}$/u.test(value.id)) {
        errors.push("id must match FF-<PREFIX>-<NNN>");
    }
    for (const field of ["section", "title", "impact", "recommendation"]) {
        if (typeof value[field] !== "string" || value[field].length === 0)
            errors.push(`${field} must be a non-empty string`);
    }
    if (!SEVERITIES.includes(value.severity))
        errors.push("invalid severity");
    if (!CONFIDENCES.includes(value.confidence))
        errors.push("invalid confidence");
    if (!STATUSES.includes(value.status))
        errors.push("invalid status");
    if (typeof value.safe_fix !== "boolean")
        errors.push("safe_fix must be boolean");
    for (const field of ["location", "evidence", "verification", "standards"]) {
        if (!Array.isArray(value[field]))
            errors.push(`${field} must be an array`);
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
            if (isRecord(location) &&
                "line" in location &&
                (!Number.isInteger(location.line) || Number(location.line) < 1)) {
                errors.push(`location[${index}].line must be a positive integer`);
            }
        }
    }
    return errors;
}
export function assertFindings(values) {
    const errors = values.flatMap((value, index) => validateFinding(value).map((error) => `[${index}] ${error}`));
    if (errors.length > 0)
        throw new Error(`Invalid findings:\n${errors.join("\n")}`);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=finding.js.map