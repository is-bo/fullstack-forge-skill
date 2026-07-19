import ts from "typescript";
/**
 * Bounded intra-file taint analysis for JavaScript and TypeScript.
 *
 * Scope and limits — this is deliberately NOT whole-program sound:
 *  - Analysis is per file. Cross-file flows are not resolved.
 *  - Propagation covers lexical bindings, local aliases, reassignment, destructuring, template
 *    literals, string concatenation, and same-file function-parameter summaries.
 *  - Control-flow joins are conservative and the fixpoint is capped.
 *  - Protection evidence is typed. Validation never erases request-controlled provenance, and a
 *    protection is useful only to a sink that explicitly accepts its kind and context.
 *
 * Anything the engine cannot resolve remains untrusted or unresolved; it is never represented as
 * universally safe.
 */
const MAX_ITERATIONS = 8;
/** Direct request-controlled roots. */
const REQUEST_ROOT = /^(?:req|request|ctx\.request|event|context\.request)\.(?:body|params|query|headers|file|files|cookies)\b/u;
export const PROTECTION_KINDS = [
    "validated",
    "normalized",
    "encoded",
    "allowlisted",
    "parameterized",
    "shell-separated",
    "trusted-origin",
    "network-constrained"
];
export function buildTaintModel(sourceFile) {
    const index = indexBindings(sourceFile);
    const states = new Map();
    const stateFor = (node) => resolveExpression(node, sourceFile, index, states);
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
        const before = stateFingerprint(states);
        walk(sourceFile, (node) => {
            collectDeclarations(node, sourceFile, index, states);
            collectAssignments(node, sourceFile, index, states);
            collectTaintedParameters(node, sourceFile, index, states);
        });
        if (stateFingerprint(states) === before)
            break;
    }
    const tainted = publicTaintMap(states);
    const resolve = (node) => stateFor(node).origin;
    const protections = (node) => stateFor(node).protections;
    return {
        resolve,
        protections,
        hasProtection: (node, kind, context) => protections(node).some((protection) => protection.kind === kind &&
            (context === undefined || protection.context === context || protection.context === "any")),
        tainted
    };
}
function resolveExpression(node, sourceFile, index, states) {
    const expression = unwrap(node);
    const text = expression.getText(sourceFile);
    if (REQUEST_ROOT.test(text)) {
        return { origin: { source: directSource(text), steps: [] }, protections: [] };
    }
    if (ts.isIdentifier(expression)) {
        const binding = resolveBinding(expression, index);
        return binding === undefined ? emptyState() : cloneState(states.get(binding));
    }
    if (ts.isPropertyAccessExpression(expression)) {
        const base = resolveExpression(expression.expression, sourceFile, index, states);
        return appendStep(base, `property access ${text}`);
    }
    if (ts.isElementAccessExpression(expression)) {
        const base = resolveExpression(expression.expression, sourceFile, index, states);
        if (base.origin !== undefined)
            return appendStep(base, `property access ${text}`);
        const selector = expression.argumentExpression;
        const selected = resolveExpression(selector, sourceFile, index, states);
        if (selected.origin === undefined)
            return emptyState();
        if (!isFixedServerOwnedMap(expression.expression, index, states)) {
            // The request controls the key of a map this engine cannot prove is fixed and server-owned,
            // so the resulting value stays request-controlled and unprotected.
            return appendStep(selected, `selected from unproven map ${expression.expression.getText(sourceFile)}`);
        }
        const producer = expression.expression.getText(sourceFile);
        return {
            origin: {
                source: selected.origin.source,
                steps: [...selected.origin.steps, `selected server-owned destination from ${producer}`]
            },
            protections: mergeProtections(selected.protections, [
                protection("allowlisted", "destination", producer, text),
                protection("trusted-origin", "network", producer, text),
                protection("network-constrained", "network", producer, text)
            ])
        };
    }
    if (ts.isTemplateExpression(expression)) {
        const statesValue = expression.templateSpans.map((span) => resolveExpression(span.expression, sourceFile, index, states));
        return combineStates(statesValue, "interpolated into template literal");
    }
    if (ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return combineStates([
            resolveExpression(expression.left, sourceFile, index, states),
            resolveExpression(expression.right, sourceFile, index, states)
        ], "string concatenation");
    }
    if (ts.isConditionalExpression(expression)) {
        return combineStates([
            resolveExpression(expression.whenTrue, sourceFile, index, states),
            resolveExpression(expression.whenFalse, sourceFile, index, states)
        ], "conditional expression");
    }
    if (ts.isCallExpression(expression) || ts.isNewExpression(expression)) {
        const argumentsValue = expression.arguments ?? ts.factory.createNodeArray();
        const inputs = argumentsValue.map((argument) => resolveExpression(argument, sourceFile, index, states));
        const combined = combineStates(inputs, `passed through ${callTarget(expression, sourceFile)}`);
        if (combined.origin === undefined)
            return emptyState();
        return {
            origin: combined.origin,
            protections: mergeProtections(combined.protections, classifyProtections(expression, sourceFile))
        };
    }
    if (ts.isObjectLiteralExpression(expression)) {
        const values = [];
        for (const property of expression.properties) {
            if (ts.isPropertyAssignment(property))
                values.push(resolveExpression(property.initializer, sourceFile, index, states));
            else if (ts.isShorthandPropertyAssignment(property))
                values.push(resolveExpression(property.name, sourceFile, index, states));
            else if (ts.isSpreadAssignment(property))
                values.push(resolveExpression(property.expression, sourceFile, index, states));
        }
        return combineStates(values, "embedded in object literal");
    }
    if (ts.isArrayLiteralExpression(expression)) {
        return combineStates(expression.elements
            .filter((element) => ts.isExpression(element))
            .map((element) => resolveExpression(element, sourceFile, index, states)), "embedded in array literal");
    }
    return emptyState();
}
function collectDeclarations(node, sourceFile, index, states) {
    if (!ts.isVariableDeclaration(node) || node.initializer === undefined)
        return;
    const initializer = resolveExpression(node.initializer, sourceFile, index, states);
    if (initializer.origin === undefined)
        return;
    if (ts.isIdentifier(node.name)) {
        const binding = bindingForDeclaration(node.name, index);
        if (binding !== undefined)
            record(states, binding, appendStep(initializer, `assigned to ${node.name.text}`));
        return;
    }
    if (!ts.isObjectBindingPattern(node.name) && !ts.isArrayBindingPattern(node.name))
        return;
    for (const element of node.name.elements) {
        if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name))
            continue;
        const binding = bindingForDeclaration(element.name, index);
        if (binding !== undefined)
            record(states, binding, appendStep(initializer, `destructured into ${element.name.text}`));
    }
}
function collectAssignments(node, sourceFile, index, states) {
    if (!ts.isBinaryExpression(node) ||
        node.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        !ts.isIdentifier(node.left))
        return;
    const value = resolveExpression(node.right, sourceFile, index, states);
    if (value.origin === undefined)
        return;
    const binding = resolveBinding(node.left, index);
    if (binding !== undefined)
        record(states, binding, appendStep(value, `reassigned to ${node.left.text}`));
}
/** Propagates request-controlled arguments into parameters of a uniquely named same-file function. */
function collectTaintedParameters(node, sourceFile, index, states) {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
        return;
    const callee = node.expression.text;
    const target = index.functionByName.get(callee);
    if (target === undefined)
        return;
    node.arguments.forEach((argument, position) => {
        const parameter = target.parameters[position];
        if (parameter === undefined || !ts.isIdentifier(parameter.name))
            return;
        const value = resolveExpression(argument, sourceFile, index, states);
        if (value.origin === undefined)
            return;
        const binding = bindingForDeclaration(parameter.name, index);
        if (binding !== undefined)
            record(states, binding, appendStep(value, `passed as argument ${position} to ${callee} and bound to ${parameter.name.text}`));
    });
}
function indexBindings(sourceFile) {
    const byScope = new Map();
    const functionByName = new Map();
    const ambiguousFunctions = new Set();
    const add = (identifier, scope) => {
        const values = byScope.get(scope) ?? new Map();
        if (!values.has(identifier.text))
            values.set(identifier.text, { name: identifier.text, declaration: identifier, scope });
        byScope.set(scope, values);
    };
    walk(sourceFile, (node) => {
        if (ts.isVariableDeclaration(node)) {
            const scope = declarationScope(node);
            for (const identifier of bindingIdentifiers(node.name))
                add(identifier, scope);
            if (ts.isIdentifier(node.name) &&
                node.initializer !== undefined &&
                (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
                registerFunction(node.name.text, node.initializer, functionByName, ambiguousFunctions);
        }
        if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
            add(node.name, declarationScope(node));
            registerFunction(node.name.text, node, functionByName, ambiguousFunctions);
        }
        if (ts.isFunctionLike(node))
            for (const parameter of node.parameters)
                for (const identifier of bindingIdentifiers(parameter.name))
                    add(identifier, node);
        if (ts.isCatchClause(node) && node.variableDeclaration !== undefined)
            for (const identifier of bindingIdentifiers(node.variableDeclaration.name))
                add(identifier, node);
    });
    for (const name of ambiguousFunctions)
        functionByName.delete(name);
    return { byScope, functionByName };
}
function registerFunction(name, node, functions, ambiguous) {
    if (functions.has(name))
        ambiguous.add(name);
    else
        functions.set(name, node);
}
function bindingIdentifiers(name) {
    if (ts.isIdentifier(name))
        return [name];
    return name.elements.flatMap((element) => ts.isBindingElement(element) ? bindingIdentifiers(element.name) : []);
}
function declarationScope(node) {
    let current = node.parent;
    while (!ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current) || ts.isBlock(current))
            return current;
        current = current.parent;
    }
    return current;
}
function resolveBinding(identifier, index) {
    let current = identifier;
    for (;;) {
        if (ts.isFunctionLike(current) || ts.isBlock(current) || ts.isSourceFile(current)) {
            const binding = index.byScope.get(current)?.get(identifier.text);
            if (binding !== undefined)
                return binding;
        }
        if (ts.isSourceFile(current))
            return undefined;
        current = current.parent;
    }
}
function bindingForDeclaration(identifier, index) {
    for (const bindings of index.byScope.values()) {
        const binding = bindings.get(identifier.text);
        if (binding?.declaration === identifier)
            return binding;
    }
    return undefined;
}
function classifyProtections(node, sourceFile) {
    const target = callTarget(node, sourceFile);
    const expression = node.getText(sourceFile);
    const values = [];
    if (/(?:^|\.)(?:safeParse|parseAsync|parse|validateSync|validate|assertIs|assertValid|isUUID|validateUUID|uuid)$/iu.test(target))
        values.push(protection("validated", "shape", target, expression));
    if (/(?:^|\.)(?:trim|normalize|coerce|sanitize)$/iu.test(target))
        values.push(protection("normalized", "text", target, expression));
    if (/^(?:encodeURIComponent)$/u.test(target))
        values.push(protection("encoded", "url-component", target, expression));
    if (/(?:escapeHtml|htmlEscape|encodeHtml)$/iu.test(target))
        values.push(protection("encoded", "html", target, expression));
    if (/(?:escapeCsv|escapeFormula|csvEscape)$/iu.test(target))
        values.push(protection("encoded", "csv", target, expression));
    if (/(?:allowlist|assertAllowed|requireAllowed|allowedValue|\.enum|oneOf)/iu.test(target))
        values.push(protection("allowlisted", "value", target, expression));
    // Deliberately absent: no network or destination protection is granted from a callee name.
    // A function called `mapDestination`, `trustedDestination`, or `resolveAllowedDestination` may be
    // a no-op that returns its argument unchanged. Names are discovery hints, never proof; the only
    // supported destination proof is a structurally verified fixed server-owned map (see
    // `isFixedServerOwnedMap`) or a connected dominating guard checked at the sink.
    return values;
}
/**
 * Structural proof that an element access reads from a fixed, server-owned destination map.
 *
 * Requires the base identifier to resolve, in this file, to a `const` declaration initialized with
 * an object literal whose every value is a fixed absolute http(s) URL literal. Under those
 * conditions the request can influence only the lookup key, never the resulting URL. Nothing about
 * the identifier's *name* contributes to the decision, and an unresolvable or non-literal map
 * yields no protection rather than an assumed-safe one.
 */
function isFixedServerOwnedMap(node, index, states) {
    const expression = unwrap(node);
    if (!ts.isIdentifier(expression))
        return false;
    const binding = resolveBinding(expression, index);
    if (binding === undefined)
        return false;
    // A map that ever received request-controlled data cannot constrain anything.
    if (states.get(binding)?.origin !== undefined)
        return false;
    const declaration = binding.declaration.parent;
    if (!ts.isVariableDeclaration(declaration))
        return false;
    const list = declaration.parent;
    if (!ts.isVariableDeclarationList(list))
        return false;
    if ((list.flags & ts.NodeFlags.Const) === 0)
        return false;
    const initializer = declaration.initializer;
    if (initializer === undefined)
        return false;
    const literal = unwrapAssertions(initializer);
    if (!ts.isObjectLiteralExpression(literal))
        return false;
    if (literal.properties.length === 0)
        return false;
    return literal.properties.every((property) => {
        if (!ts.isPropertyAssignment(property))
            return false;
        const value = unwrapAssertions(property.initializer);
        if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value))
            return false;
        return isFixedHttpUrl(value.text);
    });
}
function unwrapAssertions(node) {
    let current = node;
    while (ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isParenthesizedExpression(current) ||
        ts.isSatisfiesExpression(current)) {
        current = current.expression;
    }
    return current;
}
function isFixedHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return ((parsed.protocol === "https:" || parsed.protocol === "http:") &&
            parsed.username === "" &&
            parsed.password === "");
    }
    catch {
        return false;
    }
}
function protection(kind, context, producer, expression) {
    return { kind, context, producer, expression };
}
function record(states, binding, incoming) {
    if (incoming.origin === undefined)
        return;
    const current = states.get(binding);
    if (current === undefined) {
        states.set(binding, cloneState(incoming));
        return;
    }
    const origin = incoming.origin.steps.length < (current.origin?.steps.length ?? Number.POSITIVE_INFINITY)
        ? incoming.origin
        : current.origin;
    states.set(binding, {
        ...(origin === undefined ? {} : { origin }),
        // A binding can receive multiple values. Retain a protection only when every
        // request-controlled assignment carries the same typed protection; unioning protections would
        // let an earlier allowlisted value bless a later raw reassignment.
        protections: intersectProtections(current.protections, incoming.protections)
    });
}
function combineStates(values, step) {
    const tainted = values.filter((value) => value.origin !== undefined);
    if (tainted.length === 0)
        return emptyState();
    const shortest = tainted.reduce((best, candidate) => (candidate.origin?.steps.length ?? Number.POSITIVE_INFINITY) <
        (best.origin?.steps.length ?? Number.POSITIVE_INFINITY)
        ? candidate
        : best);
    return {
        origin: {
            source: shortest.origin?.source ?? "request-controlled data",
            steps: [...(shortest.origin?.steps ?? []), step].slice(0, 12)
        },
        protections: mergeProtections(...tainted.map((value) => value.protections))
    };
}
function appendStep(state, step) {
    if (state.origin === undefined)
        return cloneState(state);
    return {
        origin: { source: state.origin.source, steps: [...state.origin.steps, step].slice(0, 12) },
        protections: [...state.protections]
    };
}
function mergeProtections(...groups) {
    const byKey = new Map();
    for (const value of groups.flat())
        byKey.set(protectionKey(value), value);
    return [...byKey.values()];
}
function intersectProtections(left, right) {
    const rightKeys = new Set(right.map(protectionKey));
    return left.filter((value) => rightKeys.has(protectionKey(value)));
}
function protectionKey(value) {
    return `${value.kind}\u0000${value.context}\u0000${value.producer}`;
}
function cloneState(value) {
    if (value === undefined)
        return emptyState();
    return {
        ...(value.origin === undefined
            ? {}
            : { origin: { source: value.origin.source, steps: [...value.origin.steps] } }),
        protections: [...value.protections]
    };
}
function emptyState() {
    return { protections: [] };
}
function publicTaintMap(states) {
    const counts = new Map();
    for (const binding of states.keys())
        counts.set(binding.name, (counts.get(binding.name) ?? 0) + 1);
    const result = new Map();
    for (const [binding, state] of states) {
        if (state.origin === undefined)
            continue;
        const key = counts.get(binding.name) === 1
            ? binding.name
            : `${binding.name}@${binding.declaration.getStart(binding.declaration.getSourceFile())}`;
        result.set(key, state.origin);
    }
    return result;
}
function stateFingerprint(states) {
    return [...states.entries()]
        .map(([binding, state]) => [
        binding.declaration.pos,
        state.origin?.source ?? "",
        state.origin?.steps.join("|") ?? "",
        state.protections
            .map((item) => `${item.kind}:${item.context}:${item.producer}`)
            .sort()
            .join("|")
    ].join(":"))
        .sort()
        .join("\n");
}
function unwrap(node) {
    let current = node;
    while (ts.isAwaitExpression(current) ||
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isNonNullExpression(current))
        current = current.expression;
    return current;
}
function callTarget(node, sourceFile) {
    return node.expression.getText(sourceFile);
}
function directSource(text) {
    return (/(?:req|request|ctx\.request|event|context\.request)\.(?:body|params|query|headers|file|files|cookies)(?:\.[A-Za-z0-9_$]+)?/u.exec(text)?.[0] ?? "request-controlled data");
}
function walk(node, visitor) {
    visitor(node);
    node.forEachChild((child) => walk(child, visitor));
}
//# sourceMappingURL=dataflow.js.map