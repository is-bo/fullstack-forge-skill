import { redactToString, redactUrl } from "./redaction.js";
export const BUILD_RUNTIME_STATES = [
    "loading",
    "empty",
    "error",
    "success",
    "permission-denied",
    "disabled",
    "destructive-confirmation",
    "long-content"
];
export const BUILD_RUNTIME_VIEWPORTS = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 812 }
];
/**
 * Produces a finite state/viewport matrix. Routes must be http(s), are immediately redacted, and
 * state simulation remains the responsibility of a registered runtime collector.
 */
export function planBuildRuntime(input) {
    const parsed = new URL(input.route);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        throw new Error("Build runtime routes must use http or https.");
    if (parsed.username !== "" || parsed.password !== "")
        throw new Error("Build runtime routes must not contain URL credentials.");
    const route = redactUrl(parsed);
    const states = input.states === undefined ? BUILD_RUNTIME_STATES : [...new Set(input.states)];
    for (const state of states)
        if (!BUILD_RUNTIME_STATES.includes(state))
            throw new Error(`Unsupported Build runtime state '${String(state)}'.`);
    const cases = states.flatMap((state) => BUILD_RUNTIME_VIEWPORTS.map((viewport) => ({
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
        ]
    })));
    return { route, role: redactToString(input.role, 80), cases };
}
/**
 * Converts one fixed rendered-UI capture into the cases for one explicitly named state. The
 * screenshot and observation identities come from the capture; callers cannot supply selectors,
 * scripts, or replacement hashes through this adapter.
 */
export function casesFromRenderedCapture(plan, capture) {
    return plan.cases
        .filter((planned) => planned.state === capture.state)
        .map((planned) => {
        const viewport = capture.rendered.viewports.find((candidate) => candidate.name === planned.viewport.name &&
            candidate.width === planned.viewport.width &&
            candidate.height === planned.viewport.height);
        const observation = capture.rendered.structural_evidence?.observations.find((candidate) => candidate.name === planned.viewport.name &&
            candidate.width === planned.viewport.width &&
            candidate.height === planned.viewport.height);
        const observedStatus = observation === undefined ? "NOT_VERIFIED" : observation.status;
        return {
            id: planned.id,
            screenshot: viewport?.status === "PASS" ? "PASS" : "NOT_VERIFIED",
            keyboard: observation?.keyboard === undefined
                ? structuralCheck(observedStatus)
                : observation.keyboard.tab_focus && observation.keyboard.visible_focus
                    ? "PASS"
                    : "FAIL",
            accessibility: observation?.accessibility === undefined
                ? structuralCheck(observedStatus)
                : observation.accessibility.unlabeled_interactive === 0 &&
                    observation.accessibility.custom_control_defects === 0
                    ? "PASS"
                    : "FAIL",
            overflow: observation?.horizontal_overflow === undefined
                ? structuralCheck(observedStatus)
                : observation.horizontal_overflow
                    ? "FAIL"
                    : "PASS",
            artifacts: viewport?.artifact === undefined || viewport.sha256 === undefined
                ? []
                : [{ path: viewport.artifact, sha256: viewport.sha256 }],
            ...(observation === undefined ? {} : { observation }),
            limitations: observation?.limitations ?? []
        };
    });
}
function structuralCheck(status) {
    return status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "NOT_VERIFIED";
}
function sameObservation(left, right) {
    return (left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right));
}
/**
 * Converts existing rendered-UI facts and declarative per-case observations into Build evidence.
 * It is intentionally pure: the adapter neither launches a browser nor interprets arbitrary JS.
 */
export function deriveBuildRuntimeEvidence(input) {
    const design = deriveDesignDirection(input.design_direction);
    const runtime = deriveRuntime(input);
    return [runtime, design];
}
function deriveRuntime(input) {
    const captures = input.captures ?? [{ state: "success", rendered: input.rendered }];
    const limitations = captures.flatMap((capture) => capture.rendered.limitations);
    const rawArtifacts = input.cases.flatMap((entry) => entry.artifacts);
    const invalidArtifacts = rawArtifacts.filter((artifact) => !/^[a-f0-9]{64}$/u.test(artifact.sha256) ||
        /^(?:[a-z]:[\\/]|[\\/]|.*(?:^|[\\/])\.\.(?:[\\/]|$))/iu.test(artifact.path));
    const artifacts = rawArtifacts
        // Artifact paths are structural identifiers that were already constrained to safe relative
        // paths by the rendered collector. Redacting them as prose can collapse distinct state paths
        // into the same token and falsely report duplicate evidence.
        .map((artifact) => ({ path: artifact.path, sha256: artifact.sha256 }))
        .sort((a, b) => a.path.localeCompare(b.path));
    const duplicateArtifactPaths = artifacts
        .map((artifact) => artifact.path)
        .filter((path, index, paths) => paths.indexOf(path) !== index);
    const expectedById = new Map(input.plan.cases.map((planned) => [planned.id, planned]));
    const actualIds = input.cases.map((result) => result.id);
    const duplicateIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
    const missing = input.plan.cases.filter((planned) => !actualIds.includes(planned.id));
    const extra = input.cases.filter((result) => !expectedById.has(result.id));
    const allResults = input.cases.filter((result) => expectedById.has(result.id));
    const structuralGaps = allResults.filter((result) => result.observation === undefined);
    const structuralFailures = allResults.filter((result) => result.observation?.status === "FAIL");
    const structuralUnavailable = allResults.filter((result) => result.observation?.status !== "PASS");
    const mismatchedArtifacts = allResults.filter((result) => {
        const planned = expectedById.get(result.id);
        if (planned === undefined || result.artifacts.length !== 1)
            return true;
        const artifact = result.artifacts[0];
        if (artifact === undefined)
            return true;
        const stateCapture = captures.filter((capture) => capture.state === planned.state);
        if (stateCapture.length !== 1)
            return true;
        const rendered = stateCapture[0]?.rendered;
        const viewport = rendered?.viewports.find((candidate) => candidate.name === planned.viewport.name &&
            candidate.width === planned.viewport.width &&
            candidate.height === planned.viewport.height);
        const observation = rendered?.structural_evidence?.observations.find((candidate) => candidate.name === planned.viewport.name &&
            candidate.width === planned.viewport.width &&
            candidate.height === planned.viewport.height);
        return (viewport?.artifact !== artifact.path ||
            viewport.sha256 !== artifact.sha256 ||
            !sameObservation(observation, result.observation));
    });
    const caseFailures = allResults.filter((result) => [result.screenshot, result.keyboard, result.accessibility, result.overflow].some((status) => status === "FAIL"));
    const caseUnavailable = allResults.filter((result) => [result.screenshot, result.keyboard, result.accessibility, result.overflow].some((status) => status === "NOT_VERIFIED" || status === "BLOCKED"));
    const failedCapture = captures.find((capture) => capture.rendered.capture_status === "FAILED");
    const incompleteCapture = captures.find((capture) => capture.rendered.capture_status !== "COMPLETE" || capture.rendered.status !== "OK");
    const consoleCapture = captures.find((capture) => capture.rendered.console_errors > 0);
    if (incompleteCapture !== undefined) {
        const captureStatus = incompleteCapture.rendered.capture_status;
        limitations.push(`Rendered capture for '${incompleteCapture.state}' is ${captureStatus}${incompleteCapture.rendered.reason === undefined ? "" : `: ${redactToString(incompleteCapture.rendered.reason)}`}.`);
        if (consoleCapture !== undefined)
            limitations.push(`Rendered capture for '${consoleCapture.state}' recorded ${consoleCapture.rendered.console_errors} console error(s).`);
        if (caseFailures.length > 0 || structuralFailures.length > 0)
            limitations.push(`Runtime failure in case(s): ${[...caseFailures, ...structuralFailures].map((entry) => entry.id).join(", ")}.`);
        return runtimeValue(failedCapture !== undefined ||
            consoleCapture !== undefined ||
            caseFailures.length > 0 ||
            structuralFailures.length > 0
            ? "FAIL"
            : "NOT_VERIFIED", input, artifacts, limitations, captures);
    }
    if (consoleCapture !== undefined) {
        limitations.push(`Rendered capture for '${consoleCapture.state}' recorded ${consoleCapture.rendered.console_errors} console error(s).`);
        return runtimeValue("FAIL", input, artifacts, limitations, captures);
    }
    if (caseFailures.length > 0 || structuralFailures.length > 0) {
        limitations.push(`Runtime failure in case(s): ${[...caseFailures, ...structuralFailures].map((entry) => entry.id).join(", ")}.`);
        return runtimeValue("FAIL", input, artifacts, limitations, captures);
    }
    if (missing.length > 0 ||
        extra.length > 0 ||
        duplicateIds.length > 0 ||
        duplicateArtifactPaths.length > 0 ||
        caseUnavailable.length > 0 ||
        structuralGaps.length > 0 ||
        structuralUnavailable.length > 0 ||
        mismatchedArtifacts.length > 0 ||
        artifacts.length === 0 ||
        invalidArtifacts.length > 0) {
        if (missing.length > 0)
            limitations.push(`Missing planned runtime case(s): ${missing.map((entry) => entry.id).join(", ")}.`);
        if (extra.length > 0)
            limitations.push(`Unexpected runtime case(s): ${extra.map((entry) => entry.id).join(", ")}.`);
        if (duplicateIds.length > 0)
            limitations.push(`Duplicate runtime case id(s): ${[...new Set(duplicateIds)].join(", ")}.`);
        if (duplicateArtifactPaths.length > 0)
            limitations.push(`Duplicate runtime artifact path(s): ${[...new Set(duplicateArtifactPaths)].join(", ")}.`);
        if (caseUnavailable.length > 0)
            limitations.push("Keyboard, accessibility, overflow, or screenshot evidence is unavailable for one or more cases.");
        if (structuralGaps.length > 0)
            limitations.push("One or more cases had no fixed structural observation.");
        if (structuralUnavailable.length > 0)
            limitations.push("One or more cases had incomplete fixed structural observations.");
        if (mismatchedArtifacts.length > 0)
            limitations.push("One or more cases did not have exactly one matching rendered artifact and observation.");
        if (artifacts.length === 0)
            limitations.push("No hashed runtime artifacts were supplied.");
        if (invalidArtifacts.length > 0)
            limitations.push("One or more runtime artifacts had an unsafe path or an invalid SHA-256 hash.");
        return runtimeValue("NOT_VERIFIED", input, artifacts, limitations, captures);
    }
    return runtimeValue("PASS", input, artifacts, limitations, captures);
}
function runtimeValue(status, input, artifacts, limitations, captures = [{ state: "success", rendered: input.rendered }]) {
    return {
        criterion: "runtime:rendered-ui",
        status,
        evidence: [
            `Route ${input.plan.route} was planned for role '${input.plan.role}' across ${input.plan.cases.length} state/viewport case(s).`,
            ...captures.map((capture) => `Rendered capture for '${capture.state}': ${capture.rendered.capture_status}; console errors: ${capture.rendered.console_errors}.`)
        ],
        artifacts,
        limitations: [...new Set(limitations.map((entry) => redactToString(entry, 500)))]
    };
}
function deriveDesignDirection(input) {
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
//# sourceMappingURL=build-runtime.js.map