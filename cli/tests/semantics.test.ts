import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");

type ReportFinding = {
  id: string;
  instance_id?: string;
  status: string;
  severity: string;
  section: string;
  safe_fix: boolean;
  fix_attempts?: Array<{ status: string; reason: string; risk: string }>;
};

async function readFindings(root: string): Promise<ReportFinding[]> {
  const report = JSON.parse(await readFile(join(root, ".forge", "report.json"), "utf8")) as {
    findings: ReportFinding[];
  };
  return report.findings;
}

async function auditRiskyFixture(root: string): Promise<void> {
  await cp(join(PACKAGE_ROOT, "fixtures", "risky-fixes"), root, { recursive: true });
  const audit = await runFile(
    process.execPath,
    [cli, "all", "audit", "--root", root, "--json"],
    root
  );
  assert.equal(audit.exitCode, 1, audit.stderr);
}

// ---------------------------------------------------------------------------
// Section 2: defect status versus fix-attempt status
// ---------------------------------------------------------------------------

test("a blocked safe fix preserves the original FAIL defect status", async () => {
  await withTemporaryProject("blocked-preserves-fail", async (temporary) => {
    const root = join(temporary, "project");
    await auditRiskyFixture(root);
    const before = await readFindings(root);
    const failed = before.filter((finding) => finding.status === "FAIL");
    assert.ok(failed.length > 0, "the fixture must produce at least one confirmed FAIL");

    const fix = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(fix.exitCode, 2, "an approval-bound refusal is reported as BLOCKED");

    const after = await readFindings(root);
    for (const original of failed) {
      const current = after.find((finding) => finding.id === original.id);
      assert.ok(current !== undefined, `${original.id} disappeared from the report`);
      assert.equal(
        current.status,
        "FAIL",
        `${original.id} must remain FAIL after a refused fix; a refused remediation does not unprove the defect`
      );
    }
  });
});

test("a blocked safe fix records the refusal as a separate fix attempt", async () => {
  await withTemporaryProject("blocked-records-attempt", async (temporary) => {
    const root = join(temporary, "project");
    await auditRiskyFixture(root);
    await runFile(process.execPath, [cli, "all", "fix", "--safe", "--root", root, "--json"], root);

    const after = await readFindings(root);
    const refused = after.filter((finding) => finding.fix_attempts !== undefined);
    assert.ok(refused.length > 0, "a refused fix must be recorded structurally, not only in prose");
    for (const finding of refused) {
      const blocked = finding.fix_attempts?.filter((attempt) => attempt.status === "BLOCKED") ?? [];
      assert.ok(blocked.length > 0, `${finding.id} must carry a BLOCKED fix attempt`);
      assert.ok(
        blocked.every((attempt) => attempt.reason.length > 0),
        "each blocked attempt states why remediation was refused"
      );
      assert.notEqual(
        finding.status,
        "BLOCKED",
        `${finding.id} defect status must not be overwritten by the fix-attempt status`
      );
    }
  });
});

test("a blocked safe fix preserves an original WARNING defect status", async () => {
  await withTemporaryProject("blocked-preserves-warning", async (temporary) => {
    const root = join(temporary, "project");
    await auditRiskyFixture(root);

    // Force a WARNING defect that the safe registry cannot fix, then confirm it survives.
    const reportPath = join(root, ".forge", "report.json");
    const report = JSON.parse(await readFile(reportPath, "utf8")) as { findings: ReportFinding[] };
    const target = report.findings.find((finding) => finding.status === "FAIL");
    assert.ok(target !== undefined);
    target.status = "WARNING";
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    await runFile(process.execPath, [cli, "all", "fix", "--safe", "--root", root, "--json"], root);
    const after = await readFindings(root);
    const current = after.find((finding) => finding.id === target.id);
    assert.equal(current?.status, "WARNING", "a refused fix must not downgrade a WARNING either");
  });
});

// ---------------------------------------------------------------------------
// Section 3: the --safe contract
// ---------------------------------------------------------------------------

test("fix without --safe plans only and mutates nothing", async () => {
  await withTemporaryProject("safe-contract-plan", async (temporary) => {
    const root = join(temporary, "project");
    await cp(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root, { recursive: true });
    await runFile(process.execPath, [cli, "all", "audit", "--root", root, "--json"], root);

    const targets = [".env.example", "Link.tsx", "vercel.json"].map((name) => join(root, name));
    const before = await Promise.all(targets.map((path) => readFile(path, "utf8")));

    const planned = await runFile(
      process.execPath,
      [cli, "all", "fix", "--root", root, "--json"],
      root
    );
    const result = JSON.parse(planned.stdout) as {
      status: string;
      dry_run: boolean;
      changed_files: string[];
      operations: Array<{ path: string }>;
    };
    assert.equal(result.status, "BLOCKED", "planning without --safe is never PASS");
    assert.equal(result.dry_run, true);
    assert.deepEqual(result.changed_files, [], "no file may be written without --safe");
    assert.ok(result.operations.length > 0, "the proposed safe group is still reported");
    assert.deepEqual(
      await Promise.all(targets.map((path) => readFile(path, "utf8"))),
      before,
      "files must be byte-identical after a plan-only run"
    );
  });
});

test("fix --safe differs observably from fix without --safe", async () => {
  await withTemporaryProject("safe-contract-differs", async (temporary) => {
    const root = join(temporary, "project");
    await cp(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root, { recursive: true });
    await runFile(process.execPath, [cli, "all", "audit", "--root", root, "--json"], root);

    const planOnly = JSON.parse(
      (await runFile(process.execPath, [cli, "all", "fix", "--root", root, "--json"], root)).stdout
    ) as { changed_files: string[]; status: string };
    const executed = JSON.parse(
      (
        await runFile(
          process.execPath,
          [cli, "all", "fix", "--safe", "--root", root, "--json"],
          root
        )
      ).stdout
    ) as { changed_files: string[]; status: string };

    assert.deepEqual(planOnly.changed_files, []);
    assert.ok(
      executed.changed_files.length > 0,
      "--safe must actually apply the bounded safe registry entries"
    );
    assert.notDeepEqual(
      planOnly,
      executed,
      "the two command forms must not be observationally identical"
    );
  });
});

// ---------------------------------------------------------------------------
// Section 6: instance-specific findings
// ---------------------------------------------------------------------------

test("two occurrences of one rule in different files become distinct instances", async () => {
  await withTemporaryProject("instance-identity", async (root) => {
    const injection = (name: string) =>
      `export async function ${name}(req, db) {\n  return db.query(\`SELECT * FROM t WHERE id = \${req.params.id}\`);\n}\n`;
    await writeFile(join(root, "alpha.ts"), injection("alpha"), "utf8");
    await writeFile(join(root, "beta.ts"), injection("beta"), "utf8");

    await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);
    const findings = await readFindings(root);
    const sql = findings.filter((finding) => finding.id === "FF-SEC-SQL-001");
    assert.equal(sql.length, 2, "each file must yield its own instance, not one merged finding");
    const instances = new Set(sql.map((finding) => finding.instance_id));
    assert.equal(instances.size, 2, "instance ids must be distinct");
    for (const finding of sql)
      assert.ok(
        finding.instance_id?.startsWith("FF-SEC-SQL-001:"),
        "the stable rule id remains the instance id prefix"
      );
  });
});

test("instance identity is stable when unrelated lines are inserted", async () => {
  await withTemporaryProject("instance-stability", async (root) => {
    const body = `export async function alpha(req, db) {\n  return db.query(\`SELECT * FROM t WHERE id = \${req.params.id}\`);\n}\n`;
    await writeFile(join(root, "alpha.ts"), body, "utf8");
    await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);
    const before = (await readFindings(root)).find((finding) => finding.id === "FF-SEC-SQL-001");

    await writeFile(
      join(root, "alpha.ts"),
      `// unrelated comment\n// another line\n${body}`,
      "utf8"
    );
    await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);
    const after = (await readFindings(root)).find((finding) => finding.id === "FF-SEC-SQL-001");

    assert.equal(
      after?.instance_id,
      before?.instance_id,
      "moving code within a file must not mint an unrelated identity"
    );
  });
});

test("verifying a resolved instance is not failed by an unrelated instance elsewhere", async () => {
  await withTemporaryProject("instance-verification", async (root) => {
    const vulnerable = (name: string) =>
      `export async function ${name}(req, db) {\n  return db.query(\`SELECT * FROM t WHERE id = \${req.params.id}\`);\n}\n`;
    await writeFile(join(root, "alpha.ts"), vulnerable("alpha"), "utf8");
    await writeFile(join(root, "beta.ts"), vulnerable("beta"), "utf8");
    await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);

    const before = (await readFindings(root)).filter((finding) => finding.id === "FF-SEC-SQL-001");
    assert.equal(before.length, 2);

    // Resolve only alpha. beta remains vulnerable on purpose.
    await writeFile(
      join(root, "alpha.ts"),
      'export async function alpha(req, db) {\n  return db.query("SELECT * FROM t WHERE id = ?", [req.params.id]);\n}\n',
      "utf8"
    );
    await runFile(process.execPath, [cli, "security", "verify", "--root", root, "--json"], root);

    const after = (await readFindings(root)).filter((finding) => finding.id === "FF-SEC-SQL-001");
    const alpha = after.find((finding) =>
      before.find((item) => item.instance_id === finding.instance_id)
    );
    assert.ok(alpha !== undefined);
    assert.ok(
      after.some((finding) => finding.status !== "FAIL"),
      "the resolved instance must be able to leave FAIL even while another instance persists"
    );
    assert.ok(
      after.some((finding) => finding.status === "FAIL"),
      "the still-vulnerable instance must remain FAIL"
    );
  });
});

// ---------------------------------------------------------------------------
// Section 7: dry-run guarantees
// ---------------------------------------------------------------------------

test("verify --dry-run --allow-run executes no project command", async () => {
  await withTemporaryProject("verify-dry-run", async (root) => {
    // A project 'test' command whose only effect is to create a sentinel file.
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "sentinel-project",
          version: "1.0.0",
          scripts: { test: "node -e \"require('fs').writeFileSync('sentinel.txt','ran')\"" }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      join(root, "handler.ts"),
      "export async function handler(req, db) {\n  return db.query(`SELECT * FROM t WHERE id = ${req.params.id}`);\n}\n",
      "utf8"
    );
    await runFile(process.execPath, [cli, "security", "audit", "--root", root, "--json"], root);

    await runFile(
      process.execPath,
      [cli, "security", "verify", "--dry-run", "--allow-run", "--root", root, "--json"],
      root
    );

    const sentinel = await readFile(join(root, "sentinel.txt"), "utf8").catch(
      () => undefined as string | undefined
    );
    assert.equal(
      sentinel,
      undefined,
      "a dry run must not execute project commands even when --allow-run is supplied"
    );
  });
});

// ---------------------------------------------------------------------------
// Section 9: discovery accuracy
// ---------------------------------------------------------------------------

test("an undeclared nested manifest is not reported as an active workspace", async () => {
  await withTemporaryProject("workspace-undeclared", async (root) => {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "root-app", version: "1.0.0", workspaces: ["packages/*"] }, null, 2),
      "utf8"
    );
    await mkdir(join(root, "packages", "declared"), { recursive: true });
    await writeFile(
      join(root, "packages", "declared", "package.json"),
      JSON.stringify({ name: "declared-pkg", version: "1.0.0" }, null, 2),
      "utf8"
    );
    await mkdir(join(root, "examples", "sample"), { recursive: true });
    await writeFile(
      join(root, "examples", "sample", "package.json"),
      JSON.stringify({ name: "sample-pkg", version: "1.0.0" }, null, 2),
      "utf8"
    );

    const discovered = await runFile(
      process.execPath,
      [cli, "discover", "audit", "--root", root, "--json"],
      root
    );
    const parsed = JSON.parse(discovered.stdout) as {
      profile: { workspaces: Array<{ name: string; type: string; confidence: string }> };
    };
    const declared = parsed.profile.workspaces.find((item) => item.name === "declared-pkg");
    const sample = parsed.profile.workspaces.find((item) => item.name === "sample-pkg");

    assert.ok(declared !== undefined, "the declared workspace must be reported");
    assert.ok(sample !== undefined, "the undeclared manifest must still be reported");
    assert.equal(declared.type, "package-workspace");
    assert.equal(declared.confidence, "HIGH");
    assert.equal(
      sample.type,
      "nested-package",
      "a manifest no workspace glob declares is not an active workspace"
    );
    assert.equal(sample.confidence, "LOW");
  });
});

test("repository confidence is derived from Git inspection, not an excluded path walk", async () => {
  await withTemporaryProject("repository-confidence", async (root) => {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "git-app", version: "1.0.0" }, null, 2),
      "utf8"
    );
    const before = JSON.parse(
      (await runFile(process.execPath, [cli, "discover", "audit", "--root", root, "--json"], root))
        .stdout
    ) as { profile: { repository: { confidence: string } } };
    assert.equal(before.profile.repository.confidence, "MEDIUM", "a non-repository stays MEDIUM");

    await runFile("git", ["init"], root);
    const after = JSON.parse(
      (await runFile(process.execPath, [cli, "discover", "audit", "--root", root, "--json"], root))
        .stdout
    ) as { profile: { repository: { confidence: string; evidence: string[] } } };
    assert.equal(
      after.profile.repository.confidence,
      "HIGH",
      "an initialised work tree must raise confidence; the old check could never observe this"
    );
    assert.ok(after.profile.repository.evidence.some((item) => item.includes("rev-parse")));
  });
});
