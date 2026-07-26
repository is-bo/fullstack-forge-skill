import { type ModuleSlug } from "./constants.js";
import type { AnalyzerScope } from "./analyzers.js";
import type { RepositoryInventory } from "./repository-inventory.js";
import type { Finding, InspectionResult, ModuleDecision, ProjectProfile } from "./types.js";
export declare const APPLICATION_INSPECTION_MODULES: ("discover" | "requirements" | "architecture" | "code" | "ui" | "ux" | "accessibility" | "i18n" | "seo" | "frontend" | "api" | "jobs" | "integrations" | "auth" | "authorization" | "security" | "privacy" | "tenancy" | "uploads" | "database" | "queries" | "cache" | "storage" | "testing" | "performance" | "scale" | "observability" | "reliability" | "recovery" | "deployment" | "infrastructure" | "supply-chain" | "cost" | "docs" | "analytics" | "notifications" | "ai" | "payments" | "realtime" | "offline" | "all" | "ship")[];
export type ApplicationInspection = {
    modules: ModuleSlug[];
    decisions: ModuleDecision[];
    results: InspectionResult[];
    findings: Finding[];
};
/**
 * Shared application-defect derivation used by Audit and Ship.
 *
 * Gate evidence is preserved on each inspection result, but release-only command, freshness,
 * packaging, dependency, and publication gates are deliberately outside this pipeline.
 */
export declare function deriveApplicationInspection(input: {
    root: string;
    profile: ProjectProfile;
    inventory: RepositoryInventory;
    revision: string;
    modules?: readonly ModuleSlug[];
    scope?: AnalyzerScope;
}): Promise<ApplicationInspection>;
