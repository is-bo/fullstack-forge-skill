import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
import { REPORT_SCHEMA_VERSION } from "../src/report.js";

const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");

/** Produces a real `.forge/report.json` by running an audit, so report mode renders genuine input. */
async function seedReport(root: string): Promise<void> {
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({ name: "report-mode-fixture", version: "0.0.0", private: true }, null, 2)}\n`,
    "utf8"
  );
  const audit = await runFile(
    process.execPath,
    [cli, "security", "audit", "--root", root, "--json"],
    root
  );
  assert.equal(audit.exitCode, 0, audit.stderr);
}

test("report mode renders Markdown to stdout without re-running the audit", async () => {
  await withTemporaryProject("cli-report-md", async (root) => {
    await seedReport(root);
    const before = await readFile(join(root, ".forge", "report.json"), "utf8");
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    assert.ok(result.stdout.startsWith("# Fullstack Forge report"));
    assert.ok(result.stdout.includes("## Findings"));
    // Rendering must not touch the stored report.
    assert.equal(await readFile(join(root, ".forge", "report.json"), "utf8"), before);
  });
});

test("report mode emits JSON to stdout under --json", async () => {
  await withTemporaryProject("cli-report-json", async (root) => {
    await seedReport(root);
    const stored = JSON.parse(await readFile(join(root, ".forge", "report.json"), "utf8")) as {
      generated_at: string;
    };
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--json"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as { schema_version: number; generated_at: string };
    assert.equal(parsed.schema_version, REPORT_SCHEMA_VERSION);
    assert.equal(parsed.generated_at, stored.generated_at);
  });
});

test("report mode --output writes report.json and report.md", async () => {
  await withTemporaryProject("cli-report-output", async (root) => {
    await seedReport(root);
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "artifacts", "--json"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as {
      output: string;
      written: string[];
      planned_paths: Array<{ path: string; action: string }>;
    };
    assert.equal(parsed.output, "artifacts");
    assert.deepEqual(parsed.written, ["artifacts/report.json", "artifacts/report.md"]);
    const markdown = await readFile(join(root, "artifacts", "report.md"), "utf8");
    assert.ok(markdown.startsWith("# Fullstack Forge report"));
  });
});

test("report mode --output --dry-run prints planned paths and writes nothing", async () => {
  await withTemporaryProject("cli-report-dry", async (root) => {
    await seedReport(root);
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "artifacts", "--dry-run"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    assert.ok(result.stdout.includes("Planned report output in artifacts"));
    assert.ok(result.stdout.includes("artifacts/report.json (create)"));
    await assert.rejects(() => readFile(join(root, "artifacts", "report.json"), "utf8"), /ENOENT/u);
  });
});

test("report mode refuses a traversal output path", async () => {
  await withTemporaryProject("cli-report-traversal", async (root) => {
    await seedReport(root);
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "../escape"],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(/Unsafe absolute or NUL path|escapes selected root/u.test(result.stderr));
  });
});

test("report mode refuses an absolute output path", async () => {
  await withTemporaryProject("cli-report-absolute", async (root) => {
    await seedReport(root);
    const absolute = process.platform === "win32" ? "C:\\Windows\\Temp" : "/tmp/forge-escape";
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", absolute],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("Unsafe absolute or NUL path"));
  });
});

test("report mode refuses to clobber modified managed output", async () => {
  await withTemporaryProject("cli-report-modified", async (root) => {
    await seedReport(root);
    const first = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "artifacts"],
      root
    );
    assert.equal(first.exitCode, 0, first.stderr);
    await writeFile(join(root, "artifacts", "report.md"), "# edited\n", "utf8");
    const second = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "artifacts"],
      root
    );
    assert.equal(second.exitCode, 1);
    assert.ok(second.stderr.includes("Refusing to overwrite modified managed output"));
    assert.equal(await readFile(join(root, "artifacts", "report.md"), "utf8"), "# edited\n");
  });
});

test("report mode reports identical output as preserved", async () => {
  await withTemporaryProject("cli-report-identical", async (root) => {
    await seedReport(root);
    for (const _ of [0, 1]) void _;
    await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "artifacts"],
      root
    );
    const second = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root, "--output", "artifacts", "--json"],
      root
    );
    assert.equal(second.exitCode, 0, second.stderr);
    const parsed = JSON.parse(second.stdout) as { written: string[] };
    assert.deepEqual(parsed.written, []);
  });
});

test("report mode renders a legacy report that predates the newer ledgers", async () => {
  await withTemporaryProject("cli-report-legacy", async (root) => {
    await seedReport(root);
    const path = join(root, ".forge", "report.json");
    const stored = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    delete stored.environment;
    delete stored.revision;
    delete stored.gate_evidence;
    delete stored.analyzer_coverage;
    await writeFile(path, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    assert.ok(result.stdout.includes("report predates the environment ledger"));
    assert.ok(result.stdout.includes("legacy/unrecorded"));
  });
});

test("report mode refuses an invalid report", async () => {
  await withTemporaryProject("cli-report-invalid", async (root) => {
    await mkdir(join(root, ".forge"), { recursive: true });
    await writeFile(join(root, ".forge", "report.json"), `${JSON.stringify({ a: 1 })}\n`, "utf8");
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("Unsupported or invalid Fullstack Forge report"));
  });
});

test("report mode reports a missing report rather than inventing one", async () => {
  await withTemporaryProject("cli-report-missing", async (root) => {
    await rm(join(root, ".forge"), { recursive: true, force: true });
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("ENOENT") || result.stderr.includes("no such file"));
  });
});

test("report mode exits 1 when the report contains a failing finding", async () => {
  await withTemporaryProject("cli-report-failing", async (root) => {
    await seedReport(root);
    const path = join(root, ".forge", "report.json");
    const stored = JSON.parse(await readFile(path, "utf8")) as {
      findings: Array<Record<string, unknown>>;
    };
    const [first] = stored.findings;
    assert.ok(first);
    first.status = "FAIL";
    first.severity = "HIGH";
    await writeFile(path, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    const result = await runFile(
      process.execPath,
      [cli, "security", "report", "--root", root],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stdout.includes("FAIL"));
  });
});
