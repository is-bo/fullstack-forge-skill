import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");

test("compiled CLI exposes version, list, and blocked command execution", async () => {
  const version = await runFile(process.execPath, [cli, "--version"], PACKAGE_ROOT);
  assert.equal(version.exitCode, 0);
  assert.equal(version.stdout.trim(), "0.1.0");
  const list = await runFile(process.execPath, [cli, "list", "--json"], PACKAGE_ROOT);
  assert.equal(list.exitCode, 0);
  const parsed = JSON.parse(list.stdout) as { modules: string[]; tools: string[] };
  assert.equal(parsed.modules.length, 42);
  assert.equal(parsed.tools.length, 24);
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
    const audit = await runFile(
      process.execPath,
      [cli, "all", "audit", "--risk", "high", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 0, audit.stderr);
    const audited = JSON.parse(audit.stdout) as {
      report: { findings: Array<{ section: string }> };
    };
    assert.ok(audited.report.findings.some((finding) => finding.section === "security"));
    assert.ok(!audited.report.findings.some((finding) => finding.section === "ui"));

    const verify = await runFile(
      process.execPath,
      [cli, "all", "verify", "--risk", "high", "--root", root, "--json"],
      root
    );
    assert.equal(verify.exitCode, 0, verify.stderr);
    const verified = JSON.parse(verify.stdout) as {
      report: { findings: Array<{ section: string }> };
    };
    assert.ok(verified.report.findings.some((finding) => finding.section === "testing"));
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
