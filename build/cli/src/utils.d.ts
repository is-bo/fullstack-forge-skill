import { type RepositoryInventory } from "./repository-inventory.js";
export declare function sha256(content: string | Buffer): string;
export declare function toPosix(path: string): string;
/**
 * Identifies conventional test-source paths without treating arbitrary names containing "test"
 * as tests. Boundary analyzers use this to avoid reporting intentionally hostile regression
 * snippets as production behavior; secret scanning still examines these files separately.
 */
export declare function isTestSourcePath(path: string): boolean;
export declare function isInside(root: string, candidate: string): boolean;
export declare function resolveInside(root: string, rel: string): string;
export declare function assertSafeRelative(rel: string): void;
export declare function canonicalDirectory(path: string): Promise<string>;
export declare function assertNoSymlinkPath(root: string, candidate: string): Promise<void>;
export declare function walkFiles(root: string, options?: {
    exclude?: Set<string>;
    maxBytes?: number;
    maxFiles?: number;
    maxTotalBytes?: number;
    maxDepth?: number;
    /** Fail closed instead of silently skipping symlinked source entries. */
    rejectSymlinks?: boolean;
}): Promise<string[]>;
export declare function readTextIfPresent(path: string): Promise<string | undefined>;
export declare function runFile(executable: string, args: string[], cwd: string, timeout?: number): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}>;
export declare function lineNumber(content: string, index: number): number;
export declare function utcNow(): string;
/**
 * Identifies the exact inspected working tree without exposing diff contents. Clean Git trees use
 * the commit SHA directly; dirty or unversioned trees add a digest of changed/untracked bytes.
 */
export declare function workingTreeRevision(root: string, sharedInventory?: RepositoryInventory): Promise<string>;
/**
 * Counts distinct installed Fullstack Forge skills from managed file paths.
 *
 * Vendored upstream providers keep their own `skills/` directories inside the managed support tree
 * at `.fullstack-forge/upstream/`. Those are references composed by Forge, not installed skills, so
 * a naive "last `skills` segment" scan would report them as if the user had installed 125 skills.
 * Only `.fullstack-forge/skills/` and the per-host skills roots hold real Forge skills.
 */
export declare function countManagedSkills(paths: Iterable<string>): number;
