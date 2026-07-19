import ts from "typescript";

/**
 * Bounded intra-file taint analysis for JavaScript and TypeScript.
 *
 * Scope and limits — this is deliberately NOT whole-program sound:
 *  - Analysis is per file. Cross-file flows are not resolved.
 *  - Propagation covers local aliases, reassignment, destructuring, template literals, string
 *    concatenation, and same-file function-parameter summaries.
 *  - Shadowing is approximated: a symbol name is tracked per file, not per lexical scope.
 *  - Fixpoint iteration is capped, so deeply chained propagation may be missed.
 *
 * Anything the engine cannot resolve is reported as unresolved by the caller, never as safe.
 */

const MAX_ITERATIONS = 6;

/** Direct request-controlled roots. */
const REQUEST_ROOT =
  /^(?:req|request|ctx\.request|event|context\.request)\.(?:body|params|query|headers|file|files|cookies)\b/u;

export type TaintOrigin = {
  /** Human-readable source expression, e.g. `req.params.id`. */
  source: string;
  /** Ordered propagation steps from source to the current symbol. */
  steps: string[];
};

export type TaintModel = {
  /** Resolves whether an expression carries request-controlled data. */
  resolve: (node: ts.Expression) => TaintOrigin | undefined;
  /** True when a sanitizer or validator was applied to this specific symbol. */
  isSanitized: (name: string) => boolean;
  /** Symbols proven tainted, for evidence rendering. */
  tainted: ReadonlyMap<string, TaintOrigin>;
};

/** Validator and sanitizer calls that bind to a specific value. */
const SANITIZER_CALL =
  /\b(?:safeParse|parseAsync|parse|validateSync|validate|sanitize|escape|encodeURIComponent|coerce|assertIs|z|yup|joi|ajv)\b/u;

export function buildTaintModel(sourceFile: ts.SourceFile): TaintModel {
  const tainted = new Map<string, TaintOrigin>();
  const sanitized = new Set<string>();
  const parameterTaint = new Map<string, Set<number>>();

  // Pass 1: collect same-file call sites that pass request data into a declared function, so a
  // parameter can be treated as tainted inside that function body.
  collectParameterTaint(sourceFile, parameterTaint);

  // Fixpoint: repeat until no new symbol becomes tainted, bounded by MAX_ITERATIONS.
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const before = tainted.size;
    walk(sourceFile, (node) => {
      collectDeclarations(node, sourceFile, tainted, sanitized);
      collectAssignments(node, sourceFile, tainted);
      collectTaintedParameters(node, sourceFile, tainted, parameterTaint);
    });
    if (tainted.size === before) break;
  }

  const resolve = (node: ts.Expression): TaintOrigin | undefined =>
    resolveExpression(node, sourceFile, tainted);

  return {
    resolve,
    isSanitized: (name) => sanitized.has(name),
    tainted
  };
}

/**
 * Resolves an expression to a taint origin. Handles direct request access, tracked identifiers,
 * property access on tracked objects, template literals, and string concatenation.
 */
function resolveExpression(
  node: ts.Expression,
  sourceFile: ts.SourceFile,
  tainted: Map<string, TaintOrigin>
): TaintOrigin | undefined {
  const text = node.getText(sourceFile);
  if (REQUEST_ROOT.test(text)) return { source: directSource(text), steps: [] };

  if (ts.isIdentifier(node)) return tainted.get(node.text);

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const root = rootIdentifier(node);
    if (root !== undefined) {
      const origin = tainted.get(root);
      if (origin !== undefined)
        return { source: origin.source, steps: [...origin.steps, `property access ${text}`] };
    }
  }

  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const origin = resolveExpression(span.expression, sourceFile, tainted);
      if (origin !== undefined)
        return {
          source: origin.source,
          steps: [...origin.steps, `interpolated into template literal`]
        };
    }
    return undefined;
  }

  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    for (const side of [node.left, node.right]) {
      const origin = resolveExpression(side, sourceFile, tainted);
      if (origin !== undefined)
        return { source: origin.source, steps: [...origin.steps, "string concatenation"] };
    }
    return undefined;
  }

  if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
    return resolveExpression(node.expression, sourceFile, tainted);

  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        const origin = resolveExpression(property.initializer, sourceFile, tainted);
        if (origin !== undefined)
          return {
            source: origin.source,
            steps: [...origin.steps, `object property ${property.name.getText(sourceFile)}`]
          };
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        const origin = tainted.get(property.name.text);
        if (origin !== undefined)
          return {
            source: origin.source,
            steps: [...origin.steps, `object shorthand ${property.name.text}`]
          };
      }
    }
  }
  return undefined;
}

/** `const id = req.params.id`, `const { target } = req.query`, and sanitizer binding. */
function collectDeclarations(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  tainted: Map<string, TaintOrigin>,
  sanitized: Set<string>
): void {
  if (!ts.isVariableDeclaration(node) || node.initializer === undefined) return;
  const initializer = node.initializer;
  const initializerText = initializer.getText(sourceFile);

  // A sanitizer bound to this declaration cleans only the symbol it produces.
  const initializerOrigin = resolveExpression(initializer, sourceFile, tainted);
  const sanitizerApplied =
    ts.isCallExpression(initializer) &&
    SANITIZER_CALL.test(callTarget(initializer, sourceFile)) &&
    initializer.arguments.some(
      (argument) => resolveExpression(argument, sourceFile, tainted) !== undefined
    );

  if (ts.isIdentifier(node.name)) {
    if (sanitizerApplied) {
      sanitized.add(node.name.text);
      return;
    }
    if (initializerOrigin !== undefined)
      record(tainted, node.name.text, {
        source: initializerOrigin.source,
        steps: [...initializerOrigin.steps, `assigned to ${node.name.text}`]
      });
    return;
  }

  // Destructuring: `const { target } = req.query` / `const [first] = req.body.items`
  if (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) {
    if (initializerOrigin === undefined && !REQUEST_ROOT.test(initializerText)) return;
    const origin = initializerOrigin ?? { source: directSource(initializerText), steps: [] };
    for (const element of node.name.elements) {
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) continue;
      if (sanitizerApplied) {
        sanitized.add(element.name.text);
        continue;
      }
      record(tainted, element.name.text, {
        source: origin.source,
        steps: [...origin.steps, `destructured into ${element.name.text}`]
      });
    }
  }
}

/** `let command; command = req.body.command;` */
function collectAssignments(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  tainted: Map<string, TaintOrigin>
): void {
  if (
    !ts.isBinaryExpression(node) ||
    node.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
    !ts.isIdentifier(node.left)
  )
    return;
  const origin = resolveExpression(node.right, sourceFile, tainted);
  if (origin !== undefined)
    record(tainted, node.left.text, {
      source: origin.source,
      steps: [...origin.steps, `reassigned to ${node.left.text}`]
    });
}

/**
 * Same-file function-parameter summary: when `loadUser(req.params.id)` appears anywhere in the
 * file, the corresponding parameter of `loadUser` is treated as request-controlled.
 */
function collectParameterTaint(
  sourceFile: ts.SourceFile,
  parameterTaint: Map<string, Set<number>>
): void {
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
    const callee = node.expression.text;
    node.arguments.forEach((argument, index) => {
      if (!REQUEST_ROOT.test(argument.getText(sourceFile))) return;
      const positions = parameterTaint.get(callee) ?? new Set<number>();
      positions.add(index);
      parameterTaint.set(callee, positions);
    });
  });
}

function collectTaintedParameters(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  tainted: Map<string, TaintOrigin>,
  parameterTaint: Map<string, Set<number>>
): void {
  const name = functionName(node, sourceFile);
  if (name === undefined) return;
  const positions = parameterTaint.get(name);
  if (positions === undefined) return;
  const parameters = (node as ts.SignatureDeclaration).parameters ?? [];
  parameters.forEach((parameter, index) => {
    if (!positions.has(index) || !ts.isIdentifier(parameter.name)) return;
    record(tainted, parameter.name.text, {
      source: "request-controlled argument",
      steps: [`passed as argument ${index} to ${name}`, `bound to parameter ${parameter.name.text}`]
    });
  });
}

function functionName(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) return node.name.text;
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  )
    return node.name.text;
  void sourceFile;
  return undefined;
}

function record(tainted: Map<string, TaintOrigin>, name: string, origin: TaintOrigin): void {
  // Keep the shortest known path so evidence stays readable and iteration converges.
  const current = tainted.get(name);
  if (current === undefined || origin.steps.length < current.steps.length)
    tainted.set(name, { source: origin.source, steps: origin.steps.slice(0, 8) });
}

function rootIdentifier(node: ts.Expression): string | undefined {
  let current: ts.Expression = node;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
    current = current.expression;
  return ts.isIdentifier(current) ? current.text : undefined;
}

function callTarget(node: ts.CallExpression, sourceFile: ts.SourceFile): string {
  return node.expression.getText(sourceFile);
}

function directSource(text: string): string {
  return (
    /(?:req|request|ctx\.request|event|context\.request)\.(?:body|params|query|headers|file|files|cookies)(?:\.[A-Za-z0-9_$]+)?/u.exec(
      text
    )?.[0] ?? "request-controlled data"
  );
}

function walk(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  node.forEachChild((child) => walk(child, visitor));
}
