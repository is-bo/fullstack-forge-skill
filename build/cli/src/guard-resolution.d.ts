import ts from "typescript";
import { type ModuleSourceFile } from "./module-resolution.js";
/**
 * Bounded cross-file resolution of route authorization middleware.
 *
 * `analyzers.ts` proves a route guard structurally: a middleware argument counts only when the
 * body it refers to rejects the request before delegating. That proof used to stop at the file
 * boundary, so an imported guard fell back to a name heuristic and `requireRole` was accepted as
 * an authorization control without its body ever being read. A middleware that merely *looks*
 * like a guard is exactly the defect an external-repository audit has to catch, so this module
 * replaces the heuristic with real resolution across modules.
 *
 * The module-opening machinery — relative specifiers only, named/default/renamed/barrel/CommonJS
 * exports, hop and file budgets, cycle termination — lives in `module-resolution.js`, because
 * upload analysis needs the identical primitive under the identical guarantee and two copies of
 * it would drift apart. What stays here is the authorization semantics: what counts as a denial,
 * and how a middleware list maps onto a route verdict.
 *
 * Every outcome is one of three, and the distinction is the correctness contract:
 *  - `proven`      a body was read and it denies the request;
 *  - `not-guard`   a body was read and it never denies the request (a real defect, so FAIL);
 *  - `unresolved`  no body was read (NOT_VERIFIED — never a confident verdict either way).
 *
 * An identifier's spelling never yields `proven`.
 */
/** Maximum module jumps followed from one middleware argument (import chain depth). */
export declare const MAX_GUARD_HOPS = 3;
/** Maximum distinct modules opened while resolving a single middleware argument. */
export declare const MAX_GUARD_FILES = 12;
/** Maximum `export *` branches searched in one barrel module. */
export declare const MAX_BARREL_BRANCHES = 8;
/** Maximum times a factory's return value is followed to the middleware it produces. */
export declare const MAX_FACTORY_DEPTH = 2;
/**
 * A parsed source file addressed by its repository-relative POSIX path.
 *
 * Structurally compatible with the analyzer's internal `SourceRecord`, so the analyzer can pass
 * its own records without conversion.
 */
export type GuardSourceFile = ModuleSourceFile;
export type GuardVerdict = "proven" | "not-guard" | "unresolved";
export type GuardResolution = {
    verdict: GuardVerdict;
    /** Ordered resolution hops in source order; deterministic, safe to publish as evidence. */
    trace: string[];
    /** Why this verdict was reached. */
    reason: string;
};
/** Verdict shape expected by the analyzer's route classification. */
export type RouteGuardVerdict = "proven" | "absent" | "unresolved";
export type MiddlewareClassification = {
    verdict: RouteGuardVerdict;
    /** Deterministic evidence sentence, or an empty string when there is nothing to add. */
    evidence: string;
};
export type GuardResolver = {
    /** Classifies one middleware argument by the body it resolves to. */
    classifyMiddleware: (argument: ts.Expression, file: GuardSourceFile) => GuardResolution;
    /** Classifies a route's whole middleware list into the analyzer's route verdict. */
    classifyMiddlewareList: (middleware: readonly ts.Expression[], file: GuardSourceFile) => MiddlewareClassification;
};
export declare function createGuardResolver(files: readonly GuardSourceFile[]): GuardResolver;
/**
 * True when a function body denies a request on an authorization ground.
 *
 * The first two rules are the in-file analyzer's rules, kept identical so no previously proven
 * guard regresses. The third adds the structural case the first two miss: a branch that inspects
 * the caller's identity, role, permission, ownership, or tenancy and then ends the request
 * instead of delegating.
 */
export declare function functionDeniesAuthorization(fn: ts.FunctionLikeDeclaration, file: GuardSourceFile): boolean;
