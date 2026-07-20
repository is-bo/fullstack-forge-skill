import { BUILD_SUB_VERBS } from "./constants.js";
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
export declare const BUILD_STATE_VERSION: 1;
export declare const BUILD_PHASES: readonly ["frame", "plan", "implement", "check", "done", "blocked", "abandoned"];
export type BuildPhase = (typeof BUILD_PHASES)[number];
export declare const TERMINAL_PHASES: ReadonlySet<BuildPhase>;
export declare const BUILD_TIERS: readonly ["light", "standard", "high"];
export type BuildTier = (typeof BUILD_TIERS)[number];
export declare const CRITERION_STATUSES: readonly ["PASS", "FAIL", "NOT_VERIFIED", "NOT_APPLICABLE", "BLOCKED"];
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];
/**
 * Disciplines whose criterion is a required security control at high tier. A high-tier security
 * control may never be waived by risk acceptance and a NOT_VERIFIED value always refuses `done`.
 */
export declare const SECURITY_DISCIPLINES: ReadonlySet<string>;
export type EvidenceFile = {
    path: string;
    sha256: string;
};
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
export type RepairCounter = {
    criterion: string;
    signature: string;
    count: number;
};
export type Blocker = {
    criterion: string;
    reason: string;
    timestamp: string;
};
export type DisciplineSelection = {
    slug: string;
    reason: string;
};
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
export type NonGoal = {
    item: string;
    reason: string;
};
export type BuildProject = {
    schema_version: typeof BUILD_STATE_VERSION;
    generated_at: string;
    updated_at: string;
    product: {
        name?: string;
        summary: string;
    };
    risk_class?: BuildTier;
    stack: string[];
    non_goals: NonGoal[];
    features: FeatureIndexEntry[];
};
export declare const BUILD_DIR: string[];
/** Repair-cycle cap: the same failing signature may recur at most this many times before blocking. */
export declare const REPAIR_CAP = 2;
export type BuildSubVerb = (typeof BUILD_SUB_VERBS)[number];
/**
 * Validates a feature slug fail-closed.
 *
 * The grammar rejects path traversal, alternate-data-stream and drive syntax (`a..b`, `x:y`),
 * trailing dots/spaces, and control characters purely by not matching the pattern. On top of that,
 * reserved sub-verbs, the audit module slugs, platform selector names, and Windows reserved device
 * names are rejected explicitly so a feature can never be mistaken for a command or an unsafe path.
 */
export declare function assertValidSlug(slug: string): void;
export declare function assertBuildProject(value: unknown): asserts value is BuildProject;
export declare function assertBuildFeature(value: unknown): asserts value is BuildFeature;
export declare function loadProject(root: string): Promise<BuildProject | undefined>;
export declare function saveProject(root: string, project: BuildProject, dryRun: boolean): Promise<string | undefined>;
export declare function loadFeature(root: string, slug: string): Promise<BuildFeature | undefined>;
export declare function saveFeature(root: string, feature: BuildFeature, dryRun: boolean): Promise<string | undefined>;
export declare function writeArtifact(root: string, name: string, content: string, dryRun: boolean): Promise<string | undefined>;
/**
 * Re-verifies each evidence record's per-file hashes and demotes stale evidence to NOT_VERIFIED.
 *
 * Freshness is judged by file content hash, not by a whole-tree revision: an evidence record stays
 * trustworthy exactly as long as every file it was derived from is byte-identical. A changed or
 * missing file demotes the record (recorded in its evidence log, never deleted), so a reloaded PASS
 * can never outlive the source it was proven against.
 */
export declare function reverifyEvidenceHashes(root: string, feature: BuildFeature): Promise<{
    feature: BuildFeature;
    demoted: string[];
}>;
export declare function upsertFeatureIndex(project: BuildProject, feature: BuildFeature): BuildProject;
export declare function newProject(summary: string, tier: BuildTier | undefined): BuildProject;
export declare function newFeature(slug: string, tier: BuildTier, summary: string): BuildFeature;
