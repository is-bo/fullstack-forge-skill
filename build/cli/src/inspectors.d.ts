import { type ModuleSlug, type ToolName } from "./constants.js";
import type { InspectionResult, ProjectProfile } from "./types.js";
export declare function inspectWithTool(tool: ToolName, root: string): Promise<InspectionResult>;
export declare function inspectSection(section: ModuleSlug, root: string, profile: ProjectProfile): Promise<InspectionResult>;
export declare function isModuleSlug(value: string): value is ModuleSlug;
