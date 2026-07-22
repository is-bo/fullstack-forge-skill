import type { RenderedUiResult, ViewportStructuralObservation } from "./rendered-ui.js";
export declare const BUILD_RUNTIME_STATES: readonly ["loading", "empty", "error", "success", "permission-denied", "disabled", "destructive-confirmation", "long-content"];
export type BuildRuntimeState = (typeof BUILD_RUNTIME_STATES)[number];
export declare const BUILD_RUNTIME_VIEWPORTS: readonly [{
    readonly name: "desktop";
    readonly width: 1280;
    readonly height: 800;
}, {
    readonly name: "tablet";
    readonly width: 768;
    readonly height: 1024;
}, {
    readonly name: "mobile";
    readonly width: 375;
    readonly height: 812;
}];
export type BuildRuntimeViewport = (typeof BUILD_RUNTIME_VIEWPORTS)[number];
/** Deliberately finite: the adapter has no evaluate-JS, shell, selector, or arbitrary URL action. */
export type BuildRuntimeAction = {
    kind: "navigate";
} | {
    kind: "set-viewport";
    viewport: BuildRuntimeViewport["name"];
} | {
    kind: "capture-screenshot";
} | {
    kind: "keyboard-walkthrough";
} | {
    kind: "accessibility-scan";
} | {
    kind: "check-horizontal-overflow";
};
export type BuildRuntimeCase = {
    id: string;
    route: string;
    role: string;
    state: BuildRuntimeState;
    viewport: BuildRuntimeViewport;
    actions: readonly BuildRuntimeAction[];
};
export type BuildRuntimePlan = {
    route: string;
    role: string;
    cases: BuildRuntimeCase[];
};
export type RuntimeCheckStatus = "PASS" | "FAIL" | "NOT_VERIFIED" | "BLOCKED";
export type BuildRuntimeCaseResult = {
    id: string;
    screenshot: RuntimeCheckStatus;
    keyboard: RuntimeCheckStatus;
    accessibility: RuntimeCheckStatus;
    overflow: RuntimeCheckStatus;
    artifacts: Array<{
        path: string;
        sha256: string;
    }>;
    /** The exact fixed observation that accompanied this viewport artifact. */
    observation?: ViewportStructuralObservation;
    limitations: string[];
};
export type DesignDirectionResult = {
    status: "PRESENT" | "MISSING" | "NOT_VERIFIED";
    follows_direction?: boolean;
    deviation_reason?: string;
};
export type BuildRuntimeEvidence = {
    criterion: "runtime:rendered-ui" | "design-direction";
    status: RuntimeCheckStatus;
    evidence: string[];
    artifacts: Array<{
        path: string;
        sha256: string;
    }>;
    limitations: string[];
};
export type RuntimeEvidenceInput = {
    plan: BuildRuntimePlan;
    /** Backwards-compatible single-capture input, treated as the success state. */
    rendered: RenderedRuntimeCapture;
    /** Use one capture per rendered state to satisfy a multi-state plan. */
    captures?: readonly RuntimeStateCapture[];
    cases: readonly BuildRuntimeCaseResult[];
    design_direction: DesignDirectionResult;
};
export type RenderedRuntimeCapture = Pick<RenderedUiResult, "capture_status" | "status" | "reason" | "url" | "artifacts" | "viewports" | "console_errors" | "limitations" | "structural_evidence">;
export type RuntimeStateCapture = {
    state: BuildRuntimeState;
    rendered: RenderedRuntimeCapture;
};
/**
 * Produces a finite state/viewport matrix. Routes must be http(s), are immediately redacted, and
 * state simulation remains the responsibility of a registered runtime collector.
 */
export declare function planBuildRuntime(input: {
    route: string;
    role: string;
    states?: readonly BuildRuntimeState[];
}): BuildRuntimePlan;
/**
 * Converts one fixed rendered-UI capture into the cases for one explicitly named state. The
 * screenshot and observation identities come from the capture; callers cannot supply selectors,
 * scripts, or replacement hashes through this adapter.
 */
export declare function casesFromRenderedCapture(plan: BuildRuntimePlan, capture: RuntimeStateCapture): BuildRuntimeCaseResult[];
/**
 * Converts existing rendered-UI facts and declarative per-case observations into Build evidence.
 * It is intentionally pure: the adapter neither launches a browser nor interprets arbitrary JS.
 */
export declare function deriveBuildRuntimeEvidence(input: RuntimeEvidenceInput): BuildRuntimeEvidence[];
