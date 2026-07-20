import { mkdir, readFile, writeFile } from "node:fs/promises";
import { BUILD_SUB_VERBS, MODULE_SLUGS, PLATFORM_ALIASES, PLATFORM_CONFIG } from "./constants.js";
import { redactToString } from "./redaction.js";
import { assertNoSymlinkPath, readTextIfPresent, resolveInside, sha256, utcNow } from "./utils.js";
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
export const BUILD_STATE_VERSION = 1;
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
    "new",
    "resume",
    "feature",
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
    if (value.schema_version !== BUILD_STATE_VERSION)
        errors.push(`schema_version must be ${BUILD_STATE_VERSION}`);
    for (const field of ["generated_at", "updated_at"])
        if (typeof value[field] !== "string" || value[field].length === 0)
            errors.push(`${field} must be a non-empty string`);
    if (!isRecord(value.product) || typeof value.product.summary !== "string")
        errors.push("product.summary must be a string");
    if (value.risk_class !== undefined &&
        !BUILD_TIERS.includes(value.risk_class))
        errors.push("risk_class must be a valid tier");
    if (!isStringArray(value.stack))
        errors.push("stack must be a string array");
    if (!Array.isArray(value.non_goals) ||
        !value.non_goals.every((goal) => isRecord(goal) && typeof goal.item === "string" && typeof goal.reason === "string"))
        errors.push("non_goals must be an array of {item, reason}");
    if (!Array.isArray(value.features) ||
        !value.features.every((entry) => isRecord(entry) &&
            typeof entry.slug === "string" &&
            SLUG_PATTERN.test(entry.slug) &&
            BUILD_PHASES.includes(entry.phase) &&
            BUILD_TIERS.includes(entry.tier) &&
            typeof entry.updated_at === "string"))
        errors.push("features must be an array of valid index entries");
    if (errors.length > 0)
        throw new Error(`Invalid build project state:\n${errors.join("\n")}`);
}
export function assertBuildFeature(value) {
    const errors = [];
    if (!isRecord(value))
        throw new Error("Build feature state must be an object.");
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
        !value.disciplines.every((item) => isRecord(item) && typeof item.slug === "string" && typeof item.reason === "string"))
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
    if (errors.length > 0)
        throw new Error(`Invalid build feature state:\n${errors.join("\n")}`);
}
function isValidEvidence(value) {
    return (isRecord(value) &&
        typeof value.criterion === "string" &&
        value.criterion.length > 0 &&
        typeof value.security_control === "boolean" &&
        CRITERION_STATUSES.includes(value.status) &&
        typeof value.producer === "string" &&
        isStringArray(value.evidence) &&
        Array.isArray(value.files) &&
        value.files.every((file) => isRecord(file) &&
            typeof file.path === "string" &&
            file.path.length > 0 &&
            typeof file.sha256 === "string" &&
            /^[a-f0-9]{64}$/u.test(file.sha256)) &&
        isStringArray(value.instance_ids) &&
        typeof value.recorded_at === "string" &&
        (value.discipline === undefined || typeof value.discipline === "string") &&
        (value.not_applicable_reason === undefined || typeof value.not_applicable_reason === "string"));
}
function isValidRiskAcceptance(value) {
    return (isRecord(value) &&
        typeof value.criterion === "string" &&
        typeof value.reason === "string" &&
        value.reason.length > 0 &&
        typeof value.revision === "string" &&
        typeof value.timestamp === "string");
}
function isValidRepairCounter(value) {
    return (isRecord(value) &&
        typeof value.criterion === "string" &&
        typeof value.signature === "string" &&
        typeof value.count === "number" &&
        Number.isInteger(value.count) &&
        value.count >= 0);
}
function isValidBlocker(value) {
    return (isRecord(value) &&
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
        reason: redactToString(item.reason)
    }));
    clone.blockers = clone.blockers.map((item) => ({ ...item, reason: redactToString(item.reason) }));
    clone.evidence = clone.evidence.map((record) => ({
        ...record,
        evidence: record.evidence.map((line) => redactToString(line)),
        ...(record.not_applicable_reason === undefined
            ? {}
            : { not_applicable_reason: redactToString(record.not_applicable_reason) })
    }));
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
    return clone;
}
// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------
export async function loadProject(root) {
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
    await writeFile(abs, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    return abs;
}
export async function loadFeature(root, slug) {
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
    await writeFile(abs, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
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
    await writeFile(abs, content, "utf8");
    return abs;
}
// ---------------------------------------------------------------------------
// Hash freshness
// ---------------------------------------------------------------------------
/**
 * Re-verifies each evidence record's per-file hashes and demotes stale evidence to NOT_VERIFIED.
 *
 * Freshness is judged by file content hash, not by a whole-tree revision: an evidence record stays
 * trustworthy exactly as long as every file it was derived from is byte-identical. A changed or
 * missing file demotes the record (recorded in its evidence log, never deleted), so a reloaded PASS
 * can never outlive the source it was proven against.
 */
export async function reverifyEvidenceHashes(root, feature) {
    const clone = structuredClone(feature);
    const demoted = [];
    for (const record of clone.evidence) {
        // The check deriver never produces PASS for a discipline criterion (only FAIL,
        // NOT_APPLICABLE, or NOT_VERIFIED), so a reloaded discipline PASS can only be a
        // hand-edited state file. Demote it instead of trusting it.
        if (record.status === "PASS" && record.criterion.startsWith("discipline:")) {
            record.status = "NOT_VERIFIED";
            record.evidence.push("demoted on reload: a discipline criterion can never legitimately hold PASS");
            demoted.push(record.criterion);
            continue;
        }
        if (record.status === "NOT_VERIFIED" || record.files.length === 0)
            continue;
        let stale = false;
        for (const file of record.files) {
            try {
                const current = sha256(await readFile(resolveInside(root, file.path)));
                if (current !== file.sha256)
                    stale = true;
            }
            catch {
                stale = true;
            }
            if (stale)
                break;
        }
        if (stale) {
            record.status = "NOT_VERIFIED";
            record.evidence.push(`${utcNow()}: demoted to NOT_VERIFIED because a source file hash changed since this evidence was recorded.`);
            demoted.push(record.criterion);
        }
    }
    return { feature: clone, demoted };
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
        features: []
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
        blockers: []
    };
}
//# sourceMappingURL=build-state.js.map