import ts from "typescript";
import { resolveImport } from "./scope.js";

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
/** Maximum expression wrappers (parentheses, casts, non-null assertions) peeled from a value. */
const MAX_UNWRAP_STEPS = 8;

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
  classifyMiddlewareList: (
    middleware: readonly ts.Expression[],
    file: GuardSourceFile
  ) => MiddlewareClassification;
};

/**
 * A request-terminating branch condition that inspects the caller's identity, role, permissions,
 * ownership, or tenancy. This is read from the *resolved body*, not from the middleware's name.
 */
const SUBJECT_PREDICATE =
  /\b(?:user|session|role|roles|permission|permissions|scope|scopes|claim|claims|isAdmin|admin|owner|ownerId|tenant|tenantId|orgId|organizationId|ability|policy|authoriz\w*|authenticat\w*|allowed|access)\b/iu;

/** A branch body that answers or aborts the request rather than continuing the chain. */
const REQUEST_TERMINATION =
  /\b(?:res|response|reply|ctx|context)\s*\.\s*(?:status|sendStatus|send|json|end|redirect|abort)\b|\bNextResponse\b|\bthrow\b|\breturn\s+(?:false|null|undefined)\s*;?\s*$/mu;

/** Delegation to the next handler; a branch that delegates has not denied anything. */
const DELEGATION = /\bnext\s*\(/u;

/** Explicit authorization status rejection. Preserved verbatim from the in-file analyzer. */
const STATUS_CODE = /\b(?:401|403)\b/u;
const STATUS_MEMBER = /\b(?:status|sendStatus|statusCode|code)\b/u;
const THROWN_AUTHORIZATION_ERROR = /\bForbidden|Unauthorized\b/u;
const THROW_KEYWORD = /\bthrow\b/u;

/** Mutable, per-argument budget. Shared across the whole resolution of one middleware argument. */
type Budget = {
  files: Set<string>;
  visited: Set<string>;
  trace: string[];
};

type Lookup =
  | { kind: "function"; fn: ts.FunctionLikeDeclaration; file: GuardSourceFile }
  | { kind: "unresolved"; reason: string };

export function createGuardResolver(files: readonly GuardSourceFile[]): GuardResolver {
  const byPath = new Map<string, GuardSourceFile>();
  // First declaration wins so a duplicated path cannot make the corpus order-dependent.
  for (const file of files) if (!byPath.has(file.path)) byPath.set(file.path, file);
  const paths = new Set(byPath.keys());

  /** Opens the module a relative specifier names, subject to the hop and module budgets. */
  const moduleFor = (
    file: GuardSourceFile,
    request: string,
    depth: number,
    budget: Budget
  ): GuardSourceFile | undefined => {
    if (!request.startsWith(".")) return undefined;
    if (depth >= MAX_GUARD_HOPS) return undefined;
    // `scope.ts` owns module resolution. NodeNext TypeScript spells a sibling module `./x.js`
    // while the file on disk is `./x.ts`, so the compiled specifier is retried without its
    // extension; that is a second query against the same resolver, not a second resolver.
    const target =
      resolveImport(file.path, request, paths) ??
      resolveImport(file.path, request.replace(/\.[cm]?jsx?$/u, ""), paths);
    if (target === undefined) return undefined;
    const record = byPath.get(target);
    if (record === undefined) return undefined;
    if (!budget.files.has(target) && budget.files.size >= MAX_GUARD_FILES) return undefined;
    budget.files.add(target);
    return record;
  };

  /** Resolves a module-scope name in `file` to a function body, following imports. */
  const resolveBinding = (
    file: GuardSourceFile,
    name: string,
    depth: number,
    budget: Budget
  ): Lookup => {
    const key = `${file.path}#local:${name}`;
    if (budget.visited.has(key))
      return unresolved(`import cycle at ${file.path} while resolving ${name}`);
    budget.visited.add(key);

    const imported = importedBinding(file.sourceFile, name);
    if (imported !== undefined) {
      const target = moduleFor(file, imported.request, depth, budget);
      if (target === undefined) {
        budget.trace.push(`${file.path}: ${name} <- ${imported.request} (not in analyzed sources)`);
        return unresolved(
          `${name} is imported from ${imported.request}, which bounded analysis cannot open`
        );
      }
      budget.trace.push(`${file.path}: ${name} <- ${target.path}#${imported.exportName}`);
      return resolveExport(target, imported.exportName, depth + 1, budget);
    }

    const declaration = localDeclaration(file.sourceFile, name);
    if (declaration === undefined) return unresolved(`${name} has no declaration in ${file.path}`);
    if (ts.isFunctionDeclaration(declaration)) return { kind: "function", fn: declaration, file };
    const initializer = declaration.initializer;
    if (initializer === undefined)
      return unresolved(`${name} in ${file.path} has no resolvable initializer`);
    return resolveValue(initializer, file, depth, budget);
  };

  /** Resolves one exported name of a module, following re-exports and barrels. */
  const resolveExport = (
    file: GuardSourceFile,
    exportName: string,
    depth: number,
    budget: Budget
  ): Lookup => {
    const key = `${file.path}#${exportName}`;
    if (budget.visited.has(key))
      return unresolved(`export cycle at ${file.path} while resolving ${exportName}`);
    budget.visited.add(key);

    const barrels: string[] = [];
    for (const statement of file.sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && exportedAs(statement, exportName))
        return { kind: "function", fn: statement, file };
      if (
        ts.isVariableStatement(statement) &&
        hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName) continue;
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
            if (element.name.text !== exportName) continue;
            const local = (element.propertyName ?? element.name).text;
            if (specifier === undefined || !ts.isStringLiteralLike(specifier))
              return resolveBinding(file, local, depth, budget);
            const target = moduleFor(file, specifier.text, depth, budget);
            if (target === undefined)
              return unresolved(
                `${exportName} is re-exported from ${specifier.text}, which bounded analysis cannot open`
              );
            budget.trace.push(`${file.path}: re-export ${exportName} <- ${target.path}#${local}`);
            return resolveExport(target, local, depth + 1, budget);
          }
        }
        if (
          clause === undefined &&
          specifier !== undefined &&
          ts.isStringLiteralLike(specifier) &&
          barrels.length < MAX_BARREL_BRANCHES
        )
          barrels.push(specifier.text);
      }
      const commonJs = commonJsExport(statement, exportName);
      if (commonJs !== undefined) return resolveValue(commonJs, file, depth, budget);
    }

    // Barrels are searched last and in source order so the outcome does not depend on which
    // branch happens to declare the name first.
    for (const request of barrels) {
      const target = moduleFor(file, request, depth, budget);
      if (target === undefined) continue;
      budget.trace.push(`${file.path}: barrel ${request} -> ${target.path}#${exportName}`);
      const found = resolveExport(target, exportName, depth + 1, budget);
      if (found.kind === "function") return found;
    }
    return unresolved(`${file.path} does not export a resolvable ${exportName}`);
  };

  /** Resolves an arbitrary value expression to the function it denotes. */
  const resolveValue = (
    expression: ts.Expression,
    file: GuardSourceFile,
    depth: number,
    budget: Budget
  ): Lookup => {
    const value = unwrap(expression);
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
      return { kind: "function", fn: value, file };
    if (ts.isIdentifier(value)) return resolveBinding(file, value.text, depth, budget);
    if (ts.isPropertyAccessExpression(value)) return resolveMember(value, file, depth, budget);
    if (ts.isCallExpression(value))
      return unresolved(
        `the value is produced by calling ${text(value.expression, file)}, which bounded analysis does not evaluate`
      );
    return unresolved(`the value ${text(value, file)} is not a resolvable function reference`);
  };

  /** Resolves `namespace.member`, where the namespace is a namespace import or a CJS require. */
  const resolveMember = (
    value: ts.PropertyAccessExpression,
    file: GuardSourceFile,
    depth: number,
    budget: Budget
  ): Lookup => {
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
  const middlewareFromFactory = (
    lookup: Extract<Lookup, { kind: "function" }>,
    budget: Budget,
    factoryDepth: number
  ): Lookup => {
    if (factoryDepth >= MAX_FACTORY_DEPTH)
      return unresolved("the factory nesting limit was reached before a middleware body was read");
    const returned = returnedExpression(lookup.fn);
    if (returned === undefined)
      return unresolved(`${lookup.file.path} factory returns no inspectable value`);
    return resolveValue(returned, lookup.file, 0, budget);
  };

  const classifyMiddleware = (argument: ts.Expression, file: GuardSourceFile): GuardResolution => {
    const budget: Budget = { files: new Set([file.path]), visited: new Set(), trace: [] };
    return classify(argument, file, budget, 0);
  };

  const classify = (
    argument: ts.Expression,
    file: GuardSourceFile,
    budget: Budget,
    factoryDepth: number
  ): GuardResolution => {
    const value = unwrap(argument);

    if (ts.isArrayLiteralExpression(value)) {
      // Each element gets its own visited set — one element must not make the next look cyclic —
      // while the opened-module budget stays shared so the array cannot exceed the file cap.
      const parts = value.elements.map((element) =>
        classify(element, file, { ...budget, visited: new Set(), trace: [] }, factoryDepth)
      );
      const proven = parts.find((part) => part.verdict === "proven");
      if (proven !== undefined) return proven;
      const open = parts.find((part) => part.verdict === "unresolved");
      if (open !== undefined) return open;
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
      const lookup = resolveValue(value.expression, file, 0, budget);
      if (lookup.kind === "unresolved") return open(lookup.reason, budget);
      // A factory that rejects inside its own body — including an inline returned handler — is
      // already proven, matching the in-file behaviour.
      if (functionDeniesAuthorization(lookup.fn, lookup.file))
        return {
          verdict: "proven",
          trace: budget.trace.slice(),
          reason: `${text(value.expression, file)} resolves to a body that denies the request`
        };
      const produced = middlewareFromFactory(lookup, budget, factoryDepth);
      if (produced.kind === "unresolved") return open(produced.reason, budget);
      return decide(produced.fn, produced.file, budget, text(value.expression, file));
    }

    if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) {
      const lookup = resolveValue(value, file, 0, budget);
      if (lookup.kind === "unresolved") return open(lookup.reason, budget);
      return decide(lookup.fn, lookup.file, budget, text(value, file));
    }

    return open(`${text(value, file)} is not a resolvable middleware reference`, budget);
  };

  const decide = (
    fn: ts.FunctionLikeDeclaration,
    owner: GuardSourceFile,
    budget: Budget,
    label: string
  ): GuardResolution =>
    functionDeniesAuthorization(fn, owner)
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

  const classifyMiddlewareList = (
    middleware: readonly ts.Expression[],
    file: GuardSourceFile
  ): MiddlewareClassification => {
    if (middleware.length === 0) return { verdict: "absent", evidence: "" };
    const parts = middleware.map((argument) => classifyMiddleware(argument, file));
    const proven = parts.find((part) => part.verdict === "proven");
    if (proven !== undefined) return { verdict: "proven", evidence: describe(proven) };
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
export function functionDeniesAuthorization(
  fn: ts.FunctionLikeDeclaration,
  file: GuardSourceFile
): boolean {
  const body = fn.body;
  if (body === undefined) return false;
  const bodyText = body.getText(file.sourceFile);
  if (STATUS_CODE.test(bodyText) && STATUS_MEMBER.test(bodyText)) return true;
  if (THROWN_AUTHORIZATION_ERROR.test(bodyText) && THROW_KEYWORD.test(bodyText)) return true;
  return hasSubjectGatedExit(body, file.sourceFile);
}

/** True when some `if` tests an authorization-relevant subject and its branch ends the request. */
function hasSubjectGatedExit(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  let found = false;
  const walk = (node: ts.Node): void => {
    if (found) return;
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(sourceFile);
      const branch = node.thenStatement.getText(sourceFile);
      if (
        SUBJECT_PREDICATE.test(condition) &&
        REQUEST_TERMINATION.test(branch) &&
        !DELEGATION.test(branch)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(body, walk);
  return found;
}

/** The first `return` expression of a function, ignoring returns inside nested functions. */
function returnedExpression(fn: ts.FunctionLikeDeclaration): ts.Expression | undefined {
  const body = fn.body;
  if (body === undefined) return undefined;
  if (!ts.isBlock(body)) return body;
  let result: ts.Expression | undefined;
  const walk = (node: ts.Node): void => {
    if (result !== undefined) return;
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) {
      result = node.expression;
      return;
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(body, walk);
  return result;
}

/** The module specifier and exported name an imported local binding refers to. */
function importedBinding(
  sourceFile: ts.SourceFile,
  name: string
): { request: string; exportName: string } | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      if (!ts.isStringLiteralLike(specifier)) continue;
      const clause = statement.importClause;
      if (clause === undefined) continue;
      if (clause.name !== undefined && clause.name.text === name)
        return { request: specifier.text, exportName: "default" };
      const bindings = clause.namedBindings;
      if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements)
        if (element.name.text === name)
          return {
            request: specifier.text,
            exportName: (element.propertyName ?? element.name).text
          };
    }
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        const request = requireRequest(declaration.initializer);
        if (request === undefined) continue;
        if (!ts.isObjectBindingPattern(declaration.name)) continue;
        for (const element of declaration.name.elements) {
          if (!ts.isIdentifier(element.name) || element.name.text !== name) continue;
          const property = element.propertyName;
          const exportName =
            property !== undefined && ts.isIdentifier(property) ? property.text : name;
          return { request, exportName };
        }
      }
  }
  return undefined;
}

/** The module specifier a namespace binding refers to (`import * as ns` or `const ns = require`). */
function namespaceRequest(sourceFile: ts.SourceFile, name: string): string | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      const bindings = statement.importClause?.namedBindings;
      if (
        ts.isStringLiteralLike(specifier) &&
        bindings !== undefined &&
        ts.isNamespaceImport(bindings) &&
        bindings.name.text === name
      )
        return specifier.text;
    }
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
        const request = requireRequest(declaration.initializer);
        if (request !== undefined) return request;
      }
  }
  return undefined;
}

/** The specifier of a `require("...")` call, when the initializer is exactly that. */
function requireRequest(initializer: ts.Expression | undefined): string | undefined {
  if (initializer === undefined) return undefined;
  const value = unwrap(initializer);
  if (!ts.isCallExpression(value)) return undefined;
  if (!ts.isIdentifier(value.expression) || value.expression.text !== "require") return undefined;
  const argument = value.arguments[0];
  if (argument === undefined || !ts.isStringLiteralLike(argument)) return undefined;
  return argument.text;
}

/** The value assigned by a CommonJS export of `exportName`, when the statement is one. */
function commonJsExport(statement: ts.Statement, exportName: string): ts.Expression | undefined {
  if (!ts.isExpressionStatement(statement)) return undefined;
  const assignment = statement.expression;
  if (
    !ts.isBinaryExpression(assignment) ||
    assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken
  )
    return undefined;
  const target = assignment.left;
  if (!ts.isPropertyAccessExpression(target) || !ts.isIdentifier(target.expression))
    return undefined;
  if (target.expression.text === "exports" && target.name.text === exportName)
    return assignment.right;
  if (target.expression.text !== "module" || target.name.text !== "exports") return undefined;
  const value = unwrap(assignment.right);
  if (!ts.isObjectLiteralExpression(value))
    return exportName === "default" ? assignment.right : undefined;
  for (const property of value.properties) {
    if (property.name === undefined || !ts.isIdentifier(property.name)) continue;
    if (property.name.text !== exportName) continue;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property)) return property.name;
  }
  return undefined;
}

/** The declaration of a module-scope or nested name, mirroring the in-file analyzer's tolerance. */
function localDeclaration(
  sourceFile: ts.SourceFile,
  name: string
): ts.FunctionDeclaration | ts.VariableDeclaration | undefined {
  let found: ts.FunctionDeclaration | ts.VariableDeclaration | undefined;
  const walk = (node: ts.Node): void => {
    if (found !== undefined) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(sourceFile, walk);
  return found;
}

function exportedAs(declaration: ts.FunctionDeclaration, exportName: string): boolean {
  if (!hasModifier(declaration, ts.SyntaxKind.ExportKeyword)) return false;
  if (hasModifier(declaration, ts.SyntaxKind.DefaultKeyword)) return exportName === "default";
  return declaration.name?.text === exportName;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

/** Peels parentheses, casts, and non-null assertions off a value expression. */
function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  for (let step = 0; step < MAX_UNWRAP_STEPS; step += 1) {
    if (ts.isParenthesizedExpression(current)) current = current.expression;
    else if (ts.isAsExpression(current)) current = current.expression;
    else if (ts.isSatisfiesExpression(current)) current = current.expression;
    else if (ts.isNonNullExpression(current)) current = current.expression;
    else if (ts.isTypeAssertionExpression(current)) current = current.expression;
    else return current;
  }
  return current;
}

function unresolved(reason: string): Lookup {
  return { kind: "unresolved", reason };
}

function open(reason: string, budget: Budget): GuardResolution {
  return { verdict: "unresolved", trace: budget.trace.slice(), reason };
}

function describe(resolution: GuardResolution | undefined): string {
  if (resolution === undefined) return "";
  const trace =
    resolution.trace.length === 0 ? "" : ` Resolution path: ${resolution.trace.join(" -> ")}.`;
  return ` Cross-file guard resolution: ${resolution.reason}.${trace}`;
}

function text(node: ts.Node, file: GuardSourceFile): string {
  return node.getText(file.sourceFile);
}
