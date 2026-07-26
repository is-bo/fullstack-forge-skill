import type { ModuleSlug } from "./constants.js";
export declare const FRONTEND_REFERENCE_IDS: readonly ["product-and-ux", "visual-direction", "design-system", "responsive-layout", "accessibility-integration", "component-architecture", "react-nextjs", "frontend-performance", "motion-and-interactions", "forms-and-data-entry", "dashboards-and-data-visualization", "mobile-react-native", "design-review", "anti-patterns"];
export type FrontendReferenceId = (typeof FRONTEND_REFERENCE_IDS)[number];
export type FrontendArea = "frontend" | "ui" | "ux";
export type FrontendWorkflow = "build" | "audit" | "fix" | "verify";
export type FrontendRoute = {
    active: boolean;
    modules: ModuleSlug[];
    references: FrontendReferenceId[];
    workflow: FrontendWorkflow;
    scale: "small" | "standard" | "high-risk";
    reasons: string[];
};
/**
 * Selects interface disciplines and progressive references from a natural-language request.
 * It does not claim that any inspection, render, or check ran.
 */
export declare function routeFrontendRequest(request: string, area?: FrontendArea): FrontendRoute;
export declare function normalizeFrontendWorkflow(area: FrontendArea, mode?: string): FrontendWorkflow;
