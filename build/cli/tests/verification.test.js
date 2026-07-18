import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { discoverProject } from "../src/discovery.js";
import { createReport, writeReport } from "../src/report.js";
import { verifyFindings } from "../src/verification.js";
import { withTemporaryProject } from "./helpers.js";
test("finding-specific verification keeps unresolved findings failed", async () => {
    await withTemporaryProject("verify-unresolved", async (root) => {
        await writeFile(join(root, "server.ts"), sqlFixture, "utf8");
        const finding = await analyzerFinding(root, "security", "FF-SEC-SQL-001");
        const profile = await discoverProject(root);
        await writeReport(createReport(root, profile, [finding], "test audit"));
        const result = await verifyFindings(root, "security", profile, {
            allowRun: false,
            dryRun: false
        });
        const [verified] = result.report.findings;
        assert.ok(verified);
        assert.equal(verified.status, "FAIL");
        assert.ok(verified.evidence.some((item) => item.includes("reproduced")));
    });
});
test("finding-specific structural verification resolves a directly provable finding", async () => {
    await withTemporaryProject("verify-resolved", async (root) => {
        const path = join(root, "Link.tsx");
        await writeFile(path, 'export const Link = () => <a href="/docs" target="_blank">Docs</a>;\n', "utf8");
        const finding = await analyzerFinding(root, "frontend", "FF-FRONTEND-BLANK-001");
        const profile = await discoverProject(root);
        await writeReport(createReport(root, profile, [finding], "test audit"));
        await writeFile(path, (await readFile(path, "utf8")).replace('target="_blank"', 'target="_blank" rel="noopener noreferrer"'), "utf8");
        const result = await verifyFindings(root, "frontend", profile, {
            allowRun: false,
            dryRun: false
        });
        assert.equal(result.report.findings[0]?.status, "PASS");
    });
});
test("a disappeared security pattern remains NOT_VERIFIED without behavior proof", async () => {
    await withTemporaryProject("verify-disappeared", async (root) => {
        const path = join(root, "server.ts");
        await writeFile(path, sqlFixture, "utf8");
        const finding = await analyzerFinding(root, "security", "FF-SEC-SQL-001");
        const profile = await discoverProject(root);
        await writeReport(createReport(root, profile, [finding], "test audit"));
        await writeFile(path, "export const queryRemoved = true;\n", "utf8");
        const result = await verifyFindings(root, "security", profile, {
            allowRun: false,
            dryRun: false
        });
        const [verified] = result.report.findings;
        assert.ok(verified);
        assert.equal(verified.status, "NOT_VERIFIED");
        assert.ok(verified.evidence.some((item) => item.includes("disappearance alone")));
    });
});
test("verification blocks an unapproved project command", async () => {
    await withTemporaryProject("verify-blocked", async (root) => {
        await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "verify-command", private: true, scripts: { test: 'node -e "process.exit(0)"' } })}\n`, "utf8");
        const profile = await discoverProject(root);
        const finding = {
            id: "FF-TEST-VERIFY-001",
            section: "testing",
            title: "Targeted regression test requires approval",
            severity: "HIGH",
            confidence: "HIGH",
            status: "FAIL",
            location: [{ path: "package.json", line: 1 }],
            evidence: ["The original audit requires a targeted project test."],
            impact: "Behavior remains unverified.",
            recommendation: "Run the reviewed targeted test.",
            safe_fix: false,
            verification: ["Run the detected test command."],
            standards: ["Fullstack Forge evidence protocol"],
            verification_plan: {
                actions: [{ type: "project-command", command: "test", required: true }]
            }
        };
        await writeReport(createReport(root, profile, [finding], "test audit"));
        const result = await verifyFindings(root, "testing", profile, {
            allowRun: false,
            dryRun: false
        });
        assert.equal(result.report.findings[0]?.status, "BLOCKED");
    });
});
test("verification detects a regressed finding that was previously marked PASS", async () => {
    await withTemporaryProject("verify-regressed", async (root) => {
        await writeFile(join(root, "Link.tsx"), 'export const Link = () => <a href="/docs" target="_blank">Docs</a>;\n', "utf8");
        const finding = await analyzerFinding(root, "frontend", "FF-FRONTEND-BLANK-001");
        finding.status = "PASS";
        finding.evidence.push("A prior structural verification passed before this regression.");
        const profile = await discoverProject(root);
        await writeReport(createReport(root, profile, [finding], "test audit"));
        const result = await verifyFindings(root, "frontend", profile, {
            allowRun: false,
            dryRun: false
        });
        assert.equal(result.report.findings[0]?.status, "FAIL");
    });
});
const sqlFixture = `export async function handler(req) {
  return db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);
}
`;
async function analyzerFinding(root, section, id) {
    const finding = (await runAnalyzers(section, root))
        .flatMap((run) => run.findings)
        .find((candidate) => candidate.id === id);
    assert.ok(finding, `expected ${id}`);
    return finding;
}
//# sourceMappingURL=verification.test.js.map