import ts from "typescript";
import { resolveImport } from "./scope.js";
import { commonJsExport, exportedAs, hasModifier, importedBinding, localDeclaration, namespaceRequest, unwrapExpression as unwrap } from "./module-resolution.js";
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
export const MAX_GUARD_HOPS = 3;
/** Maximum distinct modules opened while resolving a single middleware argument. */
export const MAX_GUARD_FILES = 12;
/** Maximum `export *` branches searched in one barrel module. */
export const MAX_BARREL_BRANCHES = 8;
/** Maximum times a factory's return value is followed to the middleware it produces. */
export const MAX_FACTORY_DEPTH = 2;
/**
 * Concerns that reject a request for a reason other than the caller's authority.
 *
 * CSRF rejection, quota and billing limits, rate limiting, content-type policy, geographic and
 * maintenance gating, and request-shape validation all answer 401 or 403 while proving nothing
 * about who the caller is or what they may act on. Matching is substring and case-insensitive
 * because these concerns live inside compound identifiers — `ALLOWED_MIME_TYPES`, `MONTHLY_QUOTA`,
 * `csrfToken` — where a word boundary would never fire. A predicate naming one of these is not
 * authorization evidence even when it also names the session or the user.
 */
const UNRELATED_CONCERN = /csrf|xsrf|\bmime|content[_-]?type|file[_-]?type|extension|originalname|filename|magic[_-]?bytes|quota|rate[_-]?limit|ratelimit|throttl|too[_-]?many[_-]?requests|retry[_-]?after|maintenance|feature[_-]?flag|featureflag|kill[_-]?switch|captcha|honeypot|geo[_-]?block|geoip|country|denylist|blocklist|payload[_-]?too[_-]?large|file[_-]?size|max[_-]?size|body[_-]?schema|request[_-]?schema|safeparse|\bzod\b|\bjoi\b|\byup\b|\bajv\b/iu;
/**
 * Vocabulary that decides an authorization question: role, permission, scope, claim, ownership,
 * tenancy, or a policy verdict. Matching is substring where the token cannot plausibly appear in an
 * unrelated predicate, and word-bounded where it can — `allowed` must match `if (!allowed)` but not
 * `ALLOWED_MIME_TYPES`.
 */
const AUTHORIZATION_DECISION = /role|admin|permission|privilege|entitle|authoriz|unauthori|forbidden|scope|claim|owner|tenant|access|permit|\bability\b|\babilities\b|\bpolicy\b|\bpolicies\b|\bacl\b|\brbac\b|\babac\b|\bstaff\b|\bsuperuser\b|\bmember\b|membership|organi[sz]ation|org[_-]?id|workspace|\buser[_-]?id\b|created[_-]?by|belongs[_-]?to|owned[_-]?by|\ballow\b|\ballowed\b|\ballows\b|\bdeny\b|\bdenied\b|\bgrant\b|\bgranted\b|\bcan\b|\bcannot\b/iu;
/**
 * Predicate helpers spelled as a camel-case verb phrase, which the case-insensitive vocabulary
 * cannot express: `canAccess`, `mayEdit`, `assertCanManage`, `hasPermission`.
 */
const AUTHORIZATION_PREDICATE_CALL = /\b(?:can|may|is|has|assert|require|ensure|check|verify)(?:Access|Read|Write|Edit|Delete|Remove|Update|Manage|View|Modify|Admin|Owner|Own|Member|Role|Permission|Permitted|Authoriz|Allowed|Act|Operate)\w*/u;
/**
 * Expressions that denote the calling subject itself. Anchored so that `req.session.csrfToken`
 * cannot read as the subject while `req.session.user` can.
 */
const SUBJECT_EXPRESSION = /^(?:(?:req|request|ctx|context|event|locals|res\.locals)\??\.)?(?:session\??\.)?(?:user|auth|authInfo|currentUser|authenticatedUser|principal|subject|actor|identity|viewer|session|userId|sub)(?:\??\.(?:id|userId|sub|email|name))?$/iu;
/** A call that answers or aborts the request rather than continuing the chain. */
const REQUEST_TERMINATION = /\b(?:res|response|reply|ctx|context)\s*\??\s*\.\s*(?:status|sendStatus|statusCode|code|send|json|end|redirect|abort|throw)\b|\bNextResponse\s*\.\s*(?:json|redirect|rewrite)\b|\bnew\s+Response\b/u;
/**
 * Evidence that a terminating call rejects rather than answers.
 *
 * `res.json(order)` and `res.status(403).end()` are both terminations; only the second denies. A
 * denial signal is required so that a success response inside an authorization branch is never read
 * as a guard.
 */
const DENIAL_SIGNAL = /\b(?:401|403|404|407|419|423)\b|forbidden|unauthori[sz]ed|access[_-]?denied|permission[_-]?denied|not[_-]?allowed|\bdenied\b|\bdeny\b|\bredirect\b|\bnot[_-]?found\b/iu;
/** Delegation to the next handler; a branch that delegates has not denied anything. */
const DELEGATION = /\bnext\s*\(/u;
/** A `return` of an explicit falsy verdict, which is how a policy helper denies. */
const FALSY_VERDICT = /^return\s+(?:false|null|undefined)\s*;?$/u;
/** Maximum same-scope aliases expanded while reading a predicate's meaning. */
const MAX_ALIAS_HOPS = 2;
/** Maximum expressions joined into one predicate's text. */
const MAX_PREDICATE_PARTS = 12;
/** Maximum delegated authorization helpers followed from one middleware body. */
const MAX_DELEGATION_DEPTH = 2;
/** Maximum ancestors climbed from a denial site while collecting the conditions that control it. */
const MAX_ANCESTOR_STEPS = 64;
export function createGuardResolver(files) {
    const byPath = new Map();
    // First declaration wins so a duplicated path cannot make the corpus order-dependent.
    for (const file of files)
        if (!byPath.has(file.path))
            byPath.set(file.path, file);
    const paths = new Set(byPath.keys());
    /** Opens the module a relative specifier names, subject to the hop and module budgets. */
    const moduleFor = (file, request, depth, budget) => {
        if (!request.startsWith("."))
            return undefined;
        if (depth >= MAX_GUARD_HOPS)
            return undefined;
        // `scope.ts` owns module resolution. NodeNext TypeScript spells a sibling module `./x.js`
        // while the file on disk is `./x.ts`, so the compiled specifier is retried without its
        // extension; that is a second query against the same resolver, not a second resolver.
        const target = resolveImport(file.path, request, paths) ??
            resolveImport(file.path, request.replace(/\.[cm]?jsx?$/u, ""), paths);
        if (target === undefined)
            return undefined;
        const record = byPath.get(target);
        if (record === undefined)
            return undefined;
        if (!budget.files.has(target) && budget.files.size >= MAX_GUARD_FILES)
            return undefined;
        budget.files.add(target);
        return record;
    };
    /** Resolves a module-scope name in `file` to a function body, following imports. */
    const resolveBinding = (file, name, depth, budget) => {
        const key = `${file.path}#local:${name}`;
        if (budget.visited.has(key))
            return unresolved(`import cycle at ${file.path} while resolving ${name}`);
        budget.visited.add(key);
        const imported = importedBinding(file.sourceFile, name);
        if (imported !== undefined) {
            const target = moduleFor(file, imported.request, depth, budget);
            if (target === undefined) {
                budget.trace.push(`${file.path}: ${name} <- ${imported.request} (not in analyzed sources)`);
                return unresolved(`${name} is imported from ${imported.request}, which bounded analysis cannot open`);
            }
            budget.trace.push(`${file.path}: ${name} <- ${target.path}#${imported.exportName}`);
            return resolveExport(target, imported.exportName, depth + 1, budget);
        }
        const declaration = localDeclaration(file.sourceFile, name);
        if (declaration === undefined)
            return unresolved(`${name} has no declaration in ${file.path}`);
        if (ts.isFunctionDeclaration(declaration))
            return { kind: "function", fn: declaration, file };
        const initializer = declaration.initializer;
        if (initializer === undefined)
            return unresolved(`${name} in ${file.path} has no resolvable initializer`);
        return resolveValue(initializer, file, depth, budget);
    };
    /** Resolves one exported name of a module, following re-exports and barrels. */
    const resolveExport = (file, exportName, depth, budget) => {
        const key = `${file.path}#${exportName}`;
        if (budget.visited.has(key))
            return unresolved(`export cycle at ${file.path} while resolving ${exportName}`);
        budget.visited.add(key);
        const barrels = [];
        for (const statement of file.sourceFile.statements) {
            if (ts.isFunctionDeclaration(statement) && exportedAs(statement, exportName))
                return { kind: "function", fn: statement, file };
            if (ts.isVariableStatement(statement) &&
                hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
                for (const declaration of statement.declarationList.declarations) {
                    if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName)
                        continue;
                    const initializer = declaration.initializer;
                    if (initializer === undefined)
                        return unresolved(`${exportName} in ${file.path} has no initializer`);
                    return resolveValue(initializer, file, depth, budget);
                }
            }
            if (ts.isExportAssignment(statement) && exportName === "default")
                return resolveValue(statement.expression, file, depth, budget);
            if (ts.isExportDeclaration(statement)) {
                const specifier = statement.moduleSpecifier;
                const clause = statement.exportClause;
                if (clause !== undefined && ts.isNamedExports(clause)) {
                    for (const element of clause.elements) {
                        if (element.name.text !== exportName)
                            continue;
                        const local = (element.propertyName ?? element.name).text;
                        if (specifier === undefined || !ts.isStringLiteralLike(specifier))
                            return resolveBinding(file, local, depth, budget);
                        const target = moduleFor(file, specifier.text, depth, budget);
                        if (target === undefined)
                            return unresolved(`${exportName} is re-exported from ${specifier.text}, which bounded analysis cannot open`);
                        budget.trace.push(`${file.path}: re-export ${exportName} <- ${target.path}#${local}`);
                        return resolveExport(target, local, depth + 1, budget);
                    }
                }
                if (clause === undefined &&
                    specifier !== undefined &&
                    ts.isStringLiteralLike(specifier) &&
                    barrels.length < MAX_BARREL_BRANCHES)
                    barrels.push(specifier.text);
            }
            const commonJs = commonJsExport(statement, exportName);
            if (commonJs !== undefined)
                return resolveValue(commonJs, file, depth, budget);
        }
        // Barrels are searched last and in source order so the outcome does not depend on which
        // branch happens to declare the name first.
        for (const request of barrels) {
            const target = moduleFor(file, request, depth, budget);
            if (target === undefined)
                continue;
            budget.trace.push(`${file.path}: barrel ${request} -> ${target.path}#${exportName}`);
            const found = resolveExport(target, exportName, depth + 1, budget);
            if (found.kind === "function")
                return found;
        }
        return unresolved(`${file.path} does not export a resolvable ${exportName}`);
    };
    /** Resolves an arbitrary value expression to the function it denotes. */
    const resolveValue = (expression, file, depth, budget) => {
        const value = unwrap(expression);
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
            return { kind: "function", fn: value, file };
        if (ts.isIdentifier(value))
            return resolveBinding(file, value.text, depth, budget);
        if (ts.isPropertyAccessExpression(value))
            return resolveMember(value, file, depth, budget);
        if (ts.isCallExpression(value))
            return unresolved(`the value is produced by calling ${text(value.expression, file)}, which bounded analysis does not evaluate`);
        return unresolved(`the value ${text(value, file)} is not a resolvable function reference`);
    };
    /** Resolves `namespace.member`, where the namespace is a namespace import or a CJS require. */
    const resolveMember = (value, file, depth, budget) => {
        const object = unwrap(value.expression);
        if (!ts.isIdentifier(object))
            return unresolved(`${text(value, file)} is not a resolvable module member`);
        const request = namespaceRequest(file.sourceFile, object.text);
        if (request === undefined)
            return unresolved(`${object.text} is not a module namespace in ${file.path}`);
        const target = moduleFor(file, request, depth, budget);
        if (target === undefined)
            return unresolved(`${object.text} refers to ${request}, which bounded analysis cannot open`);
        budget.trace.push(`${file.path}: ${text(value, file)} <- ${target.path}#${value.name.text}`);
        return resolveExport(target, value.name.text, depth + 1, budget);
    };
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
        return resolveValue(returned, lookup.file, 0, budget);
    };
    /**
     * Follows an unconditional authorization helper called from inside a guard body.
     *
     * `assertAdmin(req.user)` denies the request without any branch of its own, so the decision has
     * to read the helper. Resolution stays inside the corpus, which is what keeps a package name from
     * being accepted as an authorization contract.
     */
    const delegate = (expression, owner) => {
        const budget = { files: new Set([owner.path]), visited: new Set(), trace: [] };
        const lookup = resolveValue(expression, owner, 0, budget);
        return lookup.kind === "function" ? { fn: lookup.fn, file: lookup.file } : undefined;
    };
    const classifyMiddleware = (argument, file) => {
        const budget = { files: new Set([file.path]), visited: new Set(), trace: [] };
        return classify(argument, file, budget, 0);
    };
    const classify = (argument, file, budget, factoryDepth) => {
        const value = unwrap(argument);
        if (ts.isArrayLiteralExpression(value)) {
            // Each element gets its own visited set — one element must not make the next look cyclic —
            // while the opened-module budget stays shared so the array cannot exceed the file cap.
            const parts = value.elements.map((element) => classify(element, file, { ...budget, visited: new Set(), trace: [] }, factoryDepth));
            const bodies = parts.flatMap((part) => part.bodies);
            const proven = parts.find((part) => part.verdict === "proven");
            if (proven !== undefined)
                return { ...proven, bodies };
            const open = parts.find((part) => part.verdict === "unresolved");
            if (open !== undefined)
                return { ...open, bodies };
            return {
                verdict: "not-guard",
                trace: parts[0]?.trace ?? [],
                reason: "no element of the middleware array denies the request",
                bodies
            };
        }
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
            return decide(value, file, budget, "the inline middleware");
        if (ts.isCallExpression(value)) {
            // The value passed to the route is what the call returns, so the factory is resolved and
            // then followed into the middleware it produces.
            const lookup = resolveValue(value.expression, file, 0, budget);
            if (lookup.kind === "unresolved")
                return open(lookup.reason, budget);
            const factoryBody = lookup.fn.getText(lookup.file.sourceFile);
            // A factory that rejects inside its own body — including an inline returned handler — is
            // already proven, matching the in-file behaviour.
            if (functionDeniesAuthorization(lookup.fn, lookup.file, delegate))
                return {
                    verdict: "proven",
                    trace: budget.trace.slice(),
                    reason: `${text(value.expression, file)} resolves to a body that denies the request`,
                    bodies: [factoryBody]
                };
            const produced = middlewareFromFactory(lookup, budget, factoryDepth);
            if (produced.kind === "unresolved")
                return { ...open(produced.reason, budget), bodies: [factoryBody] };
            return decide(produced.fn, produced.file, budget, text(value.expression, file));
        }
        if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) {
            const lookup = resolveValue(value, file, 0, budget);
            if (lookup.kind === "unresolved")
                return open(lookup.reason, budget);
            return decide(lookup.fn, lookup.file, budget, text(value, file));
        }
        return open(`${text(value, file)} is not a resolvable middleware reference`, budget);
    };
    const decide = (fn, owner, budget, label) => {
        const bodies = [fn.getText(owner.sourceFile)];
        return functionDeniesAuthorization(fn, owner, delegate)
            ? {
                verdict: "proven",
                trace: budget.trace.slice(),
                reason: `${label} resolves to a body in ${owner.path} that denies the request`,
                bodies
            }
            : {
                verdict: "not-guard",
                trace: budget.trace.slice(),
                reason: `${label} resolves to a body in ${owner.path} that never denies the request`,
                bodies
            };
    };
    const classifyMiddlewareList = (middleware, file) => {
        if (middleware.length === 0)
            return { verdict: "absent", evidence: "", authority: { resolved: false, text: "" } };
        const parts = middleware.map((argument) => classifyMiddleware(argument, file));
        const authority = {
            resolved: parts.some((part) => part.bodies.length > 0),
            text: middleware
                .map((argument) => argument.getText(file.sourceFile))
                .concat(parts.flatMap((part) => part.bodies))
                .join("\n")
        };
        const proven = parts.find((part) => part.verdict === "proven");
        if (proven !== undefined)
            return { verdict: "proven", evidence: describe(proven), authority };
        const unresolvedPart = parts.find((part) => part.verdict === "unresolved");
        if (unresolvedPart !== undefined)
            return { verdict: "unresolved", evidence: describe(unresolvedPart), authority };
        return { verdict: "absent", evidence: describe(parts[0]), authority };
    };
    return { classifyMiddleware, classifyMiddlewareList };
}
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
export function functionDeniesAuthorization(fn, file, delegate, depth = 0) {
    const body = fn.body;
    if (body === undefined)
        return false;
    if (deniesOnAuthorizationGround(body, file.sourceFile))
        return true;
    if (delegate === undefined || depth >= MAX_DELEGATION_DEPTH || !ts.isBlock(body))
        return false;
    for (const statement of body.statements) {
        const call = unconditionalCall(statement);
        if (call === undefined)
            continue;
        const target = delegate(call.expression, file);
        if (target === undefined)
            continue;
        if (functionDeniesAuthorization(target.fn, target.file, delegate, depth + 1))
            return true;
    }
    return false;
}
/** True when some request-denying site in the body is controlled by an authorization predicate. */
function deniesOnAuthorizationGround(body, sourceFile) {
    let found = false;
    const walk = (node) => {
        if (found)
            return;
        if (isDenialSite(node, sourceFile) && deniesForAuthority(node, body, sourceFile)) {
            found = true;
            return;
        }
        ts.forEachChild(node, walk);
    };
    ts.forEachChild(body, walk);
    return found;
}
/**
 * True when a node ends the request in a way that rejects it.
 *
 * A `throw` always rejects. A response call must additionally carry a denial signal so that a
 * success response returned from inside an authorization branch is not mistaken for a guard.
 */
function isDenialSite(node, sourceFile) {
    if (ts.isThrowStatement(node))
        return true;
    if (ts.isReturnStatement(node))
        return FALSY_VERDICT.test(node.getText(sourceFile).replace(/\s+/gu, " ").trim());
    if (!ts.isCallExpression(node))
        return false;
    const text = node.getText(sourceFile);
    return REQUEST_TERMINATION.test(text) && DENIAL_SIGNAL.test(text);
}
/**
 * True when the conditions controlling a denial site ask an authorization question.
 *
 * The walk is structural: it climbs from the site to the function body collecting only the
 * conditions that actually decide whether the site runs, and it refuses a branch that also calls
 * `next()`, because such a branch continues the chain instead of denying.
 */
function deniesForAuthority(site, body, sourceFile) {
    const conditions = [];
    let branchText;
    let child = site;
    // Bounded by the function body or the file root; the depth cap only guards against a malformed
    // tree, since every well-formed ancestor chain ends at the source file.
    for (let current = site.parent, depth = 0; depth < MAX_ANCESTOR_STEPS; current = current.parent, depth += 1) {
        if (ts.isIfStatement(current) &&
            (child === current.thenStatement || child === current.elseStatement)) {
            conditions.push(current.expression);
            branchText ??= child.getText(sourceFile);
        }
        else if (ts.isConditionalExpression(current) &&
            (child === current.whenTrue || child === current.whenFalse))
            conditions.push(current.condition);
        else if (ts.isBinaryExpression(current) &&
            child === current.right &&
            (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                current.operatorToken.kind === ts.SyntaxKind.BarBarToken))
            conditions.push(current.left);
        else if (ts.isCaseClause(current))
            conditions.push(current.expression);
        else if (ts.isSwitchStatement(current))
            conditions.push(current.expression);
        if (ts.isBlock(current) || ts.isSourceFile(current))
            conditions.push(...earlyExitConditions(current, child));
        if (current === body || ts.isSourceFile(current))
            break;
        child = current;
    }
    if (branchText !== undefined && DELEGATION.test(branchText))
        return false;
    return conditions.some((condition) => isAuthorizationPredicate(condition, sourceFile));
}
/**
 * Conditions of preceding `if` statements in the same block whose branch abruptly exits.
 *
 * `if (isAdmin) return next(); return res.status(403).end();` denies on an authorization ground
 * even though the denial itself sits at the top level of the body: the early exit above it is what
 * decides whether the denial runs.
 */
function earlyExitConditions(block, child) {
    const statements = ts.isBlock(block)
        ? block.statements
        : ts.isSourceFile(block)
            ? block.statements
            : undefined;
    if (statements === undefined)
        return [];
    const conditions = [];
    for (const statement of statements) {
        if (statement === child)
            break;
        if (ts.isIfStatement(statement) && abruptlyExits(statement.thenStatement))
            conditions.push(statement.expression);
    }
    return conditions;
}
/** True when a statement always leaves the enclosing function. */
function abruptlyExits(statement) {
    if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement))
        return true;
    if (ts.isBlock(statement)) {
        const last = statement.statements.at(-1);
        return last !== undefined && abruptlyExits(last);
    }
    return false;
}
/**
 * True when a condition asks an authorization question.
 *
 * An unrelated concern vetoes first and unconditionally: a predicate that names CSRF, a quota, a
 * rate limit, a MIME policy, geography, maintenance, a feature flag, or a request schema is not
 * authorization evidence even when it also mentions the session. What remains is accepted on
 * either authorization vocabulary — read from the condition plus its same-scope aliases, so that
 * `const ok = await checkPermission(user); if (!ok) …` is recognised — or a structural test of
 * whether an authenticated subject exists at all.
 */
function isAuthorizationPredicate(condition, sourceFile) {
    const text = predicateText(condition, sourceFile);
    if (UNRELATED_CONCERN.test(text))
        return false;
    if (AUTHORIZATION_DECISION.test(text) || AUTHORIZATION_PREDICATE_CALL.test(text))
        return true;
    return testsSubjectPresence(condition, sourceFile);
}
/** The condition's own text plus the initializers of the same-file names it reads. */
function predicateText(condition, sourceFile) {
    const parts = [condition.getText(sourceFile)];
    const seen = new Set();
    let frontier = [condition];
    for (let hop = 0; hop < MAX_ALIAS_HOPS && parts.length < MAX_PREDICATE_PARTS; hop += 1) {
        const next = [];
        for (const node of frontier)
            collectIdentifiers(node).forEach((name) => {
                if (seen.has(name) || parts.length >= MAX_PREDICATE_PARTS)
                    return;
                seen.add(name);
                const initializer = precedingInitializer(sourceFile, name, condition);
                if (initializer === undefined)
                    return;
                parts.push(initializer.getText(sourceFile));
                next.push(initializer);
            });
        if (next.length === 0)
            break;
        frontier = next;
    }
    return parts.join(" ");
}
function collectIdentifiers(node) {
    const names = [];
    const walk = (candidate) => {
        if (ts.isIdentifier(candidate))
            names.push(candidate.text);
        ts.forEachChild(candidate, walk);
    };
    walk(node);
    return names;
}
/** The initializer of a same-file binding declared before the condition. */
function precedingInitializer(sourceFile, name, condition) {
    let found;
    const limit = condition.getStart(sourceFile);
    const walk = (node) => {
        if (found !== undefined)
            return;
        if (ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
            node.initializer !== undefined &&
            node.getStart(sourceFile) < limit) {
            found = node.initializer;
            return;
        }
        ts.forEachChild(node, walk);
    };
    ts.forEachChild(sourceFile, walk);
    return found;
}
/**
 * True when the condition structurally tests whether an authenticated subject exists.
 *
 * Structural rather than textual: `!req.user`, `session.user == null`, and a bare `req.auth`
 * operand all qualify, while `req.headers["x-csrf-token"] !== req.session.csrfToken` does not,
 * even though both mention the session.
 */
function testsSubjectPresence(condition, sourceFile) {
    let found = false;
    const consider = (node) => {
        if (found)
            return;
        if (ts.isParenthesizedExpression(node)) {
            consider(node.expression);
            return;
        }
        if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
            if (isSubjectExpression(node.operand, sourceFile))
                found = true;
            else
                consider(node.operand);
            return;
        }
        if (ts.isBinaryExpression(node)) {
            const kind = node.operatorToken.kind;
            if (kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                kind === ts.SyntaxKind.BarBarToken ||
                kind === ts.SyntaxKind.QuestionQuestionToken) {
                consider(node.left);
                consider(node.right);
                return;
            }
            if ((kind === ts.SyntaxKind.EqualsEqualsToken ||
                kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
                kind === ts.SyntaxKind.ExclamationEqualsToken ||
                kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
                ((isSubjectExpression(node.left, sourceFile) && isNullish(node.right)) ||
                    (isSubjectExpression(node.right, sourceFile) && isNullish(node.left))))
                found = true;
            return;
        }
        if (isSubjectExpression(node, sourceFile))
            found = true;
    };
    consider(condition);
    return found;
}
function isSubjectExpression(node, sourceFile) {
    return SUBJECT_EXPRESSION.test(node.getText(sourceFile).replace(/\s+/gu, ""));
}
function isNullish(node) {
    if (node.kind === ts.SyntaxKind.NullKeyword)
        return true;
    return ts.isIdentifier(node) && node.text === "undefined";
}
/** The call of a statement-level `foo(...)` or `await foo(...)`, when the statement is one. */
function unconditionalCall(statement) {
    if (!ts.isExpressionStatement(statement))
        return undefined;
    let expression = statement.expression;
    while (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression))
        expression = expression.expression;
    return ts.isCallExpression(expression) ? expression : undefined;
}
/** The first `return` expression of a function, ignoring returns inside nested functions. */
function returnedExpression(fn) {
    const body = fn.body;
    if (body === undefined)
        return undefined;
    if (!ts.isBlock(body))
        return body;
    let result;
    const walk = (node) => {
        if (result !== undefined)
            return;
        if (ts.isFunctionLike(node))
            return;
        if (ts.isReturnStatement(node)) {
            result = node.expression;
            return;
        }
        ts.forEachChild(node, walk);
    };
    ts.forEachChild(body, walk);
    return result;
}
function unresolved(reason) {
    return { kind: "unresolved", reason };
}
function open(reason, budget) {
    return { verdict: "unresolved", trace: budget.trace.slice(), reason, bodies: [] };
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
