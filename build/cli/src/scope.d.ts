import type { ModuleSlug } from "./constants.js";
import type { ModuleCapabilityStatus, ModuleDecision, ProjectProfile } from "./types.js";
export type ChangedFileEvidence = {
    path: string;
    previous_path?: string;
    status: "added" | "modified" | "deleted" | "renamed" | "untracked";
    sources: string[];
};
export type IncludedFileEvidence = {
    path: string;
    reasons: string[];
};
export type ChangedScopeEvidence = {
    repository_root: string;
    base_ref: string;
    base_commit: string;
    merge_base: string;
    changed_files: ChangedFileEvidence[];
    included_files: IncludedFileEvidence[];
    excluded_applications: Array<{
        name: string;
        root: string;
        reason: string;
    }>;
    affected_applications: Array<{
        name: string;
        root: string;
        reasons: string[];
    }>;
    affected_modules: Array<{
        section: ModuleSlug;
        reasons: string[];
    }>;
};
export type ChangedScope = {
    evidence: ChangedScopeEvidence;
    files: Set<string>;
    modules: Set<ModuleSlug>;
};
/**
 * Determines whether a module's capability exists in the project, independent of whether this run
 * audits it.
 *
 * ABSENT is only returned when discovery actually produced capability signals and this one was
 * not among them. When discovery recorded nothing at all, absence is unproven, so the result is
 * UNKNOWN — a module cannot be declared inapplicable on the strength of a discovery pass that
 * observed nothing.
 */
export declare function capabilityStatusFor(section: ModuleSlug, profile: ProjectProfile): {
    status: ModuleCapabilityStatus;
    evidence: string[];
};
/** Risk surfaces select modules; control presence never suppresses them. */
export declare function riskStatusFor(section: ModuleSlug, profile: ProjectProfile): {
    status: ModuleCapabilityStatus;
    evidence: string[];
};
export type ModuleDecisionInput = {
    /** Every module the run could have considered, before any filter. */
    candidates: readonly ModuleSlug[];
    profile: ProjectProfile;
    /** True when an operator named a single module directly instead of running `all`. */
    explicit: boolean;
    /** Modules permitted by an active `--risk` filter. Undefined means no risk filter was applied. */
    riskAllowed?: ReadonlySet<ModuleSlug>;
    riskLabel?: string;
    /** Modules reachable from the changed set. Undefined means changed scope was not requested. */
    changedModules?: ReadonlySet<ModuleSlug>;
};
/**
 * Produces one machine-readable decision per candidate module.
 *
 * The two axes stay independent on purpose. `capability_status` is the only thing that can
 * justify NOT_APPLICABLE downstream; `selection_status` merely records why this run did or did
 * not audit the module. A module whose files did not change is OUT_OF_CHANGED_SCOPE with its
 * capability still PRESENT, so no consumer can mistake "unaudited" for "does not exist".
 */
export declare function decideModules(input: ModuleDecisionInput): ModuleDecision[];
/**
 * The status a module-level coverage finding may carry.
 *
 * NOT_APPLICABLE is reserved for a capability that provably does not exist. Anything unaudited
 * for a scoping reason is NOT_VERIFIED, because the run produced no evidence either way.
 */
export declare function decisionFindingStatus(decision: ModuleDecision): "SELECTED" | "NOT_APPLICABLE" | "NOT_VERIFIED";
export declare function analyzeChangedScope(rootInput: string, profile: ProjectProfile, requestedBase?: string): Promise<ChangedScope>;
/**
 * Resolves a relative module specifier against the analyzed file set.
 *
 * Shared with cross-file guard resolution so the audit has exactly one module resolver.
 */
export declare function resolveImport(importer: string, request: string, files: Set<string>): string | undefined;
