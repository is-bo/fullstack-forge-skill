import ts from "typescript";
import type { Confidence, Severity, Status } from "./types.js";
/**
 * Upload-pipeline analysis.
 *
 * Two defects in the previous implementation motivate this module.
 *
 * The first was a false pass. Any imported function that happened to receive an expression
 * mentioning `file`, `buffer`, `mimetype`, or `originalname` downgraded a proven missing-validation
 * failure to NOT_VERIFIED. A logger, a thumbnailer, a queue publisher, or the storage call itself
 * silenced the finding, because the rule asked what the payload *touched* rather than what decided
 * whether the payload was accepted. Delegation is now decided structurally: a resolved body must
 * actually inspect the bytes, and an unresolved body must actually sit in the acceptance decision.
 *
 * The second was coverage. Discovery was gated on a Multer-shaped `upload.single(...)` call, so a
 * Busboy, Formidable, Next.js `formData()`, raw multipart, presigned S3/GCS, or server-side
 * object-storage pipeline was silently unanalyzed — reported as nothing rather than as unsupported.
 *
 * The status contract is unchanged and is the reason the module exists:
 *  - a proven defect is `FAIL`;
 *  - a proven control is clean, with no finding at all;
 *  - indirection that bounded analysis cannot open is `NOT_VERIFIED`, never a confident failure;
 *  - a flow shape this module does not model is reported as unsupported, not as safe.
 */
/**
 * Structural mirror of the analyzer source record. This module stays wire-in only, so it declares
 * the shape it consumes instead of importing a private type from the analyzer module.
 */
export type UploadSourceRecord = {
    absolute: string;
    path: string;
    content: string;
    hash: string;
    sourceFile: ts.SourceFile;
};
type UploadIssueSpec = {
    id: string;
    analyzer: string;
    section: string;
    title: string;
    severity: Severity;
    confidence: Confidence;
    impact: string;
    recommendation: string;
    safeFix: boolean;
    absenceProvesResolution: boolean;
    verification: string[];
    standards: string[];
};
/** Structurally assignable to the analyzer `Issue` type so the caller can push these directly. */
export type UploadIssue = {
    spec: UploadIssueSpec;
    file: UploadSourceRecord;
    status?: Status;
    node?: ts.Node;
    start: number;
    end?: number;
    evidence: string;
    source: string;
    sink: string;
};
/** The analyzer owns the rule catalogue; this module owns when each rule fires. */
export type UploadSpecs = {
    extension: UploadIssueSpec;
    mime: UploadIssueSpec;
    publicStorage: UploadIssueSpec;
    scan: UploadIssueSpec;
    failOpen: UploadIssueSpec;
    filename: UploadIssueSpec;
    limits: UploadIssueSpec;
    directVerify: UploadIssueSpec;
    unsupportedFlow: UploadIssueSpec;
};
export type UploadAnalyzer = (file: UploadSourceRecord, specs: UploadSpecs) => UploadIssue[];
export declare function createUploadAnalyzer(files: readonly UploadSourceRecord[]): UploadAnalyzer;
export {};
