import ts from "typescript";
import { classifyDestination } from "./destination-policy.js";
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
        const proof = proveDestinationMap(expression.expression, sourceFile, index, states);
        if (!proof.proven) {
            // The request controls the key of a map this engine cannot prove is fixed, immutable,
            // non-escaping, and externally addressed, so the value stays request-controlled and
            // unprotected. The specific failure is retained as the propagation step.
            return appendStep(selected, `selected from unproven map ${expression.expression.getText(sourceFile)}: ${proof.reason}`);
        }
        const producer = expression.expression.getText(sourceFile);
        return {
            origin: {
                source: selected.origin.source,
                steps: [...selected.origin.steps, `selected server-owned destination from ${producer}`]
            },
            protections: mergeProtections(selected.protections, [
                protection("allowlisted", "destination", producer, text, proof.limitations),
                protection("trusted-origin", "network", producer, text, proof.limitations),
                protection("network-constrained", "network", producer, text, proof.limitations)
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
            protections: mergeProtections(combined.protections, classifyProtections(expression, sourceFile, index, 0))
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
/**
 * Library roots whose parsing and validation semantics this engine explicitly supports.
 *
 * The root identifier must be one of these AND the terminal method must be a documented
 * parse/validate entry point. A bare `parse(value)`, `validate(value)`, `sanitize(value)`,
 * `assertValid(value)`, `assertAllowed(value)`, or `safe(value)` proves nothing: any of them may be
 * a no-op that returns its argument, and this engine has repeatedly seen exactly that.
 */
const SUPPORTED_SCHEMA_ROOTS = new Set(["z", "zod", "yup", "joi", "Joi", "valibot", "superstruct"]);
const SCHEMA_TERMINAL_METHODS = new Set([
    "parse",
    "parseAsync",
    "safeParse",
    "safeParseAsync",
    "validate",
    "validateSync",
    "validateAsync",
    "assert",
    "cast"
]);
/** Standard globals whose encoding semantics are fixed by the language specification. */
const SPECIFIED_ENCODERS = new Map([
    ["encodeURIComponent", { kind: "encoded", context: "url-component" }],
    ["encodeURI", { kind: "encoded", context: "url" }]
]);
const MAX_HELPER_DEPTH = 2;
/**
 * Typed protection evidence from bounded *structural* proof.
 *
 * Nothing here consults a name for proof. `parse`, `validate`, `assertValid`, `sanitize`,
 * `allowlist`, `assertAllowed`, `requireAllowed`, `allowedValue`, `trusted`, and `safe` are
 * discovery hints only: an unknown function with any of those names produces no protection, so the
 * downstream sink keeps reporting the defect.
 */
function classifyProtections(node, sourceFile, index, depth) {
    if (!ts.isCallExpression(node))
        return [];
    const target = callTarget(node, sourceFile);
    const expression = node.getText(sourceFile);
    // 1. Explicitly supported library API with known semantics, attached to this exact value.
    if (isSupportedSchemaCall(node))
        return [protection("validated", "shape", target, expression)];
    // 2. Sink-specific encoding defined by the language specification.
    const encoder = ts.isIdentifier(node.expression)
        ? SPECIFIED_ENCODERS.get(node.expression.text)
        : undefined;
    if (encoder !== undefined)
        return [protection(encoder.kind, encoder.context, target, expression)];
    // 3. Same-file helper whose implementation is actually analyzed. A helper that returns its
    //    argument unchanged yields nothing, however protective its name reads.
    return helperProtections(node, sourceFile, index, depth);
}
/** A schema chain rooted at a supported library identifier and terminated by a parse entry point. */
function isSupportedSchemaCall(node) {
    const callee = unwrap(node.expression);
    if (!ts.isPropertyAccessExpression(callee))
        return false;
    if (!SCHEMA_TERMINAL_METHODS.has(callee.name.text))
        return false;
    let current = unwrap(callee.expression);
    for (;;) {
        if (ts.isCallExpression(current)) {
            current = unwrap(current.expression);
            continue;
        }
        if (ts.isPropertyAccessExpression(current)) {
            current = unwrap(current.expression);
            continue;
        }
        break;
    }
    return ts.isIdentifier(current) && SUPPORTED_SCHEMA_ROOTS.has(current.text);
}
/**
 * Analyzes a uniquely named same-file helper rather than trusting its name.
 *
 * Bounded to a single unconditional returned expression, recursed at most `MAX_HELPER_DEPTH`
 * levels. An identity helper (`return value;`) contributes no protection, which is the entire
 * point: no-op wrappers must not launder a request-controlled value.
 */
function helperProtections(node, sourceFile, index, depth) {
    if (depth >= MAX_HELPER_DEPTH)
        return [];
    if (!ts.isIdentifier(node.expression))
        return [];
    const target = index.functionByName.get(node.expression.text);
    if (target?.body === undefined)
        return [];
    const returned = soleReturnedExpression(target);
    if (returned === undefined)
        return [];
    if (!ts.isCallExpression(returned))
        return [];
    return classifyProtections(returned, sourceFile, index, depth + 1).map((evidence) => ({
        ...evidence,
        producer: `${node.expression.getText(sourceFile)} -> ${evidence.producer}`
    }));
}
function soleReturnedExpression(target) {
    const body = target.body;
    if (body === undefined)
        return undefined;
    if (!ts.isBlock(body))
        return unwrap(body);
    const returns = [];
    const visit = (node) => {
        if (ts.isFunctionLike(node) && node !== target)
            return;
        if (ts.isReturnStatement(node)) {
            if (node.expression === undefined)
                returns.push(ts.factory.createNull());
            else
                returns.push(unwrap(node.expression));
        }
        node.forEachChild(visit);
    };
    body.forEachChild(visit);
    return returns.length === 1 ? returns[0] : undefined;
}
/**
 * Strong structural proof that an element access reads from a fixed, immutable, server-owned map of
 * externally addressed destinations.
 *
 * A `const` object of URL strings is NOT sufficient. `const D = { local: "http://127.0.0.1:3000/" }`
 * and `Object.freeze({ metadata: "http://169.254.169.254/latest/meta-data/" })` are both constant
 * literals and both name exactly what an SSRF attack is trying to reach, and a `const` binding does
 * not stop `D.local = req.query.url` or `mutate(D)`. Every one of the following must hold:
 *
 *  - the base resolves in this file to a `const` binding that never received request data;
 *  - the initializer is a non-empty object literal (optionally wrapped in `Object.freeze`);
 *  - every destination is a fixed string literal that parses as http(s) with no credentials;
 *  - every destination classifies as external — loopback, private, link-local, unspecified,
 *    multicast, reserved, shared-carrier, and cloud-metadata addresses all fail;
 *  - the declaration is not exported;
 *  - no reference performs a property write or delete, aliases the map into another binding,
 *    returns it, exports it, or passes it to a function this engine does not model.
 *
 * Hostname destinations are accepted but recorded as DNS-dependent: no resolution is performed, so
 * DNS rebinding and private A records are outside the proof.
 */
function proveDestinationMap(node, sourceFile, index, states) {
    const expression = unwrap(node);
    if (!ts.isIdentifier(expression))
        return failed("the map is not a resolvable identifier");
    const binding = resolveBinding(expression, index);
    if (binding === undefined)
        return failed("the map does not resolve to a binding in this file");
    if (states.get(binding)?.origin !== undefined)
        return failed("the map itself received request-controlled data");
    const declaration = binding.declaration.parent;
    if (!ts.isVariableDeclaration(declaration))
        return failed("the map is not a variable declaration");
    const list = declaration.parent;
    if (!ts.isVariableDeclarationList(list))
        return failed("the map is not a variable declaration");
    if ((list.flags & ts.NodeFlags.Const) === 0)
        return failed("the map binding is not const");
    const statement = list.parent;
    if (ts.isVariableStatement(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true)
        return failed("the map is exported, so unknown code outside this file may mutate it");
    const initializer = declaration.initializer;
    if (initializer === undefined)
        return failed("the map has no initializer");
    const literal = unwrapFreeze(initializer);
    if (!ts.isObjectLiteralExpression(literal))
        return failed("the map is not an object literal");
    if (literal.properties.length === 0)
        return failed("the map is empty");
    const limitations = [];
    for (const property of literal.properties) {
        if (!ts.isPropertyAssignment(property))
            return failed("a map entry is a spread, shorthand, accessor, or method rather than a literal");
        const value = unwrapAssertions(property.initializer);
        if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value))
            return failed("a destination is not a fixed string literal");
        const verdict = classifyDestination(value.text);
        if (!verdict.safe)
            return failed(`destination '${value.text}' is ${verdict.classification}: ${verdict.reason}`);
        if (verdict.dns_dependent)
            limitations.push(`Destination '${value.text}' is a hostname. No DNS resolution is performed, so this proof does not exclude DNS rebinding or a name that resolves to an internal address.`);
    }
    const escape = findEscape(binding, sourceFile, index);
    if (escape !== undefined)
        return failed(escape);
    return { proven: true, reason: "fixed immutable server-owned destination map", limitations };
}
/**
 * Audits every reference to the map binding for mutation and escape.
 *
 * Anything not explicitly recognized as a safe read fails the proof. Being conservative here is the
 * point: an unrecognized use is exactly the case where mutation could be hiding.
 */
function findEscape(binding, sourceFile, index) {
    let failure;
    walk(sourceFile, (node) => {
        if (failure !== undefined)
            return;
        if (!ts.isIdentifier(node) || node.text !== binding.name)
            return;
        if (node === binding.declaration)
            return;
        if (resolveBinding(node, index) !== binding)
            return;
        const parent = node.parent;
        if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
            parent.expression === node) {
            const outer = parent.parent;
            if (ts.isDeleteExpression(outer)) {
                failure = `a delete removes an entry from ${binding.name}`;
                return;
            }
            if (isAssignmentTarget(parent)) {
                failure = `a property write reassigns an entry of ${binding.name}`;
                return;
            }
            return;
        }
        if (ts.isCallExpression(parent) && parent.arguments.includes(node)) {
            if (!isModelledObjectHelper(parent))
                failure = `${binding.name} is passed to ${parent.expression.getText(sourceFile)}, whose behaviour this engine does not model`;
            return;
        }
        failure = `${binding.name} escapes through an unmodelled reference (${parent.getText(sourceFile).slice(0, 60)})`;
    });
    return failure;
}
function isAssignmentTarget(node) {
    const parent = node.parent;
    return (ts.isBinaryExpression(parent) &&
        parent.left === node &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment);
}
/** `Object.freeze`/`keys`/`values`/`entries` cannot mutate or leak the map's destinations. */
function isModelledObjectHelper(call) {
    const callee = unwrap(call.expression);
    if (!ts.isPropertyAccessExpression(callee))
        return false;
    if (!ts.isIdentifier(callee.expression) || callee.expression.text !== "Object")
        return false;
    return ["freeze", "keys", "values", "entries", "getOwnPropertyNames"].includes(callee.name.text);
}
function unwrapFreeze(node) {
    const current = unwrapAssertions(node);
    if (ts.isCallExpression(current) &&
        isModelledObjectHelper(current) &&
        unwrap(current.expression).getText().endsWith("freeze") &&
        current.arguments.length === 1) {
        return unwrapAssertions(current.arguments[0]);
    }
    return current;
}
function failed(reason) {
    return { proven: false, reason, limitations: [] };
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
function protection(kind, context, producer, expression, limitations = []) {
    return {
        kind,
        context,
        producer,
        expression,
        ...(limitations.length === 0 ? {} : { limitations })
    };
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
        // Destination proof requires the selected value to reach the sink directly. Once a proven
        // destination is concatenated, interpolated, or merged with another value, the request can
        // influence the final URL again, so network-context protections do not survive combination.
        protections: mergeProtections(...tainted.map((value) => value.protections)).filter((evidence) => evidence.context !== "network" && evidence.context !== "destination")
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