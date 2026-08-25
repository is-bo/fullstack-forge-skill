import type { ModuleDependencyEdge } from "./composition.js";
import { type ModuleSlug } from "./constants.js";
import type { ModuleDecision, ProjectProfile } from "./types.js";
export type DependencyExpansionPolicy = {
    riskAllowed?: ReadonlySet<ModuleSlug>;
    riskLabel?: string;
    changedModules?: ReadonlySet<ModuleSlug>;
    /** Related concerns are one-hop by default; the canonical graph is cyclic, not a hard DAG. */
    maxDependencyDepth?: number;
    /**
     * Direct dependencies required by explicit task intent. These may bypass repository-evidence
     * selection, but never depth bounds or the explicit-only workflow denylist.
     */
    explicitIntentDependencies?: ReadonlySet<ModuleSlug>;
};
export type ApplicableDependencyExpansion = {
    decisions: ModuleDecision[];
    selected: ModuleSlug[];
    dependencyEdges: ModuleDependencyEdge[];
};
/**
 * Selects evidence-proven, directly coordinated expertise without flooding context.
 *
 * The manifest's `dependsOn` declarations form a related-concerns graph with large cycles. The
 * transitive closure remains useful for validation, but automatic composition follows one hop by
 * default. UNKNOWN applicability stays visible in the decision ledger and available for explicit
 * invocation; it never becomes an automatic load merely because a cycle can reach it.
 */
export declare function expandApplicableDependencies(root: string, profile: ProjectProfile, initialDecisions: ModuleDecision[], roots: ModuleSlug[], policy?: DependencyExpansionPolicy, runtimeRootOverride?: string): Promise<ApplicableDependencyExpansion>;
