import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { BUILD_PRODUCER_VERSION } from "../src/build-producers.js";
import { assertValidSlug, assertBuildProject, loadFeature, newFeature, newProject, reverifyEvidenceHashes, saveFeature, saveProject } from "../src/build-state.js";
import { createBuildEvidenceEnvelope } from "../src/evidence-envelope.js";
import { sha256, workingTreeRevision } from "../src/utils.js";
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
        const withoutEvidence = { ...feature };
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
        const revision = await workingTreeRevision(root);
        const recordedAt = new Date().toISOString();
        const expiresAt = new Date(Date.parse(recordedAt) + 86_400_000).toISOString();
        const files = [{ path: "app.ts", sha256: sha256("export const ready = true;\n") }];
        const record = {
            criterion: "supported-static-patterns",
            discipline: "code",
            security_control: false,
            status: "PASS",
            producer: "fullstack-forge/build-analyzers",
            producer_version: BUILD_PRODUCER_VERSION,
            evidence: ["clean"],
            limitations: ["bounded static patterns only"],
            files,
            instance_ids: [],
            recorded_at: recordedAt,
            revision,
            expires_at: expiresAt
        };
        const claim = record;
        record.envelope = await createBuildEvidenceEnvelope({
            root,
            revision,
            claim,
            artifacts: [{ path: "app.ts", media_type: "text/typescript" }]
        });
        feature.evidence = [record];
        const fresh = await reverifyEvidenceHashes(root, feature);
        assert.equal(fresh.demoted.length, 0);
        assert.equal(fresh.feature.evidence[0]?.status, "PASS");
        await writeFile(join(root, "app.ts"), "export const ready = false;\n", "utf8");
        const stale = await reverifyEvidenceHashes(root, feature);
        assert.deepEqual(stale.demoted, ["supported-static-patterns"]);
        assert.equal(stale.feature.evidence[0]?.status, "NOT_VERIFIED");
        // The record is preserved, not removed.
        assert.equal(stale.feature.evidence.length, 1);
    });
});
test("agent-authored free text is redacted before it is persisted", async () => {
    await withTemporaryProject("build-redact", async (root) => {
        const feature = newFeature("login", "standard", "");
        feature.summary = "connect with api_key=SKfaketest12345abcdefABCDEF ok";
        feature.decisions = ["token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.faketestpayload.sig"];
        await saveFeature(root, feature, false);
        const raw = await readFile(join(root, ".forge", "build", "features", "login.json"), "utf8");
        assert.ok(!raw.includes("SKfaketest12345abcdefABCDEF"), "api key survived persistence");
        assert.ok(!raw.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "JWT survived persistence");
        assert.ok(raw.includes("REDACTED"));
    });
});
test("a reloaded discipline PASS is demoted because the deriver cannot produce one", async () => {
    await withTemporaryProject("build-forged-pass", async (root) => {
        const feature = newFeature("checkout-flow", "high", "forged status test");
        feature.disciplines = [{ slug: "payments", reason: "money movement" }];
        feature.evidence = [
            {
                criterion: "discipline:payments",
                discipline: "payments",
                security_control: true,
                status: "PASS",
                producer: "hand-edited",
                evidence: ["forged"],
                files: [],
                instance_ids: [],
                recorded_at: new Date().toISOString()
            }
        ];
        await saveFeature(root, feature, false);
        const loaded = await loadFeature(root, "checkout-flow");
        assert.ok(loaded);
        const { feature: reverified, demoted } = await reverifyEvidenceHashes(root, loaded);
        assert.deepEqual(demoted, ["discipline:payments"]);
        assert.equal(reverified.evidence[0]?.status, "NOT_VERIFIED");
    });
});
test("tier inputs are redacted before persistence", async () => {
    await withTemporaryProject("build-redact-inputs", async (root) => {
        const feature = newFeature("widget", "standard", "");
        feature.tier_inputs = ["public exposure api_key=SKfaketest99887766554433 recorded"];
        await saveFeature(root, feature, false);
        const raw = await readFile(join(root, ".forge", "build", "features", "widget.json"), "utf8");
        assert.ok(!raw.includes("SKfaketest99887766554433"), "tier input secret survived persistence");
    });
});
test("v2 project state rejects unknown fields and requires a structured frame", () => {
    const project = newProject("structured", "standard");
    assert.doesNotThrow(() => assertBuildProject(project));
    assert.deepEqual(project.frame.critical_workflows, []);
    assert.deepEqual(project.frame.stack_entries, []);
    assert.throws(() => assertBuildProject({ ...project, untrusted_extra: true }), /unknown field/u);
    const withoutFrame = { ...project };
    delete withoutFrame.frame;
    assert.throws(() => assertBuildProject(withoutFrame), /structured project frame/u);
    const withoutInvariants = structuredClone(project);
    delete withoutInvariants.frame.business_invariants;
    assert.throws(() => assertBuildProject(withoutInvariants), /structured project frame/u);
});
test("atomic project persistence leaves no partial temporary file on write failure", async () => {
    await withTemporaryProject("build-atomic", async (root) => {
        const buildDir = join(root, ".forge", "build");
        await mkdir(join(buildDir, "project.json"), { recursive: true });
        await assert.rejects(saveProject(root, newProject("atomic", undefined), false));
        const entries = await readdir(buildDir);
        assert.deepEqual(entries.sort(), ["project.json"]);
    });
});
