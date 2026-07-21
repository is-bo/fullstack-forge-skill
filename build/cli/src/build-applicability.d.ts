import type { Confidence, ProjectProfile } from "./types.js";
/** The Build-only applicability result. It deliberately does not change frame or plan selections. */
export type BuildApplicabilityStatus = "REQUIRED" | "SUGGESTED" | "EXCLUDED" | "UNRESOLVED";
export type BuildDisciplineDecision = {
    discipline: string;
    status: BuildApplicabilityStatus;
    confidence: Confidence;
    evidence: string[];
    exclusion_reason?: string;
};
export type BuildApplicabilityInput = {
    profile: ProjectProfile;
    changed_paths?: readonly string[];
    touched_paths?: readonly string[];
    summary?: string;
    risk_inputs?: readonly string[];
    /** Project- or feature-level risk floor; high risk makes security review mandatory. */
    risk_baseline?: "light" | "standard" | "high";
};
export type BuildApplicabilityResult = {
    decisions: BuildDisciplineDecision[];
    required: string[];
    suggested: string[];
    unresolved: string[];
    excluded: string[];
};
/**
 * Derives Build-mode discipline obligations from classified discovery evidence and implementation
 * changes. Documentation, tests, fixtures, examples, and generated output never activate a rule.
 */
export declare function deriveBuildApplicability(input: BuildApplicabilityInput): BuildApplicabilityResult;
