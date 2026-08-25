/**
 * Composition engine: decides which upstream expertise applies to a Forge module for one
 * repository and one request.
 *
 * Forge owns applicability. Upstream skills carry specialist procedure but no routing authority:
 * they are selected here, from proven repository evidence or an explicit user request, and never
 * by announcing themselves to the agent host. Three rules hold without exception.
 *
 *   1. The Forge contract is always first in the load order.
 *   2. A provider source loads only when its activation condition is satisfied by evidence.
 *   3. The context budget is enforced, and anything dropped is reported rather than hidden.
 */
import type { Confidence, ProjectProfile } from "./types.js";
export type CompositionMode = "forge-native" | "hybrid" | "upstream-powered";
/** Intent controls which progressive procedure and provider sources are admissible. */
export declare const COMPOSITION_WORKFLOWS: readonly ["build", "audit", "fix", "verify", "ship"];
export type CompositionWorkflow = (typeof COMPOSITION_WORKFLOWS)[number];
export type OutputClassification = "finding" | "finding-or-advisory" | "advisory" | "profile" | "specification" | "report" | "gate";
/**
 * Activation evidence. Every key except `always` names a dimension of the discovered project
 * profile or an explicit request; a condition holds when any listed value matches any dimension.
 * An unknown key can never activate a source, so a typo suppresses rather than over-activates.
 */
export type ActivationCondition = {
    always?: boolean;
    languages?: string[];
    frameworks?: string[];
    databases?: string[];
    hosting?: string[];
    integrations?: string[];
    observability?: string[];
    paymentProviders?: string[];
    aiProviders?: string[];
    riskSurfaces?: string[];
    requested?: string[];
    ci?: boolean;
    retrieval?: boolean;
    migration?: boolean;
    threatModelling?: boolean;
    gdprRelevant?: boolean;
    testingApplicable?: boolean;
    missingEssentialRequirements?: boolean;
    divergentExploration?: boolean;
    incidentInvestigation?: boolean;
    /** Minimum confidence for profile-record matches in this condition. Defaults to MEDIUM. */
    minimumConfidence?: Confidence;
    /** Every nested condition must match. The strongest proven positive authority sets its rank. */
    allOf?: ActivationCondition[];
    /** At least one nested condition must match. The strongest matching branch wins. */
    anyOf?: ActivationCondition[];
    /** This nested condition must not match. It never increases activation strength. */
    not?: ActivationCondition;
};
export type CompositionSource = {
    provider: string;
    skill: string;
    path: string;
    role?: string;
    sequence?: number;
    sections?: string[];
    commands?: string[];
    /** Higher values win only after sequence and activation strength are equal. */
    priority?: number;
    /** Workflows in which this source may be selected; omission keeps the legacy tier policy. */
    workflows?: CompositionWorkflow[];
    when: ActivationCondition;
};
export type ContextBudget = {
    maxPrimarySkills: number;
    maxOverlays: number;
    maxSupplemental: number;
};
export type ModuleComposition = {
    module: string;
    mode: CompositionMode;
    designation: string;
    forgeContract: string;
    /** Optional per-workflow Forge contract paths; build falls back to `forgeContract`. */
    forgeContracts?: Partial<Record<CompositionWorkflow, string>>;
    primary: CompositionSource[];
    overlays: CompositionSource[];
    supplemental?: CompositionSource[];
    conflicts: {
        with: string;
        rule: string;
    }[];
    dependsOn: string[];
    outputClassification: OutputClassification;
    contextBudget?: ContextBudget;
    forgeAuthority: string[];
};
export type CompositionManifest = {
    schemaVersion: number;
    defaultContextBudget: ContextBudget;
    /** Generic workflow references used when a module has no per-workflow override. */
    workflowContracts?: Partial<Record<CompositionWorkflow, string>>;
    modules: ModuleComposition[];
};
/** One canonical dependency declaration retained for selection provenance. */
export type ModuleDependencyEdge = {
    /** Module whose declaration introduced this dependency. */
    parent: string;
    /** Module the parent requires. */
    dependency: string;
    /** Stable human-readable explanation suitable for module-decision evidence. */
    reason: string;
};
/**
 * Deterministic dependency closure for one or more explicitly selected roots.
 *
 * `modules` is breadth-first: de-duplicated roots first, then dependencies in each parent's
 * canonical declaration order. `edges` retains every reachable parent/dependency relationship,
 * including diamond joins and the edge that closes a cycle, so callers can explain why a module
 * was considered without attempting graph traversal themselves.
 */
export type ModuleDependencyClosure = {
    roots: string[];
    modules: string[];
    edges: ModuleDependencyEdge[];
};
/**
 * Validates and resolves the Forge-module dependency graph.
 *
 * Validation covers the complete manifest, not only the requested subgraph. A damaged registry
 * must fail closed even when the bad declaration is not reachable from this particular request.
 * Traversal is queue-based and marks a module when it is enqueued, so cycles terminate and diamond
 * dependencies appear only once in `modules` while all distinct explanatory edges remain visible.
 */
export declare function resolveModuleDependencyClosure(manifest: CompositionManifest, requestedModules: readonly string[]): ModuleDependencyClosure;
export type SelectionTier = "forge-contract" | "primary" | "overlay" | "supplemental";
export type SelectedSource = {
    tier: SelectionTier;
    provider: string;
    skill: string;
    runtimePath: string;
    reason: string;
};
export type SuppressedSource = {
    tier: SelectionTier;
    provider: string;
    skill: string;
    reason: string;
};
export type CompositionResult = {
    module: string;
    workflow?: CompositionWorkflow;
    mode: CompositionMode;
    outputClassification: OutputClassification;
    /** Ordered load list. Index 0 is always the Forge contract. */
    selected: SelectedSource[];
    /** Sources to read when entering the module: Forge contract plus primary procedure. */
    eager?: SelectedSource[];
    /** Selected sources available on demand after the task reaches their concern. */
    deferred?: SelectedSource[];
    suppressed: SuppressedSource[];
    budget: ContextBudget;
    conflicts: {
        with: string;
        rule: string;
    }[];
    forgeAuthority: string[];
    /** Provider content the manifest requires but the installation does not contain. */
    missing: string[];
};
/** Evidence the engine matches conditions against. Built from discovery plus the request. */
export type CompositionEvidence = {
    profile?: ProjectProfile;
    /** Explicit task intent. Undefined preserves the historical build composition. */
    workflow?: CompositionWorkflow;
    /** Providers or technologies the user asked for by name. */
    requested?: string[];
    /** Risk surfaces Forge proved for this task, e.g. `frontend`, `api`, `payments`. */
    riskSurfaces?: string[];
    /** Task-shaped facts that are not repository detections. */
    flags?: Partial<Record<CompositionTaskFlag, boolean>>;
};
export declare const COMPOSITION_TASK_FLAGS: readonly ["ci", "retrieval", "migration", "threatModelling", "gdprRelevant", "testingApplicable", "missingEssentialRequirements", "divergentExploration", "incidentInvestigation"];
export type CompositionTaskFlag = (typeof COMPOSITION_TASK_FLAGS)[number];
/**
 * Evaluates one activation condition. Returns the reason it matched, or `undefined` when the
 * condition is not satisfied. A source with no positive satisfiable key never activates: absence
 * of evidence suppresses provider guidance rather than defaulting it on. `not` is an exclusion
 * filter only; it cannot establish applicability by itself.
 */
export declare function evaluateActivation(when: ActivationCondition, evidence: CompositionEvidence): string | undefined;
export type ResolveOptions = {
    manifest: CompositionManifest;
    module: string;
    evidence: CompositionEvidence;
    /** Overrides `evidence.workflow`; omitted means the legacy build composition. */
    workflow?: CompositionWorkflow;
    /** Runtime paths the installation actually contains, for damaged-installation detection. */
    availableRuntimePaths?: ReadonlySet<string>;
    /** Resolves a manifest source to its compiled runtime path. */
    runtimePathFor: (source: CompositionSource) => string;
};
/**
 * Resolves one module's composition. Deterministic: the same manifest and evidence always produce
 * the same ordered result, so generated reports and tests are stable.
 */
export declare function resolveComposition(options: ResolveOptions): CompositionResult;
/**
 * Fixed conflict precedence. Lower number wins. Implemented as data so a test can assert the whole
 * order and so a report can explain exactly why one instruction beat another.
 */
export declare const PRECEDENCE: readonly ["system-and-user-instructions", "explicit-task-requirements", "repository-architecture-and-conventions", "security-privacy-integrity-legal", "forge-evidence-and-ship-contracts", "forge-cross-module-coordination", "primary-upstream-workflow", "conditional-provider-overlay", "optional-style-preference"];
export type PrecedenceLevel = (typeof PRECEDENCE)[number];
export declare function precedenceRank(level: PrecedenceLevel): number;
/**
 * Resolves a conflict between two competing instructions. Returns the winner. Ties are impossible
 * between different levels; at the same level the caller must resolve it explicitly, so this
 * returns `undefined` rather than guessing.
 */
export declare function resolveConflict(left: PrecedenceLevel, right: PrecedenceLevel): PrecedenceLevel | undefined;
