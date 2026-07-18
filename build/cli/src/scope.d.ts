import type { ModuleSlug } from "./constants.js";
import type { ProjectProfile } from "./types.js";
export type ChangedFileEvidence = {
    path: string;
    previous_path?: string;
    status: "added" | "modified" | "deleted" | "renamed" | "untracked";
    sources: string[];
};
export type IncludedFileEvidence = {
    path: string;
    reasons: string[];
};
export type ChangedScopeEvidence = {
    repository_root: string;
    base_ref: string;
    base_commit: string;
    merge_base: string;
    changed_files: ChangedFileEvidence[];
    included_files: IncludedFileEvidence[];
    excluded_applications: Array<{
        name: string;
        root: string;
        reason: string;
    }>;
    affected_applications: Array<{
        name: string;
        root: string;
        reasons: string[];
    }>;
    affected_modules: Array<{
        section: ModuleSlug;
        reasons: string[];
    }>;
};
export type ChangedScope = {
    evidence: ChangedScopeEvidence;
    files: Set<string>;
    modules: Set<ModuleSlug>;
};
export declare function analyzeChangedScope(rootInput: string, profile: ProjectProfile, requestedBase?: string): Promise<ChangedScope>;
