import { MODULE_SLUGS } from "./constants.js";
import { inspectSection } from "./inspectors.js";
import { decideModules } from "./scope.js";
export const APPLICATION_INSPECTION_MODULES = MODULE_SLUGS.filter((module) => !["discover", "all", "ship"].includes(module));
/**
 * Shared application-defect derivation used by Audit and Ship.
 *
 * Gate evidence is preserved on each inspection result, but release-only command, freshness,
 * packaging, dependency, and publication gates are deliberately outside this pipeline.
 */
export async function deriveApplicationInspection(input) {
    const candidates = [...(input.modules ?? APPLICATION_INSPECTION_MODULES)];
    const decisions = decideModules({
        candidates,
        profile: input.profile,
        explicit: input.modules !== undefined
    });
    const modules = input.modules === undefined
        ? decisions
            .filter((decision) => decision.selection_status === "SELECTED")
            .map((decision) => decision.module)
        : candidates;
    const results = await Promise.all(modules.map((module) => inspectSection(module, input.root, input.profile, input.scope, input.inventory)));
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
//# sourceMappingURL=application-inspection.js.map