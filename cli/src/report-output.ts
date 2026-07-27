/**
 * Report-mode output.
 *
 * `forge <section> report` renders an audit that already happened. It never re-runs an audit,
 * because a report that quietly regenerates its own evidence cannot be compared against the run it
 * claims to describe: the identity, timestamps, and revision of the report must survive rendering
 * untouched.
 *
 * Writing to a directory introduces the one genuinely dangerous operation in report mode — creating
 * files at an operator-supplied path — so this module carries the containment and ownership rules
 * rather than leaving them to the call site.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditReport } from "./report.js";
import { renderMarkdown, withFindingSummary } from "./report.js";
import { assertNoSymlinkPath, resolveInside, sha256, toPosix, utcNow } from "./utils.js";

const OWNERSHIP_FILE = ".forge-output.json";

export type OutputAction = "create" | "update" | "preserve-identical";

export type OutputFilePlan = {
  /** Repository-relative POSIX path, safe to print and to store in evidence. */
  path: string;
  absolute: string;
  action: OutputAction;
  sha256: string;
};

export type ReportOutputPlan = {
  directory: string;
  relative_directory: string;
  files: OutputFilePlan[];
  dry_run: boolean;
};

export type ReportOutputResult = ReportOutputPlan & {
  written: string[];
};

type OwnershipManifest = {
  schema_version: 1;
  tool: "fullstack-forge";
  generated_at: string;
  files: Record<string, string>;
};

/**
 * Resolves and validates the output directory.
 *
 * `resolveInside` rejects absolute paths, drive-qualified paths, UNC paths, NUL bytes, and any
 * `..` segment, so traversal and absolute escape are refused by construction rather than by pattern
 * matching. `assertNoSymlinkPath` then refuses a destination whose path crosses a symlink or
 * reparse point, which is the case a pure string check cannot catch: a directory that resolves
 * inside the root today can point anywhere on disk.
 */
export async function resolveOutputDirectory(root: string, output: string): Promise<string> {
  const trimmed = output.trim();
  if (trimmed.length === 0) throw new Error("--output requires a directory path");
  const directory = resolveInside(root, trimmed);
  await assertNoSymlinkPath(root, directory);
  return directory;
}

/**
 * Plans the report files without writing anything.
 *
 * Ownership is tracked by a manifest inside the output directory recording the digest of each file
 * Forge last wrote. The policy it enforces:
 *
 * - no manifest and no existing report files → Forge takes ownership and creates them;
 * - no manifest but report files already exist → refused, the directory belongs to something else;
 * - manifest present and the on-disk digest matches what Forge wrote → safe to overwrite;
 * - manifest present but the file changed since Forge wrote it → refused, an edit is never silently
 *   discarded.
 *
 * Refusal is an error rather than a skip so `--output` cannot appear to succeed while leaving stale
 * content in place.
 */
export async function planReportOutput(
  root: string,
  output: string,
  report: AuditReport,
  dryRun: boolean
): Promise<ReportOutputPlan> {
  const directory = await resolveOutputDirectory(root, output);
  const relativeDirectory = toPosix(output.trim().replace(/[\\/]+$/u, ""));
  const manifest = await readOwnership(directory);
  const documents = reportDocuments(report);

  const files: OutputFilePlan[] = [];
  for (const document of documents) {
    const absolute = join(directory, document.name);
    await assertNoSymlinkPath(root, absolute);
    const digest = sha256(document.content);
    const existing = await readIfPresent(absolute);
    const recorded = manifest?.files[document.name];

    if (existing === undefined) {
      files.push({
        path: toPosix(join(relativeDirectory, document.name)),
        absolute,
        action: "create",
        sha256: digest
      });
      continue;
    }
    const existingDigest = sha256(existing);
    if (recorded === undefined) {
      throw new Error(
        `Refusing to overwrite unowned report output: ${toPosix(join(relativeDirectory, document.name))}. ` +
          "Choose an empty directory or remove the existing file."
      );
    }
    if (existingDigest !== recorded && existingDigest !== digest) {
      throw new Error(
        `Refusing to overwrite modified managed output: ${toPosix(join(relativeDirectory, document.name))}. ` +
          "The file changed after Fullstack Forge wrote it."
      );
    }
    files.push({
      path: toPosix(join(relativeDirectory, document.name)),
      absolute,
      action: existingDigest === digest ? "preserve-identical" : "update",
      sha256: digest
    });
  }

  return { directory, relative_directory: relativeDirectory, files, dry_run: dryRun };
}

/** Executes a plan. A dry run returns the same plan with an empty `written` list. */
export async function writeReportOutput(
  root: string,
  output: string,
  report: AuditReport,
  dryRun: boolean
): Promise<ReportOutputResult> {
  const plan = await planReportOutput(root, output, report, dryRun);
  if (dryRun) return { ...plan, written: [] };

  await mkdir(plan.directory, { recursive: true });
  const written: string[] = [];
  const documents = new Map(
    reportDocuments(report).map((document) => [document.name, document.content] as const)
  );
  const files: Record<string, string> = {};
  for (const file of plan.files) {
    const name = file.path.split("/").pop() as string;
    const content = documents.get(name);
    if (content === undefined) continue;
    if (file.action !== "preserve-identical") {
      await writeFile(file.absolute, content, "utf8");
      written.push(file.path);
    }
    files[name] = file.sha256;
  }
  await writeOwnership(root, plan.directory, files);
  return { ...plan, written };
}

/**
 * The exact bytes both documents carry.
 *
 * Planning and writing must produce identical content or the ownership digests would never match,
 * so the two phases share one builder. The status-aware summary is derived here rather than trusted
 * from the input, which keeps `--output` consistent with what `writeReport` publishes into `.forge`.
 */
function reportDocuments(report: AuditReport): Array<{ name: string; content: string }> {
  const published = withFindingSummary(report);
  return [
    { name: "report.json", content: `${JSON.stringify(published, null, 2)}\n` },
    { name: "report.md", content: renderMarkdown(published) }
  ];
}

async function readOwnership(directory: string): Promise<OwnershipManifest | undefined> {
  const text = await readIfPresent(join(directory, OWNERSHIP_FILE));
  if (text === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    // An unreadable manifest is treated as no manifest, which makes the ownership check strictly
    // more conservative: existing files are then refused rather than overwritten.
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const candidate: Record<string, unknown> = parsed as Record<string, unknown>;
  if (candidate.schema_version !== 1 || candidate.tool !== "fullstack-forge") return undefined;
  const rawFiles: unknown = candidate.files;
  if (typeof rawFiles !== "object" || rawFiles === null || Array.isArray(rawFiles))
    return undefined;
  const files: Record<string, string> = {};
  for (const [name, digest] of Object.entries(rawFiles)) {
    if (typeof digest === "string" && /^[a-f0-9]{64}$/u.test(digest)) files[name] = digest;
  }
  return {
    schema_version: 1,
    tool: "fullstack-forge",
    generated_at: typeof candidate.generated_at === "string" ? candidate.generated_at : "",
    files
  };
}

async function writeOwnership(
  root: string,
  directory: string,
  files: Record<string, string>
): Promise<void> {
  const path = join(directory, OWNERSHIP_FILE);
  await assertNoSymlinkPath(root, path);
  const manifest: OwnershipManifest = {
    schema_version: 1,
    tool: "fullstack-forge",
    generated_at: utcNow(),
    files
  };
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function readIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
