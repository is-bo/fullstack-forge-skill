import ts from "typescript";
import type { Confidence, Severity, Status } from "./types.js";
/**
 * Missing-transaction analysis.
 *
 * The rule is deliberately narrow: multiple writes in one workflow are ordinary, and flagging
 * every such function would be noise. A finding is only produced when the AST carries structural
 * evidence that two writes describe one consistency invariant (dataflow between them, a shared
 * entity identifier, a foreign-key relationship, or a same-domain pairing keyed by one identifier)
 * and no atomic boundary is proven around them.
 *
 * Boundaries resolve through vendor APIs (Prisma, Knex, Sequelize, TypeORM, Drizzle, Mongo
 * sessions), raw `BEGIN`/`COMMIT` pairs, simple local aliases, and one level of local wrapper
 * delegation. A boundary the analyzer cannot resolve never becomes a silent pass or a silent
 * failure: it becomes NOT_VERIFIED.
 */
/**
 * Structural mirror of the analyzer source record. This module stays wire-in only, so it declares
 * the shape it consumes instead of importing a private type from the analyzer module.
 */
export type TransactionSourceRecord = {
    absolute: string;
    path: string;
    content: string;
    hash: string;
    sourceFile: ts.SourceFile;
};
type TransactionIssueSpec = {
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
export type TransactionIssue = {
    spec: TransactionIssueSpec;
    file: TransactionSourceRecord;
    status?: Status;
    node?: ts.Node;
    start: number;
    end?: number;
    evidence: string;
    source: string;
    sink: string;
};
/**
 * Entry point. Returns issues that are structurally assignable to the analyzer `Issue` type, in
 * stable source order.
 */
export declare function analyzeTransactionFile(file: TransactionSourceRecord): TransactionIssue[];
export {};
