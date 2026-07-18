import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}
export function toPosix(path) {
    return path.split(sep).join("/");
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
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (exclude.has(entry.name))
                continue;
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory())
                await visit(path);
            else if (entry.isFile()) {
                if (options.maxBytes !== undefined && (await stat(path)).size > options.maxBytes)
                    continue;
                output.push(path);
            }
        }
    }
    await visit(root);
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
//# sourceMappingURL=utils.js.map