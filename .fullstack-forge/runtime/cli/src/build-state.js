import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { BUILD_SUB_VERBS, BUILD_VERBS, MODULE_SLUGS, PLATFORM_ALIASES, PLATFORM_CONFIG } from "./constants.js";
import { redactToString } from "./redaction.js";
import { assertNoSymlinkPath, canonicalDirectory, readTextIfPresent, resolveInside, sha256, utcNow, workingTreeRevision } from "./utils.js";
import { assertEvidenceEnvelopeShape, verifyBuildEvidenceEnvelopeIntegrity } from "./evidence-envelope.js";
import { assertBuildMigrationJournal, BUILD_MIGRATION_JOURNAL_REL } from "./build-migration-journal.js";
/**
 * Build-mode persistent state.
 *
 * Everything here lives under `.forge/build/`. Two invariants are load-bearing and mirror the
 * audit report machinery:
 *
 *  1. State is validated fail-closed on every load (`assertBuildProject` / `assertBuildFeature`).
 *     A malformed or tampered file raises rather than being silently repaired, exactly as
 *     `readReport` refuses an unknown report.
 *  2. Statuses embedded in a reloaded file are never trusted on their own: evidence is only
 *     reusable after its per-file sha256 re-verifies (`reverifyEvidenceHashes`), and anything
 *     whose source changed is demoted to NOT_VERIFIED rather than deleted.
 */
export const BUILD_STATE_VERSION = 2;
export const LEGACY_BUILD_STATE_VERSION = 1;
export const BUILD_PHASES = [
    "frame",
    "plan",
    "implement",
    "check",
    "done",
    "blocked",
    "abandoned"
];
export const TERMINAL_PHASES = new Set(["done", "blocked", "abandoned"]);
export const BUILD_TIERS = ["light", "standard", "high"];
export const CRITERION_STATUSES = [
    "PASS",
    "FAIL",
    "NOT_VERIFIED",
    "NOT_APPLICABLE",
    "BLOCKED"
];
/**
 * Disciplines whose criterion is a required security control at high tier. A high-tier security
 * control may never be waived by risk acceptance and a NOT_VERIFIED value always refuses `done`.
 */
export const SECURITY_DISCIPLINES = new Set([
    "auth",
    "authorization",
    "security",
    "privacy",
    "tenancy",
    "uploads",
    "payments"
]);
export const BUILD_DIR = [".forge", "build"];
const PROJECT_REL = ".forge/build/project.json";
const featureRel = (slug) => `.forge/build/features/${slug}.json`;
/** Repair-cycle cap: the same failing signature may recur at most this many times before blocking. */
export const REPAIR_CAP = 2;
// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const WINDOWS_RESERVED_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;
const RESERVED_SLUGS = new Set([
    ...BUILD_SUB_VERBS,
    ...BUILD_VERBS,
    "all",
    // Audit mode words, so a misremembered command like `forge feature audit` is redirected to the
    // grammar rather than silently creating a feature literally named "audit".
    "audit",
    "fix",
    "verify",
    "report",
    ...MODULE_SLUGS,
    ...Object.keys(PLATFORM_CONFIG),
    ...Object.keys(PLATFORM_ALIASES)
]);
/**
 * Validates a feature slug fail-closed.
 *
 * The grammar rejects path traversal, alternate-data-stream and drive syntax (`a..b`, `x:y`),
 * trailing dots/spaces, and control characters purely by not matching the pattern. On top of that,
 * reserved sub-verbs, the audit module slugs, platform selector names, and Windows reserved device
 * names are rejected explicitly so a feature can never be mistaken for a command or an unsafe path.
 */
export function assertValidSlug(slug) {
    if (typeof slug !== "string" || !SLUG_PATTERN.test(slug))
        throw new Error(`Invalid feature slug '${slug}'. A slug must match ^[a-z0-9][a-z0-9-]{0,63}$ (lowercase letters, digits, and hyphens).`);
    if (WINDOWS_RESERVED_DEVICE.test(slug))
        throw new Error(`Feature slug '${slug}' is a Windows reserved device name and cannot be used.`);
    if (RESERVED_SLUGS.has(slug))
        throw new Error(`Feature slug '${slug}' is a reserved word (a sub-verb, audit module, or platform name). Choose a distinct feature name.`);
}
// ---------------------------------------------------------------------------
// Fail-closed validators
// ---------------------------------------------------------------------------
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
export function assertBuildProject(value) {
    const errors = [];
    if (!isRecord(value))
        throw new Error("Build project state must be an object.");
    if (value.schema_version === LEGACY_BUILD_STATE_VERSION)
        throw new BuildMigrationRequiredError("project");
    if (value.schema_version !== BUILD_STATE_VERSION)
        errors.push(`schema_version must be ${BUILD_STATE_VERSION}`);
    for (const field of ["generated_at", "updated_at"])
        if (typeof value[field] !== "string" || value[field].length === 0)
            errors.push(`${field} must be a non-empty string`);
    if (!isRecord(value.product) ||
        !Object.keys(value.product).every((key) => key === "name" || key === "summary") ||
        typeof value.product.summary !== "string" ||
        (value.product.name !== undefined && typeof value.product.name !== "string"))
        errors.push("product.summary must be a string");
    if (value.risk_class !== undefined &&
        !BUILD_TIERS.includes(value.risk_class))
        errors.push("risk_class must be a valid tier");
    if (!isStringArray(value.stack))
        errors.push("stack must be a string array");
    if (!Array.isArray(value.non_goals) ||
        !value.non_goals.every((goal) => isRecord(goal) &&
            Object.keys(goal).every((key) => key === "item" || key === "reason") &&
            typeof goal.item === "string" &&
            typeof goal.reason === "string"))
        errors.push("non_goals must be an array of {item, reason}");
    if (!Array.isArray(value.features) ||
        !value.features.every((entry) => isRecord(entry) &&
            Object.keys(entry).every((key) => ["slug", "phase", "tier", "updated_at"].includes(key)) &&
            typeof entry.slug === "string" &&
            SLUG_PATTERN.test(entry.slug) &&
            BUILD_PHASES.includes(entry.phase) &&
            BUILD_TIERS.includes(entry.tier) &&
            typeof entry.updated_at === "string"))
        errors.push("features must be an array of valid index entries");
    if (!isValidProjectFrame(value.frame))
        errors.push("frame must be a valid structured project frame");
    if (!isValidDesignAlignment(value.design_alignment))
        errors.push("design_alignment must be a valid alignment record");
    if (value.applicability_snapshot !== undefined &&
        !isValidApplicabilitySnapshot(value.applicability_snapshot))
        errors.push("applicability_snapshot must be valid when present");
    if (!Array.isArray(value.selection_events) ||
        !value.selection_events.every(isValidSelectionEvent))
        errors.push("selection_events must be valid append-only selection records");
    else if (!hasUniqueStrings(value.selection_events.map((event) => event.id)))
        errors.push("selection_events must have unique ids");
    if (!isValidBuildHistory(value.history))
        errors.push("history must be valid");
    rejectUnknownKeys(value, PROJECT_KEYS, errors);
    if (errors.length > 0)
        throw new Error(`Invalid build project state:\n${errors.join("\n")}`);
}
export function assertBuildFeature(value) {
    const errors = [];
    if (!isRecord(value))
        throw new Error("Build feature state must be an object.");
    if (value.schema_version === LEGACY_BUILD_STATE_VERSION)
        throw new BuildMigrationRequiredError("feature");
    if (value.schema_version !== BUILD_STATE_VERSION)
        errors.push(`schema_version must be ${BUILD_STATE_VERSION}`);
    if (typeof value.slug !== "string" || !SLUG_PATTERN.test(value.slug))
        errors.push("slug must be a valid feature slug");
    for (const field of ["created_at", "updated_at", "summary"])
        if (typeof value[field] !== "string")
            errors.push(`${field} must be a string`);
    if (!BUILD_PHASES.includes(value.phase))
        errors.push("phase must be a valid build phase");
    if (!BUILD_TIERS.includes(value.tier))
        errors.push("tier must be a valid tier");
    if (!isStringArray(value.tier_inputs))
        errors.push("tier_inputs must be a string array");
    if (value.tier_override_reason !== undefined && typeof value.tier_override_reason !== "string")
        errors.push("tier_override_reason must be a string when present");
    if (!Array.isArray(value.disciplines) ||
        !value.disciplines.every((item) => isRecord(item) &&
            Object.keys(item).every((key) => key === "slug" || key === "reason") &&
            typeof item.slug === "string" &&
            typeof item.reason === "string"))
        errors.push("disciplines must be an array of {slug, reason}");
    if (value.plan_summary !== undefined && typeof value.plan_summary !== "string")
        errors.push("plan_summary must be a string when present");
    if (value.plan_hash !== undefined &&
        (typeof value.plan_hash !== "string" || !/^[a-f0-9]{64}$/u.test(value.plan_hash)))
        errors.push("plan_hash must be a sha256 digest when present");
    for (const field of ["decisions", "assumptions", "touched_paths"])
        if (!isStringArray(value[field]))
            errors.push(`${field} must be a string array`);
    if (!Array.isArray(value.evidence) || !value.evidence.every(isValidEvidence))
        errors.push("evidence must be an array of valid criterion records");
    if (!Array.isArray(value.risk_acceptances) ||
        !value.risk_acceptances.every(isValidRiskAcceptance))
        errors.push("risk_acceptances must be an array of valid records");
    if (!Array.isArray(value.repair_counters) || !value.repair_counters.every(isValidRepairCounter))
        errors.push("repair_counters must be an array of valid records");
    if (!Array.isArray(value.blockers) || !value.blockers.every(isValidBlocker))
        errors.push("blockers must be an array of valid records");
    if (!isStringArray(value.evidence_run_ids))
        errors.push("evidence_run_ids must be a string array");
    if (value.evidence_revision !== undefined && typeof value.evidence_revision !== "string")
        errors.push("evidence_revision must be a string when present");
    if (value.applicability_snapshot !== undefined &&
        !isValidFeatureApplicabilitySnapshot(value.applicability_snapshot))
        errors.push("applicability_snapshot must be valid when present");
    if (value.gate_plan !== undefined && !isValidBuildGatePlanSnapshot(value.gate_plan))
        errors.push("gate_plan must be valid when present");
    if (!Array.isArray(value.selection_events) ||
        !value.selection_events.every(isValidSelectionEvent))
        errors.push("selection_events must be valid append-only selection records");
    else if (!hasUniqueStrings(value.selection_events.map((event) => event.id)))
        errors.push("selection_events must have unique ids");
    if (!isValidBuildHistory(value.history))
        errors.push("history must be valid");
    rejectUnknownKeys(value, FEATURE_KEYS, errors);
    if (errors.length > 0)
        throw new Error(`Invalid build feature state:\n${errors.join("\n")}`);
}
/** Raised before any v1 state is trusted by an ordinary Build command. */
export class BuildMigrationRequiredError extends Error {
    constructor(kind) {
        super(`Build ${kind} state uses schema v1 and must be migrated before use. Run \`forge migrate build --dry-run\` to inspect, then \`forge migrate build\`. If a prior migration was interrupted, run \`forge migrate build --resume\` or \`forge migrate build --rollback\`.`);
        this.name = "BuildMigrationRequiredError";
    }
}
/** Prevents normal Build operations from racing an interrupted replacement set. */
export class BuildMigrationPendingError extends Error {
    constructor() {
        super("A Build state migration is interrupted. Run `forge migrate build --resume` or `forge migrate build --rollback` before using Build commands.");
        this.name = "BuildMigrationPendingError";
    }
}
export async function assertNoInterruptedBuildMigration(root) {
    const journal = resolveInside(root, BUILD_MIGRATION_JOURNAL_REL);
    await assertNoSymlinkPath(root, journal);
    const text = await readTextIfPresent(journal);
    if (text === undefined)
        return;
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error("Malformed Build migration journal; inspect it before continuing.");
    }
    assertBuildMigrationJournal(value);
    if (value.status !== "complete" && value.status !== "rolled_back")
        throw new BuildMigrationPendingError();
}
const PROJECT_KEYS = new Set([
    "schema_version",
    "generated_at",
    "updated_at",
    "product",
    "risk_class",
    "stack",
    "non_goals",
    "features",
    "frame",
    "design_alignment",
    "applicability_snapshot",
    "selection_events",
    "history"
]);
const FEATURE_KEYS = new Set([
    "schema_version",
    "slug",
    "created_at",
    "updated_at",
    "phase",
    "tier",
    "tier_inputs",
    "tier_override_reason",
    "summary",
    "disciplines",
    "plan_summary",
    "plan_hash",
    "decisions",
    "assumptions",
    "touched_paths",
    "evidence",
    "risk_acceptances",
    "repair_counters",
    "blockers",
    "evidence_run_ids",
    "evidence_revision",
    "applicability_snapshot",
    "gate_plan",
    "selection_events",
    "history"
]);
function rejectUnknownKeys(value, keys, errors) {
    for (const key of Object.keys(value))
        if (!keys.has(key))
            errors.push(`unknown field '${key}'`);
}
function hasUniqueStrings(values) {
    return new Set(values).size === values.length;
}
function isValidProjectFrame(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => [
            "problem_statement",
            "target_users",
            "users_and_roles",
            "desired_outcomes",
            "business_rules",
            "business_invariants",
            "constraints",
            "critical_workflows",
            "sensitive_data_classes",
            "trust_boundaries",
            "expected_scale",
            "stack_entries",
            "assumptions",
            "unresolved_decisions",
            "initial_feature_backlog",
            "design_direction_reference"
        ].includes(key)) &&
        typeof value.problem_statement === "string" &&
        isStringArray(value.target_users) &&
        Array.isArray(value.users_and_roles) &&
        value.users_and_roles.every((entry) => isRecord(entry) &&
            Object.keys(entry).every((key) => key === "user" || key === "roles") &&
            typeof entry.user === "string" &&
            isStringArray(entry.roles)) &&
        isStringArray(value.desired_outcomes) &&
        isStringArray(value.business_rules) &&
        isStringArray(value.business_invariants) &&
        isStringArray(value.constraints) &&
        isStringArray(value.critical_workflows) &&
        isStringArray(value.sensitive_data_classes) &&
        isStringArray(value.trust_boundaries) &&
        typeof value.expected_scale === "string" &&
        Array.isArray(value.stack_entries) &&
        value.stack_entries.every((entry) => isRecord(entry) &&
            Object.keys(entry).every((key) => key === "name" || key === "rationale") &&
            typeof entry.name === "string" &&
            typeof entry.rationale === "string") &&
        isStringArray(value.assumptions) &&
        isStringArray(value.unresolved_decisions) &&
        isStringArray(value.initial_feature_backlog) &&
        typeof value.design_direction_reference === "string");
}
function isValidDesignAlignment(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => ["status", "references", "recorded_at"].includes(key)) &&
        ["NOT_VERIFIED", "ALIGNED", "DRIFT"].includes(value.status) &&
        isStringArray(value.references) &&
        typeof value.recorded_at === "string");
}
function isValidApplicabilitySnapshot(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => ["recorded_at", "source_revision", "disciplines"].includes(key)) &&
        typeof value.recorded_at === "string" &&
        (value.source_revision === undefined || typeof value.source_revision === "string") &&
        Array.isArray(value.disciplines) &&
        value.disciplines.every((entry) => isRecord(entry) &&
            Object.keys(entry).every((key) => ["slug", "applicable", "reason"].includes(key)) &&
            typeof entry.slug === "string" &&
            typeof entry.applicable === "boolean" &&
            typeof entry.reason === "string"));
}
function isValidSelectionEvent(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => ["id", "kind", "action", "value", "reason", "recorded_at", "source"].includes(key)) &&
        typeof value.id === "string" &&
        value.id.length > 0 &&
        ["discipline", "tier", "applicability"].includes(value.kind) &&
        ["selected", "deselected", "recorded"].includes(value.action) &&
        typeof value.value === "string" &&
        typeof value.reason === "string" &&
        typeof value.recorded_at === "string" &&
        ["user", "cli", "migration"].includes(value.source));
}
function isValidBuildHistory(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => ["migrated_from", "migrated_at"].includes(key)) &&
        (value.migrated_from === undefined || value.migrated_from === LEGACY_BUILD_STATE_VERSION) &&
        (value.migrated_at === undefined || typeof value.migrated_at === "string") &&
        true);
}
function isValidFeatureApplicabilitySnapshot(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => [
            "recorded_at",
            "revision",
            "decisions",
            "required",
            "suggested",
            "unresolved",
            "excluded"
        ].includes(key)) &&
        typeof value.recorded_at === "string" &&
        typeof value.revision === "string" &&
        Array.isArray(value.decisions) &&
        value.decisions.every((decision) => isRecord(decision) &&
            Object.keys(decision).every((key) => ["discipline", "status", "confidence", "evidence", "exclusion_reason"].includes(key)) &&
            typeof decision.discipline === "string" &&
            ["REQUIRED", "SUGGESTED", "EXCLUDED", "UNRESOLVED"].includes(decision.status) &&
            ["LOW", "MEDIUM", "HIGH"].includes(decision.confidence) &&
            isStringArray(decision.evidence) &&
            (decision.exclusion_reason === undefined || typeof decision.exclusion_reason === "string")) &&
        isStringArray(value.required) &&
        isStringArray(value.suggested) &&
        isStringArray(value.unresolved) &&
        isStringArray(value.excluded));
}
function isValidBuildGatePlanSnapshot(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => ["recorded_at", "revision", "gates", "required_criteria"].includes(key)) &&
        typeof value.recorded_at === "string" &&
        typeof value.revision === "string" &&
        isStringArray(value.required_criteria) &&
        Array.isArray(value.gates) &&
        value.gates.every((gate) => isRecord(gate) &&
            Object.keys(gate).every((key) => [
                "id",
                "name",
                "tier",
                "criteria",
                "required",
                "waiver_policy",
                "non_waivable",
                "reason"
            ].includes(key)) &&
            typeof gate.id === "string" &&
            typeof gate.name === "string" &&
            BUILD_TIERS.includes(gate.tier) &&
            isStringArray(gate.criteria) &&
            typeof gate.required === "boolean" &&
            ["never", "advisory", "operational-human"].includes(gate.waiver_policy) &&
            typeof gate.non_waivable === "boolean" &&
            typeof gate.reason === "string"));
}
function isValidEnvelope(value) {
    try {
        assertEvidenceEnvelopeShape(value);
        return true;
    }
    catch {
        return false;
    }
}
function isValidEvidenceCommand(value) {
    if (!isRecord(value))
        return false;
    return (Object.keys(value).every((key) => [
        "name",
        "argv",
        "definition",
        "exit_code",
        "started_at",
        "duration_ms",
        "output_sha256",
        "input_manifest"
    ].includes(key)) &&
        typeof value.name === "string" &&
        isStringArray(value.argv) &&
        typeof value.definition === "string" &&
        Number.isInteger(value.exit_code) &&
        typeof value.started_at === "string" &&
        typeof value.duration_ms === "number" &&
        typeof value.output_sha256 === "string" &&
        Array.isArray(value.input_manifest));
}
function isValidEvidence(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => [
            "criterion",
            "discipline",
            "security_control",
            "status",
            "producer",
            "producer_version",
            "evidence",
            "limitations",
            "files",
            "instance_ids",
            "recorded_at",
            "revision",
            "expires_at",
            "command",
            "runtime",
            "envelope",
            "not_applicable_reason",
            "migration_state",
            "expired_at"
        ].includes(key)) &&
        typeof value.criterion === "string" &&
        value.criterion.length > 0 &&
        typeof value.security_control === "boolean" &&
        CRITERION_STATUSES.includes(value.status) &&
        typeof value.producer === "string" &&
        (value.producer_version === undefined || typeof value.producer_version === "string") &&
        isStringArray(value.evidence) &&
        (value.limitations === undefined || isStringArray(value.limitations)) &&
        Array.isArray(value.files) &&
        value.files.every((file) => isRecord(file) &&
            Object.keys(file).every((key) => key === "path" || key === "sha256") &&
            typeof file.path === "string" &&
            file.path.length > 0 &&
            typeof file.sha256 === "string" &&
            /^[a-f0-9]{64}$/u.test(file.sha256)) &&
        isStringArray(value.instance_ids) &&
        typeof value.recorded_at === "string" &&
        (value.revision === undefined || typeof value.revision === "string") &&
        (value.expires_at === undefined || typeof value.expires_at === "string") &&
        (value.command === undefined || isValidEvidenceCommand(value.command)) &&
        (value.runtime === undefined || isValidEvidenceRuntime(value.runtime)) &&
        (value.envelope === undefined || isValidEnvelope(value.envelope)) &&
        (value.discipline === undefined || typeof value.discipline === "string") &&
        (value.not_applicable_reason === undefined ||
            typeof value.not_applicable_reason === "string") &&
        (value.status !== "NOT_APPLICABLE" ||
            (typeof value.not_applicable_reason === "string" &&
                value.not_applicable_reason.trim().length > 0)) &&
        (value.migration_state === undefined || value.migration_state === "migrated-untrusted") &&
        (value.expired_at === undefined || typeof value.expired_at === "string"));
}
function isValidEvidenceRuntime(value) {
    return (Array.isArray(value) &&
        value.length > 0 &&
        value.every((runtime) => {
            if (!isRecord(runtime) ||
                !Object.keys(runtime).every((key) => ["url", "role", "state", "viewport"].includes(key)) ||
                typeof runtime.url !== "string" ||
                typeof runtime.role !== "string" ||
                typeof runtime.state !== "string" ||
                !isRecord(runtime.viewport) ||
                !Object.keys(runtime.viewport).every((key) => ["name", "width", "height"].includes(key)) ||
                typeof runtime.viewport.name !== "string" ||
                !Number.isInteger(runtime.viewport.width) ||
                !Number.isInteger(runtime.viewport.height) ||
                runtime.viewport.width <= 0 ||
                runtime.viewport.height <= 0)
                return false;
            try {
                const parsed = new URL(runtime.url);
                return (["http:", "https:"].includes(parsed.protocol) &&
                    parsed.username.length === 0 &&
                    parsed.password.length === 0);
            }
            catch {
                return false;
            }
        }));
}
function isValidRiskAcceptance(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => [
            "criterion",
            "category",
            "actor",
            "reason",
            "canonical_root",
            "revision",
            "policy",
            "relevant_files",
            "timestamp",
            "expires_at",
            "migration_state",
            "lifecycle",
            "expired_at"
        ].includes(key)) &&
        typeof value.criterion === "string" &&
        (value.category === undefined ||
            value.category === "advisory" ||
            value.category === "operational") &&
        (value.actor === undefined || typeof value.actor === "string") &&
        typeof value.reason === "string" &&
        value.reason.length > 0 &&
        (value.canonical_root === undefined || typeof value.canonical_root === "string") &&
        typeof value.revision === "string" &&
        (value.policy === undefined ||
            value.policy === "advisory" ||
            value.policy === "operational-human") &&
        (value.relevant_files === undefined ||
            (Array.isArray(value.relevant_files) &&
                value.relevant_files.every((file) => isRecord(file) &&
                    Object.keys(file).every((key) => key === "path" || key === "sha256") &&
                    typeof file.path === "string" &&
                    typeof file.sha256 === "string" &&
                    /^[a-f0-9]{64}$/u.test(file.sha256)))) &&
        typeof value.timestamp === "string" &&
        (value.expires_at === undefined || typeof value.expires_at === "string") &&
        (value.migration_state === undefined || value.migration_state === "migrated-untrusted") &&
        (value.lifecycle === undefined ||
            value.lifecycle === "active" ||
            value.lifecycle === "expired") &&
        (value.expired_at === undefined || typeof value.expired_at === "string"));
}
function isValidRepairCounter(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => key === "criterion" || key === "signature" || key === "count") &&
        typeof value.criterion === "string" &&
        typeof value.signature === "string" &&
        typeof value.count === "number" &&
        Number.isInteger(value.count) &&
        value.count >= 0);
}
function isValidBlocker(value) {
    return (isRecord(value) &&
        Object.keys(value).every((key) => key === "criterion" || key === "reason" || key === "timestamp") &&
        typeof value.criterion === "string" &&
        typeof value.reason === "string" &&
        typeof value.timestamp === "string");
}
// ---------------------------------------------------------------------------
// Redaction on persist
// ---------------------------------------------------------------------------
/**
 * Redacts every agent-authored free-text field before it is persisted.
 *
 * Reloaded free text is data, never instructions, and it must not carry secrets. Repository paths
 * (`touched_paths`, evidence file paths) are deliberately left intact because they are structural,
 * not free text, and redacting them would corrupt the hash-freshness basis.
 */
function sanitizeFeature(feature) {
    const clone = structuredClone(feature);
    clone.summary = redactToString(clone.summary);
    if (clone.tier_override_reason !== undefined)
        clone.tier_override_reason = redactToString(clone.tier_override_reason);
    if (clone.plan_summary !== undefined)
        clone.plan_summary = redactToString(clone.plan_summary);
    clone.decisions = clone.decisions.map((item) => redactToString(item));
    clone.assumptions = clone.assumptions.map((item) => redactToString(item));
    clone.tier_inputs = clone.tier_inputs.map((item) => redactToString(item));
    clone.disciplines = clone.disciplines.map((item) => ({
        slug: item.slug,
        reason: redactToString(item.reason)
    }));
    clone.risk_acceptances = clone.risk_acceptances.map((item) => ({
        ...item,
        ...(item.actor === undefined ? {} : { actor: redactToString(item.actor) }),
        reason: redactToString(item.reason)
    }));
    clone.blockers = clone.blockers.map((item) => ({ ...item, reason: redactToString(item.reason) }));
    clone.selection_events = clone.selection_events.map((event) => ({
        ...event,
        value: redactToString(event.value),
        reason: redactToString(event.reason)
    }));
    clone.evidence = clone.evidence.map((record) => ({
        ...record,
        evidence: record.evidence.map((line) => redactToString(line)),
        ...(record.limitations === undefined
            ? {}
            : { limitations: record.limitations.map((line) => redactToString(line)) }),
        ...(record.not_applicable_reason === undefined
            ? {}
            : { not_applicable_reason: redactToString(record.not_applicable_reason) })
    }));
    if (clone.applicability_snapshot !== undefined)
        clone.applicability_snapshot = {
            ...clone.applicability_snapshot,
            decisions: clone.applicability_snapshot.decisions.map((decision) => ({
                ...decision,
                evidence: decision.evidence.map((line) => redactToString(line)),
                ...(decision.exclusion_reason === undefined
                    ? {}
                    : { exclusion_reason: redactToString(decision.exclusion_reason) })
            }))
        };
    return clone;
}
function sanitizeProject(project) {
    const clone = structuredClone(project);
    clone.product.summary = redactToString(clone.product.summary);
    if (clone.product.name !== undefined)
        clone.product.name = redactToString(clone.product.name);
    clone.stack = clone.stack.map((item) => redactToString(item));
    clone.non_goals = clone.non_goals.map((goal) => ({
        item: redactToString(goal.item),
        reason: redactToString(goal.reason)
    }));
    clone.frame = {
        problem_statement: redactToString(clone.frame.problem_statement),
        target_users: clone.frame.target_users.map((item) => redactToString(item)),
        users_and_roles: clone.frame.users_and_roles.map((entry) => ({
            user: redactToString(entry.user),
            roles: entry.roles.map((role) => redactToString(role))
        })),
        desired_outcomes: clone.frame.desired_outcomes.map((item) => redactToString(item)),
        business_rules: clone.frame.business_rules.map((item) => redactToString(item)),
        business_invariants: clone.frame.business_invariants.map((item) => redactToString(item)),
        constraints: clone.frame.constraints.map((item) => redactToString(item)),
        critical_workflows: clone.frame.critical_workflows.map((item) => redactToString(item)),
        sensitive_data_classes: clone.frame.sensitive_data_classes.map((item) => redactToString(item)),
        trust_boundaries: clone.frame.trust_boundaries.map((item) => redactToString(item)),
        expected_scale: redactToString(clone.frame.expected_scale),
        stack_entries: clone.frame.stack_entries.map((entry) => ({
            name: redactToString(entry.name),
            rationale: redactToString(entry.rationale)
        })),
        assumptions: clone.frame.assumptions.map((item) => redactToString(item)),
        unresolved_decisions: clone.frame.unresolved_decisions.map((item) => redactToString(item)),
        initial_feature_backlog: clone.frame.initial_feature_backlog.map((item) => redactToString(item)),
        design_direction_reference: redactToString(clone.frame.design_direction_reference)
    };
    clone.design_alignment = {
        ...clone.design_alignment,
        references: clone.design_alignment.references.map((item) => redactToString(item))
    };
    clone.selection_events = clone.selection_events.map((event) => ({
        ...event,
        value: redactToString(event.value),
        reason: redactToString(event.reason)
    }));
    return clone;
}
// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------
export async function loadProject(root) {
    await assertNoInterruptedBuildMigration(root);
    const abs = resolveInside(root, PROJECT_REL);
    await assertNoSymlinkPath(root, abs);
    const text = await readTextIfPresent(abs);
    if (text === undefined)
        return undefined;
    const value = JSON.parse(text);
    assertBuildProject(value);
    return value;
}
export async function saveProject(root, project, dryRun) {
    const sanitized = sanitizeProject({ ...project, updated_at: utcNow() });
    assertBuildProject(sanitized);
    if (dryRun)
        return undefined;
    const dir = resolveInside(root, BUILD_DIR.join("/"));
    await assertNoSymlinkPath(root, dir);
    await mkdir(dir, { recursive: true });
    const abs = resolveInside(root, PROJECT_REL);
    await assertNoSymlinkPath(root, abs);
    await atomicWrite(root, abs, `${JSON.stringify(sanitized, null, 2)}\n`);
    return abs;
}
export async function loadFeature(root, slug) {
    await assertNoInterruptedBuildMigration(root);
    assertValidSlug(slug);
    const abs = resolveInside(root, featureRel(slug));
    await assertNoSymlinkPath(root, abs);
    const text = await readTextIfPresent(abs);
    if (text === undefined)
        return undefined;
    const value = JSON.parse(text);
    assertBuildFeature(value);
    if (value.slug !== slug)
        throw new Error(`Feature file for '${slug}' records a different slug '${value.slug}'.`);
    return value;
}
/** Enumerates the canonical feature directory and rejects unknown or non-regular entries. */
export async function listFeatures(root) {
    await assertNoInterruptedBuildMigration(root);
    const dir = resolveInside(root, ".forge/build/features");
    await assertNoSymlinkPath(root, dir);
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        if (error.code === "ENOENT")
            return [];
        throw error;
    }
    const features = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (!entry.isFile() || !/^[a-z0-9][a-z0-9-]{0,63}\.json$/u.test(entry.name))
            throw new Error(`Unsafe or unknown Build feature state entry '${entry.name}'.`);
        const slug = entry.name.slice(0, -".json".length);
        const feature = await loadFeature(root, slug);
        if (feature === undefined)
            throw new Error(`Build feature state '${entry.name}' disappeared during enumeration.`);
        features.push(feature);
    }
    return features;
}
export async function saveFeature(root, feature, dryRun) {
    assertValidSlug(feature.slug);
    const sanitized = sanitizeFeature({ ...feature, updated_at: utcNow() });
    assertBuildFeature(sanitized);
    if (dryRun)
        return undefined;
    const dir = resolveInside(root, `${BUILD_DIR.join("/")}/features`);
    await assertNoSymlinkPath(root, dir);
    await mkdir(dir, { recursive: true });
    const abs = resolveInside(root, featureRel(feature.slug));
    await assertNoSymlinkPath(root, abs);
    await atomicWrite(root, abs, `${JSON.stringify(sanitized, null, 2)}\n`);
    return abs;
}
export async function writeArtifact(root, name, content, dryRun) {
    if (dryRun)
        return undefined;
    const dir = resolveInside(root, BUILD_DIR.join("/"));
    await assertNoSymlinkPath(root, dir);
    await mkdir(dir, { recursive: true });
    const abs = resolveInside(root, `${BUILD_DIR.join("/")}/${name}`);
    await assertNoSymlinkPath(root, abs);
    await atomicWrite(root, abs, content);
    return abs;
}
/** Writes a replacement only after a complete same-directory temporary file exists. */
async function atomicWrite(root, target, content) {
    const temporary = join(dirname(target), `.${randomUUID()}.tmp`);
    await assertNoSymlinkPath(root, target);
    await assertNoSymlinkPath(root, temporary);
    try {
        await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
        await rename(temporary, target);
    }
    catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
}
// ---------------------------------------------------------------------------
// Hash freshness
// ---------------------------------------------------------------------------
/**
 * Re-verifies every positive claim against its registered producer, repository identity, current
 * revision, expiry, outer fields, and artifact hashes. Invalid claims are retained as diagnostics
 * but demoted to NOT_VERIFIED, so persisted state alone can never satisfy a Build gate.
 */
export async function reverifyEvidenceHashes(root, feature) {
    const clone = structuredClone(feature);
    const demoted = [];
    const verified = [];
    const revision = await workingTreeRevision(root);
    const canonicalRoot = await canonicalDirectory(root);
    for (const record of clone.evidence) {
        if (record.migration_state === "migrated-untrusted") {
            if (record.status === "PASS" || record.status === "NOT_APPLICABLE")
                demoteEvidence(record, demoted, "migrated evidence is historical and untrusted");
            continue;
        }
        const positive = record.status === "PASS" || record.status === "NOT_APPLICABLE";
        if (!positive)
            continue;
        if (record.producer_version === undefined ||
            record.limitations === undefined ||
            record.revision === undefined ||
            record.expires_at === undefined ||
            record.envelope === undefined) {
            demoteEvidence(record, demoted, "the record has no complete registered evidence envelope");
            continue;
        }
        const verification = await verifyBuildEvidenceEnvelopeIntegrity({
            root,
            revision,
            claim: {
                criterion: record.criterion,
                ...(record.discipline === undefined ? {} : { discipline: record.discipline }),
                security_control: record.security_control,
                status: record.status,
                producer: record.producer,
                producer_version: record.producer_version,
                evidence: record.evidence,
                limitations: record.limitations,
                files: record.files,
                instance_ids: record.instance_ids,
                recorded_at: record.recorded_at,
                expires_at: record.expires_at,
                ...(record.not_applicable_reason === undefined
                    ? {}
                    : { not_applicable_reason: record.not_applicable_reason }),
                ...(record.runtime === undefined ? {} : { runtime: record.runtime }),
                ...(record.command === undefined ? {} : { command: record.command }),
                envelope: record.envelope
            }
        });
        if (!verification.verified)
            demoteEvidence(record, demoted, verification.reasons.join(" "));
        else
            verified.push(record.criterion);
    }
    for (const acceptance of clone.risk_acceptances) {
        if (acceptance.lifecycle === "expired")
            continue;
        let stale = acceptance.migration_state === "migrated-untrusted" ||
            acceptance.canonical_root !== canonicalRoot ||
            acceptance.revision !== revision ||
            acceptance.expires_at === undefined ||
            !Number.isFinite(Date.parse(acceptance.expires_at)) ||
            Date.parse(acceptance.expires_at) <= Date.now() ||
            acceptance.relevant_files === undefined ||
            acceptance.relevant_files.length === 0;
        for (const file of acceptance.relevant_files ?? []) {
            try {
                if (sha256(await readFile(resolveInside(root, file.path))) !== file.sha256)
                    stale = true;
            }
            catch {
                stale = true;
            }
            if (stale)
                break;
        }
        if (stale) {
            acceptance.lifecycle = "expired";
            acceptance.expired_at = utcNow();
        }
    }
    clone.evidence_revision = revision;
    return {
        feature: clone,
        demoted: [...new Set(demoted)],
        verified: [...new Set(verified)]
    };
}
function demoteEvidence(record, demoted, reason) {
    if (record.status !== "NOT_VERIFIED") {
        record.status = "NOT_VERIFIED";
        record.evidence.push(`${utcNow()}: demoted to NOT_VERIFIED because ${redactToString(reason, 500)}.`);
        record.expired_at = utcNow();
        demoted.push(record.criterion);
    }
}
export function upsertFeatureIndex(project, feature) {
    const entry = {
        slug: feature.slug,
        phase: feature.phase,
        tier: feature.tier,
        updated_at: feature.updated_at
    };
    const features = project.features.filter((item) => item.slug !== feature.slug);
    features.push(entry);
    features.sort((a, b) => a.slug.localeCompare(b.slug));
    return { ...project, features };
}
/** Appends an immutable selection record; callers cannot replace prior selection history. */
export function appendSelectionEvent(state, event) {
    return {
        ...state,
        selection_events: [
            ...state.selection_events,
            { ...event, id: randomUUID(), recorded_at: utcNow() }
        ]
    };
}
export function newProject(summary, tier) {
    const now = utcNow();
    return {
        schema_version: BUILD_STATE_VERSION,
        generated_at: now,
        updated_at: now,
        product: { summary },
        ...(tier === undefined ? {} : { risk_class: tier }),
        stack: [],
        non_goals: [],
        features: [],
        frame: {
            problem_statement: summary,
            target_users: [],
            users_and_roles: [],
            desired_outcomes: [],
            business_rules: [],
            business_invariants: [],
            constraints: [],
            critical_workflows: [],
            sensitive_data_classes: [],
            trust_boundaries: [],
            expected_scale: "",
            stack_entries: [],
            assumptions: [],
            unresolved_decisions: [],
            initial_feature_backlog: [],
            design_direction_reference: ""
        },
        design_alignment: { status: "NOT_VERIFIED", references: [], recorded_at: now },
        selection_events: [],
        history: {}
    };
}
export function newFeature(slug, tier, summary) {
    const now = utcNow();
    return {
        schema_version: BUILD_STATE_VERSION,
        slug,
        created_at: now,
        updated_at: now,
        phase: "frame",
        tier,
        tier_inputs: [],
        summary,
        disciplines: [],
        decisions: [],
        assumptions: [],
        touched_paths: [],
        evidence: [],
        risk_acceptances: [],
        repair_counters: [],
        blockers: [],
        evidence_run_ids: [],
        selection_events: [],
        history: {}
    };
}
