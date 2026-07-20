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

export const BUILD_STATE_VERSION = 1 as const;

export const BUILD_PHASES = [
  "frame",
  "plan",
  "implement",
  "check",
  "done",
  "blocked",
  "abandoned"
] as const;
export type BuildPhase = (typeof BUILD_PHASES)[number];
export const TERMINAL_PHASES: ReadonlySet<BuildPhase> = new Set(["done", "blocked", "abandoned"]);

export const BUILD_TIERS = ["light", "standard", "high"] as const;
export type BuildTier = (typeof BUILD_TIERS)[number];

export const CRITERION_STATUSES = [
  "PASS",
  "FAIL",
  "NOT_VERIFIED",
  "NOT_APPLICABLE",
  "BLOCKED"
] as const;
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];

/**
 * Disciplines whose criterion is a required security control at high tier. A high-tier security
 * control may never be waived by risk acceptance and a NOT_VERIFIED value always refuses `done`.
 */
export const SECURITY_DISCIPLINES: ReadonlySet<string> = new Set([
  "auth",
  "authorization",
  "security",
  "privacy",
  "tenancy",
  "uploads",
  "payments"
]);

export type EvidenceFile = { path: string; sha256: string };

export type CriterionEvidence = {
  criterion: string;
  discipline?: string;
  security_control: boolean;
  status: CriterionStatus;
  producer: string;
  evidence: string[];
  files: EvidenceFile[];
  instance_ids: string[];
  recorded_at: string;
  not_applicable_reason?: string;
};

export type RiskAcceptance = {
  criterion: string;
  reason: string;
  revision: string;
  timestamp: string;
};

export type RepairCounter = { criterion: string; signature: string; count: number };
export type Blocker = { criterion: string; reason: string; timestamp: string };
export type DisciplineSelection = { slug: string; reason: string };

export type BuildFeature = {
  schema_version: typeof BUILD_STATE_VERSION;
  slug: string;
  created_at: string;
  updated_at: string;
  phase: BuildPhase;
  tier: BuildTier;
  tier_inputs: string[];
  tier_override_reason?: string;
  summary: string;
  disciplines: DisciplineSelection[];
  plan_summary?: string;
  plan_hash?: string;
  decisions: string[];
  assumptions: string[];
  touched_paths: string[];
  evidence: CriterionEvidence[];
  risk_acceptances: RiskAcceptance[];
  repair_counters: RepairCounter[];
  blockers: Blocker[];
};

export type FeatureIndexEntry = {
  slug: string;
  phase: BuildPhase;
  tier: BuildTier;
  updated_at: string;
};

export type NonGoal = { item: string; reason: string };

export type BuildProject = {
  schema_version: typeof BUILD_STATE_VERSION;
  generated_at: string;
  updated_at: string;
  product: { name?: string; summary: string };
  risk_class?: BuildTier;
  stack: string[];
  non_goals: NonGoal[];
  features: FeatureIndexEntry[];
};

export const BUILD_DIR = [".forge", "build"];
const PROJECT_REL = ".forge/build/project.json";
const featureRel = (slug: string): string => `.forge/build/features/${slug}.json`;

/** Repair-cycle cap: the same failing signature may recur at most this many times before blocking. */
export const REPAIR_CAP = 2;

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const WINDOWS_RESERVED_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;

export type BuildSubVerb = (typeof BUILD_SUB_VERBS)[number];

const RESERVED_SLUGS: ReadonlySet<string> = new Set([
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
export function assertValidSlug(slug: string): void {
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug))
    throw new Error(
      `Invalid feature slug '${slug}'. A slug must match ^[a-z0-9][a-z0-9-]{0,63}$ (lowercase letters, digits, and hyphens).`
    );
  if (WINDOWS_RESERVED_DEVICE.test(slug))
    throw new Error(`Feature slug '${slug}' is a Windows reserved device name and cannot be used.`);
  if (RESERVED_SLUGS.has(slug))
    throw new Error(
      `Feature slug '${slug}' is a reserved word (a sub-verb, audit module, or platform name). Choose a distinct feature name.`
    );
}

// ---------------------------------------------------------------------------
// Fail-closed validators
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function assertBuildProject(value: unknown): asserts value is BuildProject {
  const errors: string[] = [];
  if (!isRecord(value)) throw new Error("Build project state must be an object.");
  if (value.schema_version !== BUILD_STATE_VERSION)
    errors.push(`schema_version must be ${BUILD_STATE_VERSION}`);
  for (const field of ["generated_at", "updated_at"] as const)
    if (typeof value[field] !== "string" || value[field].length === 0)
      errors.push(`${field} must be a non-empty string`);
  if (!isRecord(value.product) || typeof value.product.summary !== "string")
    errors.push("product.summary must be a string");
  if (
    value.risk_class !== undefined &&
    !(BUILD_TIERS as readonly string[]).includes(value.risk_class as string)
  )
    errors.push("risk_class must be a valid tier");
  if (!isStringArray(value.stack)) errors.push("stack must be a string array");
  if (
    !Array.isArray(value.non_goals) ||
    !value.non_goals.every(
      (goal) => isRecord(goal) && typeof goal.item === "string" && typeof goal.reason === "string"
    )
  )
    errors.push("non_goals must be an array of {item, reason}");
  if (
    !Array.isArray(value.features) ||
    !value.features.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.slug === "string" &&
        SLUG_PATTERN.test(entry.slug) &&
        (BUILD_PHASES as readonly string[]).includes(entry.phase as string) &&
        (BUILD_TIERS as readonly string[]).includes(entry.tier as string) &&
        typeof entry.updated_at === "string"
    )
  )
    errors.push("features must be an array of valid index entries");
  if (errors.length > 0) throw new Error(`Invalid build project state:\n${errors.join("\n")}`);
}

export function assertBuildFeature(value: unknown): asserts value is BuildFeature {
  const errors: string[] = [];
  if (!isRecord(value)) throw new Error("Build feature state must be an object.");
  if (value.schema_version !== BUILD_STATE_VERSION)
    errors.push(`schema_version must be ${BUILD_STATE_VERSION}`);
  if (typeof value.slug !== "string" || !SLUG_PATTERN.test(value.slug))
    errors.push("slug must be a valid feature slug");
  for (const field of ["created_at", "updated_at", "summary"] as const)
    if (typeof value[field] !== "string") errors.push(`${field} must be a string`);
  if (!(BUILD_PHASES as readonly string[]).includes(value.phase as string))
    errors.push("phase must be a valid build phase");
  if (!(BUILD_TIERS as readonly string[]).includes(value.tier as string))
    errors.push("tier must be a valid tier");
  if (!isStringArray(value.tier_inputs)) errors.push("tier_inputs must be a string array");
  if (value.tier_override_reason !== undefined && typeof value.tier_override_reason !== "string")
    errors.push("tier_override_reason must be a string when present");
  if (
    !Array.isArray(value.disciplines) ||
    !value.disciplines.every(
      (item) => isRecord(item) && typeof item.slug === "string" && typeof item.reason === "string"
    )
  )
    errors.push("disciplines must be an array of {slug, reason}");
  if (value.plan_summary !== undefined && typeof value.plan_summary !== "string")
    errors.push("plan_summary must be a string when present");
  if (
    value.plan_hash !== undefined &&
    (typeof value.plan_hash !== "string" || !/^[a-f0-9]{64}$/u.test(value.plan_hash))
  )
    errors.push("plan_hash must be a sha256 digest when present");
  for (const field of ["decisions", "assumptions", "touched_paths"] as const)
    if (!isStringArray(value[field])) errors.push(`${field} must be a string array`);
  if (!Array.isArray(value.evidence) || !value.evidence.every(isValidEvidence))
    errors.push("evidence must be an array of valid criterion records");
  if (
    !Array.isArray(value.risk_acceptances) ||
    !value.risk_acceptances.every(isValidRiskAcceptance)
  )
    errors.push("risk_acceptances must be an array of valid records");
  if (!Array.isArray(value.repair_counters) || !value.repair_counters.every(isValidRepairCounter))
    errors.push("repair_counters must be an array of valid records");
  if (!Array.isArray(value.blockers) || !value.blockers.every(isValidBlocker))
    errors.push("blockers must be an array of valid records");
  if (errors.length > 0) throw new Error(`Invalid build feature state:\n${errors.join("\n")}`);
}

function isValidEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.criterion === "string" &&
    value.criterion.length > 0 &&
    typeof value.security_control === "boolean" &&
    (CRITERION_STATUSES as readonly string[]).includes(value.status as string) &&
    typeof value.producer === "string" &&
    isStringArray(value.evidence) &&
    Array.isArray(value.files) &&
    value.files.every(
      (file) =>
        isRecord(file) &&
        typeof file.path === "string" &&
        file.path.length > 0 &&
        typeof file.sha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(file.sha256)
    ) &&
    isStringArray(value.instance_ids) &&
    typeof value.recorded_at === "string" &&
    (value.discipline === undefined || typeof value.discipline === "string") &&
    (value.not_applicable_reason === undefined || typeof value.not_applicable_reason === "string")
  );
}

function isValidRiskAcceptance(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.criterion === "string" &&
    typeof value.reason === "string" &&
    value.reason.length > 0 &&
    typeof value.revision === "string" &&
    typeof value.timestamp === "string"
  );
}

function isValidRepairCounter(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.criterion === "string" &&
    typeof value.signature === "string" &&
    typeof value.count === "number" &&
    Number.isInteger(value.count) &&
    value.count >= 0
  );
}

function isValidBlocker(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.criterion === "string" &&
    typeof value.reason === "string" &&
    typeof value.timestamp === "string"
  );
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
function sanitizeFeature(feature: BuildFeature): BuildFeature {
  const clone = structuredClone(feature);
  clone.summary = redactToString(clone.summary);
  if (clone.tier_override_reason !== undefined)
    clone.tier_override_reason = redactToString(clone.tier_override_reason);
  if (clone.plan_summary !== undefined) clone.plan_summary = redactToString(clone.plan_summary);
  clone.decisions = clone.decisions.map((item) => redactToString(item));
  clone.assumptions = clone.assumptions.map((item) => redactToString(item));
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

function sanitizeProject(project: BuildProject): BuildProject {
  const clone = structuredClone(project);
  clone.product.summary = redactToString(clone.product.summary);
  if (clone.product.name !== undefined) clone.product.name = redactToString(clone.product.name);
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

export async function loadProject(root: string): Promise<BuildProject | undefined> {
  const abs = resolveInside(root, PROJECT_REL);
  await assertNoSymlinkPath(root, abs);
  const text = await readTextIfPresent(abs);
  if (text === undefined) return undefined;
  const value = JSON.parse(text) as unknown;
  assertBuildProject(value);
  return value;
}

export async function saveProject(
  root: string,
  project: BuildProject,
  dryRun: boolean
): Promise<string | undefined> {
  const sanitized = sanitizeProject({ ...project, updated_at: utcNow() });
  assertBuildProject(sanitized);
  if (dryRun) return undefined;
  const dir = resolveInside(root, BUILD_DIR.join("/"));
  await assertNoSymlinkPath(root, dir);
  await mkdir(dir, { recursive: true });
  const abs = resolveInside(root, PROJECT_REL);
  await assertNoSymlinkPath(root, abs);
  await writeFile(abs, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  return abs;
}

export async function loadFeature(root: string, slug: string): Promise<BuildFeature | undefined> {
  assertValidSlug(slug);
  const abs = resolveInside(root, featureRel(slug));
  await assertNoSymlinkPath(root, abs);
  const text = await readTextIfPresent(abs);
  if (text === undefined) return undefined;
  const value = JSON.parse(text) as unknown;
  assertBuildFeature(value);
  if (value.slug !== slug)
    throw new Error(`Feature file for '${slug}' records a different slug '${value.slug}'.`);
  return value;
}

export async function saveFeature(
  root: string,
  feature: BuildFeature,
  dryRun: boolean
): Promise<string | undefined> {
  assertValidSlug(feature.slug);
  const sanitized = sanitizeFeature({ ...feature, updated_at: utcNow() });
  assertBuildFeature(sanitized);
  if (dryRun) return undefined;
  const dir = resolveInside(root, `${BUILD_DIR.join("/")}/features`);
  await assertNoSymlinkPath(root, dir);
  await mkdir(dir, { recursive: true });
  const abs = resolveInside(root, featureRel(feature.slug));
  await assertNoSymlinkPath(root, abs);
  await writeFile(abs, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  return abs;
}

export async function writeArtifact(
  root: string,
  name: string,
  content: string,
  dryRun: boolean
): Promise<string | undefined> {
  if (dryRun) return undefined;
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
export async function reverifyEvidenceHashes(
  root: string,
  feature: BuildFeature
): Promise<{ feature: BuildFeature; demoted: string[] }> {
  const clone = structuredClone(feature);
  const demoted: string[] = [];
  for (const record of clone.evidence) {
    if (record.status === "NOT_VERIFIED" || record.files.length === 0) continue;
    let stale = false;
    for (const file of record.files) {
      try {
        const current = sha256(await readFile(resolveInside(root, file.path)));
        if (current !== file.sha256) stale = true;
      } catch {
        stale = true;
      }
      if (stale) break;
    }
    if (stale) {
      record.status = "NOT_VERIFIED";
      record.evidence.push(
        `${utcNow()}: demoted to NOT_VERIFIED because a source file hash changed since this evidence was recorded.`
      );
      demoted.push(record.criterion);
    }
  }
  return { feature: clone, demoted };
}

export function upsertFeatureIndex(project: BuildProject, feature: BuildFeature): BuildProject {
  const entry: FeatureIndexEntry = {
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

export function newProject(summary: string, tier: BuildTier | undefined): BuildProject {
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

export function newFeature(slug: string, tier: BuildTier, summary: string): BuildFeature {
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
