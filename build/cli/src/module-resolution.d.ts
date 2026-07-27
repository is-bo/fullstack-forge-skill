import ts from "typescript";
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
export declare const MAX_MODULE_HOPS = 3;
/** Default distinct modules opened while resolving a single expression. */
export declare const MAX_MODULE_FILES = 12;
/** Default `export *` branches searched in one barrel module. */
export declare const MAX_BARREL_BRANCHES = 8;
/**
 * A parsed source file addressed by its repository-relative POSIX path.
 *
 * Structurally compatible with the analyzer's internal source record, so callers pass their own
 * records without conversion.
 */
export type ModuleSourceFile = {
    /** Repository-relative POSIX path — the key module specifiers resolve against. */
    path: string;
    content: string;
    sourceFile: ts.SourceFile;
};
export type ResolvedFunction = {
    kind: "function";
    fn: ts.FunctionLikeDeclaration;
    file: ModuleSourceFile;
};
export type UnresolvedValue = {
    kind: "unresolved";
    reason: string;
};
/** A body was read, or it was not. There is no third, optimistic outcome. */
export type ValueResolution = ResolvedFunction | UnresolvedValue;
/** Mutable, per-expression budget. Shared across the whole resolution of one expression. */
export type ResolutionBudget = {
    files: Set<string>;
    visited: Set<string>;
    /** Ordered resolution hops in source order; deterministic, safe to publish as evidence. */
    trace: string[];
};
export type ResolutionLimits = {
    hops: number;
    files: number;
    barrelBranches: number;
};
export type ModuleResolver = {
    /** A fresh budget rooted at the file the expression was written in. */
    budgetFor: (file: ModuleSourceFile) => ResolutionBudget;
    /** Resolves an arbitrary value expression to the function it denotes. */
    resolveValue: (expression: ts.Expression, file: ModuleSourceFile, depth: number, budget: ResolutionBudget) => ValueResolution;
    /** Resolves a module-scope name in `file` to a function body, following imports. */
    resolveBinding: (file: ModuleSourceFile, name: string, depth: number, budget: ResolutionBudget) => ValueResolution;
    /** Resolves one exported name of a module, following re-exports and barrels. */
    resolveExport: (file: ModuleSourceFile, exportName: string, depth: number, budget: ResolutionBudget) => ValueResolution;
    /** Opens the module a relative specifier names, subject to the hop and module budgets. */
    moduleFor: (file: ModuleSourceFile, request: string, depth: number, budget: ResolutionBudget) => ModuleSourceFile | undefined;
};
export declare function createModuleResolver(files: readonly ModuleSourceFile[], limits?: ResolutionLimits): ModuleResolver;
export declare function unresolvedValue(reason: string): UnresolvedValue;
/** The first `return` expression of a function, ignoring returns inside nested functions. */
export declare function returnedExpression(fn: ts.FunctionLikeDeclaration): ts.Expression | undefined;
/** The module specifier and exported name an imported local binding refers to. */
export declare function importedBinding(sourceFile: ts.SourceFile, name: string): {
    request: string;
    exportName: string;
} | undefined;
/** The module specifier a namespace binding refers to (`import * as ns` or `const ns = require`). */
export declare function namespaceRequest(sourceFile: ts.SourceFile, name: string): string | undefined;
/** The specifier of a `require("...")` call, when the initializer is exactly that. */
export declare function requireRequest(initializer: ts.Expression | undefined): string | undefined;
/** The value assigned by a CommonJS export of `exportName`, when the statement is one. */
export declare function commonJsExport(statement: ts.Statement, exportName: string): ts.Expression | undefined;
/** The declaration of a module-scope or nested name, mirroring the analyzer's tolerance. */
export declare function localDeclaration(sourceFile: ts.SourceFile, name: string): ts.FunctionDeclaration | ts.VariableDeclaration | undefined;
export declare function exportedAs(declaration: ts.FunctionDeclaration, exportName: string): boolean;
export declare function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean;
/** Peels parentheses, casts, and non-null assertions off a value expression. */
export declare function unwrapExpression(expression: ts.Expression): ts.Expression;
