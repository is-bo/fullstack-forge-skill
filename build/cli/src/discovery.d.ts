import type { CommandDefinition, ProjectProfile } from "./types.js";
import { type RepositoryInventory, type RepositoryInventoryOptions } from "./repository-inventory.js";
export declare function discoverProject(rootInput: string, options?: RepositoryInventoryOptions): Promise<ProjectProfile>;
export declare function discoverProjectWithInventory(rootInput: string, options?: RepositoryInventoryOptions): Promise<{
    profile: ProjectProfile;
    inventory: RepositoryInventory;
}>;
export declare function writeProjectArtifacts(profile: ProjectProfile, dryRun?: boolean): Promise<string[]>;
export declare function detectProjectCommands(rootInput: string): Promise<CommandDefinition[]>;
