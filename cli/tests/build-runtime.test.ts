import assert from "node:assert/strict";
import test from "node:test";
import {
  casesFromRenderedCapture,
  deriveBuildRuntimeEvidence,
  planBuildRuntime,
  type RenderedRuntimeCapture
} from "../src/build-runtime.js";
import type { ViewportStructuralObservation } from "../src/rendered-ui.js";

const SHA = "a".repeat(64);

function renderedCapture(
  observations: ViewportStructuralObservation[] = ["desktop", "tablet", "mobile"].map(
    (name, index) => ({
      name,
      width: [1280, 768, 375][index]!,
      height: [800, 1024, 812][index]!,
      status: "PASS" as const,
      horizontal_overflow: false,
      keyboard: { tab_focus: true, visible_focus: true },
      accessibility: { unlabeled_interactive: 0, custom_control_defects: 0 },
      limitations: []
    })
  )
): RenderedRuntimeCapture {
  const viewports = observations.map((observation) => ({
    name: observation.name,
    width: observation.width,
    height: observation.height,
    status: "PASS" as const,
    artifact: `evidence/${observation.name}.png`,
    sha256: SHA
  }));
  return {
    capture_status: "COMPLETE",
    status: "OK",
    url: "http://127.0.0.1:3000/dashboard",
    artifacts: viewports.map((viewport) => viewport.artifact),
    viewports,
    console_errors: 0,
    limitations: [],
    structural_evidence: { path: "evidence/structural.json", sha256: SHA, observations }
  };
}

test("runtime plan has a deterministic UI state matrix and only allowlisted actions", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard?token=secret",
    role: "admin"
  });
  assert.equal(plan.cases.length, 24);
  assert.ok(!plan.route.includes("secret"));
  assert.match(plan.route, /token=/u);
  assert.deepEqual(
    plan.cases[0]?.actions.map((action) => action.kind),
    [
      "navigate",
      "set-viewport",
      "capture-screenshot",
      "keyboard-walkthrough",
      "accessibility-scan",
      "check-horizontal-overflow"
    ]
  );
});

test("runtime evidence passes only for complete, hashed, console-clean, fully observed cases", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard",
    role: "member",
    states: ["success"]
  });
  const rendered = renderedCapture();
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases: casesFromRenderedCapture(plan, { state: "success", rendered }),
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(evidence[0]!.status, "PASS");
  assert.equal(evidence[1]!.status, "PASS");
  assert.equal(evidence[0]!.artifacts.length, 3);
});

test("partial, unavailable, console, keyboard, overflow, and accessibility outcomes fail closed", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard",
    role: "member",
    states: ["success"]
  });
  const rendered = renderedCapture();
  const partial = deriveBuildRuntimeEvidence({
    plan,
    rendered: { ...rendered, capture_status: "PARTIAL" },
    cases: [],
    design_direction: { status: "MISSING" }
  });
  assert.equal(partial[0]!.status, "NOT_VERIFIED");
  assert.equal(partial[1]!.status, "FAIL");
  const consoleFailure = deriveBuildRuntimeEvidence({
    plan,
    rendered: { ...rendered, console_errors: 1 },
    cases: casesFromRenderedCapture(plan, { state: "success", rendered }),
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(consoleFailure[0]!.status, "FAIL");
  const unavailable = casesFromRenderedCapture(plan, { state: "success", rendered });
  const first = unavailable[0];
  if (first === undefined) throw new Error("test plan unexpectedly empty");
  first.accessibility = "NOT_VERIFIED";
  assert.equal(
    deriveBuildRuntimeEvidence({
      plan,
      rendered,
      cases: unavailable,
      design_direction: { status: "PRESENT", follows_direction: true }
    })[0]!.status,
    "NOT_VERIFIED"
  );
});

test("runtime artifacts require safe paths and real SHA-256-shaped hashes", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard",
    role: "member",
    states: ["success"]
  });
  const rendered = renderedCapture();
  const cases = casesFromRenderedCapture(plan, { state: "success", rendered });
  const first = cases[0];
  if (first === undefined) throw new Error("test plan unexpectedly empty");
  first.artifacts = [{ path: "../escape.png", sha256: "A".repeat(64) }];
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases,
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(evidence[0]!.status, "NOT_VERIFIED");
  assert.match(evidence[0]!.limitations.join(" "), /unsafe path/u);

  first.artifacts = [{ path: "evidence/desktop.png", sha256: "A".repeat(64) }];
  const uppercase = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases,
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(uppercase[0]!.status, "NOT_VERIFIED");
  assert.match(uppercase[0]!.limitations.join(" "), /invalid SHA-256/u);
});

test("runtime evidence rejects duplicate and extra planned-case claims", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard",
    role: "member",
    states: ["success"]
  });
  const rendered = renderedCapture();
  const cases = casesFromRenderedCapture(plan, { state: "success", rendered });
  const first = cases[0];
  if (first === undefined) throw new Error("test plan unexpectedly empty");
  cases.push({ ...first });
  cases.push({ ...first, id: "unexpected:desktop" });
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases,
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(evidence[0]!.status, "NOT_VERIFIED");
  assert.match(evidence[0]!.limitations.join(" "), /Duplicate runtime case/u);
  assert.match(evidence[0]!.limitations.join(" "), /Unexpected runtime case/u);
});

test("every planned state needs its own complete, one-to-one rendered capture", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard",
    role: "member",
    states: ["loading", "success"]
  });
  const prefixed = (prefix: string): RenderedRuntimeCapture => {
    const base = renderedCapture();
    const structural = base.structural_evidence;
    if (structural === undefined)
      throw new Error("test capture unexpectedly lacks structural evidence");
    const viewports = base.viewports.map((viewport) => ({
      ...viewport,
      artifact: `${prefix}/${viewport.artifact ?? "missing.png"}`
    }));
    return {
      ...base,
      artifacts: viewports.map((viewport) => viewport.artifact),
      viewports,
      structural_evidence: {
        ...structural,
        path: `${prefix}/structural.json`
      }
    };
  };
  const loading = prefixed("loading");
  const success = prefixed("success");
  const loadingCapture = { state: "loading" as const, rendered: loading };
  const successCapture = { state: "success" as const, rendered: success };
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered: loading,
    captures: [loadingCapture, successCapture],
    cases: [
      ...casesFromRenderedCapture(plan, loadingCapture),
      ...casesFromRenderedCapture(plan, successCapture)
    ],
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(evidence[0]!.status, "PASS");
});

test("fixed overflow and inaccessible custom-control observations fail Build runtime evidence", () => {
  const plan = planBuildRuntime({
    route: "http://127.0.0.1:3000/dashboard",
    role: "member",
    states: ["success"]
  });
  const baseline = renderedCapture();
  const observations = baseline.structural_evidence?.observations.map((entry) => ({ ...entry }));
  if (observations === undefined) throw new Error("test capture unexpectedly lacks observations");
  const tablet = observations[1];
  const mobile = observations[2];
  if (tablet === undefined || mobile === undefined)
    throw new Error("test viewport unexpectedly missing");
  tablet.status = "FAIL";
  tablet.horizontal_overflow = true;
  mobile.status = "FAIL";
  mobile.accessibility = { unlabeled_interactive: 1, custom_control_defects: 1 };
  const rendered = renderedCapture(observations);
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases: casesFromRenderedCapture(plan, { state: "success", rendered }),
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(evidence[0]!.status, "FAIL");
  assert.match(evidence[0]!.limitations.join(" "), /Runtime failure/u);
});
