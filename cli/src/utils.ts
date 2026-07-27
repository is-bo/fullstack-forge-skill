import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { inventoryRepository, type RepositoryInventory } from "./repository-inventory.js";

const execFileAsync = promisify(execFile);

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Identifies conventional test-source paths without treating arbitrary names containing "test"
 * as tests. Boundary analyzers use this to avoid reporting intentionally hostile regression
 * snippets as production behavior; secret scanning still examines these files separately.
 */
export function isTestSourcePath(path: string): boolean {
  const normalized = toPosix(path);
  const segments = normalized.split("/");
  if (segments.some((segment) => ["__tests__", "spec", "specs", "test", "tests"].includes(segment)))
    return true;
  const basename = segments.at(-1) ?? "";
  return /\.(?:spec|test)\.[^.]+$/iu.test(basename);
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
  const privateLocalDirectories = new Set([".audit", ".audit-work", ".codex"]);
  let totalBytes = 0;
  async function visit(directory: string, depth: number): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (exclude.has(entry.name) || privateLocalDirectories.has(entry.name)) continue;
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
export async function workingTreeRevision(
  root: string,
  sharedInventory?: RepositoryInventory
): Promise<string> {
  const inventory =
    sharedInventory ??
    (await inventoryRepository(root, {
      includeNeutralEvidence: true,
      applyDefaultExclusions: true
    }));
  const head = await runFile("git", ["rev-parse", "HEAD"], root, 10_000);
  if (head.exitCode === 0) {
    const commit = head.stdout.trim();
    const status = await runFile(
      "git",
      ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."],
      root,
      30_000
    );
    if (status.exitCode !== 0) {
      const boundedState = sha256(`${status.stderr}\0${JSON.stringify(inventory.diagnostics)}`);
      return `git:${commit}:dirty-partial:${boundedState}`;
    }
    if (status.stdout.length === 0) return `git:${commit}`;

    const entries = new Map(inventory.entries.map((entry) => [entry.path, entry]));
    const changedPaths = gitStatusPaths(status.stdout);
    let complete = inventory.diagnostics.status === "COMPLETE";
    const fingerprints = changedPaths.map(({ code, path }) => {
      const entry = entries.get(path);
      if (code.includes("D")) return `${code}:${path}:deleted`;
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
    .map((entry) => `${entry.path}:${sha256(entry.content as string)}`)
    .sort();
  const prefix = inventory.diagnostics.status === "COMPLETE" ? "tree" : "tree-partial";
  return `${prefix}:${sha256(hashes.join("\n"))}`;
}

function gitStatusPaths(output: string): Array<{ code: string; path: string }> {
  const records = output.split("\0").filter(Boolean);
  const paths: Array<{ code: string; path: string }> = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? "";
    if (record.length < 4) continue;
    const code = record.slice(0, 2);
    const rawPath = record.slice(3);
    try {
      assertSafeRelative(rawPath);
      paths.push({ code, path: toPosix(rawPath) });
    } catch {
      paths.push({ code, path: "unsafe-path" });
    }
    if (code.includes("R") || code.includes("C")) index += 1;
  }
  return paths.sort((left, right) =>
    left.path === right.path
      ? left.code.localeCompare(right.code)
      : left.path.localeCompare(right.path)
  );
}

/**
 * Counts distinct installed Fullstack Forge skills from managed file paths.
 *
 * Vendored upstream providers keep their own `skills/` directories inside the managed support tree
 * at `.fullstack-forge/upstream/`. Those are references composed by Forge, not installed skills, so
 * a naive "last `skills` segment" scan would report them as if the user had installed 125 skills.
 * Only `.fullstack-forge/skills/` and the per-host skills roots hold real Forge skills.
 */
export function countManagedSkills(paths: Iterable<string>): number {
  const names = new Set<string>();
  for (const path of paths) {
    const parts = path.split(/[\\/]+/u);
    if (parts[0] === ".fullstack-forge" && parts[1] !== "skills") continue;
    const index = parts.lastIndexOf("skills");
    const name = index === -1 ? undefined : parts[index + 1];
    if (name !== undefined) names.add(name);
  }
  return names.size;
}
