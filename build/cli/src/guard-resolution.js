import ts from "typescript";
import { createModuleResolver, returnedExpression, unwrapExpression } from "./module-resolution.js";
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
export const MAX_GUARD_HOPS = 3;
/** Maximum distinct modules opened while resolving a single middleware argument. */
export const MAX_GUARD_FILES = 12;
/** Maximum `export *` branches searched in one barrel module. */
export const MAX_BARREL_BRANCHES = 8;
/** Maximum times a factory's return value is followed to the middleware it produces. */
export const MAX_FACTORY_DEPTH = 2;
/**
 * A request-terminating branch condition that inspects the caller's identity, role, permissions,
 * ownership, or tenancy. This is read from the *resolved body*, not from the middleware's name.
 */
const SUBJECT_PREDICATE = /\b(?:user|session|role|roles|permission|permissions|scope|scopes|claim|claims|isAdmin|admin|owner|ownerId|tenant|tenantId|orgId|organizationId|ability|policy|authoriz\w*|authenticat\w*|allowed|access)\b/iu;
/** A branch body that answers or aborts the request rather than continuing the chain. */
const REQUEST_TERMINATION = /\b(?:res|response|reply|ctx|context)\s*\.\s*(?:status|sendStatus|send|json|end|redirect|abort)\b|\bNextResponse\b|\bthrow\b|\breturn\s+(?:false|null|undefined)\s*;?\s*$/mu;
/** Delegation to the next handler; a branch that delegates has not denied anything. */
const DELEGATION = /\bnext\s*\(/u;
/** Explicit authorization status rejection. Preserved verbatim from the in-file analyzer. */
const STATUS_CODE = /\b(?:401|403)\b/u;
const STATUS_MEMBER = /\b(?:status|sendStatus|statusCode|code)\b/u;
const THROWN_AUTHORIZATION_ERROR = /\bForbidden|Unauthorized\b/u;
const THROW_KEYWORD = /\bthrow\b/u;
export function createGuardResolver(files) {
    const modules = createModuleResolver(files, {
        hops: MAX_GUARD_HOPS,
        files: MAX_GUARD_FILES,
        barrelBranches: MAX_BARREL_BRANCHES
    });
    /**
     * Follows a factory to the middleware it returns.
     *
     * A factory whose returned value is not a resolvable function is unresolved, never a proven or
     * a failed guard: the middleware that actually runs was never inspected.
     */
    const middlewareFromFactory = (lookup, budget, factoryDepth) => {
        if (factoryDepth >= MAX_FACTORY_DEPTH)
            return unresolved("the factory nesting limit was reached before a middleware body was read");
        const returned = returnedExpression(lookup.fn);
        if (returned === undefined)
            return unresolved(`${lookup.file.path} factory returns no inspectable value`);
        return modules.resolveValue(returned, lookup.file, 0, budget);
    };
    const classifyMiddleware = (argument, file) => classify(argument, file, modules.budgetFor(file), 0);
    const classify = (argument, file, budget, factoryDepth) => {
        const value = unwrapExpression(argument);
        if (ts.isArrayLiteralExpression(value)) {
            // Each element gets its own visited set — one element must not make the next look cyclic —
            // while the opened-module budget stays shared so the array cannot exceed the file cap.
            const parts = value.elements.map((element) => classify(element, file, { ...budget, visited: new Set(), trace: [] }, factoryDepth));
            const proven = parts.find((part) => part.verdict === "proven");
            if (proven !== undefined)
                return proven;
            const open = parts.find((part) => part.verdict === "unresolved");
            if (open !== undefined)
                return open;
            return {
                verdict: "not-guard",
                trace: parts[0]?.trace ?? [],
                reason: "no element of the middleware array denies the request"
            };
        }
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
            return decide(value, file, budget, "the inline middleware");
        if (ts.isCallExpression(value)) {
            // The value passed to the route is what the call returns, so the factory is resolved and
            // then followed into the middleware it produces.
            const lookup = modules.resolveValue(value.expression, file, 0, budget);
            if (lookup.kind === "unresolved")
                return open(lookup.reason, budget);
            // A factory that rejects inside its own body — including an inline returned handler — is
            // already proven, matching the in-file behaviour.
            if (functionDeniesAuthorization(lookup.fn, lookup.file))
                return {
                    verdict: "proven",
                    trace: budget.trace.slice(),
                    reason: `${text(value.expression, file)} resolves to a body that denies the request`
                };
            const produced = middlewareFromFactory(lookup, budget, factoryDepth);
            if (produced.kind === "unresolved")
                return open(produced.reason, budget);
            return decide(produced.fn, produced.file, budget, text(value.expression, file));
        }
        if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) {
            const lookup = modules.resolveValue(value, file, 0, budget);
            if (lookup.kind === "unresolved")
                return open(lookup.reason, budget);
            return decide(lookup.fn, lookup.file, budget, text(value, file));
        }
        return open(`${text(value, file)} is not a resolvable middleware reference`, budget);
    };
    const decide = (fn, owner, budget, label) => functionDeniesAuthorization(fn, owner)
        ? {
            verdict: "proven",
            trace: budget.trace.slice(),
            reason: `${label} resolves to a body in ${owner.path} that denies the request`
        }
        : {
            verdict: "not-guard",
            trace: budget.trace.slice(),
            reason: `${label} resolves to a body in ${owner.path} that never denies the request`
        };
    const classifyMiddlewareList = (middleware, file) => {
        if (middleware.length === 0)
            return { verdict: "absent", evidence: "" };
        const parts = middleware.map((argument) => classifyMiddleware(argument, file));
        const proven = parts.find((part) => part.verdict === "proven");
        if (proven !== undefined)
            return { verdict: "proven", evidence: describe(proven) };
        const unresolvedPart = parts.find((part) => part.verdict === "unresolved");
        if (unresolvedPart !== undefined)
            return { verdict: "unresolved", evidence: describe(unresolvedPart) };
        return { verdict: "absent", evidence: describe(parts[0]) };
    };
    return { classifyMiddleware, classifyMiddlewareList };
}
/**
 * True when a function body denies a request on an authorization ground.
 *
 * The first two rules are the in-file analyzer's rules, kept identical so no previously proven
 * guard regresses. The third adds the structural case the first two miss: a branch that inspects
 * the caller's identity, role, permission, ownership, or tenancy and then ends the request
 * instead of delegating.
 */
export function functionDeniesAuthorization(fn, file) {
    const body = fn.body;
    if (body === undefined)
        return false;
    const bodyText = body.getText(file.sourceFile);
    if (STATUS_CODE.test(bodyText) && STATUS_MEMBER.test(bodyText))
        return true;
    if (THROWN_AUTHORIZATION_ERROR.test(bodyText) && THROW_KEYWORD.test(bodyText))
        return true;
    return hasSubjectGatedExit(body, file.sourceFile);
}
/** True when some `if` tests an authorization-relevant subject and its branch ends the request. */
function hasSubjectGatedExit(body, sourceFile) {
    let found = false;
    const walk = (node) => {
        if (found)
            return;
        if (ts.isIfStatement(node)) {
            const condition = node.expression.getText(sourceFile);
            const branch = node.thenStatement.getText(sourceFile);
            if (SUBJECT_PREDICATE.test(condition) &&
                REQUEST_TERMINATION.test(branch) &&
                !DELEGATION.test(branch)) {
                found = true;
                return;
            }
        }
        ts.forEachChild(node, walk);
    };
    ts.forEachChild(body, walk);
    return found;
}
function unresolved(reason) {
    return { kind: "unresolved", reason };
}
function open(reason, budget) {
    return { verdict: "unresolved", trace: budget.trace.slice(), reason };
}
function describe(resolution) {
    if (resolution === undefined)
        return "";
    const trace = resolution.trace.length === 0 ? "" : ` Resolution path: ${resolution.trace.join(" -> ")}.`;
    return ` Cross-file guard resolution: ${resolution.reason}.${trace}`;
}
function text(node, file) {
    return node.getText(file.sourceFile);
}
//# sourceMappingURL=guard-resolution.js.map