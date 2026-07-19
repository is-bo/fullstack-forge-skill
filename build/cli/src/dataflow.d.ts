import ts from "typescript";
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
export declare function buildTaintModel(sourceFile: ts.SourceFile): TaintModel;
