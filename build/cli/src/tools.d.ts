import type { CliOptions } from "./types.js";
export type ToolResponse = {
    value: unknown;
    exitCode: number;
};
export declare const SOURCE_CHECKOUT_ONLY_TOOL_NAMES: readonly ["sync-platform-assets", "check-platform-assets", "package-platforms", "smoke-install"];
export declare function runTool(nameInput: string, args: string[], options: CliOptions): Promise<ToolResponse>;
/**
 * True only when the audited root really is the Fullstack Forge package root.
 *
 * Both paths are canonicalized before comparison, so a project cannot claim the Forge-internal
 * exemption by naming a directory or a script the same way.
 */
export declare function isForgePackageRoot(root: string): Promise<boolean>;
export declare function validateBundledSkills(): Promise<{
    valid: boolean;
    skills: number;
    errors: string[];
}>;
export declare function validateBundledManagedLayout(): Promise<{
    valid: boolean;
    roots: number;
    files: number;
    errors: string[];
}>;
