import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { MODULE_SLUGS, PACKAGE_ROOT, PLATFORMS, TOOL_NAMES } from "../src/constants.js";
import { validateBundledSkills } from "../src/tools.js";
const EXPECTED = [
    "discover",
    "requirements",
    "architecture",
    "code",
    "ui",
    "ux",
    "accessibility",
    "i18n",
    "seo",
    "frontend",
    "api",
    "jobs",
    "integrations",
    "auth",
    "authorization",
    "security",
    "privacy",
    "tenancy",
    "uploads",
    "database",
    "queries",
    "cache",
    "storage",
    "testing",
    "performance",
    "scale",
    "observability",
    "reliability",
    "recovery",
    "deployment",
    "infrastructure",
    "supply-chain",
    "cost",
    "docs",
    "analytics",
    "notifications",
    "ai",
    "payments",
    "realtime",
    "offline",
    "all",
    "ship"
];
test("module and tool catalogs are exact and unique", () => {
    assert.deepEqual(MODULE_SLUGS, EXPECTED);
    assert.equal(new Set(MODULE_SLUGS).size, 42);
    assert.equal(new Set(TOOL_NAMES).size, 24);
    assert.equal(new Set(PLATFORMS).size, 6);
});
test("canonical catalog and generated command directories match", async () => {
    const catalog = JSON.parse(await readFile(join(PACKAGE_ROOT, "config", "modules.json"), "utf8"));
    assert.deepEqual(catalog.map((entry) => entry.slug), [...EXPECTED]);
    const entries = await readdir(join(PACKAGE_ROOT, "src", "fullstack-forge", "commands"), {
        withFileTypes: true
    });
    assert.deepEqual(entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(), EXPECTED.map((slug) => `forge-${slug}`).sort());
});
test("all bundled skills satisfy the structural validator", async () => {
    const result = await validateBundledSkills();
    assert.deepEqual(result.errors, []);
    assert.equal(result.skills, 43);
});
//# sourceMappingURL=catalog.test.js.map