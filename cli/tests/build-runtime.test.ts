import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveBuildRuntimeEvidence,
  planBuildRuntime,
  type BuildRuntimeCaseResult
} from "../src/build-runtime.js";

const result = (id: string): BuildRuntimeCaseResult => ({
  id,
  screenshot: "PASS",
  keyboard: "PASS",
  accessibility: "PASS",
  overflow: "PASS",
  artifacts: [{ path: `evidence/${id}.png`, sha256: "a".repeat(64) }],
  limitations: []
});
const rendered = {
  capture_status: "COMPLETE" as const,
  status: "OK" as const,
  url: "http://127.0.0.1:3000/dashboard",
  artifacts: [],
  viewports: [],
  console_errors: 0,
  limitations: []
};

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
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases: plan.cases.map((entry) => result(entry.id)),
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
    cases: plan.cases.map((entry) => result(entry.id)),
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(consoleFailure[0]!.status, "FAIL");
  const unavailable = plan.cases.map((entry) => result(entry.id));
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
  const cases = plan.cases.map((entry) => result(entry.id));
  const first = cases[0];
  if (first === undefined) throw new Error("test plan unexpectedly empty");
  first.artifacts = [{ path: "../escape.png", sha256: "not-a-hash" }];
  const evidence = deriveBuildRuntimeEvidence({
    plan,
    rendered,
    cases,
    design_direction: { status: "PRESENT", follows_direction: true }
  });
  assert.equal(evidence[0]!.status, "NOT_VERIFIED");
  assert.match(evidence[0]!.limitations.join(" "), /unsafe path/u);
});
