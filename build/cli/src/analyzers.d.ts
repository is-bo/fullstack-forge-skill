import type { Finding } from "./types.js";
import { type RepositoryInventory } from "./repository-inventory.js";
export type AnalyzerScope = ReadonlySet<string> | undefined;
export type AnalyzerRun = {
    analyzer_id: string;
    supported_files: number;
    findings: Finding[];
};
export declare function runAnalyzers(section: string, root: string, scope?: AnalyzerScope, repositoryInventory?: RepositoryInventory): Promise<AnalyzerRun[]>;
export declare function runNamedAnalyzer(analyzerId: string, root: string, scope?: AnalyzerScope): Promise<AnalyzerRun>;
/**
 * Stable per-occurrence identity for a rule. Derived from the rule ID, the repository-relative
 * path, and the sink symbol so that it survives unrelated edits to the same file.
 */
export declare function findingInstanceId(ruleId: string, path: string, sink: string): string;
