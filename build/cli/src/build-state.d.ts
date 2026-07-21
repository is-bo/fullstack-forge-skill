import { BUILD_SUB_VERBS } from "./constants.js";
import { type EvidenceCommand, type EvidenceEnvelope, type EvidenceRuntimeContext } from "./evidence-envelope.js";
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
export declare const BUILD_STATE_VERSION: 2;
export declare const LEGACY_BUILD_STATE_VERSION: 1;
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
    producer_version?: string;
    evidence: string[];
    limitations?: string[];
    files: EvidenceFile[];
    instance_ids: string[];
    recorded_at: string;
    revision?: string;
    expires_at?: string;
    command?: EvidenceCommand;
    runtime?: EvidenceRuntimeContext[];
    envelope?: EvidenceEnvelope;
    not_applicable_reason?: string;
    /** v1 imports are retained for auditability but never trusted as current evidence. */
    migration_state?: "migrated-untrusted";
    expired_at?: string;
};
export type RiskAcceptance = {
    criterion: string;
    category?: "advisory" | "operational";
    actor?: string;
    reason: string;
    canonical_root?: string;
    revision: string;
    policy?: "advisory" | "operational-human";
    relevant_files?: EvidenceFile[];
    timestamp: string;
    expires_at?: string;
    /** A migrated v1 acceptance is historical only and can never satisfy a v2 gate. */
    migration_state?: "migrated-untrusted";
    lifecycle?: "active" | "expired";
    expired_at?: string;
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
export type ProjectFrame = {
    problem_statement: string;
    target_users: string[];
    users_and_roles: Array<{
        user: string;
        roles: string[];
    }>;
    desired_outcomes: string[];
    business_rules: string[];
    business_invariants: string[];
    constraints: string[];
    critical_workflows: string[];
    sensitive_data_classes: string[];
    trust_boundaries: string[];
    expected_scale: string;
    stack_entries: Array<{
        name: string;
        rationale: string;
    }>;
    assumptions: string[];
    unresolved_decisions: string[];
    initial_feature_backlog: string[];
    design_direction_reference: string;
};
export type SelectionEvent = {
    id: string;
    kind: "discipline" | "tier" | "applicability";
    action: "selected" | "deselected" | "recorded";
    value: string;
    reason: string;
    recorded_at: string;
    source: "user" | "cli" | "migration";
};
export type BuildHistory = {
    migrated_from?: number;
    migrated_at?: string;
};
export type DesignAlignment = {
    status: "NOT_VERIFIED" | "ALIGNED" | "DRIFT";
    references: string[];
    recorded_at: string;
};
export type ApplicabilitySnapshot = {
    recorded_at: string;
    source_revision?: string;
    disciplines: Array<{
        slug: string;
        applicable: boolean;
        reason: string;
    }>;
};
export type FeatureApplicabilitySnapshot = {
    recorded_at: string;
    revision: string;
    decisions: Array<{
        discipline: string;
        status: "REQUIRED" | "SUGGESTED" | "EXCLUDED" | "UNRESOLVED";
        confidence: "LOW" | "MEDIUM" | "HIGH";
        evidence: string[];
        exclusion_reason?: string;
    }>;
    required: string[];
    suggested: string[];
    unresolved: string[];
    excluded: string[];
};
export type BuildGateSnapshot = {
    id: string;
    name: string;
    tier: BuildTier;
    criteria: string[];
    required: boolean;
    waiver_policy: "never" | "advisory" | "operational-human";
    non_waivable: boolean;
    reason: string;
};
export type BuildGatePlanSnapshot = {
    recorded_at: string;
    revision: string;
    gates: BuildGateSnapshot[];
    required_criteria: string[];
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
    /** Opaque references to independently verified evidence envelopes. */
    evidence_run_ids: string[];
    evidence_revision?: string;
    applicability_snapshot?: FeatureApplicabilitySnapshot;
    gate_plan?: BuildGatePlanSnapshot;
    selection_events: SelectionEvent[];
    history: BuildHistory;
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
    frame: ProjectFrame;
    design_alignment: DesignAlignment;
    applicability_snapshot?: ApplicabilitySnapshot;
    selection_events: SelectionEvent[];
    history: BuildHistory;
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
/** Raised before any v1 state is trusted by an ordinary Build command. */
export declare class BuildMigrationRequiredError extends Error {
    constructor(kind: "project" | "feature");
}
/** Prevents normal Build operations from racing an interrupted replacement set. */
export declare class BuildMigrationPendingError extends Error {
    constructor();
}
export declare function assertNoInterruptedBuildMigration(root: string): Promise<void>;
export declare function loadProject(root: string): Promise<BuildProject | undefined>;
export declare function saveProject(root: string, project: BuildProject, dryRun: boolean): Promise<string | undefined>;
export declare function loadFeature(root: string, slug: string): Promise<BuildFeature | undefined>;
/** Enumerates the canonical feature directory and rejects unknown or non-regular entries. */
export declare function listFeatures(root: string): Promise<BuildFeature[]>;
export declare function saveFeature(root: string, feature: BuildFeature, dryRun: boolean): Promise<string | undefined>;
export declare function writeArtifact(root: string, name: string, content: string, dryRun: boolean): Promise<string | undefined>;
/**
 * Re-verifies every positive claim against its registered producer, repository identity, current
 * revision, expiry, outer fields, and artifact hashes. Invalid claims are retained as diagnostics
 * but demoted to NOT_VERIFIED, so persisted state alone can never satisfy a Build gate.
 */
export declare function reverifyEvidenceHashes(root: string, feature: BuildFeature): Promise<{
    feature: BuildFeature;
    demoted: string[];
    verified: string[];
}>;
export declare function upsertFeatureIndex(project: BuildProject, feature: BuildFeature): BuildProject;
/** Appends an immutable selection record; callers cannot replace prior selection history. */
export declare function appendSelectionEvent<T extends {
    selection_events: SelectionEvent[];
}>(state: T, event: Omit<SelectionEvent, "id" | "recorded_at">): T;
export declare function newProject(summary: string, tier: BuildTier | undefined): BuildProject;
export declare function newFeature(slug: string, tier: BuildTier, summary: string): BuildFeature;
