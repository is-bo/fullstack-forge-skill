import assert from "node:assert/strict";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");

test("all safe fixes support dry-run, real writes, complete reporting, and idempotency", async () => {
  await withTemporaryProject("safe-fixes", async (temporary) => {
    const root = join(temporary, "project");
    await cp(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root, { recursive: true });
    const audit = await runFile(
      process.execPath,
      [cli, "all", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 1, audit.stderr);

    const envPath = join(root, ".env.example");
    const linkPath = join(root, "Link.tsx");
    const vercelPath = join(root, "vercel.json");
    const before = await Promise.all(
      [envPath, linkPath, vercelPath].map((path) => readFile(path, "utf8"))
    );
    const dryRun = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--dry-run", "--root", root, "--json"],
      root
    );
    assert.equal(dryRun.exitCode, 0, dryRun.stderr);
    const dryResult = JSON.parse(dryRun.stdout) as {
      operations: Array<{ path: string }>;
      changed_files: string[];
    };
    assert.deepEqual(dryResult.operations.map((operation) => operation.path).sort(), [
      ".env.example",
      "Link.tsx",
      "vercel.json"
    ]);
    assert.deepEqual(dryResult.changed_files, []);
    assert.deepEqual(
      await Promise.all([envPath, linkPath, vercelPath].map((path) => readFile(path, "utf8"))),
      before
    );

    const applied = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(applied.exitCode, 0, applied.stderr);
    const result = JSON.parse(applied.stdout) as {
      status: string;
      changed_files: string[];
      operations: Array<{ fix_id: string; path: string; rollback: string }>;
    };
    assert.equal(result.status, "PASS");
    assert.deepEqual(result.changed_files, [".env.example", "Link.tsx", "vercel.json"]);
    assert.equal(result.operations.length, 3);
    assert.ok(result.operations.every((operation) => operation.fix_id.startsWith("FF-FIX-")));
    assert.ok(result.operations.every((operation) => operation.rollback.length > 20));
    assert.match(await readFile(envPath, "utf8"), /PAYMENT_API_KEY=<REPLACE_WITH_SECRET>/u);
    assert.match(await readFile(linkPath, "utf8"), /rel="noopener noreferrer"/u);
    assert.match(await readFile(vercelPath, "utf8"), /"X-Content-Type-Options"/u);

    const repeated = await runFile(
      process.execPath,
      [cli, "all", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(repeated.exitCode, 0, repeated.stderr);
    const repeatedResult = JSON.parse(repeated.stdout) as {
      operations: unknown[];
      changed_files: string[];
    };
    assert.deepEqual(repeatedResult.operations, []);
    assert.deepEqual(repeatedResult.changed_files, []);
  });
});

test("safe fix refuses a file whose post-audit hash changed", async () => {
  await withTemporaryProject("stale-fix", async (temporary) => {
    const root = join(temporary, "project");
    await cp(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root, { recursive: true });
    const audit = await runFile(
      process.execPath,
      [cli, "frontend", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 1, audit.stderr);
    const path = join(root, "Link.tsx");
    const changed = `${await readFile(path, "utf8")}\n// user change after audit\n`;
    await writeFile(path, changed, "utf8");
    const fix = await runFile(
      process.execPath,
      [cli, "frontend", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(fix.exitCode, 2, fix.stderr);
    const result = JSON.parse(fix.stdout) as {
      status: string;
      blocked_findings: Array<{ reason: string }>;
    };
    assert.equal(result.status, "BLOCKED");
    assert.ok(
      result.blocked_findings.some((finding) => finding.reason.includes("changed after audit"))
    );
    assert.equal(await readFile(path, "utf8"), changed);
  });
});

test("risky authorization finding remains blocked in safe fix mode", async () => {
  await withTemporaryProject("risky-fix", async (temporary) => {
    const root = join(temporary, "project");
    await cp(join(PACKAGE_ROOT, "fixtures", "risky-fixes"), root, { recursive: true });
    const audit = await runFile(
      process.execPath,
      [cli, "authorization", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(audit.exitCode, 1, audit.stderr);
    const before = await readFile(join(root, "routes.js"), "utf8");
    const fix = await runFile(
      process.execPath,
      [cli, "authorization", "fix", "--safe", "--root", root, "--json"],
      root
    );
    assert.equal(fix.exitCode, 2, fix.stderr);
    const result = JSON.parse(fix.stdout) as {
      status: string;
      blocked_findings: Array<{ finding_id: string }>;
    };
    assert.equal(result.status, "BLOCKED");
    assert.ok(
      result.blocked_findings.some((finding) => finding.finding_id === "FF-AUTHZ-OBJECT-001")
    );
    assert.equal(await readFile(join(root, "routes.js"), "utf8"), before);
  });
});

test("authorized project regression tests are recorded and failures roll fixes back", async (t) => {
  for (const [name, exitCode] of [
    ["pass", 0],
    ["fail", 7]
  ] as const) {
    await t.test(name, async () => {
      await withTemporaryProject(`fix-regression-${name}`, async (temporary) => {
        const root = join(temporary, "project");
        await cp(join(PACKAGE_ROOT, "fixtures", "safe-fixes"), root, { recursive: true });
        await writeFile(
          join(root, "package.json"),
          `${JSON.stringify(
            {
              name: "safe-fixes",
              private: true,
              dependencies: { react: "0.0.0-fixture" },
              scripts: { test: `node -e "process.exit(${exitCode})"` }
            },
            null,
            2
          )}\n`,
          "utf8"
        );
        const audit = await runFile(
          process.execPath,
          [cli, "all", "audit", "--root", root, "--json"],
          root
        );
        assert.equal(audit.exitCode, 1, audit.stderr);
        const linkPath = join(root, "Link.tsx");
        const before = await readFile(linkPath, "utf8");
        const fix = await runFile(
          process.execPath,
          [cli, "all", "fix", "--safe", "--allow-run", "--root", root, "--json"],
          root,
          120_000
        );
        assert.equal(fix.exitCode, exitCode === 0 ? 0 : 1, fix.stderr);
        const result = JSON.parse(fix.stdout) as {
          status: string;
          execution: Array<{ exitCode: number; duration_ms: number }>;
          changed_files: string[];
        };
        const [execution] = result.execution;
        assert.ok(execution);
        assert.equal(execution.exitCode, exitCode);
        assert.ok(execution.duration_ms >= 0);
        if (exitCode === 0) {
          assert.equal(result.status, "PASS");
          assert.match(await readFile(linkPath, "utf8"), /noopener noreferrer/u);
        } else {
          assert.equal(result.status, "FAIL");
          assert.deepEqual(result.changed_files, []);
          assert.equal(await readFile(linkPath, "utf8"), before);
        }
      });
    });
  }
});
