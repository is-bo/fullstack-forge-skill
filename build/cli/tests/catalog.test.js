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
const EXPECTED_CRITERIA_COUNTS = {
    discover: 34,
    requirements: 19,
    architecture: 19,
    code: 22,
    ui: 34,
    ux: 35,
    accessibility: 28,
    i18n: 22,
    seo: 19,
    frontend: 28,
    api: 27,
    jobs: 19,
    integrations: 19,
    auth: 25,
    authorization: 21,
    security: 42,
    privacy: 23,
    tenancy: 20,
    uploads: 80,
    database: 23,
    queries: 23,
    cache: 24,
    storage: 16,
    testing: 25,
    performance: 22,
    scale: 19,
    observability: 18,
    reliability: 19,
    recovery: 17,
    deployment: 18,
    infrastructure: 18,
    "supply-chain": 18,
    cost: 18,
    docs: 18,
    analytics: 16,
    notifications: 16,
    ai: 32,
    payments: 19,
    realtime: 15,
    offline: 18,
    all: 10,
    ship: 12
};
const CRITERIA_SENTINELS = {
    discover: ["Critical workflows", "Confidence and file evidence for every detected technology"],
    requirements: ["Requirement-to-test traceability", "Irreversible actions"],
    architecture: ["Premature microservices", "Underengineering and overengineering"],
    code: ["Unhandled promises", "Generated-code boundaries"],
    ui: ["Browser-console errors", "Product-specific visual direction with rationale"],
    ux: [
        "Back-button behavior",
        "Input preservation across validation, timeout, and session renewal"
    ],
    accessibility: ["WCAG 2.2 AA scope", "Screen-reader navigation"],
    i18n: ["Mixed LTR and RTL content", "Arabic, French, and English compatibility"],
    seo: ["Conditional applicability for public web pages", "Structured data"],
    frontend: ["Data-fetching waterfalls", "Progressive reference selection"],
    api: ["GraphQL complexity", "Request-size limits"],
    jobs: ["Poison messages", "Safe deployment while jobs run"],
    integrations: ["Replay prevention", "Out-of-order events"],
    auth: ["Session fixation", "Refresh-token rotation"],
    authorization: ["Staff impersonation", "Negative tests for unauthorized reads and writes"],
    security: ["Request smuggling risks", "Prototype pollution", "ReDoS"],
    privacy: ["Children's data", "Whether data should be collected or retained at all"],
    tenancy: ["Cache-key isolation", "Active negative tests for cross-tenant access"],
    uploads: ["Magic-byte validation", "PDF JavaScript", "Many-small-files attacks"],
    database: ["Large-table evolution", "Rollback implications"],
    queries: [
        "N+1 queries",
        "Safe EXPLAIN (ANALYZE, BUFFERS) only on development or staging databases"
    ],
    cache: [
        "Stampede protection",
        "An explicit conclusion that Redis is unnecessary when evidence supports it"
    ],
    storage: ["Orphaned objects", "Environment isolation"],
    testing: ["Malware-pipeline tests", "Risk-based adequacy rather than line coverage alone"],
    performance: ["INP", "Slow-device behavior"],
    scale: ["Hot tenants", "No microservices, Kubernetes, queues, or Redis without evidence"],
    observability: ["Correlation IDs", "OpenTelemetry-compatible concepts where practical"],
    reliability: ["Retry storms", "User-visible failure behavior"],
    recovery: [
        "Geographic failure",
        "NOT_VERIFIED rather than PASS when restoration lacks direct evidence"
    ],
    deployment: ["Database migration ordering", "Post-deployment verification"],
    infrastructure: ["Public admin services", "Production and debug differences"],
    "supply-chain": ["Unexpected install scripts", "Compromised transitive dependencies"],
    cost: ["Per-tenant cost", "Waste caused by retries"],
    docs: ["Backup restoration", "Decisions existing only in chat or undocumented knowledge"],
    analytics: ["Anonymous and authenticated identity merging", "Event validation"],
    notifications: ["Notification fatigue", "Failed delivery"],
    ai: ["Indirect prompt injection", "Retrieval poisoning", "Original file hash and review history"],
    payments: ["Chargeback handling", "Webhook ordering"],
    realtime: ["Tenant-separated channels", "Authentication refresh"],
    offline: ["Clock manipulation", "Offline authorization assumptions"],
    all: ["Avoid irrelevant modules", "Clearly mark blocked and not-verified checks"],
    ship: [
        "Required high-risk NOT_VERIFIED checks block release",
        "Remote CI, release, and production state require separate direct verification"
    ]
};
test("module and tool catalogs are exact and unique", () => {
    assert.deepEqual(MODULE_SLUGS, EXPECTED);
    assert.equal(new Set(MODULE_SLUGS).size, 42);
    assert.equal(new Set(TOOL_NAMES).size, 27);
    assert.equal(new Set(PLATFORMS).size, 7);
});
test("canonical catalog and generated command directories match", async () => {
    const catalog = JSON.parse(await readFile(join(PACKAGE_ROOT, "config", "modules.json"), "utf8"));
    assert.deepEqual(catalog.map((entry) => entry.slug), [...EXPECTED]);
    const entries = await readdir(join(PACKAGE_ROOT, "src", "fullstack-forge", "commands"), {
        withFileTypes: true
    });
    // The 42 audit command directories are a strict closed set. The product router and Build mode add
    // three workflow command directories that are validated independently from the audit catalog.
    const EXPECTED_WORKFLOW_COMMANDS = ["forge", "forge-new", "forge-feature"];
    const directoryNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const auditDirectories = EXPECTED.map((slug) => `forge-${slug}`).sort();
    assert.deepEqual(directoryNames.filter((name) => !EXPECTED_WORKFLOW_COMMANDS.includes(name)), auditDirectories);
    const unexpected = directoryNames.filter((name) => !auditDirectories.includes(name) && !EXPECTED_WORKFLOW_COMMANDS.includes(name));
    assert.deepEqual(unexpected, [], `unexpected command directories: ${unexpected.join(", ")}`);
});
test("explicit inspection criteria cover every module and render into canonical skills", async () => {
    const criteria = JSON.parse(await readFile(join(PACKAGE_ROOT, "config", "module-criteria.json"), "utf8"));
    assert.deepEqual(Object.keys(criteria), [...EXPECTED]);
    let totalCriteria = 0;
    for (const slug of EXPECTED) {
        const moduleCriteria = criteria[slug];
        assert.ok(moduleCriteria, `${slug}: missing criteria`);
        assert.equal(moduleCriteria.length, EXPECTED_CRITERIA_COUNTS[slug], slug);
        totalCriteria += moduleCriteria.length;
        assert.ok(moduleCriteria.every((criterion) => criterion === criterion.trim() && !/[\r\n]/u.test(criterion)), `${slug}: criteria must be normalized single lines`);
        assert.equal(new Set(moduleCriteria).size, moduleCriteria.length, `${slug} duplicates`);
        for (const sentinel of CRITERIA_SENTINELS[slug])
            assert.ok(moduleCriteria.includes(sentinel), `${slug}: ${sentinel}`);
        const content = await readFile(join(PACKAGE_ROOT, "src", "fullstack-forge", "commands", `forge-${slug}`, "SKILL.md"), "utf8");
        assert.match(content, /## Missing-control checks/u, slug);
        for (const criterion of moduleCriteria)
            assert.ok(content.includes(`- ${criterion}`), `${slug}: missing ${criterion}`);
        const toolReferences = [
            ...content.matchAll(/^- Use `([a-z0-9-]+)` for its bounded evidence/gmu)
        ];
        for (const match of toolReferences)
            assert.ok(TOOL_NAMES.includes(match[1]), `${slug}: unknown tool ${match[1]}`);
    }
    assert.equal(totalCriteria, 970);
});
test("all bundled skills satisfy the structural validator", async () => {
    const result = await validateBundledSkills();
    assert.deepEqual(result.errors, []);
    assert.equal(result.skills, 46);
});
