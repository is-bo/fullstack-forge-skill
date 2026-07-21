import { redactToString, redactUrl } from "./redaction.js";
import type { CaptureStatus, RenderedUiResult } from "./rendered-ui.js";

export const BUILD_RUNTIME_STATES = [
  "loading",
  "empty",
  "error",
  "success",
  "permission-denied",
  "disabled",
  "destructive-confirmation",
  "long-content"
] as const;
export type BuildRuntimeState = (typeof BUILD_RUNTIME_STATES)[number];

export const BUILD_RUNTIME_VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 }
] as const;
export type BuildRuntimeViewport = (typeof BUILD_RUNTIME_VIEWPORTS)[number];

/** Deliberately finite: the adapter has no evaluate-JS, shell, selector, or arbitrary URL action. */
export type BuildRuntimeAction =
  | { kind: "navigate" }
  | { kind: "set-viewport"; viewport: BuildRuntimeViewport["name"] }
  | { kind: "capture-screenshot" }
  | { kind: "keyboard-walkthrough" }
  | { kind: "accessibility-scan" }
  | { kind: "check-horizontal-overflow" };

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
  artifacts: Array<{ path: string; sha256: string }>;
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
  artifacts: Array<{ path: string; sha256: string }>;
  limitations: string[];
};

export type RuntimeEvidenceInput = {
  plan: BuildRuntimePlan;
  rendered: Pick<
    RenderedUiResult,
    | "capture_status"
    | "status"
    | "reason"
    | "url"
    | "artifacts"
    | "viewports"
    | "console_errors"
    | "limitations"
  >;
  cases: readonly BuildRuntimeCaseResult[];
  design_direction: DesignDirectionResult;
};

/**
 * Produces a finite state/viewport matrix. Routes must be http(s), are immediately redacted, and
 * state simulation remains the responsibility of a registered runtime collector.
 */
export function planBuildRuntime(input: {
  route: string;
  role: string;
  states?: readonly BuildRuntimeState[];
}): BuildRuntimePlan {
  const parsed = new URL(input.route);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new Error("Build runtime routes must use http or https.");
  if (parsed.username !== "" || parsed.password !== "")
    throw new Error("Build runtime routes must not contain URL credentials.");
  const route = redactUrl(parsed);
  const states = input.states === undefined ? BUILD_RUNTIME_STATES : [...new Set(input.states)];
  for (const state of states)
    if (!(BUILD_RUNTIME_STATES as readonly string[]).includes(state))
      throw new Error(`Unsupported Build runtime state '${String(state)}'.`);
  const cases = states.flatMap((state) =>
    BUILD_RUNTIME_VIEWPORTS.map((viewport) => ({
      id: `${state}:${viewport.name}`,
      route,
      role: redactToString(input.role, 80),
      state,
      viewport,
      actions: [
        { kind: "navigate" },
        { kind: "set-viewport", viewport: viewport.name },
        { kind: "capture-screenshot" },
        { kind: "keyboard-walkthrough" },
        { kind: "accessibility-scan" },
        { kind: "check-horizontal-overflow" }
      ] as const
    }))
  );
  return { route, role: redactToString(input.role, 80), cases };
}

/**
 * Converts existing rendered-UI facts and declarative per-case observations into Build evidence.
 * It is intentionally pure: the adapter neither launches a browser nor interprets arbitrary JS.
 */
export function deriveBuildRuntimeEvidence(input: RuntimeEvidenceInput): BuildRuntimeEvidence[] {
  const design = deriveDesignDirection(input.design_direction);
  const runtime = deriveRuntime(input);
  return [runtime, design];
}

function deriveRuntime(input: RuntimeEvidenceInput): BuildRuntimeEvidence {
  const limitations = [...input.rendered.limitations];
  const rawArtifacts = input.cases.flatMap((entry) => entry.artifacts);
  const invalidArtifacts = rawArtifacts.filter(
    (artifact) =>
      !/^[a-f0-9]{64}$/iu.test(artifact.sha256) ||
      /^(?:[a-z]:[\\/]|[\\/]|.*(?:^|[\\/])\.\.(?:[\\/]|$))/iu.test(artifact.path)
  );
  const artifacts = rawArtifacts
    .map((artifact) => ({ path: redactToString(artifact.path, 500), sha256: artifact.sha256 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const missing = input.plan.cases.filter(
    (planned) => !input.cases.some((result) => result.id === planned.id)
  );
  const allResults = input.cases.filter((result) =>
    input.plan.cases.some((planned) => planned.id === result.id)
  );
  const caseFailures = allResults.filter((result) =>
    [result.screenshot, result.keyboard, result.accessibility, result.overflow].some(
      (status) => status === "FAIL"
    )
  );
  const caseUnavailable = allResults.filter((result) =>
    [result.screenshot, result.keyboard, result.accessibility, result.overflow].some(
      (status) => status === "NOT_VERIFIED" || status === "BLOCKED"
    )
  );
  const captureStatus: CaptureStatus = input.rendered.capture_status;
  if (captureStatus !== "COMPLETE" || input.rendered.status !== "OK") {
    limitations.push(
      `Rendered capture is ${captureStatus}${input.rendered.reason === undefined ? "" : `: ${redactToString(input.rendered.reason)}`}.`
    );
    if (input.rendered.console_errors > 0)
      limitations.push(
        `Rendered capture recorded ${input.rendered.console_errors} console error(s).`
      );
    if (caseFailures.length > 0)
      limitations.push(
        `Runtime failure in case(s): ${caseFailures.map((entry) => entry.id).join(", ")}.`
      );
    return runtimeValue(
      captureStatus === "FAILED" || input.rendered.console_errors > 0 || caseFailures.length > 0
        ? "FAIL"
        : "NOT_VERIFIED",
      input,
      artifacts,
      limitations
    );
  }
  if (input.rendered.console_errors > 0) {
    limitations.push(
      `Rendered capture recorded ${input.rendered.console_errors} console error(s).`
    );
    return runtimeValue("FAIL", input, artifacts, limitations);
  }
  if (caseFailures.length > 0) {
    limitations.push(
      `Runtime failure in case(s): ${caseFailures.map((entry) => entry.id).join(", ")}.`
    );
    return runtimeValue("FAIL", input, artifacts, limitations);
  }
  if (
    missing.length > 0 ||
    caseUnavailable.length > 0 ||
    artifacts.length === 0 ||
    invalidArtifacts.length > 0
  ) {
    if (missing.length > 0)
      limitations.push(
        `Missing planned runtime case(s): ${missing.map((entry) => entry.id).join(", ")}.`
      );
    if (caseUnavailable.length > 0)
      limitations.push(
        "Keyboard, accessibility, overflow, or screenshot evidence is unavailable for one or more cases."
      );
    if (artifacts.length === 0) limitations.push("No hashed runtime artifacts were supplied.");
    if (invalidArtifacts.length > 0)
      limitations.push(
        "One or more runtime artifacts had an unsafe path or an invalid SHA-256 hash."
      );
    return runtimeValue("NOT_VERIFIED", input, artifacts, limitations);
  }
  return runtimeValue("PASS", input, artifacts, limitations);
}

function runtimeValue(
  status: RuntimeCheckStatus,
  input: RuntimeEvidenceInput,
  artifacts: Array<{ path: string; sha256: string }>,
  limitations: string[]
): BuildRuntimeEvidence {
  return {
    criterion: "runtime:rendered-ui",
    status,
    evidence: [
      `Route ${input.plan.route} was planned for role '${input.plan.role}' across ${input.plan.cases.length} state/viewport case(s).`,
      `Rendered capture status: ${input.rendered.capture_status}; console errors: ${input.rendered.console_errors}.`
    ],
    artifacts,
    limitations: [...new Set(limitations.map((entry) => redactToString(entry, 500)))]
  };
}

function deriveDesignDirection(input: DesignDirectionResult): BuildRuntimeEvidence {
  if (input.status === "MISSING")
    return {
      criterion: "design-direction",
      status: "FAIL",
      evidence: ["No .forge/build/DESIGN.md direction was recorded for this UI feature."],
      artifacts: [],
      limitations: [
        "Visual quality remains a human review requirement; this structural check does not judge aesthetics."
      ]
    };
  if (input.status === "NOT_VERIFIED" || input.follows_direction === undefined)
    return {
      criterion: "design-direction",
      status: "NOT_VERIFIED",
      evidence: ["Design direction could not be structurally verified."],
      artifacts: [],
      limitations: [
        "Record whether the feature follows DESIGN.md or a reasoned intentional deviation."
      ]
    };
  if (!input.follows_direction && (input.deviation_reason ?? "").trim() === "")
    return {
      criterion: "design-direction",
      status: "FAIL",
      evidence: ["The feature declares a design-direction deviation without a reason."],
      artifacts: [],
      limitations: ["Visual quality remains a human review requirement."]
    };
  return {
    criterion: "design-direction",
    status: "PASS",
    evidence: [
      input.follows_direction
        ? "The feature records that it follows the project design direction."
        : `The feature records an intentional design-direction deviation: ${redactToString(input.deviation_reason ?? "", 300)}`
    ],
    artifacts: [],
    limitations: ["This proves a structural design-direction record, not visual quality."]
  };
}
