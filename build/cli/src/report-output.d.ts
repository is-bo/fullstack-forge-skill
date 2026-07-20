import type { AuditReport } from "./report.js";
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
/**
 * Resolves and validates the output directory.
 *
 * `resolveInside` rejects absolute paths, drive-qualified paths, UNC paths, NUL bytes, and any
 * `..` segment, so traversal and absolute escape are refused by construction rather than by pattern
 * matching. `assertNoSymlinkPath` then refuses a destination whose path crosses a symlink or
 * reparse point, which is the case a pure string check cannot catch: a directory that resolves
 * inside the root today can point anywhere on disk.
 */
export declare function resolveOutputDirectory(root: string, output: string): Promise<string>;
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
export declare function planReportOutput(root: string, output: string, report: AuditReport, dryRun: boolean): Promise<ReportOutputPlan>;
/** Executes a plan. A dry run returns the same plan with an empty `written` list. */
export declare function writeReportOutput(root: string, output: string, report: AuditReport, dryRun: boolean): Promise<ReportOutputResult>;
