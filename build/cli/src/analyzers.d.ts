import type { Finding } from "./types.js";
export type AnalyzerScope = ReadonlySet<string> | undefined;
export type AnalyzerRun = {
    analyzer_id: string;
    supported_files: number;
    findings: Finding[];
};
export declare function runAnalyzers(section: string, root: string, scope?: AnalyzerScope): Promise<AnalyzerRun[]>;
export declare function runNamedAnalyzer(analyzerId: string, root: string, scope?: AnalyzerScope): Promise<AnalyzerRun>;
