import ts from "typescript";
import { resolveImport } from "./scope.js";
/**
 * Bounded cross-file resolution of a value expression to the function body it denotes.
 *
 * Two rule families need the same primitive and need it under the same guarantee. Route
 * authorization has to read the body an imported middleware actually names; upload analysis has
 * to read the body an imported type-validation helper actually names. In both cases an identifier
 * that was never opened must be reported unresolved rather than trusted, because trusting a
 * spelling is how a `requireRole` that only calls `next()` or an `assertAllowedType` that only
 * logs gets accepted as a control. Keeping one implementation here prevents a second, subtly
 * different resolver from drifting away from that guarantee.
 *
 * Scope and limits — deliberately NOT a whole-program resolver:
 *  - Only relative specifiers are followed, and only into the analyzed source corpus. A bare
 *    specifier (an installed package) is never resolved and is reported unresolved, never proven.
 *  - Named, default, aliased, renamed re-export, `export *` barrel, and CommonJS `exports.x` /
 *    `module.exports` forms are followed. Computed, conditional, or dynamically produced exports
 *    are not.
 *  - Module jumps, opened modules, and barrel branches are each capped by the caller's limits, and
 *    a visited set makes cyclic imports terminate.
 */
/** Default module jumps followed from one expression (import chain depth). */
export const MAX_MODULE_HOPS = 3;
/** Default distinct modules opened while resolving a single expression. */
export const MAX_MODULE_FILES = 12;
/** Default `export *` branches searched in one barrel module. */
export const MAX_BARREL_BRANCHES = 8;
/** Maximum expression wrappers (parentheses, casts, non-null assertions) peeled from a value. */
const MAX_UNWRAP_STEPS = 8;
const DEFAULT_LIMITS = {
    hops: MAX_MODULE_HOPS,
    files: MAX_MODULE_FILES,
    barrelBranches: MAX_BARREL_BRANCHES
};
export function createModuleResolver(files, limits = DEFAULT_LIMITS) {
    const byPath = new Map();
    // First declaration wins so a duplicated path cannot make the corpus order-dependent.
    for (const file of files)
        if (!byPath.has(file.path))
            byPath.set(file.path, file);
    const paths = new Set(byPath.keys());
    const moduleFor = (file, request, depth, budget) => {
        if (!request.startsWith("."))
            return undefined;
        if (depth >= limits.hops)
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
        if (!budget.files.has(target) && budget.files.size >= limits.files)
            return undefined;
        budget.files.add(target);
        return record;
    };
    const resolveBinding = (file, name, depth, budget) => {
        const key = `${file.path}#local:${name}`;
        if (budget.visited.has(key))
            return unresolvedValue(`import cycle at ${file.path} while resolving ${name}`);
        budget.visited.add(key);
        const imported = importedBinding(file.sourceFile, name);
        if (imported !== undefined) {
            const target = moduleFor(file, imported.request, depth, budget);
            if (target === undefined) {
                budget.trace.push(`${file.path}: ${name} <- ${imported.request} (not in analyzed sources)`);
                return unresolvedValue(`${name} is imported from ${imported.request}, which bounded analysis cannot open`);
            }
            budget.trace.push(`${file.path}: ${name} <- ${target.path}#${imported.exportName}`);
            return resolveExport(target, imported.exportName, depth + 1, budget);
        }
        const declaration = localDeclaration(file.sourceFile, name);
        if (declaration === undefined)
            return unresolvedValue(`${name} has no declaration in ${file.path}`);
        if (ts.isFunctionDeclaration(declaration))
            return { kind: "function", fn: declaration, file };
        const initializer = declaration.initializer;
        if (initializer === undefined)
            return unresolvedValue(`${name} in ${file.path} has no resolvable initializer`);
        return resolveValue(initializer, file, depth, budget);
    };
    const resolveExport = (file, exportName, depth, budget) => {
        const key = `${file.path}#${exportName}`;
        if (budget.visited.has(key))
            return unresolvedValue(`export cycle at ${file.path} while resolving ${exportName}`);
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
                        return unresolvedValue(`${exportName} in ${file.path} has no initializer`);
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
                            return unresolvedValue(`${exportName} is re-exported from ${specifier.text}, which bounded analysis cannot open`);
                        budget.trace.push(`${file.path}: re-export ${exportName} <- ${target.path}#${local}`);
                        return resolveExport(target, local, depth + 1, budget);
                    }
                }
                if (clause === undefined &&
                    specifier !== undefined &&
                    ts.isStringLiteralLike(specifier) &&
                    barrels.length < limits.barrelBranches)
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
        return unresolvedValue(`${file.path} does not export a resolvable ${exportName}`);
    };
    const resolveValue = (expression, file, depth, budget) => {
        const value = unwrapExpression(expression);
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
            return { kind: "function", fn: value, file };
        if (ts.isIdentifier(value))
            return resolveBinding(file, value.text, depth, budget);
        if (ts.isPropertyAccessExpression(value))
            return resolveMember(value, file, depth, budget);
        if (ts.isCallExpression(value))
            return unresolvedValue(`the value is produced by calling ${value.expression.getText(file.sourceFile)}, which bounded analysis does not evaluate`);
        return unresolvedValue(`the value ${value.getText(file.sourceFile)} is not a resolvable function reference`);
    };
    /** Resolves `namespace.member`, where the namespace is a namespace import or a CJS require. */
    const resolveMember = (value, file, depth, budget) => {
        const object = unwrapExpression(value.expression);
        if (!ts.isIdentifier(object))
            return unresolvedValue(`${value.getText(file.sourceFile)} is not a resolvable module member`);
        const request = namespaceRequest(file.sourceFile, object.text);
        if (request === undefined)
            return unresolvedValue(`${object.text} is not a module namespace in ${file.path}`);
        const target = moduleFor(file, request, depth, budget);
        if (target === undefined)
            return unresolvedValue(`${object.text} refers to ${request}, which bounded analysis cannot open`);
        budget.trace.push(`${file.path}: ${value.getText(file.sourceFile)} <- ${target.path}#${value.name.text}`);
        return resolveExport(target, value.name.text, depth + 1, budget);
    };
    return {
        budgetFor: (file) => ({ files: new Set([file.path]), visited: new Set(), trace: [] }),
        resolveValue,
        resolveBinding,
        resolveExport,
        moduleFor
    };
}
export function unresolvedValue(reason) {
    return { kind: "unresolved", reason };
}
/** The first `return` expression of a function, ignoring returns inside nested functions. */
export function returnedExpression(fn) {
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
/** The module specifier and exported name an imported local binding refers to. */
export function importedBinding(sourceFile, name) {
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier;
            if (!ts.isStringLiteralLike(specifier))
                continue;
            const clause = statement.importClause;
            if (clause === undefined)
                continue;
            if (clause.name !== undefined && clause.name.text === name)
                return { request: specifier.text, exportName: "default" };
            const bindings = clause.namedBindings;
            if (bindings === undefined || !ts.isNamedImports(bindings))
                continue;
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
                if (request === undefined)
                    continue;
                if (!ts.isObjectBindingPattern(declaration.name))
                    continue;
                for (const element of declaration.name.elements) {
                    if (!ts.isIdentifier(element.name) || element.name.text !== name)
                        continue;
                    const property = element.propertyName;
                    const exportName = property !== undefined && ts.isIdentifier(property) ? property.text : name;
                    return { request, exportName };
                }
            }
    }
    return undefined;
}
/** The module specifier a namespace binding refers to (`import * as ns` or `const ns = require`). */
export function namespaceRequest(sourceFile, name) {
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier;
            const bindings = statement.importClause?.namedBindings;
            if (ts.isStringLiteralLike(specifier) &&
                bindings !== undefined &&
                ts.isNamespaceImport(bindings) &&
                bindings.name.text === name)
                return specifier.text;
        }
        if (ts.isVariableStatement(statement))
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name)
                    continue;
                const request = requireRequest(declaration.initializer);
                if (request !== undefined)
                    return request;
            }
    }
    return undefined;
}
/** The specifier of a `require("...")` call, when the initializer is exactly that. */
export function requireRequest(initializer) {
    if (initializer === undefined)
        return undefined;
    const value = unwrapExpression(initializer);
    if (!ts.isCallExpression(value))
        return undefined;
    if (!ts.isIdentifier(value.expression) || value.expression.text !== "require")
        return undefined;
    const argument = value.arguments[0];
    if (argument === undefined || !ts.isStringLiteralLike(argument))
        return undefined;
    return argument.text;
}
/** The value assigned by a CommonJS export of `exportName`, when the statement is one. */
function commonJsExport(statement, exportName) {
    if (!ts.isExpressionStatement(statement))
        return undefined;
    const assignment = statement.expression;
    if (!ts.isBinaryExpression(assignment) ||
        assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken)
        return undefined;
    const target = assignment.left;
    if (!ts.isPropertyAccessExpression(target) || !ts.isIdentifier(target.expression))
        return undefined;
    if (target.expression.text === "exports" && target.name.text === exportName)
        return assignment.right;
    if (target.expression.text !== "module" || target.name.text !== "exports")
        return undefined;
    const value = unwrapExpression(assignment.right);
    if (!ts.isObjectLiteralExpression(value))
        return exportName === "default" ? assignment.right : undefined;
    for (const property of value.properties) {
        if (property.name === undefined || !ts.isIdentifier(property.name))
            continue;
        if (property.name.text !== exportName)
            continue;
        if (ts.isPropertyAssignment(property))
            return property.initializer;
        if (ts.isShorthandPropertyAssignment(property))
            return property.name;
    }
    return undefined;
}
/** The declaration of a module-scope or nested name, mirroring the analyzer's tolerance. */
export function localDeclaration(sourceFile, name) {
    let found;
    const walk = (node) => {
        if (found !== undefined)
            return;
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
function exportedAs(declaration, exportName) {
    if (!hasModifier(declaration, ts.SyntaxKind.ExportKeyword))
        return false;
    if (hasModifier(declaration, ts.SyntaxKind.DefaultKeyword))
        return exportName === "default";
    return declaration.name?.text === exportName;
}
export function hasModifier(node, kind) {
    if (!ts.canHaveModifiers(node))
        return false;
    return (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}
/** Peels parentheses, casts, and non-null assertions off a value expression. */
export function unwrapExpression(expression) {
    let current = expression;
    for (let step = 0; step < MAX_UNWRAP_STEPS; step += 1) {
        if (ts.isParenthesizedExpression(current))
            current = current.expression;
        else if (ts.isAsExpression(current))
            current = current.expression;
        else if (ts.isSatisfiesExpression(current))
            current = current.expression;
        else if (ts.isNonNullExpression(current))
            current = current.expression;
        else if (ts.isTypeAssertionExpression(current))
            current = current.expression;
        else
            return current;
    }
    return current;
}
//# sourceMappingURL=module-resolution.js.map