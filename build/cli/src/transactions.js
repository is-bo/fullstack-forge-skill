import ts from "typescript";
import { lineNumber } from "./utils.js";
const MISSING_BOUNDARY = {
    id: "FF-DATA-TRANSACTION-001",
    analyzer: "js-ts-database",
    section: "database",
    title: "Related writes are not enclosed by a proven atomic boundary",
    impact: "A failure between the writes commits one half of the invariant and leaves the record set inconsistent.",
    recommendation: "Execute the related writes inside one database transaction, or make the second write idempotently recoverable and prove that recovery with a test.",
    safeFix: false,
    absenceProvesResolution: false,
    verification: [
        "Re-run the js-ts-database analyzer",
        "Force a failure between the writes and assert that neither is durable"
    ],
    standards: ["OWASP ASVS 5.0", "CWE-662"]
};
const UNRESOLVED_BOUNDARY = {
    id: "FF-DATA-TRANSACTION-NOT-VERIFIED-001",
    analyzer: "js-ts-database",
    section: "database",
    title: "Atomic boundary around related writes could not be established",
    impact: "The writes share a consistency invariant, but the enclosing abstraction is not a recognized transaction API, so atomicity is neither proven nor disproven.",
    recommendation: "Document or adapt the transaction wrapper so its boundary is resolvable, then rerun the analyzer.",
    safeFix: false,
    absenceProvesResolution: false,
    verification: [
        "Inspect the wrapper implementation",
        "Force a failure between the writes and assert that neither is durable"
    ],
    standards: ["OWASP ASVS 5.0", "CWE-662"]
};
/** One level of local helper inlining. Deeper call graphs are reported as unresolved, not guessed. */
const HELPER_RESOLUTION_DEPTH = 1;
/** Bounds object-literal descent when harvesting identifier and foreign-key evidence. */
const OBJECT_SCAN_DEPTH = 5;
const CREATE_METHODS = new Set([
    "add",
    "bulkCreate",
    "create",
    "createMany",
    "insert",
    "insertMany",
    "insertOne",
    "replaceOne",
    "save",
    "upsert"
]);
const UPDATE_METHODS = new Set([
    "findOneAndReplace",
    "findOneAndUpdate",
    "update",
    "updateMany",
    "updateOne"
]);
const DELETE_METHODS = new Set([
    "del",
    "delete",
    "deleteMany",
    "deleteOne",
    "destroy",
    "findOneAndDelete",
    "remove",
    "truncate"
]);
const ADJUST_METHODS = new Set(["decrement", "increment"]);
const RAW_METHODS = new Set([
    "$executeRaw",
    "$executeRawUnsafe",
    "execute",
    "query",
    "raw",
    "run",
    "unsafe"
]);
/** Method names that never prove persistence on their own and require a data-access receiver. */
const AMBIGUOUS_METHODS = new Set([
    "add",
    "create",
    "delete",
    "insert",
    "remove",
    "save",
    "set",
    "update"
]);
const TRANSACTION_METHODS = new Set([
    "$transaction",
    "runTransaction",
    "transaction",
    "transactional",
    "withTransaction"
]);
/** Handle producers that only become transactional once `startTransaction` is observed. */
const DEFERRED_HANDLE_METHODS = new Set(["createQueryRunner", "startSession"]);
/** Option keys through which a transaction handle is threaded into an otherwise global client. */
const HANDLE_OPTION_KEYS = new Set(["client", "session", "transaction", "trx", "tx"]);
/**
 * Object keys whose values are row payloads or filters. A vendor threads a transaction handle
 * through an options object, never through the data it writes, so descending into these keys turns
 * an ordinary column named `session` or `client` into a phantom handle and masks a real defect.
 */
const PAYLOAD_KEYS = new Set([
    "$inc",
    "$push",
    "$set",
    "attributes",
    "create",
    "data",
    "defaults",
    "fields",
    "filter",
    "having",
    "include",
    "orderBy",
    "payload",
    "record",
    "returning",
    "select",
    "set",
    "update",
    "values",
    "where"
]);
/** Keys that select rows rather than mutate them, so an amount named there is not an amount write. */
const FILTER_KEYS = new Set([
    "attributes",
    "filter",
    "having",
    "include",
    "order",
    "orderBy",
    "select",
    "where"
]);
/**
 * Names that carry no meaning other than "transaction handle". A binding with one of these names
 * whose producer the analyzer cannot classify is an unresolved boundary, not an absent one.
 * Ordinary client names (`db`, `prisma`, `client`, `repo`) are deliberately excluded: treating them
 * the same way would convert the most common genuine defect shape into NOT_VERIFIED.
 */
const TRANSACTION_HANDLE_NAME = /^(?:queryrunner|transaction|trx|tx|txn|unitofwork|uow)$/iu;
/**
 * Ownership and tenancy keys. They scope a row to a principal rather than tying two rows into one
 * consistency invariant, so two unrelated tables written for the same `userId` are not a pair.
 */
const SCOPE_ONLY_KEY = /^(?:actor|author|creator|customer|member|org|organization|owner|principal|tenant|user|workspace)(?:Id|_id|Uuid|Key|Ref)$/u;
const DATA_ACCESS_ROOT = /^(?:client|collection|conn|connection|database|datasource|db|drizzle|em|entitymanager|firestore|knex|manager|model|models|mongo|mongoose|orm|pool|prisma|queryrunner|repo|repository|sequelize|session|sql|store|supabase|trx|tx|txn)$/iu;
const DATA_ACCESS_SUFFIX = /(?:client|collection|dao|db|model|repo|repository|store|table)$/iu;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const IDENTIFIER_PROPERTY = /^(?:id|uuid|_id|[a-z0-9]+(?:Id|_id|Uuid|Key|Ref))$/u;
const AMOUNT_PROPERTY = /(?:amount|balance|credits?|debits?|price|quantity|qty|stock|total)/iu;
const FINANCIAL_ENTITY = /(?:account|balance|billing|charge|checkout|credit|debit|fee|invoice|ledger|order|payment|payout|purchase|receipt|refund|settlement|subscription|transfer|wallet)/u;
const INVENTORY_ENTITY = /(?:allocation|capacity|inventory|item|reservation|seat|sku|slot|stock|warehouse)/u;
const ACCESS_ENTITY = /(?:acl|apikey|entitlement|grant|licen[cs]e|membership|permission|policy|role|token)/u;
/**
 * Entry point. Returns issues that are structurally assignable to the analyzer `Issue` type, in
 * stable source order.
 */
export function analyzeTransactionFile(file) {
    const index = buildFileIndex(file);
    const scopes = collectWorkflowScopes(index);
    // A workflow that performs every write through helpers has no direct write of its own, so it
    // never appeared as a scope and was never analysed. Registering those scopes with an empty direct
    // list is what makes `record(a); record(b)` visible at all.
    for (const scope of helperCallScopes(index))
        if (!scopes.has(scope))
            scopes.set(scope, []);
    const issues = [];
    for (const [scope, writes] of scopes) {
        const resolved = [...writes, ...helperWrites(index, scope, writes)].sort((left, right) => left.anchor.getStart(index.sourceFile) - right.anchor.getStart(index.sourceFile));
        if (resolved.length < 2)
            continue;
        for (const group of relatedGroups(resolved))
            issues.push(...groupIssues(index, group));
    }
    return issues.sort((left, right) => left.start - right.start || left.spec.id.localeCompare(right.spec.id));
}
/* -------------------------------------------------------------------------- */
/* File index                                                                  */
/* -------------------------------------------------------------------------- */
function buildFileIndex(file) {
    const sourceFile = file.sourceFile;
    const functions = new Map();
    const aliases = new Map();
    const deferredHandles = [];
    const handles = [];
    const unresolvedHandles = [];
    const started = new Set();
    const markers = [];
    walk(sourceFile, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name !== undefined)
            functions.set(node.name.text, node);
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            const name = node.name.text;
            const initializer = node.initializer;
            if (initializer === undefined)
                return;
            if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
                functions.set(name, initializer);
            const value = unwrapValue(initializer);
            if (ts.isPropertyAccessExpression(value) || ts.isIdentifier(value)) {
                const alias = expressionName(value);
                if (alias !== undefined)
                    aliases.set(name, alias);
            }
            if (ts.isCallExpression(value)) {
                const scope = declarationScope(node);
                const bound = boundHandleKind(value, sourceFile, aliases);
                if (bound === "immediate")
                    handles.push({ name, scope });
                else if (bound === "deferred")
                    deferredHandles.push({ name, scope });
                else if (TRANSACTION_HANDLE_NAME.test(name))
                    unresolvedHandles.push({ name, scope });
            }
        }
        if (ts.isCallExpression(node)) {
            const chain = callChain(node);
            if (chain !== undefined) {
                const tip = chain.segments.at(-1);
                if (tip?.name === "startTransaction")
                    started.add(chain.root);
                const marker = transactionMarker(node, sourceFile);
                if (marker !== undefined)
                    markers.push({
                        kind: marker,
                        start: node.getStart(sourceFile),
                        root: chain.root,
                        node
                    });
            }
        }
    });
    for (const deferred of deferredHandles)
        if (started.has(deferred.name))
            handles.push(deferred);
        else
            unresolvedHandles.push(deferred);
    markers.sort((left, right) => left.start - right.start);
    return { file, sourceFile, functions, aliases, handles, unresolvedHandles, markers };
}
/** The function (or the file) a declaration belongs to. Bindings never escape their own scope. */
function declarationScope(node) {
    let current = node;
    while (!ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current))
            return current;
        current = current.parent;
    }
    return current;
}
function containsNode(scope, node) {
    let current = node;
    for (;;) {
        if (current === scope)
            return true;
        if (ts.isSourceFile(current))
            return false;
        current = current.parent;
    }
}
/**
 * Resolves a name to a live transaction handle visible at `node`.
 *
 * A same-named parameter shadows any outer binding: a function that receives `trx` as an argument
 * decides nothing about atomicity here, even when another function in the same file happens to
 * open a transaction into a variable of that name.
 */
function handleInScope(index, name, node) {
    if (isParameterReceiver(node, name))
        return false;
    return index.handles.some((handle) => handle.name === name && containsNode(handle.scope, node));
}
function unresolvedHandleInScope(index, name, node) {
    if (isParameterReceiver(node, name))
        return false;
    return index.unresolvedHandles.some((handle) => handle.name === name && containsNode(handle.scope, node));
}
/** Name-only lookup used for write *detection*, where a handle anywhere in the file is a signal. */
function declaresHandleNamed(index, name) {
    return (index.handles.some((handle) => handle.name === name) ||
        index.unresolvedHandles.some((handle) => handle.name === name));
}
/** `await`, parentheses, and `as` casts never change which value is being bound. */
function unwrapValue(node) {
    let current = node;
    for (;;) {
        if (ts.isAwaitExpression(current))
            current = current.expression;
        else if (ts.isParenthesizedExpression(current))
            current = current.expression;
        else if (ts.isAsExpression(current) || ts.isNonNullExpression(current))
            current = current.expression;
        else
            return current;
    }
}
/**
 * Distinguishes an unmanaged transaction handle (`await knex.transaction()`) from a deferred one
 * (`dataSource.createQueryRunner()`), which only becomes transactional once `startTransaction` runs.
 */
function boundHandleKind(node, sourceFile, aliases) {
    const chain = callChain(node);
    const tip = chain?.segments.at(-1);
    if (chain === undefined || tip === undefined)
        return undefined;
    if (DEFERRED_HANDLE_METHODS.has(tip.name))
        return "deferred";
    if (!isKnownTransactionChain(chain, aliases))
        return undefined;
    const takesCallback = node.arguments.some((argument) => isFunctionLike(argument, sourceFile));
    return takesCallback ? undefined : "immediate";
}
function transactionMarker(node, sourceFile) {
    const chain = callChain(node);
    const tip = chain?.segments.at(-1);
    if (chain === undefined || tip === undefined || !RAW_METHODS.has(tip.name))
        return undefined;
    const text = literalArgumentText(node, sourceFile);
    if (/^\s*(?:begin|start\s+transaction)\b/iu.test(text))
        return "begin";
    if (/^\s*commit\b/iu.test(text))
        return "commit";
    if (/^\s*rollback\b/iu.test(text))
        return "rollback";
    return undefined;
}
/* -------------------------------------------------------------------------- */
/* Write collection                                                            */
/* -------------------------------------------------------------------------- */
/**
 * Groups writes by workflow scope. A callback handed to a transaction API is not its own workflow:
 * writes inside it belong to the function that opened the transaction, so a transaction wrapped
 * around only part of a workflow stays visible.
 */
function collectWorkflowScopes(index) {
    const scopes = new Map();
    walk(index.sourceFile, (node) => {
        if (!ts.isCallExpression(node))
            return;
        const write = describeWrite(index, node);
        if (write === undefined)
            return;
        const scope = workflowScope(index, node);
        const existing = scopes.get(scope);
        if (existing === undefined)
            scopes.set(scope, [write]);
        else
            existing.push(write);
    });
    return scopes;
}
/**
 * Scopes that write only through locally declared helpers.
 *
 * `collectWorkflowScopes` keys on direct writes, so a function whose every write happens inside a
 * helper it calls produced no scope entry and was skipped entirely — a silent false negative for
 * exactly the delegation style helper inlining exists to handle.
 */
function helperCallScopes(index) {
    const found = [];
    const seen = new Set();
    walk(index.sourceFile, (node) => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
            return;
        const declaration = index.functions.get(node.expression.text);
        if (declaration?.body === undefined)
            return;
        const scope = workflowScope(index, node);
        if (scope === declaration || seen.has(scope))
            return;
        if (!containsWrite(index, declaration.body))
            return;
        seen.add(scope);
        found.push(scope);
    });
    return found;
}
function containsWrite(index, node) {
    const writes = [];
    walk(node, (inner) => {
        if (ts.isCallExpression(inner) && describeWrite(index, inner) !== undefined)
            writes.push(inner);
    });
    return writes.length > 0;
}
function workflowScope(index, node) {
    let current = node;
    while (!ts.isSourceFile(current)) {
        const parent = current.parent;
        if (ts.isFunctionLike(current) && !isTransactionCallback(index, current))
            return current;
        current = parent;
    }
    return index.sourceFile;
}
function isTransactionCallback(index, node) {
    const parent = node.parent;
    if (!ts.isCallExpression(parent))
        return false;
    if (!parent.arguments.some((argument) => argument === node))
        return false;
    return classifyTransactionCall(index, parent) !== undefined;
}
function describeWrite(index, node) {
    if (isInnerChainLink(node))
        return undefined;
    const chain = callChain(node);
    if (chain === undefined)
        return undefined;
    const write = writeSegment(index, chain, node);
    if (write === undefined)
        return undefined;
    const sourceFile = index.sourceFile;
    const symbols = new Set();
    const identifiers = new Map();
    const foreignKeys = new Set();
    let mutatesAmount = write.kind === "adjust";
    // Every call in the fluent chain contributes, not just the outermost one. `knex("accounts")
    // .where({ id }).update({ balance })` keys its row in `.where()`, so reading only the last call's
    // arguments left every Knex-style write with no identifier evidence and no relation to anything.
    for (const segment of chain.segments) {
        const call = segment.call;
        if (call === undefined)
            continue;
        for (const argument of call.arguments) {
            collectSymbols(argument, sourceFile, symbols);
            collectIdentifierProperties(argument, sourceFile, identifiers, foreignKeys, 0);
            // A row selector naming a column called `total` selects rows; it does not move money.
            if (!FILTER_KEYS.has(segment.name) && mutatesAmountValue(argument, sourceFile, 0))
                mutatesAmount = true;
        }
    }
    const binding = resultBinding(node);
    const operation = {
        node,
        anchor: node,
        name: chainName(chain),
        kind: write.kind,
        entity: write.entity,
        line: lineNumber(index.file.content, node.getStart(sourceFile)),
        symbols,
        identifiers,
        foreignKeys,
        mutatesAmount,
        coverage: { state: "NONE", boundary: "", detail: "" }
    };
    if (binding !== undefined)
        operation.binding = binding;
    operation.coverage = assessCoverage(index, operation, chain);
    return operation;
}
/**
 * True when the write actually mutates a quantity, which is what raises financial severity.
 *
 * The previous test matched the whole argument text, so `update({ where: { totalId: x }, data: {
 * note } })` was scored as an amount write on the strength of a filter column. Only mutation keys
 * are considered now, and only keys: a value expression that merely mentions `total` is not
 * evidence that a balance moved.
 */
function mutatesAmountValue(node, sourceFile, depth) {
    if (depth > OBJECT_SCAN_DEPTH)
        return false;
    if (!ts.isObjectLiteralExpression(node))
        return AMOUNT_PROPERTY.test(node.getText(sourceFile));
    for (const property of node.properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
            if (AMOUNT_PROPERTY.test(property.name.text))
                return true;
            continue;
        }
        if (!ts.isPropertyAssignment(property))
            continue;
        const key = property.name.getText(sourceFile).replace(/["']/gu, "");
        if (FILTER_KEYS.has(key))
            continue;
        if (AMOUNT_PROPERTY.test(key))
            return true;
        if (ts.isObjectLiteralExpression(property.initializer) &&
            mutatesAmountValue(property.initializer, sourceFile, depth + 1))
            return true;
    }
    return false;
}
/** True when this call is only a link of a longer fluent chain; the outermost call owns the write. */
function isInnerChainLink(node) {
    const parent = node.parent;
    return (ts.isPropertyAccessExpression(parent) &&
        parent.expression === node &&
        ts.isCallExpression(parent.parent) &&
        parent.parent.expression === parent);
}
function writeSegment(index, chain, node) {
    for (let position = chain.segments.length - 1; position >= 0; position -= 1) {
        const segment = chain.segments[position];
        if (segment === undefined)
            continue;
        const kind = methodKind(segment.name);
        if (kind === undefined) {
            if (!RAW_METHODS.has(segment.name))
                continue;
            const raw = rawWrite(segment.call ?? node, index.sourceFile);
            if (raw === undefined)
                continue;
            return raw;
        }
        if (AMBIGUOUS_METHODS.has(segment.name) && !hasDataAccessReceiver(index, chain, position, node))
            continue;
        return { kind, entity: entityFor(index, chain, position) };
    }
    return undefined;
}
function methodKind(name) {
    if (CREATE_METHODS.has(name))
        return "create";
    if (UPDATE_METHODS.has(name))
        return "update";
    if (DELETE_METHODS.has(name))
        return "delete";
    if (ADJUST_METHODS.has(name))
        return "adjust";
    return undefined;
}
function rawWrite(node, sourceFile) {
    const text = literalArgumentText(node, sourceFile);
    const insert = /\binsert\s+into\s+["'`[]?([\w.]+)/iu.exec(text);
    if (insert !== null)
        return { kind: "create", entity: singularize(insert[1] ?? "") };
    const update = /\bupdate\s+["'`[]?([\w.]+)/iu.exec(text);
    if (update !== null)
        return { kind: "update", entity: singularize(update[1] ?? "") };
    const remove = /\bdelete\s+from\s+["'`[]?([\w.]+)/iu.exec(text);
    if (remove !== null)
        return { kind: "delete", entity: singularize(remove[1] ?? "") };
    return undefined;
}
/**
 * Entity resolution, in descending order of structural certainty: an explicit model segment
 * (`prisma.order.create`), a table argument (`knex("orders")`, `db.insert(orders)`), then a
 * receiver that names its model (`orderRepository`, `Order`).
 */
function entityFor(index, chain, position) {
    const previous = chain.segments[position - 1];
    if (previous !== undefined && previous.call === undefined)
        return singularize(previous.name);
    const segment = chain.segments[position];
    const own = tableArgument(segment?.call, index.sourceFile);
    if (own !== undefined)
        return own;
    for (let earlier = position - 1; earlier >= 0; earlier -= 1) {
        const candidate = tableArgument(chain.segments[earlier]?.call, index.sourceFile);
        if (candidate !== undefined)
            return candidate;
    }
    const receiver = chain.segments[position - 1]?.name ?? chain.root;
    const stripped = receiver.replace(/(?:Repository|Repo|Model|Table|Collection|Store|Dao)$/u, "");
    return singularize(stripped.length > 0 ? stripped : receiver);
}
function tableArgument(call, sourceFile) {
    const argument = call?.arguments[0];
    if (argument === undefined)
        return undefined;
    if (ts.isStringLiteralLike(argument))
        return singularize(argument.text);
    if (ts.isIdentifier(argument) && !PASCAL_CASE.test(argument.text))
        return singularize(argument.text);
    void sourceFile;
    return undefined;
}
function hasDataAccessReceiver(index, chain, position, node) {
    const candidates = [chain.root, ...chain.segments.slice(0, position).map((item) => item.name)];
    return candidates.some((candidate) => DATA_ACCESS_ROOT.test(candidate) ||
        DATA_ACCESS_SUFFIX.test(candidate) ||
        PASCAL_CASE.test(candidate) ||
        // Detection, unlike boundary proof, is name-only on purpose: a name bound to a handle
        // anywhere in the file is evidence that the receiver is a data-access object, and missing
        // the write entirely would hide the workflow in both directions.
        declaresHandleNamed(index, candidate) ||
        isWrapperCallbackParameter(node, candidate));
}
/**
 * True when `root` names a parameter of a callback that is itself an argument to a call, i.e. the
 * handle shape a transaction wrapper hands out (`unit(async (handle) => handle.invoice.update())`).
 *
 * Without this, a wrapper whose handle is named unconventionally hides its writes from detection
 * entirely, so an unresolved boundary is reported as nothing at all rather than as NOT_VERIFIED.
 * The parameter must belong to a callback argument, so an ordinary declaration's parameters (a
 * route's `req`/`res`, for instance) never qualify.
 */
function isWrapperCallbackParameter(node, root) {
    let current = node;
    while (!ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current) &&
            ts.isCallExpression(current.parent) &&
            current.parent.arguments.some((argument) => argument === current)) {
            for (const parameter of current.parameters)
                if (ts.isIdentifier(parameter.name) && parameter.name.text === root)
                    return true;
        }
        current = current.parent;
    }
    return false;
}
function resultBinding(node) {
    let current = node;
    while (ts.isAwaitExpression(current.parent) ||
        ts.isParenthesizedExpression(current.parent) ||
        ts.isAsExpression(current.parent) ||
        ts.isNonNullExpression(current.parent))
        current = current.parent;
    const parent = current.parent;
    if (!ts.isVariableDeclaration(parent) || parent.initializer !== current)
        return undefined;
    if (ts.isIdentifier(parent.name))
        return parent.name.text;
    return undefined;
}
/* -------------------------------------------------------------------------- */
/* Atomic boundary resolution                                                  */
/* -------------------------------------------------------------------------- */
function assessCoverage(index, write, chain) {
    const sourceFile = index.sourceFile;
    const handleOption = optionHandle(write.node, sourceFile);
    if (handleInScope(index, chain.root, write.node))
        return {
            state: "PROVEN",
            boundary: `handle:${chain.root}`,
            detail: `the write runs on transaction handle \`${chain.root}\``
        };
    const transacting = transactingArgument(chain);
    if (transacting !== undefined && handleInScope(index, transacting, write.node))
        return {
            state: "PROVEN",
            boundary: `handle:${transacting}`,
            detail: `the write is bound to transaction handle \`${transacting}\` via .transacting()`
        };
    if (handleOption !== undefined && handleInScope(index, handleOption, write.node))
        return {
            state: "PROVEN",
            boundary: `handle:${handleOption}`,
            detail: `the write carries transaction handle \`${handleOption}\``
        };
    const lexical = lexicalBoundary(index, write.node, chain);
    if (lexical !== undefined)
        return lexical;
    if (handleOption !== undefined || transacting !== undefined) {
        const symbol = handleOption ?? transacting ?? "";
        return {
            state: "UNRESOLVED",
            boundary: `unresolved-handle:${symbol}`,
            detail: `the write threads \`${symbol}\` as a transaction handle, but its origin is not a recognized transaction API`
        };
    }
    const raw = rawBoundary(index, write.node, chain);
    if (raw !== undefined)
        return raw;
    if (isParameterReceiver(write.node, chain.root))
        return {
            state: "UNRESOLVED",
            boundary: `parameter:${chain.root}`,
            detail: `the data-access receiver \`${chain.root}\` is supplied by the caller, so the boundary is decided outside this function`
        };
    if (unresolvedHandleInScope(index, chain.root, write.node))
        return {
            state: "UNRESOLVED",
            boundary: `unresolved-origin:${chain.root}`,
            detail: `the receiver \`${chain.root}\` is named as a transaction handle but is produced by a call this analyzer cannot classify, so the boundary is neither proven nor disproven`
        };
    return { state: "NONE", boundary: "", detail: "no transaction encloses the write" };
}
function lexicalBoundary(index, node, chain) {
    let current = node;
    while (!ts.isSourceFile(current)) {
        const parent = current.parent;
        if (ts.isCallExpression(parent) && parent.expression !== current) {
            const classification = classifyTransactionCall(index, parent);
            if (classification === "known" || classification === "delegating") {
                const label = callChain(parent);
                return {
                    state: "PROVEN",
                    boundary: `scope:${parent.getStart(index.sourceFile)}`,
                    detail: `the write runs inside ${label === undefined ? "a transaction scope" : `\`${chainName(label)}\``}`,
                    scopeNode: parent
                };
            }
            if (classification === "unknown" && usesCallbackParameter(index, parent, node, chain))
                return {
                    state: "UNRESOLVED",
                    boundary: `unknown-scope:${parent.getStart(index.sourceFile)}`,
                    detail: `the write runs on a handle supplied by \`${callChain(parent) === undefined ? "an unresolved wrapper" : chainName(callChain(parent))}\`, whose transactional behaviour is not resolvable`
                };
        }
        current = parent;
    }
    return undefined;
}
/**
 * A wrapper is only treated as a transaction candidate when the write actually consumes the handle
 * it hands out. A plain callback helper (retry, logging, mapping) hands out nothing and therefore
 * proves nothing either way.
 */
function usesCallbackParameter(index, call, node, chain) {
    const parameters = new Set();
    for (const argument of call.arguments) {
        if (!isFunctionLike(argument, index.sourceFile))
            continue;
        for (const parameter of argument.parameters)
            if (ts.isIdentifier(parameter.name))
                parameters.add(parameter.name.text);
    }
    if (parameters.has(chain.root))
        return true;
    const option = optionHandle(node, index.sourceFile);
    return option !== undefined && parameters.has(option);
}
/**
 * Classifies a call as a transaction scope. `known` covers vendor APIs and simple local aliases;
 * `delegating` covers a local wrapper that forwards its own callback into a vendor API;
 * `unknown` covers any other callback-taking call whose implementation is not resolvable here.
 */
function classifyTransactionCall(index, node, depth = 0) {
    const chain = callChain(node);
    if (chain === undefined)
        return undefined;
    if (isKnownTransactionChain(chain, index.aliases))
        return "known";
    const takesCallback = node.arguments.some((argument) => isFunctionLike(argument, index.sourceFile));
    if (!takesCallback)
        return undefined;
    if (chain.segments.length !== 1)
        return "unknown";
    const local = index.functions.get(chain.root);
    if (local === undefined)
        return "unknown";
    if (depth >= HELPER_RESOLUTION_DEPTH)
        return "unknown";
    return delegatesToTransaction(index, local, depth + 1) ? "delegating" : "unknown";
}
/** One-level delegation: the wrapper forwards one of its own parameters into a transaction API. */
function delegatesToTransaction(index, declaration, depth) {
    const parameters = new Set(declaration.parameters
        .map((parameter) => (ts.isIdentifier(parameter.name) ? parameter.name.text : undefined))
        .filter((name) => name !== undefined));
    let delegates = false;
    walk(declaration, (node) => {
        if (delegates || !ts.isCallExpression(node))
            return;
        const classification = classifyTransactionCall(index, node, depth);
        if (classification !== "known" && classification !== "delegating")
            return;
        const forwards = node.arguments.some((argument) => {
            if (ts.isIdentifier(argument))
                return parameters.has(argument.text);
            if (!isFunctionLike(argument, index.sourceFile))
                return false;
            let found = false;
            walk(argument, (inner) => {
                if (ts.isIdentifier(inner) && parameters.has(inner.text))
                    found = true;
            });
            return found;
        });
        if (forwards)
            delegates = true;
    });
    return delegates;
}
function isKnownTransactionChain(chain, aliases) {
    const tip = chain.segments.at(-1);
    if (tip === undefined)
        return false;
    // `callChain` records a bare `run(cb)` as root `run` with a single same-named segment, while a
    // member call `prisma.$transaction(cb)` also yields one segment but a distinct root. Only the
    // bare form is an alias candidate; testing segment count alone sent every single-hop member
    // call down the alias path, where a real vendor API could never be recognised.
    const bareCall = chain.segments.length === 1 && chain.segments[0]?.name === chain.root;
    if (bareCall) {
        const alias = aliases.get(chain.root);
        if (alias === undefined)
            return false;
        const method = alias.split(".").at(-1) ?? "";
        return TRANSACTION_METHODS.has(method);
    }
    if (!TRANSACTION_METHODS.has(tip.name))
        return false;
    if (tip.name === "$transaction")
        return true;
    const receivers = [chain.root, ...chain.segments.slice(0, -1).map((item) => item.name)];
    return receivers.some((receiver) => DATA_ACCESS_ROOT.test(receiver) || DATA_ACCESS_SUFFIX.test(receiver));
}
/**
 * A raw `BEGIN` … terminator pair is an atomic boundary for writes positioned between them.
 *
 * Three conditions are required beyond position, because position alone proved boundaries that do
 * not exist. The marker must run on the same receiver as the write, so a `BEGIN` on one connection
 * cannot bound a write on another. It must belong to the same workflow, so a `BEGIN`/`COMMIT` pair
 * in a neighbouring function cannot enclose everything written between them. And no terminator may
 * sit between the `BEGIN` and the write, because a transaction that already committed does not
 * cover what follows it.
 *
 * `ROLLBACK` closes the boundary exactly as `COMMIT` does: a rolled-back transaction still applies
 * all of the writes or none of them, which is the invariant this rule is about.
 */
function rawBoundary(index, node, chain) {
    const start = node.getStart(index.sourceFile);
    const scope = workflowScope(index, node);
    const scoped = index.markers.filter((marker) => marker.root === chain.root && workflowScope(index, marker.node) === scope);
    const begin = scoped.filter((marker) => marker.kind === "begin" && marker.start < start).at(-1);
    if (begin === undefined)
        return undefined;
    const closed = (marker) => marker.kind !== "begin";
    if (scoped.some((marker) => closed(marker) && marker.start > begin.start && marker.start < start))
        return undefined;
    const terminator = scoped.find((marker) => closed(marker) && marker.start > start);
    if (terminator === undefined)
        return undefined;
    return {
        state: "PROVEN",
        boundary: `raw:${begin.start}`,
        detail: `the write is between an explicit BEGIN and ${terminator.kind.toUpperCase()} on \`${chain.root}\``
    };
}
function optionHandle(node, sourceFile) {
    for (const argument of node.arguments) {
        const found = findOptionHandle(argument, sourceFile, 0);
        if (found !== undefined)
            return found;
    }
    return undefined;
}
/**
 * Finds the symbol threaded as a transaction handle in an options object.
 *
 * A handle reached through a property path (`{ transaction: ctx.tx }`) is still deliberately
 * threaded, so its full path is returned rather than ignored. Nothing in this file can resolve
 * `ctx.tx`, and that is the point: naming it produces NOT_VERIFIED instead of the confident "no
 * transaction encloses the write" that ignoring it produced.
 *
 * Row payloads and filters are never descended into, so a column named `session` or `client` cannot
 * masquerade as a handle and downgrade a genuine defect to an evidence gap.
 */
function findOptionHandle(node, sourceFile, depth) {
    if (depth > OBJECT_SCAN_DEPTH || !ts.isObjectLiteralExpression(node))
        return undefined;
    for (const property of node.properties) {
        if (ts.isShorthandPropertyAssignment(property) && HANDLE_OPTION_KEYS.has(property.name.text))
            return property.name.text;
        if (!ts.isPropertyAssignment(property))
            continue;
        const key = property.name.getText(sourceFile).replace(/["']/gu, "");
        if (HANDLE_OPTION_KEYS.has(key)) {
            const named = expressionName(unwrapValue(property.initializer));
            if (named !== undefined)
                return named;
            continue;
        }
        if (PAYLOAD_KEYS.has(key))
            continue;
        const nested = findOptionHandle(property.initializer, sourceFile, depth + 1);
        if (nested !== undefined)
            return nested;
    }
    return undefined;
}
function transactingArgument(chain) {
    for (const segment of chain.segments) {
        if (segment.name !== "transacting" && segment.name !== "session")
            continue;
        const argument = segment.call?.arguments[0];
        if (argument !== undefined && ts.isIdentifier(argument))
            return argument.text;
    }
    return undefined;
}
function isParameterReceiver(node, root) {
    let current = node;
    while (!ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current)) {
            for (const parameter of current.parameters)
                if (ts.isIdentifier(parameter.name) && parameter.name.text === root)
                    return true;
        }
        current = current.parent;
    }
    return false;
}
/* -------------------------------------------------------------------------- */
/* Helper inlining                                                             */
/* -------------------------------------------------------------------------- */
/**
 * Inlines writes performed by locally declared helpers that the workflow calls directly. Depth is
 * bounded to one level; anything deeper is left out rather than guessed at.
 *
 * Inlining is tracked per call site, not per helper body. A shared set of already-visited helper
 * nodes silently dropped every call after the first, so `record(a); record(b)` — two related rows
 * written by two calls to one helper, with no boundary around either — produced no finding at all.
 * Only the workflow's own direct writes are excluded, so a helper that *is* the workflow scope
 * cannot have its writes counted twice.
 */
function helperWrites(index, scope, direct) {
    const inlined = [];
    const directNodes = new Set(direct.map((write) => write.node));
    walk(scope, (node) => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
            return;
        if (workflowScope(index, node) !== scope)
            return;
        const declaration = index.functions.get(node.expression.text);
        if (declaration === undefined || declaration.body === undefined)
            return;
        const parameters = declaration.parameters.map((parameter) => ts.isIdentifier(parameter.name) ? parameter.name.text : undefined);
        const callerCoverage = lexicalBoundary(index, node, {
            root: node.expression.text,
            segments: []
        });
        walk(declaration.body, (inner) => {
            if (!ts.isCallExpression(inner) || directNodes.has(inner))
                return;
            const write = describeWrite(index, inner);
            if (write === undefined)
                return;
            inlined.push(rebindHelperWrite(index, write, node, declaration, parameters, callerCoverage));
        });
    });
    return inlined;
}
/**
 * Rewrites a helper's symbols into caller vocabulary so relatedness can be judged at the call site,
 * and downgrades coverage when a proven caller boundary may not reach the helper's receiver.
 */
function rebindHelperWrite(index, write, callSite, declaration, parameters, callerCoverage) {
    const substitutions = new Map();
    for (const [position, parameter] of parameters.entries()) {
        const argument = callSite.arguments[position];
        if (parameter === undefined || argument === undefined)
            continue;
        substitutions.set(parameter, argument.getText(index.sourceFile).replace(/\s+/gu, ""));
    }
    const symbols = new Set();
    for (const symbol of write.symbols)
        symbols.add(substitute(symbol, substitutions));
    const identifiers = new Map();
    for (const [key, value] of write.identifiers)
        identifiers.set(key, substitute(value, substitutions));
    const helperName = ts.isIdentifier(callSite.expression) ? callSite.expression.text : "helper";
    const receiverIsParameter = declaration.parameters.some((parameter) => ts.isIdentifier(parameter.name) && write.name.startsWith(`${parameter.name.text}.`));
    let coverage = write.coverage;
    if (callerCoverage !== undefined && callerCoverage.state === "PROVEN")
        coverage = receiverIsParameter
            ? callerCoverage
            : {
                state: "UNRESOLVED",
                boundary: `helper:${helperName}`,
                detail: `\`${helperName}\` writes through its own data-access receiver, so the caller's transaction may not enclose it`
            };
    return {
        ...write,
        anchor: callSite,
        symbols,
        identifiers,
        coverage,
        viaHelper: helperName
    };
}
function substitute(value, substitutions) {
    const head = value.split(".")[0] ?? value;
    const replacement = substitutions.get(head);
    if (replacement === undefined)
        return value;
    return `${replacement}${value.slice(head.length)}`;
}
/* -------------------------------------------------------------------------- */
/* Relatedness                                                                 */
/* -------------------------------------------------------------------------- */
/** Connected components over the relatedness relation, so a three-step workflow reports once. */
function relatedGroups(writes) {
    const parent = writes.map((_, position) => position);
    const find = (position) => {
        let current = position;
        while (parent[current] !== current)
            current = parent[current] ?? current;
        return current;
    };
    const relations = new Map();
    for (let left = 0; left < writes.length; left += 1) {
        for (let right = left + 1; right < writes.length; right += 1) {
            const first = writes[left];
            const second = writes[right];
            if (first === undefined || second === undefined)
                continue;
            const relationship = relate(first, second);
            if (relationship === undefined)
                continue;
            relations.set(`${left}:${right}`, relationship);
            const rootLeft = find(left);
            const rootRight = find(right);
            if (rootLeft !== rootRight)
                parent[rootRight] = rootLeft;
        }
    }
    const groups = new Map();
    for (const [position, write] of writes.entries()) {
        if (![...relations.keys()].some((key) => key.split(":").includes(String(position))))
            continue;
        const root = find(position);
        const bucket = groups.get(root);
        if (bucket === undefined)
            groups.set(root, [write]);
        else
            bucket.push(write);
    }
    return [...groups.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, group]) => group)
        .filter((group) => group.length >= 2);
}
/**
 * Structural relatedness. Every rule requires a shared symbol or a shared schema reference; no rule
 * infers a relationship from proximity, ordering, or function naming alone.
 */
function relate(first, second) {
    const dataflow = dataflowRelation(first, second) ?? dataflowRelation(second, first);
    if (dataflow !== undefined)
        return dataflow;
    const foreignKey = foreignKeyRelation(first, second) ?? foreignKeyRelation(second, first);
    if (foreignKey !== undefined)
        return foreignKey;
    const shared = sharedIdentifier(first, second);
    if (shared === undefined)
        return undefined;
    if (first.entity === second.entity)
        return {
            kind: "same-entity",
            description: `both writes address \`${first.entity}\` rows keyed by \`${shared}\``
        };
    const domains = pairedDomains(first, second);
    if (domains !== undefined) {
        const [left, right] = domains;
        return {
            kind: left === right ? `${left}-pair` : "mixed-domain-pair",
            description: left === right
                ? `\`${first.entity}\` and \`${second.entity}\` are ${left} records keyed by the same identifier \`${shared}\``
                : `\`${first.entity}\` (${left}) and \`${second.entity}\` (${right}) are consistency-critical records keyed by the same identifier \`${shared}\``
        };
    }
    if (first.kind === "delete" || second.kind === "delete")
        return {
            kind: "destructive-dependency",
            description: `a destructive write and a dependent write share the entity identifier \`${shared}\``
        };
    return undefined;
}
function dataflowRelation(producer, consumer) {
    const binding = producer.binding;
    if (binding === undefined)
        return undefined;
    const consumed = [...consumer.symbols].some((symbol) => symbol === binding || symbol.startsWith(`${binding}.`));
    if (!consumed)
        return undefined;
    return {
        kind: "dataflow",
        description: `the \`${consumer.entity}\` write consumes \`${binding}\`, produced by the \`${producer.entity}\` write`
    };
}
function foreignKeyRelation(parent, child) {
    if (!child.foreignKeys.has(parent.entity))
        return undefined;
    return {
        kind: "parent-child",
        description: `the \`${child.entity}\` write carries a foreign key to \`${parent.entity}\``
    };
}
/**
 * The identifier two writes share, when that identifier actually ties the two rows together.
 *
 * A value carried only under ownership or tenancy keys is rejected: `userId` appearing on a deleted
 * draft and on a new notification proves that one principal owns both rows, not that the two rows
 * form one invariant. Accepting it made every pair of writes in a per-user request handler look
 * related, which is the loudest false-positive shape this rule can produce.
 */
function sharedIdentifier(first, second) {
    const candidates = [];
    for (const value of first.identifiers.values()) {
        if (![...second.identifiers.values()].includes(value))
            continue;
        if (!tiesRowsTogether(first, second, value))
            continue;
        candidates.push(value);
    }
    return candidates.sort()[0];
}
function tiesRowsTogether(first, second, value) {
    for (const write of [first, second])
        for (const [key, candidate] of write.identifiers)
            if (candidate === value && !SCOPE_ONLY_KEY.test(key))
                return true;
    return false;
}
/**
 * The impact domains of a pair of non-ordinary writes, in argument order.
 *
 * Mismatched domains previously collapsed to `financial`, which put "are financial records" into
 * the evidence of a seat/token pair that contains no financial record at all. The pairing is still
 * reported — both rows are consistency-critical — but each domain is now named as observed.
 */
function pairedDomains(first, second) {
    const left = impactDomain(first.entity);
    const right = impactDomain(second.entity);
    if (left === "ordinary" || right === "ordinary")
        return undefined;
    return [left, right];
}
function impactDomain(entity) {
    if (FINANCIAL_ENTITY.test(entity))
        return "financial";
    if (INVENTORY_ENTITY.test(entity))
        return "inventory";
    if (ACCESS_ENTITY.test(entity))
        return "access-control";
    return "ordinary";
}
/* -------------------------------------------------------------------------- */
/* Issue construction                                                          */
/* -------------------------------------------------------------------------- */
function groupIssues(index, group) {
    const states = new Set(group.map((write) => write.coverage.state));
    const boundaries = new Set(group.map((write) => write.coverage.boundary));
    const allProven = states.size === 1 && states.has("PROVEN");
    if (allProven && boundaries.size === 1)
        return [];
    const anchor = group[0];
    if (anchor === undefined)
        return [];
    const nested = allProven && nestedBoundaries(group);
    const unresolved = states.has("UNRESOLVED") || nested;
    const template = unresolved ? UNRESOLVED_BOUNDARY : MISSING_BOUNDARY;
    const severity = severityFor(group);
    const confidence = confidenceFor(group, unresolved);
    const scope = scopeName(index, anchor.anchor);
    const relationship = describeRelationships(group);
    const locations = group
        .map((write) => `${write.name} (${index.file.path}:${write.line}${write.viaHelper === undefined ? "" : ` via ${write.viaHelper}()`})`)
        .join(", ");
    const boundaryText = nested
        ? "one transaction scope is nested inside the other; whether the inner scope is a savepoint of the outer transaction or an independent one is vendor-specific and not decidable from this file"
        : unresolved
            ? group
                .filter((write) => write.coverage.state === "UNRESOLVED")
                .map((write) => write.coverage.detail)
                .sort()[0]
            : boundaryFailure(group);
    const issue = {
        spec: { ...template, severity, confidence },
        file: index.file,
        node: anchor.anchor,
        start: anchor.anchor.getStart(index.sourceFile),
        end: anchor.anchor.getEnd(),
        source: `related writes ${locations}`,
        sink: `non-atomic write sequence in ${scope}`,
        evidence: `Related writes ${locations} in ${scope}: ${relationship}. Atomic boundary: ${boundaryText ?? "none observed"}. A failure after the first write leaves \`${anchor.entity}\` durable while ${group
            .slice(1)
            .map((write) => `\`${write.entity}\``)
            .join(" and ")} ${group.length > 2 ? "are" : "is"} missing, so the ${dominantDomain(group)} invariant is left half-applied.`
    };
    if (unresolved)
        issue.status = "NOT_VERIFIED";
    return [issue];
}
/**
 * True when every write is inside a proven transaction, but one of those transactions lexically
 * encloses the others.
 *
 * Nesting is not the same defect as two sibling transactions. A vendor may implement an inner
 * `transaction` call as a savepoint of the outer one — in which case the writes *are* atomic — or as
 * an independent connection, in which case they are not. Nothing in a single file distinguishes the
 * two, so the group is reported as unproven rather than as a confident split.
 */
function nestedBoundaries(group) {
    const nodes = group.map((write) => write.coverage.scopeNode);
    if (nodes.some((node) => node === undefined))
        return false;
    const scopes = nodes;
    return scopes.some((candidate) => scopes.every((other) => containsNode(candidate, other)));
}
/** The most impactful domain present in the group, so the evidence never understates the group. */
function dominantDomain(group) {
    const present = new Set(group.map((write) => impactDomain(write.entity)));
    const ranked = ["financial", "access-control", "inventory", "ordinary"];
    return ranked.find((domain) => present.has(domain)) ?? "ordinary";
}
function boundaryFailure(group) {
    const proven = group.filter((write) => write.coverage.state === "PROVEN");
    if (proven.length === 0)
        return "no transaction encloses the related writes";
    if (proven.length === group.length)
        return "the related writes are split across separate transactions, so they still commit independently";
    return "only part of the related writes runs inside a transaction";
}
function describeRelationships(group) {
    const descriptions = new Set();
    for (let left = 0; left < group.length; left += 1) {
        for (let right = left + 1; right < group.length; right += 1) {
            const first = group[left];
            const second = group[right];
            if (first === undefined || second === undefined)
                continue;
            const relationship = relate(first, second);
            if (relationship !== undefined)
                descriptions.add(relationship.description);
        }
    }
    return [...descriptions].sort().join("; ");
}
/**
 * Severity follows demonstrated impact rather than the rule identity: money, entitlements, and
 * destructive writes outrank an ordinary parent/child pair.
 */
function severityFor(group) {
    const domains = new Set(group.map((write) => impactDomain(write.entity)));
    const destructive = group.some((write) => write.kind === "delete");
    const amount = group.some((write) => write.mutatesAmount);
    if (domains.has("financial"))
        return destructive || amount ? "CRITICAL" : "HIGH";
    if (domains.has("access-control"))
        return destructive ? "CRITICAL" : "HIGH";
    if (domains.has("inventory"))
        return "HIGH";
    return destructive || group.length > 2 ? "HIGH" : "MEDIUM";
}
/**
 * Confidence is raised by the strongest relation anywhere in the group, not by the relation between
 * its first two members. A three-step workflow whose dataflow runs between the second and third
 * write is exactly as well evidenced as one whose dataflow runs between the first and second.
 */
function confidenceFor(group, unresolved) {
    if (unresolved)
        return "LOW";
    for (let left = 0; left < group.length; left += 1) {
        for (let right = left + 1; right < group.length; right += 1) {
            const first = group[left];
            const second = group[right];
            if (first === undefined || second === undefined)
                continue;
            const kind = relate(first, second)?.kind;
            if (kind === "dataflow" || kind === "parent-child")
                return "HIGH";
        }
    }
    return "MEDIUM";
}
function scopeName(index, node) {
    let current = node;
    while (!ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current)) {
            const named = functionName(current, index.sourceFile);
            if (named !== undefined)
                return named;
        }
        current = current.parent;
    }
    return index.file.path;
}
function functionName(node, sourceFile) {
    if (node.name !== undefined)
        return node.name.getText(sourceFile);
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
        return parent.name.text;
    if (ts.isCallExpression(parent)) {
        const route = parent.arguments[0];
        if (route !== undefined && ts.isStringLiteralLike(route))
            return `handler for ${route.text}`;
    }
    return undefined;
}
/* -------------------------------------------------------------------------- */
/* AST utilities                                                               */
/* -------------------------------------------------------------------------- */
function walk(node, callback) {
    callback(node);
    node.forEachChild((child) => walk(child, callback));
}
function isFunctionLike(node, sourceFile) {
    void sourceFile;
    return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}
/** Flattens a fluent call into root plus ordered segments, so `knex("t").insert()` stays legible. */
function callChain(node) {
    const segments = [];
    let current = node;
    let root;
    for (;;) {
        if (ts.isCallExpression(current)) {
            const target = current.expression;
            if (ts.isPropertyAccessExpression(target)) {
                segments.push({ name: target.name.text, call: current });
                current = target.expression;
                continue;
            }
            if (ts.isIdentifier(target)) {
                segments.push({ name: target.text, call: current });
                root = target.text;
                break;
            }
            return undefined;
        }
        if (ts.isPropertyAccessExpression(current)) {
            segments.push({ name: current.name.text });
            current = current.expression;
            continue;
        }
        if (ts.isIdentifier(current)) {
            root = current.text;
            break;
        }
        if (current.kind === ts.SyntaxKind.ThisKeyword) {
            root = "this";
            break;
        }
        return undefined;
    }
    // Every `break` above assigns `root`; the only other exit returns early.
    segments.reverse();
    return { root, segments };
}
function chainName(chain) {
    const names = chain.segments.map((segment) => segment.name);
    return names[0] === chain.root ? names.join(".") : [chain.root, ...names].join(".");
}
function expressionName(node) {
    if (ts.isIdentifier(node))
        return node.text;
    if (ts.isPropertyAccessExpression(node)) {
        const receiver = expressionName(node.expression);
        return receiver === undefined ? undefined : `${receiver}.${node.name.text}`;
    }
    return undefined;
}
function literalArgumentText(node, sourceFile) {
    return node.arguments
        .filter((argument) => ts.isStringLiteralLike(argument) || ts.isTemplateExpression(argument))
        .map((argument) => argument.getText(sourceFile).replace(/["'`]/gu, ""))
        .join(" ");
}
function collectSymbols(node, sourceFile, into) {
    walk(node, (child) => {
        if (ts.isPropertyAccessExpression(child)) {
            const name = expressionName(child);
            if (name !== undefined)
                into.add(name);
            return;
        }
        if (ts.isIdentifier(child) && !ts.isPropertyAssignment(child.parent))
            into.add(child.text);
        void sourceFile;
    });
}
/**
 * Harvests identifier-shaped properties from write payloads and filters. The property name yields
 * the foreign-key entity; the value expression yields the shared-identifier evidence.
 */
function collectIdentifierProperties(node, sourceFile, identifiers, foreignKeys, depth) {
    if (depth > OBJECT_SCAN_DEPTH || !ts.isObjectLiteralExpression(node))
        return;
    for (const property of node.properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
            register(property.name.text, property.name.text, identifiers, foreignKeys);
            continue;
        }
        if (!ts.isPropertyAssignment(property))
            continue;
        const key = property.name.getText(sourceFile).replace(/["']/gu, "");
        const value = property.initializer;
        if (ts.isObjectLiteralExpression(value)) {
            collectIdentifierProperties(value, sourceFile, identifiers, foreignKeys, depth + 1);
            continue;
        }
        if (isTrivialLiteral(value))
            continue;
        register(key, value.getText(sourceFile).replace(/\s+/gu, ""), identifiers, foreignKeys);
    }
}
function register(key, value, identifiers, foreignKeys) {
    if (!IDENTIFIER_PROPERTY.test(key))
        return;
    identifiers.set(key, value);
    const base = key.replace(/(?:Id|_id|Uuid|Key|Ref)$/u, "");
    if (base.length > 0 && base !== key)
        foreignKeys.add(singularize(base));
}
function isTrivialLiteral(node) {
    return (node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isIdentifier(node) && node.text === "undefined"));
}
function singularize(value) {
    const lower = value.toLowerCase().replace(/[^a-z0-9]/gu, "");
    if (lower.endsWith("ies"))
        return `${lower.slice(0, -3)}y`;
    if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("ches"))
        return lower.slice(0, -2);
    if (lower.endsWith("s") && !lower.endsWith("ss"))
        return lower.slice(0, -1);
    return lower;
}
