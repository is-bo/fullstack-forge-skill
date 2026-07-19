export declare function sha256(content: string | Buffer): string;
export declare function toPosix(path: string): string;
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
export declare function workingTreeRevision(root: string): Promise<string>;
