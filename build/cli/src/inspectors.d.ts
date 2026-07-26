import { type AnalyzerScope } from "./analyzers.js";
import { type RepositoryInventory } from "./repository-inventory.js";
import { type ModuleSlug, type ToolName } from "./constants.js";
import type { InspectionResult, ProjectProfile } from "./types.js";
export declare function inspectWithTool(tool: ToolName, root: string, scope?: AnalyzerScope, repositoryInventory?: RepositoryInventory): Promise<InspectionResult>;
export declare function inspectSection(section: ModuleSlug, root: string, profile: ProjectProfile, scope?: AnalyzerScope, repositoryInventory?: RepositoryInventory): Promise<InspectionResult>;
export declare function isModuleSlug(value: string): value is ModuleSlug;
