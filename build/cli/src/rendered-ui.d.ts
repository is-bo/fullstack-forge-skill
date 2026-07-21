import type { CliOptions, Finding } from "./types.js";
export type ConsoleEntry = {
    type: string;
    text: string;
    redacted?: boolean;
    truncated?: boolean;
};
/**
 * How much of the required evidence was actually produced.
 *
 * Rendered inspection previously reported success whenever it did not throw, so a run in which
 * every viewport failed still exited `0` and could contribute a PASS. Capture status makes the
 * completeness of the evidence explicit and is the only input allowed to authorize a rendered PASS.
 *
 * - `COMPLETE` — browser launched, every required viewport captured and hashed, nothing blocked.
 * - `PARTIAL`  — some evidence exists, but a required step failed or a request was blocked.
 * - `BLOCKED`  — a policy boundary (authorization, offline, no trusted driver) prevented execution.
 * - `FAILED`   — execution was attempted but produced no usable capture.
 */
export type CaptureStatus = "COMPLETE" | "PARTIAL" | "BLOCKED" | "FAILED";
export type ViewportResult = {
    name: string;
    width: number;
    height: number;
    status: "PASS" | "FAIL" | "BLOCKED";
    artifact?: string;
    sha256?: string;
    error?: string;
};
export type StructuralCheckStatus = "PASS" | "FAIL" | "NOT_VERIFIED";
/**
 * Fixed, bounded browser observations collected after each navigation. This is intentionally not a
 * general accessibility scanner: it catches only structural facts the built-in adapter can observe
 * without caller-provided selectors or JavaScript.
 */
export type ViewportStructuralObservation = {
    name: string;
    width: number;
    height: number;
    status: StructuralCheckStatus;
    horizontal_overflow?: boolean;
    keyboard?: {
        tab_focus: boolean;
        visible_focus: boolean;
    };
    accessibility?: {
        unlabeled_interactive: number;
        custom_control_defects: number;
    };
    limitations: string[];
};
export type RenderedUiStructuralEvidence = {
    path: string;
    sha256: string;
    observations: ViewportStructuralObservation[];
};
/** A request the offline interceptor refused. The URL is redacted before it is ever stored. */
export type BlockedRequest = {
    url: string;
    reason: string;
    resource_type?: string;
};
/**
 * Identity of the browser automation package that was actually imported. `source` records the trust
 * domain: `forge` packages ship with this tool and are covered by its lockfile, while `project`
 * packages come from the audited repository and execute audited-project code on import.
 */
export type DriverIdentity = {
    package: string;
    version?: string;
    path: string;
    source: "forge" | "project";
    trusted: boolean;
};
export type RenderedUiResult = {
    tool: "inspect-rendered-ui";
    status: "OK" | "BLOCKED";
    capture_status: CaptureStatus;
    reason?: string;
    url?: string;
    driver?: string;
    driver_identity?: DriverIdentity;
    offline: boolean;
    dry_run?: boolean;
    evidence_dir?: string;
    run_id?: string;
    route_id?: string;
    artifacts: string[];
    planned_artifacts?: string[];
    viewports: ViewportResult[];
    blocked_requests: BlockedRequest[];
    console_errors: number;
    console_warnings: number;
    /** Optional to preserve the existing rendered-UI CLI contract for older consumers. */
    structural_evidence?: RenderedUiStructuralEvidence;
    limitations: string[];
    findings: Finding[];
};
type RouteLike = {
    abort(errorCode?: string): Promise<void>;
    continue(): Promise<void>;
};
type RequestLike = {
    url(): string;
    resourceType?(): string;
};
type MinimalPage = {
    setDefaultTimeout(timeout: number): void;
    setViewportSize(size: {
        width: number;
        height: number;
    }): Promise<void>;
    goto(url: string, options?: {
        waitUntil?: string;
    }): Promise<unknown>;
    screenshot(options: {
        path: string;
        fullPage?: boolean;
    }): Promise<unknown>;
    url(): string;
    on(event: "console", handler: (message: {
        type(): string;
        text(): string;
    }) => void): void;
    on(event: "pageerror", handler: (error: Error) => void): void;
    /** Present on real drivers; absence is treated as "cannot enforce offline" rather than ignored. */
    route?(pattern: string, handler: (route: RouteLike, request: RequestLike) => void | Promise<void>): Promise<void>;
    addInitScript?(script: string): Promise<void>;
    /** Optional because older supported drivers can still capture screenshots without it. */
    evaluate?(pageFunction: () => unknown): Promise<unknown>;
    keyboard?: {
        press(key: "Tab"): Promise<void>;
    };
};
type MinimalBrowser = {
    newPage(): Promise<MinimalPage>;
    close(): Promise<void>;
};
type MinimalChromium = {
    launch(options: {
        headless: boolean;
    }): Promise<MinimalBrowser>;
};
export type CaptureOutcome = {
    capture_status: CaptureStatus;
    viewports: ViewportResult[];
    console_entries: ConsoleEntry[];
    blocked_requests: BlockedRequest[];
    screenshots: Array<{
        path: string;
        viewport: string;
        sha256: string;
    }>;
    structural_observations: ViewportStructuralObservation[];
    artifacts: string[];
    limitations: string[];
    final_url?: string;
    blocked_reason?: string;
};
/**
 * Drives the browser and returns exactly what it managed to capture.
 *
 * Exported so the fail-closed state machine and the offline interceptor can be tested against
 * controlled fake browser objects; this release deliberately does not add Playwright or browser
 * binaries as a required dependency.
 */
export declare function captureRenderedUi(chromium: MinimalChromium, params: {
    url: string;
    offline: boolean;
    evidenceDirectory: string;
    relativeEvidenceDir: string;
}): Promise<CaptureOutcome>;
export declare function inspectRenderedUi(root: string, args: string[], options: CliOptions, revision: string): Promise<{
    value: RenderedUiResult;
    exitCode: number;
}>;
export {};
