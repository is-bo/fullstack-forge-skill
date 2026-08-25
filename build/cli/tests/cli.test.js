import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT, VERSION } from "../src/constants.js";
import { discoverProject } from "../src/discovery.js";
import { createReport, writeReport } from "../src/report.js";
import { runFile, sha256, workingTreeRevision } from "../src/utils.js";
import { copyFixture, withTemporaryProject } from "./helpers.js";
const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
test("compiled CLI exposes version, list, and blocked command execution", async () => {
    const version = await runFile(process.execPath, [cli, "--version"], PACKAGE_ROOT);
    assert.equal(version.exitCode, 0);
    assert.equal(version.stdout.trim(), VERSION);
    const list = await runFile(process.execPath, [cli, "list", "--json"], PACKAGE_ROOT);
    assert.equal(list.exitCode, 0);
    const parsed = JSON.parse(list.stdout);
    assert.equal(parsed.modules.length, 42);
    assert.equal(parsed.tools.length, 27);
    assert.deepEqual(parsed.tool_availability.source_checkout_only, [
        "sync-platform-assets",
        "check-platform-assets",
        "package-platforms",
        "smoke-install"
    ]);
    assert.equal(parsed.tool_availability.installed_runtime.includes("validate-skill"), true);
});
test("compiled CLI ingests validated agent findings into both official report formats", async () => {
    await withTemporaryProject("agent-findings", async (root) => {
        await mkdir(join(root, ".forge"), { recursive: true });
        await mkdir(join(root, "src"), { recursive: true });
        const source = "export const reset = true;\n";
        await writeFile(join(root, "src", "auth.ts"), source, "utf8");
        const revision = await workingTreeRevision(root);
        const input = join(root, ".forge", "agent-findings.json");
        await writeFile(input, JSON.stringify([
            {
                id: "FF-AUTH-900",
                section: "auth",
                module: "auth",
                title: "Reset tokens remain reusable",
                severity: "HIGH",
                confidence: "HIGH",
                status: "FAIL",
                producer: "agent-reviewed-source",
                evidence_type: "source-review",
                location: [{ path: "src/auth.ts", line: 1 }],
                evidence: ["The reviewed reset path has no one-time-use transition."],
                explanation: "The reset path accepts the same token more than once.",
                impact: "A captured token can reset the account repeatedly.",
                recommendation: "Atomically consume the reset token on first use.",
                safe_fix: false,
                safe_fix_classification: "approval-required",
                verification: ["Replay one token twice and require the second request to fail."],
                revision,
                evidence_snapshot: [
                    {
                        path: "src/auth.ts",
                        line: 1,
                        sha256: sha256(source),
                        excerpt_hash: sha256("export const reset = true;")
                    }
                ],
                commands_executed: [{ command: "node --test auth", exit_code: 1 }],
                remaining_limitations: ["No production mail-provider evidence was available."],
                standards: ["OWASP ASVS 5.0"]
            }
        ]), "utf8");
        const result = await runFile(process.execPath, [
            cli,
            "tool",
            "ingest-agent-findings",
            ".forge/agent-findings.json",
            "--root",
            root,
            "--json"
        ], root);
        assert.equal(result.exitCode, 1, result.stderr);
        const report = JSON.parse(await readFile(join(root, ".forge", "report.json"), "utf8"));
        const [finding] = report.findings;
        assert.ok(finding);
        assert.equal(finding.producer, "agent-reviewed-source");
        assert.match(finding.explanation, /accepts the same token/u);
        const markdown = await readFile(join(root, ".forge", "report.md"), "utf8");
        assert.match(markdown, /agent-reviewed-source/u);
        assert.match(markdown, /No production mail-provider evidence was available/u);
    });
});
test("compiled CLI performs discovery and writes evidence artifacts", async () => {
    await withTemporaryProject("cli", async (root) => {
        const result = await runFile(process.execPath, [cli, "discover", "audit", "--root", root, "--json"], root);
        assert.equal(result.exitCode, 0, result.stderr);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.profile.root, root);
        assert.equal(parsed.report_paths.length, 2);
    });
});
test("a real module invocation resolves and records composed specialist context", async () => {
    await withTemporaryProject("cli-composition", async (root) => {
        await writeFile(join(root, "package.json"), JSON.stringify({
            name: "composition-fixture",
            private: true,
            dependencies: { next: "16.0.0", react: "19.0.0", "@sentry/nextjs": "10.0.0" }
        }), "utf8");
        const result = await runFile(process.execPath, [cli, "observability", "audit", "--request", "sentry-nextjs", "--root", root, "--json"], root);
        assert.ok([0, 2].includes(result.exitCode), result.stderr);
        const parsed = JSON.parse(result.stdout);
        const [composition] = parsed.report.compositions;
        assert.ok(composition);
        assert.equal(composition.module, "observability");
        assert.equal(composition.selected[0]?.tier, "forge-contract");
        assert.ok(composition.selected.some((source) => source.skill === "sentry-nextjs-sdk"));
        assert.ok(composition.suppressed.every((source) => source.reason.length > 0));
        const artifact = JSON.parse(await readFile(parsed.composition_artifact, "utf8"));
        assert.equal(artifact.compositions[0]?.module, "observability");
    });
});
test("compose is a first-class module entry and the archive-equivalent runner uses the same resolver", async () => {
    await withTemporaryProject("cli-compose-entry", async (root) => {
        await writeFile(join(root, "package.json"), JSON.stringify({
            name: "composition-entry-fixture",
            private: true,
            dependencies: { react: "19.0.0", "@sentry/react": "10.0.0" }
        }), "utf8");
        const args = [
            "observability",
            "compose",
            "--request",
            "sentry-react",
            "--root",
            root,
            "--json"
        ];
        const result = await runFile(process.execPath, [cli, ...args], root);
        assert.equal(result.exitCode, 0, result.stderr);
        const parsed = JSON.parse(result.stdout);
        const [composition] = parsed.compositions;
        assert.ok(composition);
        assert.equal(composition.selected[0]?.tier, "forge-contract");
        assert.equal(composition.selected[0].runtimePath, ".fullstack-forge/skills/fullstack-forge/references/build/observability.md");
        assert.ok(composition.selected.some((source) => source.skill === "sentry-react-sdk"));
        assert.ok(composition.suppressed.every((source) => source.reason.length > 0));
        assert.deepEqual(composition.missing, []);
        const artifact = JSON.parse(await readFile(parsed.composition_artifact, "utf8"));
        assert.equal(artifact.compositions[0]?.module, "observability");
        const standalone = join(PACKAGE_ROOT, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js");
        const archiveEquivalent = await runFile(process.execPath, [standalone, ...args], root);
        assert.equal(archiveEquivalent.exitCode, 0, archiveEquivalent.stderr);
        const archiveParsed = JSON.parse(archiveEquivalent.stdout);
        assert.deepEqual(archiveParsed.compositions, parsed.compositions);
    });
});
test("composition loads only direct dependencies reachable through observed applicability", async () => {
    await withTemporaryProject("cli-compose-applicable-dependencies", async (root) => {
        await writeFile(join(root, "package.json"), JSON.stringify({
            name: "frontend-dependency-fixture",
            private: true,
            dependencies: { react: "19.0.0" }
        }), "utf8");
        await writeFile(join(root, "App.tsx"), "export function App() { return <main><button>Save</button></main>; }\n", "utf8");
        const result = await runFile(process.execPath, [cli, "frontend", "compose", "--root", root, "--dry-run", "--json"], root);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.ok(result.stdout.length < 32_000, `bounded composition output unexpectedly grew to ${result.stdout.length} bytes`);
        const parsed = JSON.parse(result.stdout);
        const selected = new Set(parsed.compositions.map((composition) => composition.module));
        for (const expected of ["frontend", "ui", "ux", "accessibility", "performance", "testing"])
            assert.ok(selected.has(expected), `expected applicable ${expected} dependency`);
        for (const excluded of ["database", "auth", "payments", "ship"])
            assert.equal(selected.has(excluded), false, `did not expect unrelated ${excluded} context`);
        assert.equal(parsed.module_decisions.some((decision) => decision.module === "database"), false, "compact dependency provenance must not emit unrelated transitive decisions");
        assert.ok(parsed.dependency_edges.some((edge) => edge.parent === "frontend"));
        assert.ok(parsed.dependency_edges.every((edge) => edge.parent === "frontend"));
        assert.equal(parsed.composition_artifact, undefined);
    });
});
test("explicit greenfield frontend composition includes the complete experience team", async () => {
    await withTemporaryProject("cli-compose-greenfield-frontend", async (root) => {
        const args = ["frontend", "compose", "--root", root, "--dry-run", "--json"];
        const result = await runFile(process.execPath, [cli, ...args], root);
        assert.equal(result.exitCode, 0, result.stderr);
        const parsed = JSON.parse(result.stdout);
        const selected = new Map(parsed.compositions.map((composition) => [composition.module, composition]));
        for (const expected of ["frontend", "ui", "ux", "accessibility"])
            assert.ok(selected.has(expected), `expected explicit greenfield ${expected} composition`);
        assert.ok(selected
            .get("ui")
            ?.selected.some((source) => source.provider === "impeccable" && source.skill === "impeccable"), "greenfield UI composition must include Impeccable");
        for (const excluded of ["database", "auth", "payments", "ship"])
            assert.equal(selected.has(excluded), false, `did not expect unrelated ${excluded} context`);
        const standalone = join(PACKAGE_ROOT, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js");
        const archiveEquivalent = await runFile(process.execPath, [standalone, ...args], root);
        assert.equal(archiveEquivalent.exitCode, 0, archiveEquivalent.stderr);
        assert.deepEqual(JSON.parse(archiveEquivalent.stdout).compositions, parsed.compositions);
    });
});
test("the production runner accepts proven task conditions and rejects invented ones", async () => {
    await withTemporaryProject("cli-compose-task-condition", async (root) => {
        const standalone = join(PACKAGE_ROOT, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js");
        const args = [
            "recovery",
            "compose",
            "--condition",
            "incidentInvestigation",
            "--risk-surface",
            "api",
            "--root",
            root,
            "--json"
        ];
        const result = await runFile(process.execPath, [cli, ...args], root);
        assert.equal(result.exitCode, 0, result.stderr);
        const compositions = JSON.parse(result.stdout).compositions;
        assert.ok(compositions[0]?.selected.some((source) => source.skill === "debugging-and-error-recovery" &&
            source.reason.includes("incidentInvestigation")));
        assert.deepEqual(compositions[0]?.missing, []);
        const archiveEquivalent = await runFile(process.execPath, [standalone, ...args], root);
        assert.equal(archiveEquivalent.exitCode, 0, archiveEquivalent.stderr);
        const archiveParsed = JSON.parse(archiveEquivalent.stdout);
        assert.deepEqual(archiveParsed.compositions, compositions);
        const invalid = await runFile(process.execPath, [standalone, "recovery", "compose", "--condition", "incidentMaybe", "--root", root], root);
        assert.equal(invalid.exitCode, 1);
        assert.match(invalid.stderr, /Unknown composition condition 'incidentMaybe'/u);
    });
});
test("unsupported language audit reports a precise NOT_VERIFIED adapter boundary", async () => {
    await withTemporaryProject("cli-unsupported", async (root) => {
        await writeFile(join(root, "app.py"), "print('hello')\n", "utf8");
        const result = await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);
        assert.equal(result.exitCode, 2, result.stderr);
        const findings = JSON.parse(result.stdout).report.findings;
        const [finding] = findings;
        assert.ok(finding);
        assert.equal(finding.status, "NOT_VERIFIED");
        assert.ok(finding.evidence.some((item) => item.includes("Python")));
        assert.ok(finding.evidence.some((item) => item.includes("required_adapter=python-security-boundaries")));
    });
});
test("compiled CLI accepts the documented --ai installer form", async () => {
    await withTemporaryProject("cli-ai", async (root) => {
        const result = await runFile(process.execPath, [cli, "init", "--ai", "generic", "--root", root, "--dry-run", "--json"], root);
        assert.equal(result.exitCode, 0, result.stderr);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.selector, "generic");
        assert.equal(parsed.dry_run, true);
    });
});
test("compiled CLI audits and applies all safe fixes with dry-run and idempotency", async () => {
    await withTemporaryProject("cli-safe-fix", async (root) => {
        await copyFixture(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root);
        const envPath = join(root, ".env.example");
        const original = await readFile(envPath, "utf8");
        const audit = await runFile(process.execPath, [cli, "all", "audit", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        const highOnly = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--severity", "high", "--dry-run", "--root", root, "--json"], root);
        assert.equal(highOnly.exitCode, 0, highOnly.stderr);
        assert.deepEqual(JSON.parse(highOnly.stdout).operations.map((operation) => operation.finding_id), ["FF-ENV-TEMPLATE-001"]);
        const dryRun = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--dry-run", "--root", root, "--json"], root);
        assert.equal(dryRun.exitCode, 0, dryRun.stderr);
        const planned = JSON.parse(dryRun.stdout);
        assert.equal(planned.operations.length, 3);
        assert.deepEqual(planned.changed_files, []);
        assert.equal(await readFile(envPath, "utf8"), original);
        const applied = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(applied.exitCode, 0, applied.stderr);
        const result = JSON.parse(applied.stdout);
        assert.deepEqual(result.changed_files, [".env.example", "Link.tsx", "vercel.json"]);
        assert.match(await readFile(envPath, "utf8"), /<REPLACE_WITH_SECRET>/u);
        const repeated = await runFile(process.execPath, [cli, "all", "fix", "--safe", "--root", root, "--json"], root);
        assert.equal(repeated.exitCode, 0, repeated.stderr);
        assert.deepEqual(JSON.parse(repeated.stdout).changed_files, []);
    });
});
test("project command execution rejects unknown names and blocks unapproved definitions", async () => {
    await withTemporaryProject("cli-command", async (root) => {
        await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }), "utf8");
        const unknown = await runFile(process.execPath, [cli, "tool", "run-project-command", "missing", "--root", root, "--json"], root);
        assert.equal(unknown.exitCode, 1);
        assert.match(unknown.stderr, /not a detected project command/u);
        const blocked = await runFile(process.execPath, [cli, "tool", "run-project-command", "check", "--root", root, "--json"], root);
        assert.equal(blocked.exitCode, 2);
        assert.equal(JSON.parse(blocked.stdout).status, "BLOCKED");
        const allowed = await runFile(process.execPath, [cli, "tool", "run-project-command", "check", "--allow-run", "--root", root, "--json"], root);
        assert.equal(allowed.exitCode, 0, allowed.stderr);
    });
});
test("high-risk all audit and verify route through applicable focused modules", async () => {
    await withTemporaryProject("cli-verify-all", async (root) => {
        await writeFile(join(root, "app.ts"), "export const ready = true;\n", "utf8");
        // A declared frontend makes the ui capability genuinely PRESENT, so the assertions below
        // isolate risk exclusion instead of accidentally testing a capability that does not exist.
        await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "risk-fixture", private: true, dependencies: { react: "19.0.0" } }, null, 2)}\n`, "utf8");
        const audit = await runFile(process.execPath, [cli, "all", "audit", "--risk", "high", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 2, "selected high-risk modules with remaining NOT_VERIFIED evidence must keep Audit incomplete");
        const audited = JSON.parse(audit.stdout);
        assert.ok(audited.report.findings.some((finding) => finding.section === "security"));
        // A risk filter narrows what is audited; it never proves anything about what it skipped.
        // The ui module must therefore still appear, recorded as excluded by risk and unverified,
        // rather than disappearing from the report as though it had been considered and cleared.
        const [uiFinding, ...extraUiFindings] = audited.report.findings.filter((finding) => finding.section === "ui");
        assert.ok(uiFinding, "a risk-excluded module must still be accounted for");
        assert.equal(extraUiFindings.length, 0);
        assert.equal(uiFinding.status, "NOT_VERIFIED");
        const uiDecision = audited.report.module_decisions.find((decision) => decision.module === "ui");
        assert.ok(uiDecision);
        assert.equal(uiDecision.selection_status, "EXCLUDED_BY_RISK");
        assert.notEqual(uiDecision.capability_status, "ABSENT", "excluding a module by risk must not be recorded as the capability being absent");
        const verify = await runFile(process.execPath, [cli, "all", "verify", "--risk", "high", "--root", root, "--json"], root);
        assert.equal(verify.exitCode, 2, "risk-excluded NOT_VERIFIED evidence must keep Verify incomplete");
        const verified = JSON.parse(verify.stdout);
        assert.ok(verified.report.findings.some((finding) => finding.section === "testing"));
        assert.ok(verified.report.findings.some((finding) => finding.section === "ui" && finding.status === "NOT_VERIFIED"));
        assert.ok(!verified.report.findings.some((finding) => finding.section === "all"));
    });
});
test("section Verify exit status ignores unrelated carried findings while all remains global", async () => {
    await withTemporaryProject("cli-verify-section-exit", async (root) => {
        await writeFile(join(root, "app.ts"), "export const ready = true;\n", "utf8");
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const finding = (section, status) => ({
            id: `FF-${section.toUpperCase()}-EXIT-001`,
            section,
            title: `${section} verification fixture`,
            severity: status === "FAIL" ? "HIGH" : "INFO",
            confidence: "HIGH",
            status,
            location: [{ path: "app.ts", line: 1 }],
            evidence: [`${section} fixture evidence.`],
            impact: `${section} fixture impact.`,
            recommendation: `Review the ${section} fixture.`,
            safe_fix: false,
            verification: [`Verify the ${section} fixture.`],
            standards: ["Fullstack Forge verification scope"]
        });
        await writeReport(createReport(root, profile, [finding("security", "PASS"), finding("payments", "FAIL")], "mixed fixture", [], [], [], undefined, [], [], revision));
        const scoped = await runFile(process.execPath, [cli, "security", "verify", "--root", root, "--json"], root);
        assert.equal(scoped.exitCode, 0, scoped.stderr);
        const scopedFindings = JSON.parse(scoped.stdout).report.findings;
        assert.ok(scopedFindings.some((candidate) => candidate.section === "payments" && candidate.status === "FAIL"), "section Verify must preserve unrelated history without letting it determine the exit code");
        const global = await runFile(process.execPath, [cli, "all", "verify", "--root", root, "--json"], root);
        assert.equal(global.exitCode, 2, "unscoped Verify must still reflect the whole carried report");
    });
});
test("ship remains blocked without a prior audit and detected release gates", async () => {
    await withTemporaryProject("cli-ship", async (root) => {
        const result = await runFile(process.execPath, [cli, "ship", "--allow-run", "--root", root, "--json"], root);
        assert.equal(result.exitCode, 2, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.findings[0]?.status, "BLOCKED");
    });
});
test("ship report preserves the prior audit findings", async () => {
    await withTemporaryProject("cli-ship-preserve", async (root) => {
        await writeFile(join(root, "app.py"), "print('hello')\n", "utf8");
        const audit = await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);
        assert.equal(audit.exitCode, 2, audit.stderr);
        const priorIds = JSON.parse(audit.stdout).report.findings.map((finding) => finding.id);
        const ship = await runFile(process.execPath, [cli, "ship", "--root", root, "--json"], root);
        assert.equal(ship.exitCode, 2, ship.stderr);
        const ids = JSON.parse(ship.stdout).findings.map((finding) => finding.id);
        for (const id of priorIds)
            assert.ok(ids.includes(id), `missing prior finding ${id}`);
        assert.ok(ids.includes("FF-SHIP-001"));
    });
});
