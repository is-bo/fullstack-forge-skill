import assert from "node:assert/strict";
import { test } from "node:test";

import { capabilityStatusFor, decideModules, decisionFindingStatus } from "../src/scope.js";
import { CAPABILITY_RULES } from "../src/discovery-evidence.js";
import type { CapabilityAssessment } from "../src/discovery-evidence.js";
import type { ProjectProfile } from "../src/types.js";

/**
 * Cross-feature regression tests spanning the v0.1.8 module-decision schema and the v0.1.10
 * discovery evidence classification.
 *
 * v0.1.8 established that `NOT_APPLICABLE` may only mean "this capability provably does not
 * exist". v0.1.10 introduces a richer capability assessment whose whole purpose is to stop weak
 * signals — documentation, tests, fixtures, generated copies — from activating a capability. The
 * hazard at the seam is the reverse of the one v0.1.8 closed: an `UNKNOWN` assessment being
 * projected onto the decision axis as a proven `ABSENT`, which would resurrect exactly the
 * false-`NOT_APPLICABLE` defect v0.1.8 exists to prevent.
 */

const MODELED_CAPABILITIES = new Set(CAPABILITY_RULES.map((rule) => rule.capability));

const assessment = (
  capability: string,
  status: CapabilityAssessment["status"],
  workspace = "."
): CapabilityAssessment => ({
  capability,
  workspace,
  status,
  score: status === "PRESENT" ? 1 : 0,
  evidence: [],
  reasons: [`assessed ${status}`]
});

const profile = (assessments: CapabilityAssessment[]): ProjectProfile =>
  ({
    root: "/p",
    generated_at: "2026-07-20T00:00:00.000Z",
    capabilities: {},
    capability_assessments: assessments
  }) as unknown as ProjectProfile;

test("a PRESENT assessment activates the module capability axis", () => {
  const result = capabilityStatusFor("auth", profile([assessment("authentication", "PRESENT")]));
  assert.equal(result.status, "PRESENT");
  assert.match(result.evidence[0] ?? "", /authentication/u);
});

test("an UNKNOWN assessment never becomes a proven ABSENT", () => {
  // This is the defect being guarded. UNKNOWN means discovery could not decide; reporting it as
  // ABSENT would let a module be dismissed NOT_APPLICABLE on no evidence at all.
  const result = capabilityStatusFor("auth", profile([assessment("authentication", "UNKNOWN")]));
  assert.equal(result.status, "UNKNOWN");
  assert.notEqual(result.status, "ABSENT");
});

test("a capability with no assessment at all is UNKNOWN, not ABSENT", () => {
  const result = capabilityStatusFor("auth", profile([assessment("database", "PRESENT")]));
  assert.equal(result.status, "UNKNOWN");
});

test("ABSENT requires every workspace to prove absence", () => {
  const mixed = profile([
    assessment("database", "ABSENT", "packages/web"),
    assessment("database", "UNKNOWN", "packages/api")
  ]);
  assert.equal(capabilityStatusFor("database", mixed).status, "UNKNOWN");

  const proven = profile([
    assessment("database", "ABSENT", "packages/web"),
    assessment("database", "ABSENT", "packages/api")
  ]);
  assert.equal(capabilityStatusFor("database", proven).status, "ABSENT");
});

test("one workspace proving PRESENT is enough for the whole project", () => {
  const monorepo = profile([
    assessment("uploads", "ABSENT", "packages/web"),
    assessment("uploads", "PRESENT", "packages/api")
  ]);
  assert.equal(capabilityStatusFor("uploads", monorepo).status, "PRESENT");
});

test("only a proven-absent capability yields NOT_APPLICABLE downstream", () => {
  const cases: Array<[CapabilityAssessment["status"], string]> = [
    ["ABSENT", "NOT_APPLICABLE"],
    ["UNKNOWN", "NOT_VERIFIED"]
  ];
  for (const [status, expected] of cases) {
    const decisions = decideModules({
      candidates: ["uploads"],
      profile: profile([assessment("uploads", status)]),
      explicit: false
    });
    const decision = decisions[0];
    assert.ok(decision);
    assert.equal(decision.capability_status, status);
    assert.equal(decisionFindingStatus(decision), expected);
  }
});

test("documentation-, test-, fixture- and generated-only signals cannot activate a capability", () => {
  // The assessment layer already assigns these zero activation weight; this asserts the decision
  // layer honours the resulting UNKNOWN rather than inferring presence or absence from it.
  const decisions = decideModules({
    candidates: ["payments"],
    profile: profile([assessment("payments", "UNKNOWN")]),
    explicit: false
  });
  const decision = decisions[0];
  assert.ok(decision);
  assert.notEqual(decision.capability_status, "PRESENT");
  assert.notEqual(decision.capability_status, "ABSENT");
  assert.equal(decisionFindingStatus(decision), "NOT_VERIFIED");
});

test("a profile without assessments still uses the legacy presence map", () => {
  const legacy = {
    root: "/p",
    generated_at: "2026-07-20T00:00:00.000Z",
    capabilities: { authentication: { confidence: "HIGH", evidence: ["src/auth.ts"] } }
  } as unknown as ProjectProfile;
  assert.equal(capabilityStatusFor("auth", legacy).status, "PRESENT");
});

test("a capability the evidence layer does not model falls back to the legacy presence map", () => {
  // `frontend` has no capability rule in the v0.1.10 evidence layer. Treating the resulting
  // silence as an assessment would report UNKNOWN forever and permanently disable every module
  // gated on it, so those capabilities must still consult the legacy map.
  assert.equal(MODELED_CAPABILITIES.has("authentication"), true);
  assert.equal(MODELED_CAPABILITIES.has("frontend"), false);

  const withFrontend = {
    root: "/p",
    generated_at: "2026-07-20T00:00:00.000Z",
    capabilities: { frontend: { confidence: "HIGH", evidence: ["src/App.tsx"] } },
    capability_assessments: [assessment("authentication", "PRESENT")]
  } as unknown as ProjectProfile;

  assert.equal(capabilityStatusFor("ui", withFrontend).status, "PRESENT");
  // The modeled capability still comes from the assessment layer in the same profile.
  assert.equal(capabilityStatusFor("auth", withFrontend).status, "PRESENT");
});
