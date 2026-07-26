import { type Platform } from "./constants.js";
import type { InstallFile, InstallManifest } from "./types.js";
export type InstallAction = {
    action: "create" | "update" | "preserve-identical" | "remove" | "preserve-modified";
    path: string;
    platform: Platform;
};
export declare function normalizePlatforms(selector: string): Platform[];
export declare function install(rootInput: string, selector: string, options: {
    global: boolean;
    dryRun: boolean;
    home?: string;
    /** Test-only fault injection. Production callers must omit this option. */
    interruptAfter?: number;
}): Promise<InstallAction[]>;
export declare function uninstall(rootInput: string, selector: string, options: {
    global: boolean;
    dryRun: boolean;
    home?: string;
}): Promise<InstallAction[]>;
export declare function readInstallManifest(rootInput: string): Promise<InstallManifest | undefined>;
export declare function hashInstalledRecord(content: Buffer, record: InstallFile): string | undefined;
