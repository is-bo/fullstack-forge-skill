/**
 * Structured analyzer support registry.
 *
 * This is the single source of truth for what Fullstack Forge can actually execute. README and
 * generated platform skills are checked against it so documentation cannot claim coverage the
 * runtime does not have.
 *
 * When a module has no adapter for a detected language/framework, the audit reports
 * NOT_VERIFIED and names the missing adapter instead of implying executable coverage.
 */
export type CoverageLevel = "executable" | "partial" | "none";
export type AnalyzerSupport = {
    module: string;
    language: string;
    framework: string;
    analyzer_id: string;
    coverage: CoverageLevel;
    supported_shapes: string[];
    unsupported_shapes: string[];
    /** Adapter that would be required to raise coverage. Present when coverage is not executable. */
    required_adapter?: string;
};
export declare const ANALYZER_SUPPORT: readonly AnalyzerSupport[];
export type MissingAdapter = {
    module: string;
    language: string;
    framework: string;
    required_adapter: string;
};
/** Resolves the support record for a module/language pair, if one is registered. */
export declare function findSupport(module: string, language: string, framework?: string): AnalyzerSupport | undefined;
/**
 * Reports the adapters that would be required to give a module executable coverage over the
 * languages a project actually contains.
 */
export declare function missingAdapters(module: string, languages: string[]): MissingAdapter[];
/** Renders the structured NOT_VERIFIED evidence line for a missing adapter. */
export declare function describeMissingAdapter(missing: MissingAdapter): string;
