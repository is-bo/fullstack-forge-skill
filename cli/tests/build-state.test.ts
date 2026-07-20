import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  assertValidSlug,
  loadFeature,
  newFeature,
  reverifyEvidenceHashes,
  saveFeature,
  type BuildFeature,
  type CriterionEvidence
} from "../src/build-state.js";
import { sha256 } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

test("valid slugs are accepted", () => {
  for (const slug of ["login", "a", "abc-123", "checkout-flow", "x0"])
    assert.doesNotThrow(() => assertValidSlug(slug));
});

test("slug validation rejects traversal, ADS, drive, reserved, and device names", () => {
  const invalid = [
    "../evil",
    "a/b",
    "a..b",
    "x:y",
    "con",
    "aux",
    "nul",
    "prn",
    "com1",
    "lpt9",
    "CON",
    "Login",
    "-lead",
    "a".repeat(65),
    "",
    // reserved words: sub-verbs, verbs, audit modes, module slugs, platform names/aliases
    "frame",
    "check",
    "done",
    "resume",
    "feature",
    "audit",
    "verify",
    "auth",
    "security",
    "all",
    "ship",
    "claude",
    "codex",
    "generic"
  ];
  for (const slug of invalid)
    assert.throws(() => assertValidSlug(slug), new RegExp("slug|reserved|device", "iu"), slug);
});

test("fail-closed load rejects malformed JSON", async () => {
  await withTemporaryProject("build-malformed", async (root) => {
    const dir = join(root, ".forge", "build", "features");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "login.json"), "{ not valid json", "utf8");
    await assert.rejects(loadFeature(root, "login"));
  });
});

test("fail-closed load rejects a tampered enum and missing fields", async () => {
  await withTemporaryProject("build-tamper", async (root) => {
    const dir = join(root, ".forge", "build", "features");
    await mkdir(dir, { recursive: true });
    const feature = newFeature("login", "standard", "s");
    // Corrupt the phase to a value outside the enum.
    const tampered = { ...feature, phase: "shipped" };
    await writeFile(join(dir, "login.json"), JSON.stringify(tampered), "utf8");
    await assert.rejects(loadFeature(root, "login"), /Invalid build feature state/u);

    // Remove a required field.
    const withoutEvidence: Record<string, unknown> = { ...feature };
    delete withoutEvidence.evidence;
    await writeFile(join(dir, "login.json"), JSON.stringify(withoutEvidence), "utf8");
    await assert.rejects(loadFeature(root, "login"), /Invalid build feature state/u);
  });
});

test("a slug that disagrees with its file name is rejected", async () => {
  await withTemporaryProject("build-slug-mismatch", async (root) => {
    const dir = join(root, ".forge", "build", "features");
    await mkdir(dir, { recursive: true });
    const feature = newFeature("other", "standard", "s");
    await writeFile(join(dir, "login.json"), JSON.stringify(feature), "utf8");
    await assert.rejects(loadFeature(root, "login"), /records a different slug/u);
  });
});

test("evidence stale by file hash is demoted to NOT_VERIFIED, not deleted", async () => {
  await withTemporaryProject("build-stale", async (root) => {
    await writeFile(join(root, "app.ts"), "export const ready = true;\n", "utf8");
    const feature = newFeature("login", "standard", "s");
    const record: CriterionEvidence = {
      criterion: "static-analysis",
      security_control: false,
      status: "PASS",
      producer: "analyzers.ts",
      evidence: ["clean"],
      files: [{ path: "app.ts", sha256: sha256("export const ready = true;\n") }],
      instance_ids: [],
      recorded_at: new Date().toISOString()
    };
    feature.evidence = [record];

    const fresh = await reverifyEvidenceHashes(root, feature);
    assert.equal(fresh.demoted.length, 0);
    assert.equal(fresh.feature.evidence[0]?.status, "PASS");

    await writeFile(join(root, "app.ts"), "export const ready = false;\n", "utf8");
    const stale = await reverifyEvidenceHashes(root, feature);
    assert.deepEqual(stale.demoted, ["static-analysis"]);
    assert.equal(stale.feature.evidence[0]?.status, "NOT_VERIFIED");
    // The record is preserved, not removed.
    assert.equal(stale.feature.evidence.length, 1);
  });
});

test("agent-authored free text is redacted before it is persisted", async () => {
  await withTemporaryProject("build-redact", async (root) => {
    const feature: BuildFeature = newFeature("login", "standard", "");
    feature.summary = "connect with api_key=SK12345abcdefABCDEF67890 ok";
    feature.decisions = ["token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig"];
    await saveFeature(root, feature, false);
    const raw = await readFile(
      join(root, ".forge", "build", "features", "login.json"),
      "utf8"
    );
    assert.ok(!raw.includes("SK12345abcdefABCDEF67890"), "api key survived persistence");
    assert.ok(!raw.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "JWT survived persistence");
    assert.ok(raw.includes("REDACTED"));
  });
});
