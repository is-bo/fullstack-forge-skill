import { MODULE_SLUGS, type ModuleSlug } from "./constants.js";
import { inspectSection } from "./inspectors.js";
import type { AnalyzerScope } from "./analyzers.js";
import type { RepositoryInventory } from "./repository-inventory.js";
import { decideModules } from "./scope.js";
import type { Finding, InspectionResult, ModuleDecision, ProjectProfile } from "./types.js";

export const APPLICATION_INSPECTION_MODULES = MODULE_SLUGS.filter(
  (module): module is ModuleSlug => !["discover", "all", "ship"].includes(module)
);

export type ApplicationInspection = {
  modules: ModuleSlug[];
  decisions: ModuleDecision[];
  results: InspectionResult[];
  findings: Finding[];
};

/**
 * Shared application-defect derivation used by Audit and Ship.
 *
 * Gate evidence is preserved on each inspection result, but release-only command, freshness,
 * packaging, dependency, and publication gates are deliberately outside this pipeline.
 */
export async function deriveApplicationInspection(input: {
  root: string;
  profile: ProjectProfile;
  inventory: RepositoryInventory;
  revision: string;
  modules?: readonly ModuleSlug[];
  scope?: AnalyzerScope;
}): Promise<ApplicationInspection> {
  const candidates = [...(input.modules ?? APPLICATION_INSPECTION_MODULES)];
  const decisions = decideModules({
    candidates,
    profile: input.profile,
    explicit: input.modules !== undefined
  });
  const modules =
    input.modules === undefined
      ? decisions
          .filter((decision) => decision.selection_status === "SELECTED")
          .map((decision) => decision.module as ModuleSlug)
      : candidates;
  // Execution consumes the decision the report will publish, so `module_decisions`, analyzer
  // execution, and finding status cannot disagree.
  const decisionByModule = new Map(decisions.map((decision) => [decision.module, decision]));
  const results = await Promise.all(
    modules.map((module) =>
      inspectSection(
        module,
        input.root,
        input.profile,
        input.scope,
        input.inventory,
        decisionByModule.get(module)
      )
    )
  );
  for (const result of results)
    result.gate_evidence = result.gate_evidence.map((evidence) => ({
      ...evidence,
      revision: input.revision
    }));
  return {
    modules,
    decisions,
    results,
    findings: results.flatMap((result) => structuredClone(result.findings))
  };
}
