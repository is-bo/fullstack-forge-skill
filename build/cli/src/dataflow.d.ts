import ts from "typescript";
export declare const PROTECTION_KINDS: readonly ["validated", "normalized", "encoded", "allowlisted", "parameterized", "shell-separated", "trusted-origin", "network-constrained"];
export type ProtectionKind = (typeof PROTECTION_KINDS)[number];
export type ProtectionEvidence = {
    kind: ProtectionKind;
    /** A protection is never universal; context names the boundary it can help protect. */
    context: string;
    producer: string;
    expression: string;
};
export type TaintOrigin = {
    /** Human-readable source expression, e.g. `req.params.id`. */
    source: string;
    /** Ordered propagation steps from source to the current value. */
    steps: string[];
};
export type TaintModel = {
    /** Resolves whether an expression carries request-controlled data. */
    resolve: (node: ts.Expression) => TaintOrigin | undefined;
    /** Typed protections attached to this exact expression or lexical binding. */
    protections: (node: ts.Expression) => readonly ProtectionEvidence[];
    /** True only for the requested protection kind and, when supplied, the requested context. */
    hasProtection: (node: ts.Expression, kind: ProtectionKind, context?: string) => boolean;
    /** Debug/evidence view. Shadowed names receive a declaration-position suffix. */
    tainted: ReadonlyMap<string, TaintOrigin>;
};
export declare function buildTaintModel(sourceFile: ts.SourceFile): TaintModel;
