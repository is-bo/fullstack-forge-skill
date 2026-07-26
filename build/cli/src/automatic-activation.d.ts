import type { Platform } from "./constants.js";
export declare const ACTIVATION_START = "<!-- fullstack-forge:automatic-activation:start -->";
export declare const ACTIVATION_END = "<!-- fullstack-forge:automatic-activation:end -->";
export type ProjectInstruction = {
    path: readonly string[];
    management: "file" | "section";
    content: string;
};
export declare const PROJECT_INSTRUCTIONS: Readonly<Partial<Record<Platform, ProjectInstruction>>>;
export declare function extractManagedSection(content: string): string | undefined;
export declare function upsertManagedSection(current: string, next: string): string;
export declare function removeManagedSection(current: string): string;
