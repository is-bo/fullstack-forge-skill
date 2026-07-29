import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { copyFixture, withTemporaryProject } from "./helpers.js";
const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
test("all safe fixes support dry-run, real writes, complete reporting, and idempotency", async () => {
    await withTemporaryProject("safe-fixes", async (temporary) => {
        const root = join(temporary, "project");
        await copyFixture(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root);
        const audit = await runFile(process.execPath, [cli, "all", "audit", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        const envPath = join(root, ".env.example");
        const linkPath = join(root, "Link.tsx");
        const vercelPath = join(root, "vercel.json");
        const before = await Promise.all([envPath, linkPath, vercelPath].map((path) => readFile(path, "utf8")));
        const dryRun = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--dry-run", "--root", root, "--json"], root);
        assert.equal(dryRun.exitCode, 0, dryRun.stderr);
        const dryResult = JSON.parse(dryRun.stdout);
        assert.deepEqual(dryResult.operations.map((operation) => operation.path).sort(), [
            ".env.example",
            "Link.tsx",
            "vercel.json"
        ]);
        assert.deepEqual(dryResult.changed_files, []);
        assert.deepEqual(await Promise.all([envPath, linkPath, vercelPath].map((path) => readFile(path, "utf8"))), before);
        const applied = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(applied.exitCode, 0, applied.stderr);
        const result = JSON.parse(applied.stdout);
        assert.equal(result.status, "PASS");
        assert.deepEqual(result.changed_files, [".env.example", "Link.tsx", "vercel.json"]);
        assert.equal(result.operations.length, 3);
        assert.ok(result.operations.every((operation) => operation.fix_id.startsWith("FF-FIX-")));
        assert.ok(result.operations.every((operation) => operation.rollback.length > 20));
        assert.match(await readFile(envPath, "utf8"), /PAYMENT_API_KEY=<REPLACE_WITH_SECRET>/u);
        assert.match(await readFile(linkPath, "utf8"), /rel="noopener noreferrer"/u);
        assert.match(await readFile(vercelPath, "utf8"), /"X-Content-Type-Options"/u);
        const repeated = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(repeated.exitCode, 0, repeated.stderr);
        const repeatedResult = JSON.parse(repeated.stdout);
        assert.deepEqual(repeatedResult.operations, []);
        assert.deepEqual(repeatedResult.changed_files, []);
    });
});
test("safe fix refuses a file whose post-audit hash changed", async () => {
    await withTemporaryProject("stale-fix", async (temporary) => {
        const root = join(temporary, "project");
        await copyFixture(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root);
        const audit = await runFile(process.execPath, [cli, "frontend", "audit", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        const path = join(root, "Link.tsx");
        const changed = `${await readFile(path, "utf8")}\n// user change after audit\n`;
        await writeFile(path, changed, "utf8");
        const fix = await runFile(process.execPath, [cli, "frontend", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(fix.exitCode, 2, fix.stderr);
        const result = JSON.parse(fix.stdout);
        assert.equal(result.status, "BLOCKED");
        assert.ok(result.blocked_findings.some((finding) => finding.reason.includes("changed after audit")));
        assert.equal(await readFile(path, "utf8"), changed);
    });
});
test("risky authorization finding remains blocked in safe fix mode", async () => {
    await withTemporaryProject("risky-fix", async (temporary) => {
        const root = join(temporary, "project");
        await copyFixture(join(PACKAGE_ROOT, "fixtures", "risky-fixes"), root);
        const audit = await runFile(process.execPath, [cli, "authorization", "audit", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        const before = await readFile(join(root, "routes.js"), "utf8");
        const fix = await runFile(process.execPath, [cli, "authorization", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(fix.exitCode, 2, fix.stderr);
        const result = JSON.parse(fix.stdout);
        assert.equal(result.status, "BLOCKED");
        assert.ok(result.blocked_findings.some((finding) => finding.finding_id === "FF-AUTHZ-OBJECT-001"));
        assert.equal(await readFile(join(root, "routes.js"), "utf8"), before);
    });
});
test("authorized project regression tests are recorded and failures roll fixes back", async (t) => {
    for (const [name, exitCode] of [
        ["pass", 0],
        ["fail", 7]
    ]) {
        await t.test(name, async () => {
            await withTemporaryProject(`fix-regression-${name}`, async (temporary) => {
                const root = join(temporary, "project");
                await copyFixture(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root);
                await writeFile(join(root, "package.json"), `${JSON.stringify({
                    name: "safe-fixes",
                    private: true,
                    dependencies: { react: "0.0.0-fixture" },
                    scripts: { test: `node -e "process.exit(${exitCode})"` }
                }, null, 2)}\n`, "utf8");
                const audit = await runFile(process.execPath, [cli, "all", "audit", "--root", root, "--json"], root);
                assert.equal(audit.exitCode, 1, audit.stderr);
                const linkPath = join(root, "Link.tsx");
                const before = await readFile(linkPath, "utf8");
                const fix = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--allow-run", "--root", root, "--json"], root, 120_000);
                assert.equal(fix.exitCode, exitCode === 0 ? 0 : 1, fix.stderr);
                const result = JSON.parse(fix.stdout);
                const [execution] = result.execution;
                assert.ok(execution);
                assert.equal(execution.exitCode, exitCode);
                assert.ok(execution.duration_ms >= 0);
                if (exitCode === 0) {
                    assert.equal(result.status, "PASS");
                    assert.match(await readFile(linkPath, "utf8"), /noopener noreferrer/u);
                }
                else {
                    assert.equal(result.status, "FAIL");
                    assert.deepEqual(result.changed_files, []);
                    assert.equal(await readFile(linkPath, "utf8"), before);
                }
            });
        });
    }
});
test("same-rule safe fixes remain instance-specific within one file", async () => {
    await withTemporaryProject("instance-safe-fixes", async (root) => {
        await writeFile(join(root, "package.json"), JSON.stringify({
            name: "instance-safe-fixes",
            private: true,
            dependencies: { react: "0.0.0-fixture" }
        }), "utf8");
        await writeFile(join(root, "Links.tsx"), `export function Links() {
  return <>
    <a href="/same" target="_blank">same</a>
    <a href="/same" target="_blank">same</a>
  </>;
}
`, "utf8");
        const audit = await runFile(process.execPath, [cli, "frontend", "audit", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        const reportPath = join(root, ".forge", "report.json");
        const report = JSON.parse(await readFile(reportPath, "utf8"));
        const links = report.findings.filter((finding) => finding.id === "FF-FRONTEND-BLANK-001");
        assert.equal(links.length, 2);
        assert.equal(new Set(links.map((finding) => finding.instance_id)).size, 2);
        const applied = links.find((finding) => finding.location[0]?.line === 3);
        const blocked = links.find((finding) => finding.location[0]?.line === 4);
        assert.ok(blocked?.instance_id !== undefined && applied?.instance_id !== undefined);
        blocked.safe_fix = false;
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        const fix = await runFile(process.execPath, [cli, "frontend", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(fix.exitCode, 2, fix.stderr);
        const result = JSON.parse(fix.stdout);
        assert.deepEqual(result.operations.map((operation) => operation.instance_id), [applied.instance_id]);
        assert.deepEqual(result.blocked_findings.map((finding) => finding.instance_id), [blocked.instance_id]);
        const source = await readFile(join(root, "Links.tsx"), "utf8");
        assert.equal((source.match(/rel="noopener noreferrer"/gu) ?? []).length, 1);
        const after = JSON.parse(await readFile(reportPath, "utf8"));
        const blockedAfter = after.findings.find((finding) => finding.instance_id === blocked.instance_id);
        const appliedAfter = after.findings.find((finding) => finding.instance_id === applied.instance_id);
        assert.deepEqual(blockedAfter?.fix_attempts?.map((attempt) => attempt.status), ["BLOCKED"]);
        assert.deepEqual(appliedAfter?.fix_attempts?.map((attempt) => attempt.status), ["APPLIED"]);
    });
});
test("rollback evidence is attached only to the written finding instance", async () => {
    await withTemporaryProject("instance-rollback", async (root) => {
        const original = `export function Links() {
  return <>
    <a href="/one" target="_blank">one</a>
    <a href="/two" target="_blank">two</a>
  </>;
}
`;
        await writeFile(join(root, "Links.tsx"), original, "utf8");
        await writeFile(join(root, "package.json"), JSON.stringify({
            name: "instance-rollback",
            private: true,
            dependencies: { react: "0.0.0-fixture" },
            scripts: { test: 'node -e "process.exit(9)"' }
        }), "utf8");
        await runFile(process.execPath, [cli, "frontend", "audit", "--root", root, "--json"], root);
        const reportPath = join(root, ".forge", "report.json");
        const report = JSON.parse(await readFile(reportPath, "utf8"));
        const links = report.findings.filter((finding) => finding.id === "FF-FRONTEND-BLANK-001");
        assert.equal(links.length, 2);
        const untouched = links.find((finding) => finding.location[0]?.line === 3);
        const written = links.find((finding) => finding.location[0]?.line === 4);
        assert.ok(untouched !== undefined && written !== undefined);
        untouched.status = "PASS";
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        const fix = await runFile(process.execPath, [cli, "frontend", "fix", "--safe", "--allow-run", "--root", root, "--json"], root);
        assert.equal(fix.exitCode, 1);
        assert.equal(await readFile(join(root, "Links.tsx"), "utf8"), original);
        const after = JSON.parse(await readFile(reportPath, "utf8"));
        const untouchedAfter = after.findings.find((finding) => finding.instance_id === untouched.instance_id);
        const writtenAfter = after.findings.find((finding) => finding.instance_id === written.instance_id);
        assert.ok(!untouchedAfter?.evidence.some((item) => item.includes("rolled back")));
        assert.ok(writtenAfter?.evidence.some((item) => item.includes("rolled back")));
        assert.deepEqual(untouchedAfter?.fix_attempts, undefined);
        assert.deepEqual(writtenAfter?.fix_attempts?.map((attempt) => attempt.status), ["ROLLED_BACK"]);
    });
});
