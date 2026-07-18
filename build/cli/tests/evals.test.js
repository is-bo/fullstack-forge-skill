import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
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
    "missing-webhook-idempotency"
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
//# sourceMappingURL=evals.test.js.map