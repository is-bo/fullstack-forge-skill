import ts from "typescript";
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
 * Scope and limits — deliberately NOT a whole-program resolver:
 *  - Only relative specifiers are followed, and only into the analyzed source corpus. A bare
 *    specifier (an installed package) is never resolved and is reported unresolved, never proven.
 *  - Named, default, aliased, renamed re-export, `export *` barrel, and CommonJS `exports.x` /
 *    `module.exports` forms are followed. Computed, conditional, or dynamically produced exports
 *    are not.
 *  - Module jumps, opened modules, barrel branches, and factory unwrapping are each capped, and a
 *    visited set makes cyclic imports terminate.
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
export type GuardSourceFile = {
    /** Repository-relative POSIX path — the key module specifiers resolve against. */
    path: string;
    content: string;
    sourceFile: ts.SourceFile;
};
export type GuardVerdict = "proven" | "not-guard" | "unresolved";
export type GuardResolution = {
    verdict: GuardVerdict;
    /** Ordered resolution hops in source order; deterministic, safe to publish as evidence. */
    trace: string[];
    /** Why this verdict was reached. */
    reason: string;
    /** Source text of every body this argument resolved to, in source order. */
    bodies: string[];
};
/** Verdict shape expected by the analyzer's route classification. */
export type RouteGuardVerdict = "proven" | "absent" | "unresolved";
/**
 * Role vocabulary observed on a route's middleware.
 *
 * `text` joins the middleware expressions with the bodies they resolved to, and `resolved` records
 * whether any body was actually read. Object authorization reads this to tell a proven platform
 * administrator from an unread name; it is never used to prove that a guard exists.
 */
export type MiddlewareAuthority = {
    resolved: boolean;
    text: string;
};
export type MiddlewareClassification = {
    verdict: RouteGuardVerdict;
    /** Deterministic evidence sentence, or an empty string when there is nothing to add. */
    evidence: string;
    authority: MiddlewareAuthority;
};
export type GuardResolver = {
    /** Classifies one middleware argument by the body it resolves to. */
    classifyMiddleware: (argument: ts.Expression, file: GuardSourceFile) => GuardResolution;
    /** Classifies a route's whole middleware list into the analyzer's route verdict. */
    classifyMiddlewareList: (middleware: readonly ts.Expression[], file: GuardSourceFile) => MiddlewareClassification;
};
export declare function createGuardResolver(files: readonly GuardSourceFile[]): GuardResolver;
/**
 * Resolves a value expression to the function it denotes, for delegated authorization helpers.
 *
 * Supplied by `createGuardResolver`; absent when the caller has no corpus (the analyzer's in-file
 * handler check), in which case delegation is simply not followed.
 */
export type AuthorizationDelegate = (expression: ts.Expression, file: GuardSourceFile) => {
    fn: ts.FunctionLikeDeclaration;
    file: GuardSourceFile;
} | undefined;
/**
 * True when a function body denies a request on an authorization ground.
 *
 * The previous rule accepted any body whose text contained `401` or `403` next to a status-like
 * token. Every middleware that rejects for an unrelated reason — CSRF, quota, rate limit, MIME
 * policy, geography, maintenance, feature flags, request-shape validation — satisfied that, so a
 * route protected by none of them was reported clean. A status code is a symptom, not a proof.
 *
 * The replacement is a structural connection. Each request-denying site in the body is located, the
 * conditions that actually control it are walked out of the AST (enclosing `if`/ternary/logical
 * branches, `switch` subjects, and preceding early-exit dominators in the same block), and the
 * guard is proven only when one of those controlling conditions asks an authorization question:
 * subject presence, identity, role, permission, scope or claim, ownership, tenancy, or a policy
 * verdict. A predicate that names an unrelated concern is rejected outright, so a status code alone
 * can no longer clear a route.
 *
 * A `throw` counts on the same terms — it must be controlled by an authorization predicate — which
 * is what removes the old "the word `Forbidden` appears somewhere in this file" acceptance. When a
 * resolver is available, an unconditional call to a helper whose own body denies on an
 * authorization ground also counts, so `assertAdmin(req.user)` is recognised without trusting the
 * helper's name.
 */
export declare function functionDeniesAuthorization(fn: ts.FunctionLikeDeclaration, file: GuardSourceFile, delegate?: AuthorizationDelegate, depth?: number): boolean;
