import { type Platform } from "./constants.js";
import type { InstallManifest } from "./types.js";
export type InstallAction = {
    action: "create" | "update" | "preserve-identical" | "remove" | "preserve-modified";
    path: string;
    platform: Platform;
};
export declare function normalizePlatforms(selector: string): Platform[];
export declare function install(rootInput: string, selector: string, options: {
    global: boolean;
    dryRun: boolean;
}): Promise<InstallAction[]>;
export declare function uninstall(rootInput: string, selector: string, options: {
    global: boolean;
    dryRun: boolean;
}): Promise<InstallAction[]>;
export declare function readInstallManifest(rootInput: string): Promise<InstallManifest | undefined>;
