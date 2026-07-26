import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { inventoryRepository } from "./repository-inventory.js";
const execFileAsync = promisify(execFile);
export function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}
export function toPosix(path) {
    return path.split(sep).join("/");
}
/**
 * Identifies conventional test-source paths without treating arbitrary names containing "test"
 * as tests. Boundary analyzers use this to avoid reporting intentionally hostile regression
 * snippets as production behavior; secret scanning still examines these files separately.
 */
export function isTestSourcePath(path) {
    const normalized = toPosix(path);
    const segments = normalized.split("/");
    if (segments.some((segment) => ["__tests__", "spec", "specs", "test", "tests"].includes(segment)))
        return true;
    const basename = segments.at(-1) ?? "";
    return /\.(?:spec|test)\.[^.]+$/iu.test(basename);
}
export function isInside(root, candidate) {
    const rel = relative(root, candidate);
    return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}
export function resolveInside(root, rel) {
    if (rel.includes("\0") ||
        isAbsolute(rel) ||
        hasWindowsRoot(rel) ||
        rel.split(/[\\/]+/u).some(isUnsafePortableSegment))
        throw new Error(`Unsafe absolute or NUL path: ${rel}`);
    const candidate = resolve(root, rel);
    if (!isInside(resolve(root), candidate))
        throw new Error(`Path escapes selected root: ${rel}`);
    return candidate;
}
export function assertSafeRelative(rel) {
    if (rel.length === 0 ||
        rel.includes("\0") ||
        isAbsolute(rel) ||
        hasWindowsRoot(rel) ||
        rel.split(/[\\/]+/u).some(isUnsafePortableSegment)) {
        throw new Error(`Unsafe manifest path: ${rel}`);
    }
}
function hasWindowsRoot(path) {
    return /^[A-Za-z]:/u.test(path) || /^[\\/]{2}/u.test(path);
}
function isUnsafePortableSegment(part) {
    const stem = part.split(".")[0]?.toUpperCase() ?? "";
    return (part === "" ||
        part === "." ||
        part === ".." ||
        part.includes(":") ||
        /[. ]$/u.test(part) ||
        [...part].some((character) => character.charCodeAt(0) < 0x20) ||
        /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem));
}
export async function canonicalDirectory(path) {
    const resolved = resolve(path);
    const info = await stat(resolved);
    if (!info.isDirectory())
        throw new Error(`Not a directory: ${resolved}`);
    return realpath(resolved);
}
export async function assertNoSymlinkPath(root, candidate) {
    const resolvedRoot = resolve(root);
    const resolvedCandidate = resolve(candidate);
    if (!isInside(resolvedRoot, resolvedCandidate))
        throw new Error(`Path escapes root: ${candidate}`);
    const rel = relative(resolvedRoot, resolvedCandidate);
    let current = resolvedRoot;
    for (const part of rel.split(sep).filter(Boolean)) {
        current = join(current, part);
        try {
            if ((await lstat(current)).isSymbolicLink()) {
                throw new Error(`Refusing symlinked install destination: ${current}`);
            }
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            break;
        }
    }
}
export async function walkFiles(root, options = {}) {
    const output = [];
    const exclude = options.exclude ?? new Set();
    const privateLocalDirectories = new Set([".audit", ".audit-work", ".codex"]);
    let totalBytes = 0;
    async function visit(directory, depth) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (exclude.has(entry.name) || privateLocalDirectories.has(entry.name))
                continue;
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory()) {
                if (options.maxDepth !== undefined && depth >= options.maxDepth)
                    throw new Error(`Repository scan exceeded the maximum depth of ${options.maxDepth}.`);
                await visit(path, depth + 1);
            }
            else if (entry.isFile()) {
                const size = (await stat(path)).size;
                if (options.maxBytes !== undefined && size > options.maxBytes)
                    continue;
                totalBytes += size;
                if (options.maxTotalBytes !== undefined && totalBytes > options.maxTotalBytes)
                    throw new Error(`Repository scan exceeded the ${options.maxTotalBytes}-byte inspection budget.`);
                output.push(path);
                if (options.maxFiles !== undefined && output.length > options.maxFiles)
                    throw new Error(`Repository scan exceeded the ${options.maxFiles}-file inspection budget.`);
            }
        }
    }
    await visit(root, 0);
    return output;
}
export async function readTextIfPresent(path) {
    try {
        const bytes = await readFile(path);
        if (bytes.includes(0))
            return undefined;
        return bytes.toString("utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
export async function runFile(executable, args, cwd, timeout = 120_000) {
    try {
        const result = await execFileAsync(executable, args, {
            cwd,
            encoding: "utf8",
            timeout,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024
        });
        return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    }
    catch (error) {
        const failure = error;
        const numericCode = typeof failure.code === "number" ? failure.code : 1;
        return {
            exitCode: numericCode,
            stdout: failure.stdout ?? "",
            stderr: failure.stderr ?? failure.message
        };
    }
}
export function lineNumber(content, index) {
    return content.slice(0, index).split("\n").length;
}
export function utcNow() {
    return new Date().toISOString();
}
/**
 * Identifies the exact inspected working tree without exposing diff contents. Clean Git trees use
 * the commit SHA directly; dirty or unversioned trees add a digest of changed/untracked bytes.
 */
export async function workingTreeRevision(root, sharedInventory) {
    const inventory = sharedInventory ??
        (await inventoryRepository(root, {
            includeNeutralEvidence: true,
            applyDefaultExclusions: true
        }));
    const head = await runFile("git", ["rev-parse", "HEAD"], root, 10_000);
    if (head.exitCode === 0) {
        const commit = head.stdout.trim();
        const status = await runFile("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."], root, 30_000);
        if (status.exitCode !== 0) {
            const boundedState = sha256(`${status.stderr}\0${JSON.stringify(inventory.diagnostics)}`);
            return `git:${commit}:dirty-partial:${boundedState}`;
        }
        if (status.stdout.length === 0)
            return `git:${commit}`;
        const entries = new Map(inventory.entries.map((entry) => [entry.path, entry]));
        const changedPaths = gitStatusPaths(status.stdout);
        let complete = inventory.diagnostics.status === "COMPLETE";
        const fingerprints = changedPaths.map(({ code, path }) => {
            const entry = entries.get(path);
            if (code.includes("D"))
                return `${code}:${path}:deleted`;
            if (entry?.status === "INSPECTED" && entry.content !== undefined)
                return `${code}:${path}:text:${sha256(entry.content)}`;
            complete = false;
            return `${code}:${path}:bounded:${entry?.size ?? "unavailable"}:${entry?.reason ?? "not-in-inventory"}`;
        });
        const digest = sha256(`${status.stdout}\0${fingerprints.sort().join("\n")}`);
        return `git:${commit}:dirty${complete ? "" : "-partial"}:${digest}`;
    }
    const hashes = inventory.entries
        .filter((entry) => entry.status === "INSPECTED" && entry.content !== undefined)
        .map((entry) => `${entry.path}:${sha256(entry.content)}`)
        .sort();
    const prefix = inventory.diagnostics.status === "COMPLETE" ? "tree" : "tree-partial";
    return `${prefix}:${sha256(hashes.join("\n"))}`;
}
function gitStatusPaths(output) {
    const records = output.split("\0").filter(Boolean);
    const paths = [];
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index] ?? "";
        if (record.length < 4)
            continue;
        const code = record.slice(0, 2);
        const rawPath = record.slice(3);
        try {
            assertSafeRelative(rawPath);
            paths.push({ code, path: toPosix(rawPath) });
        }
        catch {
            paths.push({ code, path: "unsafe-path" });
        }
        if (code.includes("R") || code.includes("C"))
            index += 1;
    }
    return paths.sort((left, right) => left.path === right.path
        ? left.code.localeCompare(right.code)
        : left.path.localeCompare(right.path));
}
//# sourceMappingURL=utils.js.map