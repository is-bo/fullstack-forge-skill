import { runFile } from "./utils.js";
export declare const UPSTREAM_GIT_URL = "https://github.com/is-bo/fullstack-forge-skill.git";
export type UpdateAvailability = {
    status: "PASS" | "WARNING";
    evidence: string;
    latestVersion?: string;
    unavailable?: boolean;
};
type CommandRunner = typeof runFile;
/** Parses only stable, canonical vMAJOR.MINOR.PATCH refs from untrusted `git ls-remote` output. */
export declare function parseReleaseTags(output: string): string[];
/** Returns the public, immutable source archive for a stable released version. */
export declare function publicReleaseArchive(version: string): string;
export declare function checkUpdateAvailability(root: string, offline: boolean, currentVersion?: string, runner?: CommandRunner): Promise<UpdateAvailability>;
export {};
