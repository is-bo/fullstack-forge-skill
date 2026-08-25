import { type CompositionEvidence, type CompositionResult, type CompositionWorkflow, type CompositionTaskFlag, type ModuleDependencyClosure } from "./composition.js";
import type { ModuleSlug } from "./constants.js";
import type { ProjectProfile } from "./types.js";
/**
 * Explicit frontend work in a repository without frontend evidence is greenfield intent, not an
 * automatic applicability claim. Seed only the experience disciplines needed to design that new
 * surface; ordinary dependency expansion remains evidence-gated.
 */
export declare function explicitGreenfieldDependenciesFor(profile: ProjectProfile, modules: readonly ModuleSlug[]): ReadonlySet<ModuleSlug>;
export declare function compositionEvidenceFor(profile: ProjectProfile, input?: {
    workflow?: CompositionWorkflow | undefined;
    requested?: string[] | undefined;
    taskFlags?: CompositionTaskFlag[] | undefined;
    riskSurfaces?: string[] | undefined;
    /** Explicit root modules seed task intent for greenfield composition. */
    modules?: ModuleSlug[] | undefined;
}): CompositionEvidence;
export declare function resolveRuntimeComposition(root: string, modules: ModuleSlug[], evidence: CompositionEvidence, runtimeRootOverride?: string): Promise<CompositionResult[]>;
export type RuntimeCompositionResolution = {
    /** Absolute installation/package root against which every selected runtimePath resolves. */
    runtimeRoot: string;
    compositions: CompositionResult[];
};
export declare function resolveRuntimeCompositionWithRoot(root: string, modules: ModuleSlug[], evidence: CompositionEvidence, runtimeRootOverride?: string): Promise<RuntimeCompositionResolution>;
/**
 * Loads the same installed composition registry as runtime source resolution and returns a pure,
 * cycle-safe dependency closure. Callers can apply applicability policy to `modules` and retain
 * `edges` as the explanation for every dependency considered.
 */
export declare function resolveRuntimeModuleDependencyClosure(root: string, modules: readonly ModuleSlug[], runtimeRootOverride?: string): Promise<ModuleDependencyClosure>;
export declare function writeCompositionArtifact(root: string, resolution: RuntimeCompositionResolution): Promise<string>;
