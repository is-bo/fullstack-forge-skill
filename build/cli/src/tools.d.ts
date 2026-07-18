import type { CliOptions } from "./types.js";
export type ToolResponse = {
    value: unknown;
    exitCode: number;
};
export declare function runTool(nameInput: string, args: string[], options: CliOptions): Promise<ToolResponse>;
export declare function validateBundledSkills(): Promise<{
    valid: boolean;
    skills: number;
    errors: string[];
}>;
