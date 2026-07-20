import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { missingForDone, runBuild } from "../src/build.js";
import {
  loadFeature,
  newFeature,
  saveFeature,
  type BuildFeature,
  type CriterionEvidence,
  type CriterionStatus
} from "../src/build-state.js";
import { withTemporaryProject } from "./helpers.js";

const VULN_SOURCE = `const PAYMENT_API_SECRET = "prod_secret_1234567890";
app.get("/redirect", (req, res) => {
  console.log(req.body.password);
  res.redirect(req.query.next);
});
`;

async function captureRun(argv: string[]): Promise<{ code: number; out: string }> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]): void => {
    lines.push(args.map((value) => String(value)).join(" "));
  };
  try {
    const code = await runBuild(argv);
    return { code, out: lines.join("\n") };
  } finally {
    console.log = original;
  }
}

function evidence(
  criterion: string,
  status: CriterionStatus,
  securityControl = false,
  discipline?: string
): CriterionEvidence {
  return {
    criterion,
    ...(discipline === undefined ? {} : { discipline }),
    security_control: securityControl,
    status,
    producer: "test",
    evidence: [`${criterion} synthetic ${status}`],
    files: [],
    instance_ids: [],
    recorded_at: new Date().toISOString(),
    ...(status === "NOT_APPLICABLE" ? { not_applicable_reason: "synthetic" } : {})
  };
}

test("light tier completes in two invocations (start runs check, then done)", async () => {
  await withTemporaryProject("build-light", async (root) => {
    await writeFile(join(root, "app.ts"), "export const value = 1;\n", "utf8");
    const start = await captureRun([
      "feature",
      "login",
      "--tier",
      "light",
      "--summary",
      "login",
      "--allow-run",
      "--root",
      root
    ]);
    assert.equal(start.code, 0);
    const afterStart = await loadFeature(root, "login");
    assert.ok(afterStart);
    assert.equal(afterStart.phase, "check");
    assert.equal(
      afterStart.evidence.find((e) => e.criterion === "static-analysis")?.status,
      "PASS"
    );

    const done = await captureRun(["feature", "login", "done", "--root", root]);
    assert.equal(done.code, 0);
    assert.equal((await loadFeature(root, "login"))?.phase, "done");
  });
});

test("standard phase transitions frame -> plan -> check, and terminal edges are enforced", async () => {
  await withTemporaryProject("build-transitions", async (root) => {
    await captureRun(["feature", "t", "--tier", "standard", "--summary", "s", "--root", root]);
    assert.equal((await loadFeature(root, "t"))?.phase, "frame");
    await captureRun(["feature", "t", "plan", "--summary", "the plan", "--root", root]);
    const planned = await loadFeature(root, "t");
    assert.ok(planned);
    assert.equal(planned.phase, "plan");
    assert.ok(planned.plan_hash);
    await captureRun(["feature", "t", "check", "--root", root]);
    assert.equal((await loadFeature(root, "t"))?.phase, "check");

    await captureRun(["feature", "t", "abandon", "--root", root]);
    assert.equal((await loadFeature(root, "t"))?.phase, "abandoned");
    // Terminal edges: an abandoned feature can neither be checked nor completed.
    await assert.rejects(runBuild(["feature", "t", "check", "--root", root]), /abandoned/u);
    await assert.rejects(runBuild(["feature", "t", "done", "--root", root]), /abandoned/u);
  });
});

test("done refuses with an actionable missing list and a high-tier security control never passes", async () => {
  await withTemporaryProject("build-done-refuse", async (root) => {
    const feature = newFeature("secure", "high", "s");
    feature.phase = "check";
    feature.disciplines = [{ slug: "auth", reason: "login" }];
    feature.evidence = [
      evidence("scope-resolution", "PASS"),
      evidence("static-analysis", "PASS"),
      evidence("discipline:auth", "NOT_VERIFIED", true, "auth")
    ];
    await saveFeature(root, feature, false);
    const result = await captureRun(["feature", "secure", "done", "--root", root]);
    assert.equal(result.code, 1);
    assert.match(result.out, /done refused/u);
    assert.match(result.out, /high-tier required security control is NOT_VERIFIED/u);
    // The refusal never advanced the phase.
    assert.equal((await loadFeature(root, "secure"))?.phase, "check");
  });
});

test("accept-risk is refused for a high-tier required security control", async () => {
  await withTemporaryProject("build-accept-refuse", async (root) => {
    const feature = newFeature("secure", "high", "s");
    feature.phase = "check";
    feature.disciplines = [{ slug: "auth", reason: "login" }];
    feature.evidence = [evidence("discipline:auth", "NOT_VERIFIED", true, "auth")];
    await saveFeature(root, feature, false);
    await assert.rejects(
      runBuild([
        "feature",
        "secure",
        "accept-risk",
        "--criterion",
        "discipline:auth",
        "--reason",
        "later",
        "--root",
        root
      ]),
      /required security control at high tier/u
    );
  });
});

test("a non-security criterion can be risk-accepted to satisfy done, and is never shown as PASS", async () => {
  await withTemporaryProject("build-accept-ok", async (root) => {
    const feature = newFeature("rep", "standard", "s");
    feature.phase = "check";
    feature.disciplines = [{ slug: "observability", reason: "logs" }];
    feature.evidence = [
      evidence("scope-resolution", "PASS"),
      evidence("static-analysis", "PASS"),
      evidence("discipline:observability", "NOT_VERIFIED", false, "observability")
    ];
    await saveFeature(root, feature, false);

    const refused = await captureRun(["feature", "rep", "done", "--root", root]);
    assert.equal(refused.code, 1);

    const accept = await captureRun([
      "feature",
      "rep",
      "accept-risk",
      "--criterion",
      "discipline:observability",
      "--reason",
      "tracked in backlog",
      "--root",
      root
    ]);
    assert.equal(accept.code, 0);
    const accepted = await loadFeature(root, "rep");
    assert.ok(accepted);
    assert.equal(accepted.risk_acceptances.length, 1);
    // The evidence status stays NOT_VERIFIED; risk acceptance never rewrites it to PASS.
    assert.equal(
      accepted.evidence.find((e) => e.criterion === "discipline:observability")?.status,
      "NOT_VERIFIED"
    );

    const done = await captureRun(["feature", "rep", "done", "--root", root]);
    assert.equal(done.code, 0);
    assert.equal((await loadFeature(root, "rep"))?.phase, "done");
  });
});

test("the repair cap blocks a feature whose failure signature recurs", async () => {
  await withTemporaryProject("build-repair", async (root) => {
    await writeFile(join(root, "server.ts"), VULN_SOURCE, "utf8");
    await captureRun(["feature", "vuln", "--tier", "standard", "--summary", "s", "--root", root]);
    const first = await captureRun(["feature", "vuln", "check", "--root", root]);
    assert.equal(first.code, 1);
    let feature = await loadFeature(root, "vuln");
    assert.ok(feature);
    assert.equal(feature.phase, "check");
    assert.equal(feature.evidence.find((e) => e.criterion === "static-analysis")?.status, "FAIL");
    assert.equal(feature.repair_counters.find((c) => c.criterion === "static-analysis")?.count, 1);

    const second = await captureRun(["feature", "vuln", "check", "--root", root]);
    assert.equal(second.code, 1);
    feature = await loadFeature(root, "vuln");
    assert.ok(feature);
    assert.equal(feature.phase, "blocked");
    assert.ok(feature.blockers.length > 0);
    // A blocked feature reports its block rather than re-running the check.
    const again = await captureRun(["feature", "vuln", "check", "--root", root]);
    assert.match(again.out, /blocked/iu);
  });
});

test("new-repo bootstrap scopes to recorded touched paths when there is no merge base", async () => {
  await withTemporaryProject("build-bootstrap", async (root) => {
    await writeFile(join(root, "app.ts"), "export const value = 1;\n", "utf8");
    await writeFile(join(root, "other.ts"), "export const other = 2;\n", "utf8");
    await captureRun([
      "feature",
      "boot",
      "--tier",
      "standard",
      "--summary",
      "s",
      "--touch",
      "app.ts",
      "--root",
      root
    ]);
    const result = await captureRun(["feature", "boot", "check", "--json", "--root", root]);
    assert.equal(result.code, 0);
    const feature = await loadFeature(root, "boot");
    const scope = feature?.evidence.find((e) => e.criterion === "scope-resolution");
    assert.match(scope?.evidence.join(" ") ?? "", /recorded touched paths/u);
    assert.deepEqual(feature?.touched_paths, ["app.ts"]);
  });
});

test("resume lists unfinished features and points at the most recent", async () => {
  await withTemporaryProject("build-resume", async (root) => {
    await writeFile(join(root, "app.ts"), "export const value = 1;\n", "utf8");
    await captureRun(["feature", "done-one", "--tier", "light", "--allow-run", "--root", root]);
    await captureRun(["feature", "done-one", "done", "--root", root]);
    await captureRun([
      "feature",
      "open-two",
      "--tier",
      "standard",
      "--summary",
      "s",
      "--root",
      root
    ]);
    const resume = await captureRun(["resume", "--json", "--root", root]);
    assert.equal(resume.code, 0);
    const parsed = JSON.parse(resume.out) as {
      unfinished_features: { slug: string }[];
      most_recent?: { slug: string };
    };
    assert.deepEqual(
      parsed.unfinished_features.map((entry) => entry.slug),
      ["open-two"]
    );
    assert.equal(parsed.most_recent?.slug, "open-two");
  });
});

test("missingForDone is a pure function of tier and evidence", () => {
  const base = (): BuildFeature => {
    const feature = newFeature("f", "standard", "s");
    feature.disciplines = [{ slug: "api", reason: "endpoints" }];
    feature.evidence = [
      evidence("scope-resolution", "PASS"),
      evidence("static-analysis", "PASS"),
      evidence("discipline:api", "NOT_APPLICABLE", false, "api")
    ];
    return feature;
  };
  assert.deepEqual(missingForDone(base()), []);
  const failing = base();
  failing.evidence.push(evidence("project:test", "FAIL"));
  assert.ok(missingForDone(failing).some((item) => item.includes("FAIL")));
});
