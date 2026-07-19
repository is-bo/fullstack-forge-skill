import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

export function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function resolveInside(root: string, rel: string): string {
  if (
    rel.includes("\0") ||
    isAbsolute(rel) ||
    hasWindowsRoot(rel) ||
    rel.split(/[\\/]+/u).some(isUnsafePortableSegment)
  )
    throw new Error(`Unsafe absolute or NUL path: ${rel}`);
  const candidate = resolve(root, rel);
  if (!isInside(resolve(root), candidate)) throw new Error(`Path escapes selected root: ${rel}`);
  return candidate;
}

export function assertSafeRelative(rel: string): void {
  if (
    rel.length === 0 ||
    rel.includes("\0") ||
    isAbsolute(rel) ||
    hasWindowsRoot(rel) ||
    rel.split(/[\\/]+/u).some(isUnsafePortableSegment)
  ) {
    throw new Error(`Unsafe manifest path: ${rel}`);
  }
}

function hasWindowsRoot(path: string): boolean {
  return /^[A-Za-z]:/u.test(path) || /^[\\/]{2}/u.test(path);
}

function isUnsafePortableSegment(part: string): boolean {
  const stem = part.split(".")[0]?.toUpperCase() ?? "";
  return (
    part === "" ||
    part === "." ||
    part === ".." ||
    part.includes(":") ||
    /[. ]$/u.test(part) ||
    [...part].some((character) => character.charCodeAt(0) < 0x20) ||
    /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem)
  );
}

export async function canonicalDirectory(path: string): Promise<string> {
  const resolved = resolve(path);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error(`Not a directory: ${resolved}`);
  return realpath(resolved);
}

export async function assertNoSymlinkPath(root: string, candidate: string): Promise<void> {
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
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      break;
    }
  }
}

export async function walkFiles(
  root: string,
  options: {
    exclude?: Set<string>;
    maxBytes?: number;
    maxFiles?: number;
    maxTotalBytes?: number;
    maxDepth?: number;
  } = {}
): Promise<string[]> {
  const output: string[] = [];
  const exclude = options.exclude ?? new Set<string>();
  let totalBytes = 0;
  async function visit(directory: string, depth: number): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (exclude.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (options.maxDepth !== undefined && depth >= options.maxDepth)
          throw new Error(`Repository scan exceeded the maximum depth of ${options.maxDepth}.`);
        await visit(path, depth + 1);
      } else if (entry.isFile()) {
        const size = (await stat(path)).size;
        if (options.maxBytes !== undefined && size > options.maxBytes) continue;
        totalBytes += size;
        if (options.maxTotalBytes !== undefined && totalBytes > options.maxTotalBytes)
          throw new Error(
            `Repository scan exceeded the ${options.maxTotalBytes}-byte inspection budget.`
          );
        output.push(path);
        if (options.maxFiles !== undefined && output.length > options.maxFiles)
          throw new Error(
            `Repository scan exceeded the ${options.maxFiles}-file inspection budget.`
          );
      }
    }
  }
  await visit(root, 0);
  return output;
}

export async function readTextIfPresent(path: string): Promise<string | undefined> {
  try {
    const bytes = await readFile(path);
    if (bytes.includes(0)) return undefined;
    return bytes.toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function runFile(
  executable: string,
  args: string[],
  cwd: string,
  timeout = 120_000
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(executable, args, {
      cwd,
      encoding: "utf8",
      timeout,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      code?: string | number;
      stdout?: string;
      stderr?: string;
    };
    const numericCode = typeof failure.code === "number" ? failure.code : 1;
    return {
      exitCode: numericCode,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message
    };
  }
}

export function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export function utcNow(): string {
  return new Date().toISOString();
}

/**
 * Identifies the exact inspected working tree without exposing diff contents. Clean Git trees use
 * the commit SHA directly; dirty or unversioned trees add a digest of changed/untracked bytes.
 */
export async function workingTreeRevision(root: string): Promise<string> {
  const head = await runFile("git", ["rev-parse", "HEAD"], root, 10_000);
  if (head.exitCode === 0) {
    const commit = head.stdout.trim();
    const diff = await runFile("git", ["diff", "--binary", "HEAD", "--", "."], root, 30_000);
    const untracked = await runFile(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      root,
      30_000
    );
    const untrackedHashes: string[] = [];
    if (untracked.exitCode === 0) {
      for (const path of untracked.stdout.split("\0").filter(Boolean).sort()) {
        try {
          assertSafeRelative(path);
          untrackedHashes.push(
            `${toPosix(path)}:${sha256(await readFile(resolveInside(root, path)))}`
          );
        } catch {
          untrackedHashes.push(`${toPosix(path)}:unreadable`);
        }
      }
    }
    const state = `${diff.stdout}\u0000${untrackedHashes.join("\n")}`;
    return state.length === 1 ? `git:${commit}` : `git:${commit}:dirty:${sha256(state)}`;
  }

  const files = await walkFiles(root, {
    exclude: new Set([".forge", ".git", "build", "coverage", "dist", "node_modules"]),
    maxBytes: 2 * 1024 * 1024,
    maxFiles: 10_000,
    maxTotalBytes: 128 * 1024 * 1024,
    maxDepth: 64
  });
  const hashes = await Promise.all(
    files
      .sort()
      .map(async (path) => `${toPosix(relative(root, path))}:${sha256(await readFile(path))}`)
  );
  return `tree:${sha256(hashes.join("\n"))}`;
}
