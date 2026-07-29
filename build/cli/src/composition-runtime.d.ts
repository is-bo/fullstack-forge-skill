import { type CompositionEvidence, type CompositionResult, type CompositionTaskFlag } from "./composition.js";
import type { ModuleSlug } from "./constants.js";
import type { ProjectProfile } from "./types.js";
export declare function compositionEvidenceFor(profile: ProjectProfile, input?: {
    requested?: string[] | undefined;
    taskFlags?: CompositionTaskFlag[] | undefined;
    riskSurfaces?: string[] | undefined;
}): CompositionEvidence;
export declare function resolveRuntimeComposition(root: string, modules: ModuleSlug[], evidence: CompositionEvidence, runtimeRootOverride?: string): Promise<CompositionResult[]>;
export declare function writeCompositionArtifact(root: string, results: CompositionResult[]): Promise<string>;
