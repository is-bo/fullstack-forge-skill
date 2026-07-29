import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { PACKAGE_ROOT } from "../src/constants.js";
import { copyFixture, withTemporaryProject } from "./helpers.js";
const expectedIds = [
    "sql-injection",
    "nosql-injection",
    "command-injection",
    "broken-object-level-authorization",
    "cross-tenant-leakage",
    "unrestricted-uploads",
    "extension-only-validation",
    "mime-spoofing",
    "public-quarantine-bypass",
    "missing-malware-scanning",
    "scanner-fail-open",
    "zip-bomb-risk",
    "n-plus-one-queries",
    "missing-pagination",
    "missing-indexes",
    "cross-user-cache-keys",
    "cross-tenant-cache-keys",
    "invoice-prompt-injection",
    "ai-irreversible-stock-change",
    "missing-keyboard-navigation",
    "missing-form-labels",
    "missing-focus-handling",
    "unverified-backup-claims",
    "unsigned-payment-webhooks",
    "duplicate-payment-handling",
    "missing-webhook-idempotency",
    "insecure-session-cookie-attributes",
    "user-controlled-session-identifier",
    "ssrf-url-fetch",
    "unsafe-deserialization",
    "csv-formula-injection",
    "mass-assignment"
];
test("evaluation catalog covers the exact required failure modes with explicit expectations", async () => {
    const cases = JSON.parse(await readFile(join(PACKAGE_ROOT, "evals", "cases.json"), "utf8"));
    assert.deepEqual(cases.map((entry) => entry.id), expectedIds);
    assert.equal(new Set(cases.map((entry) => entry.id)).size, expectedIds.length);
    for (const entry of cases) {
        await access(join(PACKAGE_ROOT, "fixtures", entry.fixture));
        assert.match(entry.mode, /evaluation|automated-signal/u);
        assert.ok(entry.section.length > 1);
        assert.ok(entry.prompt.length > 40);
        assert.match(entry.expected_finding, /^(?:FAIL|NOT_VERIFIED)/u);
    }
});
test("every automated evaluation executes its analyzer against a temporary fixture copy", async (t) => {
    const cases = JSON.parse(await readFile(join(PACKAGE_ROOT, "evals", "cases.json"), "utf8"));
    const automated = cases.filter((entry) => entry.mode.startsWith("automated-signal"));
    assert.equal(automated.length, 26);
    for (const entry of automated) {
        await t.test(entry.id, async () => {
            assert.ok(entry.expected_finding_id, `${entry.id} must declare a stable finding ID`);
            await withTemporaryProject(`eval-${entry.id}`, async (temporary) => {
                const root = join(temporary, "project");
                await copyFixture(join(PACKAGE_ROOT, "fixtures", entry.fixture), root);
                const runs = await runAnalyzers(entry.section, root);
                const finding = runs
                    .flatMap((run) => run.findings)
                    .find((candidate) => candidate.id === entry.expected_finding_id);
                assert.ok(finding, `${entry.id} should emit ${entry.expected_finding_id}`);
                assert.equal(finding.id, entry.expected_finding_id);
                assert.equal(finding.section, entry.section);
                assert.equal(finding.status, "FAIL");
                assert.ok(["CRITICAL", "HIGH", "MEDIUM"].includes(finding.severity));
                assert.ok(finding.location.length > 0);
                assert.ok(finding.location.every((location) => location.path.length > 0));
                assert.ok(finding.evidence.length > 0);
                assert.ok(finding.evidence.every((evidence) => evidence.includes(":")));
                assert.ok(finding.recommendation.length > 20);
                assert.ok(finding.verification.length > 0);
                assert.ok(finding.analyzer_id);
                assert.ok(finding.trace && finding.trace.length > 0);
            });
        });
    }
});
