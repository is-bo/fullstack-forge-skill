import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT, VERSION } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { copyFixture, withTemporaryProject } from "./helpers.js";

const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");

test("compiled CLI exposes version, list, and blocked command execution", async () => {
  const version = await runFile(process.execPath, [cli, "--version"], PACKAGE_ROOT);
  assert.equal(version.exitCode, 0);
  assert.equal(version.stdout.trim(), VERSION);
  const list = await runFile(process.execPath, [cli, "list", "--json"], PACKAGE_ROOT);
  assert.equal(list.exitCode, 0);
  const parsed = JSON.parse(list.stdout) as { modules: string[]; tools: string[] };
  assert.equal(parsed.modules.length, 42);
  assert.equal(parsed.tools.length, 25);
});

test("compiled CLI performs discovery and writes evidence artifacts", async () => {
  await withTemporaryProject("cli", async (root) => {
    const result = await runFile(
      process.execPath,
      [cli, "discover", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as {
      profile: { root: string };
      report_paths: string[];
    };
    assert.equal(parsed.profile.root, root);
    assert.equal(parsed.report_paths.length, 2);
  });
});

test("unsupported language audit reports a precise NOT_VERIFIED adapter boundary", async () => {
  await withTemporaryProject("cli-unsupported", async (root) => {
    await writeFile(join(root, "app.py"), "print('hello')\n", "utf8");
    const result = await runFile(
      process.execPath,
      [cli, "security", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    const findings = (
      JSON.parse(result.stdout) as {
        report: { findings: Array<{ status: string; evidence: string[] }> };
      }
    ).report.findings;
    const [finding] = findings;
    assert.ok(finding);
    assert.equal(finding.status, "NOT_VERIFIED");
    assert.ok(finding.evidence.some((item) => item.includes("Python")));
    assert.ok(
      finding.evidence.some((item) => item.includes("required_adapter=python-security-boundaries"))
    );
  });
});

test("compiled CLI accepts the documented --ai installer form", async () => {
  await withTemporaryProject("cli-ai", async (root) => {
    const result = await runFile(
      process.execPath,
      [cli, "init", "--ai", "generic", "--root", root, "--dry-run", "--json"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as { selector: string; dry_run: boolean };
    assert.equal(parsed.selector, "generic");
    assert.equal(parsed.dry_run, true);
  });
});

test("compiled CLI audits and applies all safe fixes with dry-run and idempotency", async () => {
  await withTemporaryProject("cli-safe-fix", async (root) => {
    await copyFixture(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root);
    const envPath = join(root, ".env.example");
    const original = await readFile(envPath, "utf8");
    const audit = await runFile(
      process.execPath,
      [cli, "all", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 1, audit.stderr);

    const highOnly = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--severity", "high", "--dry-run", "--root", root, "--json"],
      root
    );
    assert.equal(highOnly.exitCode, 0, highOnly.stderr);
    assert.deepEqual(
      (JSON.parse(highOnly.stdout) as { operations: Array<{ finding_id: string }> }).operations.map(
        (operation) => operation.finding_id
      ),
      ["FF-ENV-TEMPLATE-001"]
    );

    const dryRun = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--dry-run", "--root", root, "--json"],
      root
    );
    assert.equal(dryRun.exitCode, 0, dryRun.stderr);
    const planned = JSON.parse(dryRun.stdout) as {
      operations: Array<{ fix_id: string }>;
      changed_files: string[];
    };
    assert.equal(planned.operations.length, 3);
    assert.deepEqual(planned.changed_files, []);
    assert.equal(await readFile(envPath, "utf8"), original);

    const applied = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(applied.exitCode, 0, applied.stderr);
    const result = JSON.parse(applied.stdout) as { changed_files: string[] };
    assert.deepEqual(result.changed_files, [".env.example", "Link.tsx", "vercel.json"]);
    assert.match(await readFile(envPath, "utf8"), /<REPLACE_WITH_SECRET>/u);

    const repeated = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(repeated.exitCode, 0, repeated.stderr);
    assert.deepEqual(
      (JSON.parse(repeated.stdout) as { changed_files: string[] }).changed_files,
      []
    );
  });
});

test("project command execution rejects unknown names and blocks unapproved definitions", async () => {
  await withTemporaryProject("cli-command", async (root) => {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }),
      "utf8"
    );
    const unknown = await runFile(
      process.execPath,
      [cli, "tool", "run-project-command", "missing", "--root", root, "--json"],
      root
    );
    assert.equal(unknown.exitCode, 1);
    assert.match(unknown.stderr, /not a detected project command/u);

    const blocked = await runFile(
      process.execPath,
      [cli, "tool", "run-project-command", "check", "--root", root, "--json"],
      root
    );
    assert.equal(blocked.exitCode, 2);
    assert.equal((JSON.parse(blocked.stdout) as { status: string }).status, "BLOCKED");

    const allowed = await runFile(
      process.execPath,
      [cli, "tool", "run-project-command", "check", "--allow-run", "--root", root, "--json"],
      root
    );
    assert.equal(allowed.exitCode, 0, allowed.stderr);
  });
});

test("high-risk all audit and verify route through applicable focused modules", async () => {
  await withTemporaryProject("cli-verify-all", async (root) => {
    await writeFile(join(root, "app.ts"), "export const ready = true;\n", "utf8");
    // A declared frontend makes the ui capability genuinely PRESENT, so the assertions below
    // isolate risk exclusion instead of accidentally testing a capability that does not exist.
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "risk-fixture", private: true, dependencies: { react: "19.0.0" } }, null, 2)}\n`,
      "utf8"
    );
    const audit = await runFile(
      process.execPath,
      [cli, "all", "audit", "--risk", "high", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 0, audit.stderr);
    const audited = JSON.parse(audit.stdout) as {
      report: {
        findings: Array<{ section: string; status: string }>;
        module_decisions: Array<{
          module: string;
          capability_status: string;
          selection_status: string;
        }>;
      };
    };
    assert.ok(audited.report.findings.some((finding) => finding.section === "security"));

    // A risk filter narrows what is audited; it never proves anything about what it skipped.
    // The ui module must therefore still appear, recorded as excluded by risk and unverified,
    // rather than disappearing from the report as though it had been considered and cleared.
    const [uiFinding, ...extraUiFindings] = audited.report.findings.filter(
      (finding) => finding.section === "ui"
    );
    assert.ok(uiFinding, "a risk-excluded module must still be accounted for");
    assert.equal(extraUiFindings.length, 0);
    assert.equal(uiFinding.status, "NOT_VERIFIED");
    const uiDecision = audited.report.module_decisions.find((decision) => decision.module === "ui");
    assert.ok(uiDecision);
    assert.equal(uiDecision.selection_status, "EXCLUDED_BY_RISK");
    assert.notEqual(
      uiDecision.capability_status,
      "ABSENT",
      "excluding a module by risk must not be recorded as the capability being absent"
    );

    const verify = await runFile(
      process.execPath,
      [cli, "all", "verify", "--risk", "high", "--root", root, "--json"],
      root
    );
    assert.equal(
      verify.exitCode,
      2,
      "risk-excluded NOT_VERIFIED evidence must keep Verify incomplete"
    );
    const verified = JSON.parse(verify.stdout) as {
      report: { findings: Array<{ section: string; status: string }> };
    };
    assert.ok(verified.report.findings.some((finding) => finding.section === "testing"));
    assert.ok(
      verified.report.findings.some(
        (finding) => finding.section === "ui" && finding.status === "NOT_VERIFIED"
      )
    );
    assert.ok(!verified.report.findings.some((finding) => finding.section === "all"));
  });
});

test("ship remains blocked without a prior audit and detected release gates", async () => {
  await withTemporaryProject("cli-ship", async (root) => {
    const result = await runFile(
      process.execPath,
      [cli, "ship", "--allow-run", "--root", root, "--json"],
      root
    );
    assert.equal(result.exitCode, 2, result.stderr);
    const report = JSON.parse(result.stdout) as { findings: Array<{ status: string }> };
    assert.equal(report.findings[0]?.status, "BLOCKED");
  });
});

test("ship report preserves the prior audit findings", async () => {
  await withTemporaryProject("cli-ship-preserve", async (root) => {
    await writeFile(join(root, "app.py"), "print('hello')\n", "utf8");
    const audit = await runFile(
      process.execPath,
      [cli, "security", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 0, audit.stderr);
    const priorIds = (
      JSON.parse(audit.stdout) as { report: { findings: Array<{ id: string }> } }
    ).report.findings.map((finding) => finding.id);
    const ship = await runFile(process.execPath, [cli, "ship", "--root", root, "--json"], root);
    assert.equal(ship.exitCode, 2, ship.stderr);
    const ids = (JSON.parse(ship.stdout) as { findings: Array<{ id: string }> }).findings.map(
      (finding) => finding.id
    );
    for (const id of priorIds) assert.ok(ids.includes(id), `missing prior finding ${id}`);
    assert.ok(ids.includes("FF-SHIP-001"));
  });
});
