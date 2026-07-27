import ts from "typescript";
import type { Confidence, Severity, Status } from "./types.js";
import { lineNumber } from "./utils.js";

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

type RuleTemplate = Omit<TransactionIssueSpec, "severity" | "confidence">;

const MISSING_BOUNDARY: RuleTemplate = {
  id: "FF-DATA-TRANSACTION-001",
  analyzer: "js-ts-database",
  section: "database",
  title: "Related writes are not enclosed by a proven atomic boundary",
  impact:
    "A failure between the writes commits one half of the invariant and leaves the record set inconsistent.",
  recommendation:
    "Execute the related writes inside one database transaction, or make the second write idempotently recoverable and prove that recovery with a test.",
  safeFix: false,
  absenceProvesResolution: false,
  verification: [
    "Re-run the js-ts-database analyzer",
    "Force a failure between the writes and assert that neither is durable"
  ],
  standards: ["OWASP ASVS 5.0", "CWE-662"]
};

const UNRESOLVED_BOUNDARY: RuleTemplate = {
  id: "FF-DATA-TRANSACTION-NOT-VERIFIED-001",
  analyzer: "js-ts-database",
  section: "database",
  title: "Atomic boundary around related writes could not be established",
  impact:
    "The writes share a consistency invariant, but the enclosing abstraction is not a recognized transaction API, so atomicity is neither proven nor disproven.",
  recommendation:
    "Document or adapt the transaction wrapper so its boundary is resolvable, then rerun the analyzer.",
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

const DATA_ACCESS_ROOT =
  /^(?:client|collection|conn|connection|database|datasource|db|drizzle|em|entitymanager|firestore|knex|manager|model|models|mongo|mongoose|orm|pool|prisma|queryrunner|repo|repository|sequelize|session|sql|store|supabase|trx|tx|txn)$/iu;
const DATA_ACCESS_SUFFIX = /(?:client|collection|dao|db|model|repo|repository|store|table)$/iu;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;

const IDENTIFIER_PROPERTY = /^(?:id|uuid|_id|[a-z0-9]+(?:Id|_id|Uuid|Key|Ref))$/u;
const AMOUNT_PROPERTY = /(?:amount|balance|credits?|debits?|price|quantity|qty|stock|total)/iu;

const FINANCIAL_ENTITY =
  /(?:account|balance|billing|charge|checkout|credit|debit|fee|invoice|ledger|order|payment|payout|purchase|receipt|refund|settlement|subscription|transfer|wallet)/u;
const INVENTORY_ENTITY =
  /(?:allocation|capacity|inventory|item|reservation|seat|sku|slot|stock|warehouse)/u;
const ACCESS_ENTITY =
  /(?:acl|apikey|entitlement|grant|licen[cs]e|membership|permission|policy|role|token)/u;

type ImpactDomain = "financial" | "inventory" | "access-control" | "ordinary";
type WriteKind = "create" | "update" | "delete" | "adjust";
type CoverageState = "PROVEN" | "UNRESOLVED" | "NONE";

type ChainSegment = { name: string; call?: ts.CallExpression };
type CallChain = { root: string; segments: ChainSegment[] };

type Coverage = {
  state: CoverageState;
  /** Identity of the boundary, so two writes in different transactions do not look atomic. */
  boundary: string;
  detail: string;
};

type WriteOperation = {
  node: ts.CallExpression;
  /** Anchor used for evidence and issue placement; the call site when a helper supplied the write. */
  anchor: ts.CallExpression;
  name: string;
  kind: WriteKind;
  entity: string;
  line: number;
  /** Identifier the awaited result is bound to, if any. Drives the dataflow relationship. */
  binding?: string;
  /** Every identifier and property path referenced by the write arguments. */
  symbols: Set<string>;
  /** Identifier-shaped property assignments: property name to normalized value expression. */
  identifiers: Map<string, string>;
  /** Foreign-key property names reduced to their singular entity base. */
  foreignKeys: Set<string>;
  mutatesAmount: boolean;
  coverage: Coverage;
  /** Present when the write was inlined from a local helper called by the workflow scope. */
  viaHelper?: string;
};

type TransactionMarker = { kind: "begin" | "commit" | "rollback"; start: number };

type FileIndex = {
  file: TransactionSourceRecord;
  sourceFile: ts.SourceFile;
  /** Locally declared functions, used for one-level wrapper and helper resolution. */
  functions: Map<string, ts.FunctionLikeDeclaration>;
  /** `const run = prisma.$transaction` style aliases, mapped to the aliased call name. */
  aliases: Map<string, string>;
  /** Variables bound to a live transaction handle. */
  handles: Set<string>;
  markers: TransactionMarker[];
};

type Relationship = { kind: string; description: string };

/**
 * Entry point. Returns issues that are structurally assignable to the analyzer `Issue` type, in
 * stable source order.
 */
export function analyzeTransactionFile(file: TransactionSourceRecord): TransactionIssue[] {
  const index = buildFileIndex(file);
  const scopes = collectWorkflowScopes(index);
  const issues: TransactionIssue[] = [];
  for (const [scope, writes] of scopes) {
    const resolved = [...writes, ...helperWrites(index, scope, writes)].sort(
      (left, right) =>
        left.anchor.getStart(index.sourceFile) - right.anchor.getStart(index.sourceFile)
    );
    if (resolved.length < 2) continue;
    for (const group of relatedGroups(resolved)) issues.push(...groupIssues(index, group));
  }
  return issues.sort(
    (left, right) => left.start - right.start || left.spec.id.localeCompare(right.spec.id)
  );
}

/* -------------------------------------------------------------------------- */
/* File index                                                                  */
/* -------------------------------------------------------------------------- */

function buildFileIndex(file: TransactionSourceRecord): FileIndex {
  const sourceFile = file.sourceFile;
  const functions = new Map<string, ts.FunctionLikeDeclaration>();
  const aliases = new Map<string, string>();
  const deferredHandles = new Map<string, string>();
  const handles = new Set<string>();
  const started = new Set<string>();
  const markers: TransactionMarker[] = [];
  walk(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined)
      functions.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const initializer = node.initializer;
      if (initializer === undefined) return;
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        functions.set(name, initializer);
      const value = unwrapValue(initializer);
      if (ts.isPropertyAccessExpression(value) || ts.isIdentifier(value)) {
        const alias = expressionName(value);
        if (alias !== undefined) aliases.set(name, alias);
      }
      if (ts.isCallExpression(value)) {
        const bound = boundHandleKind(value, sourceFile, aliases);
        if (bound === "immediate") handles.add(name);
        else if (bound === "deferred") deferredHandles.set(name, name);
      }
    }
    if (ts.isCallExpression(node)) {
      const chain = callChain(node);
      if (chain !== undefined) {
        const tip = chain.segments.at(-1);
        if (tip?.name === "startTransaction") started.add(chain.root);
      }
      const marker = transactionMarker(node, sourceFile);
      if (marker !== undefined) markers.push({ kind: marker, start: node.getStart(sourceFile) });
    }
  });
  for (const [name, root] of deferredHandles) if (started.has(root)) handles.add(name);
  markers.sort((left, right) => left.start - right.start);
  return { file, sourceFile, functions, aliases, handles, markers };
}

/** `await`, parentheses, and `as` casts never change which value is being bound. */
function unwrapValue(node: ts.Expression): ts.Expression {
  let current = node;
  for (;;) {
    if (ts.isAwaitExpression(current)) current = current.expression;
    else if (ts.isParenthesizedExpression(current)) current = current.expression;
    else if (ts.isAsExpression(current) || ts.isNonNullExpression(current))
      current = current.expression;
    else return current;
  }
}

/**
 * Distinguishes an unmanaged transaction handle (`await knex.transaction()`) from a deferred one
 * (`dataSource.createQueryRunner()`), which only becomes transactional once `startTransaction` runs.
 */
function boundHandleKind(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  aliases: ReadonlyMap<string, string>
): "immediate" | "deferred" | undefined {
  const chain = callChain(node);
  const tip = chain?.segments.at(-1);
  if (chain === undefined || tip === undefined) return undefined;
  if (DEFERRED_HANDLE_METHODS.has(tip.name)) return "deferred";
  if (!isKnownTransactionChain(chain, aliases)) return undefined;
  const takesCallback = node.arguments.some((argument) => isFunctionLike(argument, sourceFile));
  return takesCallback ? undefined : "immediate";
}

function transactionMarker(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile
): TransactionMarker["kind"] | undefined {
  const chain = callChain(node);
  const tip = chain?.segments.at(-1);
  if (chain === undefined || tip === undefined || !RAW_METHODS.has(tip.name)) return undefined;
  const text = literalArgumentText(node, sourceFile);
  if (/^\s*(?:begin|start\s+transaction)\b/iu.test(text)) return "begin";
  if (/^\s*commit\b/iu.test(text)) return "commit";
  if (/^\s*rollback\b/iu.test(text)) return "rollback";
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
function collectWorkflowScopes(index: FileIndex): Map<ts.Node, WriteOperation[]> {
  const scopes = new Map<ts.Node, WriteOperation[]>();
  walk(index.sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const write = describeWrite(index, node);
    if (write === undefined) return;
    const scope = workflowScope(index, node);
    const existing = scopes.get(scope);
    if (existing === undefined) scopes.set(scope, [write]);
    else existing.push(write);
  });
  return scopes;
}

function workflowScope(index: FileIndex, node: ts.Node): ts.Node {
  let current: ts.Node = node;
  while (!ts.isSourceFile(current)) {
    const parent: ts.Node = current.parent;
    if (ts.isFunctionLike(current) && !isTransactionCallback(index, current)) return current;
    current = parent;
  }
  return index.sourceFile;
}

function isTransactionCallback(index: FileIndex, node: ts.Node): boolean {
  const parent: ts.Node = node.parent;
  if (!ts.isCallExpression(parent)) return false;
  if (!parent.arguments.some((argument) => argument === node)) return false;
  return classifyTransactionCall(index, parent) !== undefined;
}

function describeWrite(index: FileIndex, node: ts.CallExpression): WriteOperation | undefined {
  if (isInnerChainLink(node)) return undefined;
  const chain = callChain(node);
  if (chain === undefined) return undefined;
  const write = writeSegment(index, chain, node);
  if (write === undefined) return undefined;
  const sourceFile = index.sourceFile;
  const symbols = new Set<string>();
  const identifiers = new Map<string, string>();
  const foreignKeys = new Set<string>();
  let mutatesAmount = write.kind === "adjust";
  for (const argument of node.arguments) {
    collectSymbols(argument, sourceFile, symbols);
    collectIdentifierProperties(argument, sourceFile, identifiers, foreignKeys, 0);
    if (AMOUNT_PROPERTY.test(argument.getText(sourceFile))) mutatesAmount = true;
  }
  const binding = resultBinding(node);
  const operation: WriteOperation = {
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
  if (binding !== undefined) operation.binding = binding;
  operation.coverage = assessCoverage(index, operation, chain);
  return operation;
}

/** True when this call is only a link of a longer fluent chain; the outermost call owns the write. */
function isInnerChainLink(node: ts.CallExpression): boolean {
  const parent: ts.Node = node.parent;
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === node &&
    ts.isCallExpression(parent.parent) &&
    parent.parent.expression === parent
  );
}

function writeSegment(
  index: FileIndex,
  chain: CallChain,
  node: ts.CallExpression
): { kind: WriteKind; entity: string } | undefined {
  for (let position = chain.segments.length - 1; position >= 0; position -= 1) {
    const segment = chain.segments[position];
    if (segment === undefined) continue;
    const kind = methodKind(segment.name);
    if (kind === undefined) {
      if (!RAW_METHODS.has(segment.name)) continue;
      const raw = rawWrite(segment.call ?? node, index.sourceFile);
      if (raw === undefined) continue;
      return raw;
    }
    if (AMBIGUOUS_METHODS.has(segment.name) && !hasDataAccessReceiver(index, chain, position, node))
      continue;
    return { kind, entity: entityFor(index, chain, position) };
  }
  return undefined;
}

function methodKind(name: string): WriteKind | undefined {
  if (CREATE_METHODS.has(name)) return "create";
  if (UPDATE_METHODS.has(name)) return "update";
  if (DELETE_METHODS.has(name)) return "delete";
  if (ADJUST_METHODS.has(name)) return "adjust";
  return undefined;
}

function rawWrite(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile
): { kind: WriteKind; entity: string } | undefined {
  const text = literalArgumentText(node, sourceFile);
  const insert = /\binsert\s+into\s+["'`[]?([\w.]+)/iu.exec(text);
  if (insert !== null) return { kind: "create", entity: singularize(insert[1] ?? "") };
  const update = /\bupdate\s+["'`[]?([\w.]+)/iu.exec(text);
  if (update !== null) return { kind: "update", entity: singularize(update[1] ?? "") };
  const remove = /\bdelete\s+from\s+["'`[]?([\w.]+)/iu.exec(text);
  if (remove !== null) return { kind: "delete", entity: singularize(remove[1] ?? "") };
  return undefined;
}

/**
 * Entity resolution, in descending order of structural certainty: an explicit model segment
 * (`prisma.order.create`), a table argument (`knex("orders")`, `db.insert(orders)`), then a
 * receiver that names its model (`orderRepository`, `Order`).
 */
function entityFor(index: FileIndex, chain: CallChain, position: number): string {
  const previous = chain.segments[position - 1];
  if (previous !== undefined && previous.call === undefined) return singularize(previous.name);
  const segment = chain.segments[position];
  const own = tableArgument(segment?.call, index.sourceFile);
  if (own !== undefined) return own;
  for (let earlier = position - 1; earlier >= 0; earlier -= 1) {
    const candidate = tableArgument(chain.segments[earlier]?.call, index.sourceFile);
    if (candidate !== undefined) return candidate;
  }
  const receiver = chain.segments[position - 1]?.name ?? chain.root;
  const stripped = receiver.replace(/(?:Repository|Repo|Model|Table|Collection|Store|Dao)$/u, "");
  return singularize(stripped.length > 0 ? stripped : receiver);
}

function tableArgument(
  call: ts.CallExpression | undefined,
  sourceFile: ts.SourceFile
): string | undefined {
  const argument = call?.arguments[0];
  if (argument === undefined) return undefined;
  if (ts.isStringLiteralLike(argument)) return singularize(argument.text);
  if (ts.isIdentifier(argument) && !PASCAL_CASE.test(argument.text))
    return singularize(argument.text);
  void sourceFile;
  return undefined;
}

function hasDataAccessReceiver(
  index: FileIndex,
  chain: CallChain,
  position: number,
  node: ts.CallExpression
): boolean {
  const candidates = [chain.root, ...chain.segments.slice(0, position).map((item) => item.name)];
  return candidates.some(
    (candidate) =>
      DATA_ACCESS_ROOT.test(candidate) ||
      DATA_ACCESS_SUFFIX.test(candidate) ||
      PASCAL_CASE.test(candidate) ||
      index.handles.has(candidate) ||
      isWrapperCallbackParameter(node, candidate)
  );
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
function isWrapperCallbackParameter(node: ts.Node, root: string): boolean {
  let current: ts.Node = node;
  while (!ts.isSourceFile(current)) {
    if (
      ts.isFunctionLike(current) &&
      ts.isCallExpression(current.parent) &&
      current.parent.arguments.some((argument) => argument === current)
    ) {
      for (const parameter of current.parameters)
        if (ts.isIdentifier(parameter.name) && parameter.name.text === root) return true;
    }
    current = current.parent;
  }
  return false;
}

function resultBinding(node: ts.CallExpression): string | undefined {
  let current: ts.Node = node;
  while (
    ts.isAwaitExpression(current.parent) ||
    ts.isParenthesizedExpression(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isNonNullExpression(current.parent)
  )
    current = current.parent;
  const parent: ts.Node = current.parent;
  if (!ts.isVariableDeclaration(parent) || parent.initializer !== current) return undefined;
  if (ts.isIdentifier(parent.name)) return parent.name.text;
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Atomic boundary resolution                                                  */
/* -------------------------------------------------------------------------- */

function assessCoverage(index: FileIndex, write: WriteOperation, chain: CallChain): Coverage {
  const sourceFile = index.sourceFile;
  const handleOption = optionHandle(write.node, sourceFile);
  if (index.handles.has(chain.root))
    return {
      state: "PROVEN",
      boundary: `handle:${chain.root}`,
      detail: `the write runs on transaction handle \`${chain.root}\``
    };
  const transacting = transactingArgument(chain);
  if (transacting !== undefined && index.handles.has(transacting))
    return {
      state: "PROVEN",
      boundary: `handle:${transacting}`,
      detail: `the write is bound to transaction handle \`${transacting}\` via .transacting()`
    };
  if (handleOption !== undefined && index.handles.has(handleOption))
    return {
      state: "PROVEN",
      boundary: `handle:${handleOption}`,
      detail: `the write carries transaction handle \`${handleOption}\``
    };
  const lexical = lexicalBoundary(index, write.node, chain);
  if (lexical !== undefined) return lexical;
  if (handleOption !== undefined || transacting !== undefined) {
    const symbol = handleOption ?? transacting ?? "";
    return {
      state: "UNRESOLVED",
      boundary: `unresolved-handle:${symbol}`,
      detail: `the write threads \`${symbol}\` as a transaction handle, but its origin is not a recognized transaction API`
    };
  }
  const raw = rawBoundary(index, write.node);
  if (raw !== undefined) return raw;
  if (isParameterReceiver(index, write.node, chain.root))
    return {
      state: "UNRESOLVED",
      boundary: `parameter:${chain.root}`,
      detail: `the data-access receiver \`${chain.root}\` is supplied by the caller, so the boundary is decided outside this function`
    };
  return { state: "NONE", boundary: "", detail: "no transaction encloses the write" };
}

function lexicalBoundary(
  index: FileIndex,
  node: ts.CallExpression,
  chain: CallChain
): Coverage | undefined {
  let current: ts.Node = node;
  while (!ts.isSourceFile(current)) {
    const parent: ts.Node = current.parent;
    if (ts.isCallExpression(parent) && parent.expression !== current) {
      const classification = classifyTransactionCall(index, parent);
      if (classification === "known" || classification === "delegating") {
        const label = callChain(parent);
        return {
          state: "PROVEN",
          boundary: `scope:${parent.getStart(index.sourceFile)}`,
          detail: `the write runs inside ${label === undefined ? "a transaction scope" : `\`${chainName(label)}\``}`
        };
      }
      if (classification === "unknown" && usesCallbackParameter(index, parent, node, chain))
        return {
          state: "UNRESOLVED",
          boundary: `unknown-scope:${parent.getStart(index.sourceFile)}`,
          detail: `the write runs on a handle supplied by \`${callChain(parent) === undefined ? "an unresolved wrapper" : chainName(callChain(parent) as CallChain)}\`, whose transactional behaviour is not resolvable`
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
function usesCallbackParameter(
  index: FileIndex,
  call: ts.CallExpression,
  node: ts.CallExpression,
  chain: CallChain
): boolean {
  const parameters = new Set<string>();
  for (const argument of call.arguments) {
    if (!isFunctionLike(argument, index.sourceFile)) continue;
    for (const parameter of argument.parameters)
      if (ts.isIdentifier(parameter.name)) parameters.add(parameter.name.text);
  }
  if (parameters.has(chain.root)) return true;
  const option = optionHandle(node, index.sourceFile);
  return option !== undefined && parameters.has(option);
}

/**
 * Classifies a call as a transaction scope. `known` covers vendor APIs and simple local aliases;
 * `delegating` covers a local wrapper that forwards its own callback into a vendor API;
 * `unknown` covers any other callback-taking call whose implementation is not resolvable here.
 */
function classifyTransactionCall(
  index: FileIndex,
  node: ts.CallExpression,
  depth = 0
): "known" | "delegating" | "unknown" | undefined {
  const chain = callChain(node);
  if (chain === undefined) return undefined;
  if (isKnownTransactionChain(chain, index.aliases)) return "known";
  const takesCallback = node.arguments.some((argument) =>
    isFunctionLike(argument, index.sourceFile)
  );
  if (!takesCallback) return undefined;
  if (chain.segments.length !== 1) return "unknown";
  const local = index.functions.get(chain.root);
  if (local === undefined) return "unknown";
  if (depth >= HELPER_RESOLUTION_DEPTH) return "unknown";
  return delegatesToTransaction(index, local, depth + 1) ? "delegating" : "unknown";
}

/** One-level delegation: the wrapper forwards one of its own parameters into a transaction API. */
function delegatesToTransaction(
  index: FileIndex,
  declaration: ts.FunctionLikeDeclaration,
  depth: number
): boolean {
  const parameters = new Set(
    declaration.parameters
      .map((parameter) => (ts.isIdentifier(parameter.name) ? parameter.name.text : undefined))
      .filter((name): name is string => name !== undefined)
  );
  let delegates = false;
  walk(declaration, (node) => {
    if (delegates || !ts.isCallExpression(node)) return;
    const classification = classifyTransactionCall(index, node, depth);
    if (classification !== "known" && classification !== "delegating") return;
    const forwards = node.arguments.some((argument) => {
      if (ts.isIdentifier(argument)) return parameters.has(argument.text);
      if (!isFunctionLike(argument, index.sourceFile)) return false;
      let found = false;
      walk(argument, (inner) => {
        if (ts.isIdentifier(inner) && parameters.has(inner.text)) found = true;
      });
      return found;
    });
    if (forwards) delegates = true;
  });
  return delegates;
}

function isKnownTransactionChain(chain: CallChain, aliases: ReadonlyMap<string, string>): boolean {
  const tip = chain.segments.at(-1);
  if (tip === undefined) return false;
  // `callChain` records a bare `run(cb)` as root `run` with a single same-named segment, while a
  // member call `prisma.$transaction(cb)` also yields one segment but a distinct root. Only the
  // bare form is an alias candidate; testing segment count alone sent every single-hop member
  // call down the alias path, where a real vendor API could never be recognised.
  const bareCall = chain.segments.length === 1 && chain.segments[0]?.name === chain.root;
  if (bareCall) {
    const alias = aliases.get(chain.root);
    if (alias === undefined) return false;
    const method = alias.split(".").at(-1) ?? "";
    return TRANSACTION_METHODS.has(method);
  }
  if (!TRANSACTION_METHODS.has(tip.name)) return false;
  if (tip.name === "$transaction") return true;
  const receivers = [chain.root, ...chain.segments.slice(0, -1).map((item) => item.name)];
  return receivers.some(
    (receiver) => DATA_ACCESS_ROOT.test(receiver) || DATA_ACCESS_SUFFIX.test(receiver)
  );
}

/** A `BEGIN` … `COMMIT` pair in raw SQL is an atomic boundary for writes positioned between them. */
function rawBoundary(index: FileIndex, node: ts.CallExpression): Coverage | undefined {
  const start = node.getStart(index.sourceFile);
  const begin = index.markers
    .filter((marker) => marker.kind === "begin" && marker.start < start)
    .at(-1);
  if (begin === undefined) return undefined;
  const commit = index.markers.find((marker) => marker.kind === "commit" && marker.start > start);
  if (commit === undefined) return undefined;
  return {
    state: "PROVEN",
    boundary: `raw:${begin.start}`,
    detail: `the write is between an explicit BEGIN and COMMIT`
  };
}

function optionHandle(node: ts.CallExpression, sourceFile: ts.SourceFile): string | undefined {
  for (const argument of node.arguments) {
    const found = findOptionHandle(argument, sourceFile, 0);
    if (found !== undefined) return found;
  }
  return undefined;
}

function findOptionHandle(
  node: ts.Expression,
  sourceFile: ts.SourceFile,
  depth: number
): string | undefined {
  if (depth > OBJECT_SCAN_DEPTH || !ts.isObjectLiteralExpression(node)) return undefined;
  for (const property of node.properties) {
    if (ts.isShorthandPropertyAssignment(property) && HANDLE_OPTION_KEYS.has(property.name.text))
      return property.name.text;
    if (!ts.isPropertyAssignment(property)) continue;
    const key = property.name.getText(sourceFile).replace(/["']/gu, "");
    if (HANDLE_OPTION_KEYS.has(key) && ts.isIdentifier(property.initializer))
      return property.initializer.text;
    const nested = findOptionHandle(property.initializer, sourceFile, depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function transactingArgument(chain: CallChain): string | undefined {
  for (const segment of chain.segments) {
    if (segment.name !== "transacting" && segment.name !== "session") continue;
    const argument = segment.call?.arguments[0];
    if (argument !== undefined && ts.isIdentifier(argument)) return argument.text;
  }
  return undefined;
}

function isParameterReceiver(index: FileIndex, node: ts.Node, root: string): boolean {
  let current: ts.Node = node;
  while (!ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) {
      for (const parameter of current.parameters)
        if (ts.isIdentifier(parameter.name) && parameter.name.text === root) return true;
    }
    current = current.parent;
  }
  void index;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Helper inlining                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Inlines writes performed by locally declared helpers that the workflow calls directly. Depth is
 * bounded to one level; anything deeper is left out rather than guessed at.
 */
function helperWrites(
  index: FileIndex,
  scope: ts.Node,
  direct: readonly WriteOperation[]
): WriteOperation[] {
  const inlined: WriteOperation[] = [];
  const seen = new Set<ts.Node>(direct.map((write) => write.node));
  walk(scope, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
    if (workflowScope(index, node) !== scope) return;
    const declaration = index.functions.get(node.expression.text);
    if (declaration === undefined || declaration.body === undefined) return;
    const parameters = declaration.parameters.map((parameter) =>
      ts.isIdentifier(parameter.name) ? parameter.name.text : undefined
    );
    const callerCoverage = lexicalBoundary(index, node, {
      root: node.expression.text,
      segments: []
    });
    walk(declaration.body, (inner) => {
      if (!ts.isCallExpression(inner) || seen.has(inner)) return;
      const write = describeWrite(index, inner);
      if (write === undefined) return;
      seen.add(inner);
      inlined.push(rebindHelperWrite(index, write, node, declaration, parameters, callerCoverage));
    });
  });
  return inlined;
}

/**
 * Rewrites a helper's symbols into caller vocabulary so relatedness can be judged at the call site,
 * and downgrades coverage when a proven caller boundary may not reach the helper's receiver.
 */
function rebindHelperWrite(
  index: FileIndex,
  write: WriteOperation,
  callSite: ts.CallExpression,
  declaration: ts.FunctionLikeDeclaration,
  parameters: readonly (string | undefined)[],
  callerCoverage: Coverage | undefined
): WriteOperation {
  const substitutions = new Map<string, string>();
  for (const [position, parameter] of parameters.entries()) {
    const argument = callSite.arguments[position];
    if (parameter === undefined || argument === undefined) continue;
    substitutions.set(parameter, argument.getText(index.sourceFile).replace(/\s+/gu, ""));
  }
  const symbols = new Set<string>();
  for (const symbol of write.symbols) symbols.add(substitute(symbol, substitutions));
  const identifiers = new Map<string, string>();
  for (const [key, value] of write.identifiers)
    identifiers.set(key, substitute(value, substitutions));
  const helperName = ts.isIdentifier(callSite.expression) ? callSite.expression.text : "helper";
  const receiverIsParameter = declaration.parameters.some(
    (parameter) =>
      ts.isIdentifier(parameter.name) && write.name.startsWith(`${parameter.name.text}.`)
  );
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

function substitute(value: string, substitutions: ReadonlyMap<string, string>): string {
  const head = value.split(".")[0] ?? value;
  const replacement = substitutions.get(head);
  if (replacement === undefined) return value;
  return `${replacement}${value.slice(head.length)}`;
}

/* -------------------------------------------------------------------------- */
/* Relatedness                                                                 */
/* -------------------------------------------------------------------------- */

/** Connected components over the relatedness relation, so a three-step workflow reports once. */
function relatedGroups(writes: readonly WriteOperation[]): WriteOperation[][] {
  const parent = writes.map((_, position) => position);
  const find = (position: number): number => {
    let current = position;
    while (parent[current] !== current) current = parent[current] ?? current;
    return current;
  };
  const relations = new Map<string, Relationship>();
  for (let left = 0; left < writes.length; left += 1) {
    for (let right = left + 1; right < writes.length; right += 1) {
      const first = writes[left];
      const second = writes[right];
      if (first === undefined || second === undefined) continue;
      const relationship = relate(first, second);
      if (relationship === undefined) continue;
      relations.set(`${left}:${right}`, relationship);
      const rootLeft = find(left);
      const rootRight = find(right);
      if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
    }
  }
  const groups = new Map<number, WriteOperation[]>();
  for (const [position, write] of writes.entries()) {
    if (![...relations.keys()].some((key) => key.split(":").includes(String(position)))) continue;
    const root = find(position);
    const bucket = groups.get(root);
    if (bucket === undefined) groups.set(root, [write]);
    else bucket.push(write);
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
function relate(first: WriteOperation, second: WriteOperation): Relationship | undefined {
  const dataflow = dataflowRelation(first, second) ?? dataflowRelation(second, first);
  if (dataflow !== undefined) return dataflow;
  const foreignKey = foreignKeyRelation(first, second) ?? foreignKeyRelation(second, first);
  if (foreignKey !== undefined) return foreignKey;
  const shared = sharedIdentifier(first, second);
  if (shared === undefined) return undefined;
  if (first.entity === second.entity)
    return {
      kind: "same-entity",
      description: `both writes address \`${first.entity}\` rows keyed by \`${shared}\``
    };
  const domain = pairedDomain(first, second);
  if (domain !== undefined)
    return {
      kind: `${domain}-pair`,
      description: `\`${first.entity}\` and \`${second.entity}\` are ${domain} records keyed by the same identifier \`${shared}\``
    };
  if (first.kind === "delete" || second.kind === "delete")
    return {
      kind: "destructive-dependency",
      description: `a destructive write and a dependent write share the entity identifier \`${shared}\``
    };
  return undefined;
}

function dataflowRelation(
  producer: WriteOperation,
  consumer: WriteOperation
): Relationship | undefined {
  const binding = producer.binding;
  if (binding === undefined) return undefined;
  const consumed = [...consumer.symbols].some(
    (symbol) => symbol === binding || symbol.startsWith(`${binding}.`)
  );
  if (!consumed) return undefined;
  return {
    kind: "dataflow",
    description: `the \`${consumer.entity}\` write consumes \`${binding}\`, produced by the \`${producer.entity}\` write`
  };
}

function foreignKeyRelation(
  parent: WriteOperation,
  child: WriteOperation
): Relationship | undefined {
  if (!child.foreignKeys.has(parent.entity)) return undefined;
  return {
    kind: "parent-child",
    description: `the \`${child.entity}\` write carries a foreign key to \`${parent.entity}\``
  };
}

function sharedIdentifier(first: WriteOperation, second: WriteOperation): string | undefined {
  const candidates: string[] = [];
  for (const value of first.identifiers.values())
    if ([...second.identifiers.values()].includes(value)) candidates.push(value);
  return candidates.sort()[0];
}

function pairedDomain(first: WriteOperation, second: WriteOperation): ImpactDomain | undefined {
  const left = impactDomain(first.entity);
  const right = impactDomain(second.entity);
  if (left === "ordinary" || right === "ordinary") return undefined;
  return left === right ? left : "financial";
}

function impactDomain(entity: string): ImpactDomain {
  if (FINANCIAL_ENTITY.test(entity)) return "financial";
  if (INVENTORY_ENTITY.test(entity)) return "inventory";
  if (ACCESS_ENTITY.test(entity)) return "access-control";
  return "ordinary";
}

/* -------------------------------------------------------------------------- */
/* Issue construction                                                          */
/* -------------------------------------------------------------------------- */

function groupIssues(index: FileIndex, group: readonly WriteOperation[]): TransactionIssue[] {
  const states = new Set(group.map((write) => write.coverage.state));
  const boundaries = new Set(group.map((write) => write.coverage.boundary));
  if (states.size === 1 && states.has("PROVEN") && boundaries.size === 1) return [];
  const anchor = group[0];
  if (anchor === undefined) return [];
  const unresolved = states.has("UNRESOLVED");
  const template = unresolved ? UNRESOLVED_BOUNDARY : MISSING_BOUNDARY;
  const severity = severityFor(group);
  const confidence = confidenceFor(group, unresolved);
  const scope = scopeName(index, anchor.anchor);
  const relationship = describeRelationships(group);
  const locations = group
    .map(
      (write) =>
        `${write.name} (${index.file.path}:${write.line}${write.viaHelper === undefined ? "" : ` via ${write.viaHelper}()`})`
    )
    .join(", ");
  const boundaryText = unresolved
    ? group
        .filter((write) => write.coverage.state === "UNRESOLVED")
        .map((write) => write.coverage.detail)
        .sort()[0]
    : boundaryFailure(group);
  const issue: TransactionIssue = {
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
      .join(
        " and "
      )} ${group.length > 2 ? "are" : "is"} missing, so the ${impactDomain(anchor.entity)} invariant is left half-applied.`
  };
  if (unresolved) issue.status = "NOT_VERIFIED";
  return [issue];
}

function boundaryFailure(group: readonly WriteOperation[]): string {
  const proven = group.filter((write) => write.coverage.state === "PROVEN");
  if (proven.length === 0) return "no transaction encloses the related writes";
  if (proven.length === group.length)
    return "the related writes are split across separate transactions, so they still commit independently";
  return "only part of the related writes runs inside a transaction";
}

function describeRelationships(group: readonly WriteOperation[]): string {
  const descriptions = new Set<string>();
  for (let left = 0; left < group.length; left += 1) {
    for (let right = left + 1; right < group.length; right += 1) {
      const first = group[left];
      const second = group[right];
      if (first === undefined || second === undefined) continue;
      const relationship = relate(first, second);
      if (relationship !== undefined) descriptions.add(relationship.description);
    }
  }
  return [...descriptions].sort().join("; ");
}

/**
 * Severity follows demonstrated impact rather than the rule identity: money, entitlements, and
 * destructive writes outrank an ordinary parent/child pair.
 */
function severityFor(group: readonly WriteOperation[]): Severity {
  const domains = new Set(group.map((write) => impactDomain(write.entity)));
  const destructive = group.some((write) => write.kind === "delete");
  const amount = group.some((write) => write.mutatesAmount);
  if (domains.has("financial")) return destructive || amount ? "CRITICAL" : "HIGH";
  if (domains.has("access-control")) return destructive ? "CRITICAL" : "HIGH";
  if (domains.has("inventory")) return "HIGH";
  return destructive || group.length > 2 ? "HIGH" : "MEDIUM";
}

function confidenceFor(group: readonly WriteOperation[], unresolved: boolean): Confidence {
  if (unresolved) return "LOW";
  const first = group[0];
  const second = group[1];
  if (first === undefined || second === undefined) return "MEDIUM";
  const relationship = relate(first, second);
  return relationship?.kind === "dataflow" || relationship?.kind === "parent-child"
    ? "HIGH"
    : "MEDIUM";
}

function scopeName(index: FileIndex, node: ts.Node): string {
  let current: ts.Node = node;
  while (!ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) {
      const named = functionName(current, index.sourceFile);
      if (named !== undefined) return named;
    }
    current = current.parent;
  }
  return index.file.path;
}

function functionName(
  node: ts.SignatureDeclaration,
  sourceFile: ts.SourceFile
): string | undefined {
  if (node.name !== undefined) return node.name.getText(sourceFile);
  const parent: ts.Node = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isCallExpression(parent)) {
    const route = parent.arguments[0];
    if (route !== undefined && ts.isStringLiteralLike(route)) return `handler for ${route.text}`;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* AST utilities                                                               */
/* -------------------------------------------------------------------------- */

function walk(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node);
  node.forEachChild((child) => walk(child, callback));
}

function isFunctionLike(
  node: ts.Expression,
  sourceFile: ts.SourceFile
): node is ts.ArrowFunction | ts.FunctionExpression {
  void sourceFile;
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

/** Flattens a fluent call into root plus ordered segments, so `knex("t").insert()` stays legible. */
function callChain(node: ts.CallExpression): CallChain | undefined {
  const segments: ChainSegment[] = [];
  let current: ts.Node = node;
  let root: string | undefined;
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

function chainName(chain: CallChain): string {
  const names = chain.segments.map((segment) => segment.name);
  return names[0] === chain.root ? names.join(".") : [chain.root, ...names].join(".");
}

function expressionName(node: ts.Expression): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const receiver = expressionName(node.expression);
    return receiver === undefined ? undefined : `${receiver}.${node.name.text}`;
  }
  return undefined;
}

function literalArgumentText(node: ts.CallExpression, sourceFile: ts.SourceFile): string {
  return node.arguments
    .filter((argument) => ts.isStringLiteralLike(argument) || ts.isTemplateExpression(argument))
    .map((argument) => argument.getText(sourceFile).replace(/["'`]/gu, ""))
    .join(" ");
}

function collectSymbols(node: ts.Node, sourceFile: ts.SourceFile, into: Set<string>): void {
  walk(node, (child) => {
    if (ts.isPropertyAccessExpression(child)) {
      const name = expressionName(child);
      if (name !== undefined) into.add(name);
      return;
    }
    if (ts.isIdentifier(child) && !ts.isPropertyAssignment(child.parent)) into.add(child.text);
    void sourceFile;
  });
}

/**
 * Harvests identifier-shaped properties from write payloads and filters. The property name yields
 * the foreign-key entity; the value expression yields the shared-identifier evidence.
 */
function collectIdentifierProperties(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  identifiers: Map<string, string>,
  foreignKeys: Set<string>,
  depth: number
): void {
  if (depth > OBJECT_SCAN_DEPTH || !ts.isObjectLiteralExpression(node)) return;
  for (const property of node.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      register(property.name.text, property.name.text, identifiers, foreignKeys);
      continue;
    }
    if (!ts.isPropertyAssignment(property)) continue;
    const key = property.name.getText(sourceFile).replace(/["']/gu, "");
    const value = property.initializer;
    if (ts.isObjectLiteralExpression(value)) {
      collectIdentifierProperties(value, sourceFile, identifiers, foreignKeys, depth + 1);
      continue;
    }
    if (isTrivialLiteral(value)) continue;
    register(key, value.getText(sourceFile).replace(/\s+/gu, ""), identifiers, foreignKeys);
  }
}

function register(
  key: string,
  value: string,
  identifiers: Map<string, string>,
  foreignKeys: Set<string>
): void {
  if (!IDENTIFIER_PROPERTY.test(key)) return;
  identifiers.set(key, value);
  const base = key.replace(/(?:Id|_id|Uuid|Key|Ref)$/u, "");
  if (base.length > 0 && base !== key) foreignKeys.add(singularize(base));
}

function isTrivialLiteral(node: ts.Expression): boolean {
  return (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) && node.text === "undefined")
  );
}

function singularize(value: string): string {
  const lower = value.toLowerCase().replace(/[^a-z0-9]/gu, "");
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("ches"))
    return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}
