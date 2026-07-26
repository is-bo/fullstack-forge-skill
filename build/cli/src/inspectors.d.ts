import { type AnalyzerScope } from "./analyzers.js";
import { type RepositoryInventory } from "./repository-inventory.js";
import { type ModuleSlug, type ToolName } from "./constants.js";
import type { InspectionResult, ModuleDecision, ProjectProfile } from "./types.js";
export declare function inspectWithTool(tool: ToolName, root: string, scope?: AnalyzerScope, repositoryInventory?: RepositoryInventory): Promise<InspectionResult>;
/**
 * Runs one module's inspection.
 *
 * Applicability is decided once, by `decideModules`, and handed in as `decision`. Execution and
 * reporting therefore cannot disagree: this function never re-derives applicability from the
 * legacy `profile.capabilities` presence map, because that map records *control* discovery and
 * would suppress analysis of exactly the risk surfaces that lack a control.
 *
 * `decision` is optional only so that callers holding a single module can omit it; in that case
 * the canonical decision is computed here from the same `decideModules` entry point rather than
 * from a second applicability model.
 */
export declare function inspectSection(section: ModuleSlug, root: string, profile: ProjectProfile, scope?: AnalyzerScope, repositoryInventory?: RepositoryInventory, decision?: ModuleDecision): Promise<InspectionResult>;
export declare function isModuleSlug(value: string): value is ModuleSlug;
