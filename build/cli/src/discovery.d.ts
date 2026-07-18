import type { CommandDefinition, ProjectProfile } from "./types.js";
export declare function discoverProject(rootInput: string): Promise<ProjectProfile>;
export declare function writeProjectArtifacts(profile: ProjectProfile, dryRun?: boolean): Promise<string[]>;
export declare function detectProjectCommands(rootInput: string): Promise<CommandDefinition[]>;
