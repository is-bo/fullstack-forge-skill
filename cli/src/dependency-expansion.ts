import type { ModuleDependencyEdge } from "./composition.js";
import { resolveRuntimeModuleDependencyClosure } from "./composition-runtime.js";
import { MODULE_SLUGS, type ModuleSlug } from "./constants.js";
import { decideModules } from "./scope.js";
import type { ModuleDecision, ProjectProfile } from "./types.js";

const EXPLICIT_ONLY_COMPOSITION_MODULES = new Set<ModuleSlug>(["discover", "all", "ship"]);
const KNOWN_MODULES = new Set<string>(MODULE_SLUGS);

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
export async function expandApplicableDependencies(
  root: string,
  profile: ProjectProfile,
  initialDecisions: ModuleDecision[],
  roots: ModuleSlug[],
  policy: DependencyExpansionPolicy = {},
  runtimeRootOverride?: string
): Promise<ApplicableDependencyExpansion> {
  if (roots.length === 0) return { decisions: initialDecisions, selected: [], dependencyEdges: [] };
  const maxDepth = policy.maxDependencyDepth ?? 1;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 4)
    throw new Error(`Invalid composition dependency depth '${maxDepth}'.`);

  const closure = await resolveRuntimeModuleDependencyClosure(root, roots, runtimeRootOverride);
  const unsupported = closure.modules.filter((module) => !KNOWN_MODULES.has(module));
  if (unsupported.length > 0)
    throw new Error(
      `Composition dependency graph declares unknown Forge module(s): ${unsupported.join(", ")}.`
    );

  const existing = new Set(initialDecisions.map((decision) => decision.module));
  const additionalCandidates = closure.modules
    .filter((module) => !existing.has(module))
    .map((module) => module as ModuleSlug);
  const additional = decideModules({
    candidates: additionalCandidates,
    profile,
    explicit: false,
    ...(policy.riskAllowed === undefined ? {} : { riskAllowed: policy.riskAllowed }),
    ...(policy.riskLabel === undefined ? {} : { riskLabel: policy.riskLabel }),
    ...(policy.changedModules === undefined ? {} : { changedModules: policy.changedModules })
  });
  const combined = [...initialDecisions, ...additional];
  const byModule = new Map(combined.map((decision) => [decision.module, decision]));
  const rootSet = new Set<string>(roots);
  const reachable = new Set<string>(roots);
  const depth = new Map<string, number>(roots.map((module) => [module, 0]));
  const queue = [...roots];
  while (queue.length > 0) {
    const parent = queue.shift();
    if (parent === undefined) break;
    const parentDepth = depth.get(parent) ?? 0;
    if (parentDepth >= maxDepth) continue;
    for (const edge of closure.edges.filter((candidate) => candidate.parent === parent)) {
      if (reachable.has(edge.dependency)) continue;
      const decision = byModule.get(edge.dependency);
      const selectedByExplicitIntent =
        rootSet.has(edge.parent) &&
        policy.explicitIntentDependencies?.has(edge.dependency as ModuleSlug) === true;
      if (
        decision === undefined ||
        EXPLICIT_ONLY_COMPOSITION_MODULES.has(edge.dependency as ModuleSlug) ||
        (!selectedByExplicitIntent &&
          (decision.selection_status !== "SELECTED" ||
            (decision.risk_status ?? decision.capability_status) !== "PRESENT"))
      )
        continue;
      reachable.add(edge.dependency);
      depth.set(edge.dependency, parentDepth + 1);
      queue.push(edge.dependency as ModuleSlug);
    }
  }

  const relevantEdges = closure.edges.filter((edge) => {
    const parentDepth = depth.get(edge.parent);
    return parentDepth !== undefined && parentDepth < maxDepth;
  });
  const considered = new Set(initialDecisions.map((decision) => decision.module));
  for (const edge of relevantEdges) considered.add(edge.dependency);
  const decisions = combined
    .filter((decision) => considered.has(decision.module))
    .map((decision) => {
      if (rootSet.has(decision.module)) return decision;
      const inbound = relevantEdges.filter((edge) => edge.dependency === decision.module);
      if (inbound.length === 0) return decision;
      const reached = reachable.has(decision.module);
      const wasSelected = decision.selection_status === "SELECTED";
      const selectedByExplicitIntent =
        reached &&
        policy.explicitIntentDependencies?.has(decision.module as ModuleSlug) === true &&
        inbound.some((edge) => rootSet.has(edge.parent));
      const reasons = decision.reasons.filter(
        (reason) => reason !== "The module was selected for this run."
      );
      if (selectedByExplicitIntent)
        reasons.push(
          `Selected as a bounded dependency of explicit greenfield ${inbound
            .filter((edge) => rootSet.has(edge.parent))
            .map((edge) => edge.parent)
            .join(", ")} intent; this is not automatic repository applicability evidence.`
        );
      else if (reached)
        reasons.push(
          `Selected as an applicable dependency of ${[
            ...new Set(
              inbound.filter((edge) => reachable.has(edge.parent)).map((edge) => edge.parent)
            )
          ].join(", ")}.`
        );
      else if (wasSelected)
        reasons.push(
          EXPLICIT_ONLY_COMPOSITION_MODULES.has(decision.module as ModuleSlug)
            ? "This workflow module requires explicit invocation and is never pulled into ordinary specialist context through a dependency edge."
            : (decision.risk_status ?? decision.capability_status) === "UNKNOWN"
              ? "Dependency applicability is UNKNOWN; automatic composition requires positive repository evidence, so the module remains available for explicit invocation but was not loaded."
              : "No applicable selected parent reached this dependency, so it was not loaded automatically."
        );
      return {
        ...decision,
        selection_status: reached
          ? "SELECTED"
          : wasSelected
            ? "NOT_REQUESTED"
            : decision.selection_status,
        reasons,
        evidence: [
          ...decision.evidence,
          ...inbound.map((edge) => `Composition dependency: ${edge.reason}`)
        ]
      };
    });
  const selected = closure.modules
    .filter((module) => reachable.has(module))
    .map((module) => module as ModuleSlug);
  return { decisions, selected, dependencyEdges: relevantEdges };
}
