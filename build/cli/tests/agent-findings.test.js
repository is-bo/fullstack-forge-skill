import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { bindAgentFindings, reconcileFindings } from "../src/agent-findings.js";
import { runFile, sha256, workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
test("agent source findings bind to exact clean and dirty content revisions", async () => {
    await withTemporaryProject("agent-binding-exact", async (root) => {
        const source = "export const clinicId = session.user.clinicId;\n";
        await initializeGit(root, source);
        const cleanRevision = await workingTreeRevision(root);
        const exact = await bindAgentFindings(root, [finding(cleanRevision, source)]);
        assert.equal(exact[0]?.binding_state, "EXACT");
        const dirtySource = `${source}export const pending = true;\n`;
        await writeFile(join(root, "route.ts"), dirtySource, "utf8");
        const dirtyRevision = await workingTreeRevision(root);
        const dirty = await bindAgentFindings(root, [finding(dirtyRevision, dirtySource)]);
        assert.equal(dirty[0]?.binding_state, "EXACT_DIRTY");
    });
});
test("ancestor findings rebase only when cited content is unchanged", async () => {
    await withTemporaryProject("agent-binding-ancestor", async (root) => {
        const source = "export const clinicId = session.user.clinicId;\n";
        const ancestor = await initializeGit(root, source);
        await writeFile(join(root, "other.ts"), "export const other = true;\n", "utf8");
        await git(root, ["add", "other.ts"]);
        await git(root, ["commit", "-m", "add unrelated file"]);
        const rebased = await bindAgentFindings(root, [finding(ancestor, source)]);
        assert.equal(rebased[0]?.binding_state, "REBASED");
        await writeFile(join(root, "route.ts"), "export const clinicId = request.body.clinicId;\n", "utf8");
        await git(root, ["add", "route.ts"]);
        await git(root, ["commit", "-m", "change cited file"]);
        const stale = await bindAgentFindings(root, [finding(ancestor, source)]);
        const staleFinding = stale[0];
        assert.ok(staleFinding);
        assert.equal(staleFinding.binding_state, "STALE");
        assert.equal(staleFinding.status, "NOT_VERIFIED");
    });
});
test("invalid revisions and mismatched exact snapshots are rejected", async () => {
    await withTemporaryProject("agent-binding-invalid", async (root) => {
        const source = "export const clinicId = session.user.clinicId;\n";
        await initializeGit(root, source);
        await assert.rejects(bindAgentFindings(root, [finding("not-a-revision", source)]), /malformed Git revision/u);
        await assert.rejects(bindAgentFindings(root, [finding("f".repeat(40), source)]), /nonexistent Git revision/u);
        const current = await workingTreeRevision(root);
        const mismatched = finding(current, source);
        mismatched.evidence_snapshot = [
            { path: "route.ts", line: 1, sha256: "0".repeat(64), excerpt_hash: "0".repeat(64) }
        ];
        await assert.rejects(bindAgentFindings(root, [mismatched]), /snapshot hash mismatch/u);
    });
});
test("non-Git findings bind to the exact content revision", async () => {
    await withTemporaryProject("agent-binding-tree", async (root) => {
        const source = "export const clinicId = session.user.clinicId;\n";
        await writeFile(join(root, "route.ts"), source, "utf8");
        const revision = await workingTreeRevision(root);
        const bound = await bindAgentFindings(root, [finding(revision, source)]);
        assert.equal(bound[0]?.binding_state, "EXACT");
    });
});
test("strong bound evidence supersedes contradictory applicability and stays historical", () => {
    const applicability = {
        ...finding("tree:fixture", "export const value = true;\n"),
        id: "FF-TENANCY-001",
        instance_id: "FF-TENANCY-001:11111111",
        status: "NOT_APPLICABLE",
        producer: "forge-analyzer"
    };
    const direct = {
        ...finding("tree:fixture", "export const value = true;\n"),
        binding_state: "EXACT"
    };
    const reconciled = reconcileFindings([applicability], [direct]);
    const historical = reconciled.find((item) => item.id === "FF-TENANCY-001");
    const active = reconciled.find((item) => item.id === "FF-TENANT-900");
    assert.ok(historical);
    assert.ok(active);
    assert.equal(historical.status, "SUPERSEDED");
    assert.equal(historical.superseded_by, active.instance_id);
    assert.deepEqual(active.supersedes, [historical.instance_id]);
});
function finding(revision, source) {
    return {
        id: "FF-TENANT-900",
        instance_id: "FF-TENANT-900:abcdef12",
        section: "tenancy",
        module: "tenancy",
        title: "Tenant scope is missing",
        severity: "HIGH",
        confidence: "HIGH",
        status: "FAIL",
        producer: "agent-reviewed-source",
        evidence_type: "source-review",
        location: [{ path: "route.ts", line: 1 }],
        evidence: ["Direct source review found a tenant boundary."],
        explanation: "The cited query crosses tenant scope.",
        impact: "Records may cross tenant boundaries.",
        recommendation: "Bind the query to authenticated tenant context.",
        safe_fix: false,
        safe_fix_classification: "approval-required",
        verification: ["Run a two-tenant negative test."],
        standards: ["OWASP Multi Tenant Security Cheat Sheet"],
        revision,
        commands_executed: [],
        remaining_limitations: [],
        evidence_snapshot: [
            {
                path: "route.ts",
                line: 1,
                sha256: sha256(source),
                excerpt_hash: sha256(source.split(/\r?\n/u)[0] ?? "")
            }
        ]
    };
}
async function initializeGit(root, source) {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "route.ts"), source, "utf8");
    await git(root, ["init"]);
    await git(root, ["config", "user.email", "forge@example.test"]);
    await git(root, ["config", "user.name", "Forge Tests"]);
    await git(root, ["add", "route.ts"]);
    await git(root, ["commit", "-m", "initial"]);
    return (await git(root, ["rev-parse", "HEAD"])).trim();
}
async function git(root, args) {
    const result = await runFile("git", args, root, 10_000);
    assert.equal(result.exitCode, 0, result.stderr);
    return result.stdout;
}
//# sourceMappingURL=agent-findings.test.js.map