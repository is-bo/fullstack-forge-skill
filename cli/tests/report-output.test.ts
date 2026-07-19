import assert from "node:assert/strict";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createReport, type AuditReport } from "../src/report.js";
import { planReportOutput, writeReportOutput } from "../src/report-output.js";
import type { Finding, ProjectProfile } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

function profile(root: string): ProjectProfile {
  return {
    schema_version: 2,
    root,
    generated_at: "2026-01-01T00:00:00.000Z",
    detections: [],
    capabilities: {},
    repository: { name: "test", type: "repository", confidence: "HIGH", evidence: ["fixture"] },
    workspaces: [],
    applications: [],
    languages: [],
    frameworks: [],
    package_managers: [],
    databases: [],
    orms: [],
    authentication: [],
    sessions: [],
    authorization: [],
    roles: [],
    tenant_boundaries: [],
    routes: [],
    storage: [],
    upload_pipelines: [],
    caches: [],
    queues: [],
    scheduled_jobs: [],
    tests: [],
    ci: [],
    observability: [],
    integrations: [],
    ai_providers: [],
    payment_providers: [],
    hosting: [],
    deployment: [],
    environment_templates: [],
    critical_workflows: []
  };
}

const FINDING: Finding = {
  id: "FF-SECURITY-900",
  section: "security",
  title: "security checks require additional direct verification",
  severity: "INFO",
  confidence: "LOW",
  status: "NOT_VERIFIED",
  location: [{ path: ".forge/project-profile.json" }],
  evidence: ["0 static implementation signal(s) recorded."],
  impact: "Unexecuted criteria cannot support a pass.",
  recommendation: "Complete the module procedure.",
  safe_fix: false,
  verification: ["Re-run the audit."],
  standards: ["Fullstack Forge evidence protocol"]
};

function report(root: string): AuditReport {
  return createReport(root, profile(root), [FINDING], "security");
}

test("report output writes report.json and report.md into the selected directory", async () => {
  await withTemporaryProject("report-output", async (root) => {
    const result = await writeReportOutput(root, "out", report(root), false);
    assert.deepEqual(
      result.files.map((file) => file.path),
      ["out/report.json", "out/report.md"]
    );
    assert.deepEqual(
      result.files.map((file) => file.action),
      ["create", "create"]
    );
    assert.equal(result.written.length, 2);
    const json = JSON.parse(
      await readFile(join(root, "out", "report.json"), "utf8")
    ) as AuditReport;
    assert.equal(json.schema_version, 1);
    assert.equal(json.findings[0]?.id, "FF-SECURITY-900");
    const markdown = await readFile(join(root, "out", "report.md"), "utf8");
    assert.ok(markdown.startsWith("# Fullstack Forge report"));
  });
});

test("report output preserves the identity and evidence of the source report", async () => {
  await withTemporaryProject("report-output-identity", async (root) => {
    const source = report(root);
    await writeReportOutput(root, "out", source, false);
    const json = JSON.parse(
      await readFile(join(root, "out", "report.json"), "utf8")
    ) as AuditReport;
    assert.equal(json.generated_at, source.generated_at);
    assert.equal(json.root, source.root);
    assert.equal(json.scope, source.scope);
    assert.deepEqual(json.findings, source.findings);
  });
});

test("a dry run prints planned paths and writes nothing", async () => {
  await withTemporaryProject("report-output-dry", async (root) => {
    const result = await writeReportOutput(root, "out", report(root), true);
    assert.equal(result.dry_run, true);
    assert.deepEqual(result.written, []);
    assert.deepEqual(
      result.files.map((file) => file.path),
      ["out/report.json", "out/report.md"]
    );
    await assert.rejects(() => readFile(join(root, "out", "report.json"), "utf8"), /ENOENT/u);
  });
});

test("a traversal path is refused", async () => {
  await withTemporaryProject("report-output-traversal", async (root) => {
    await assert.rejects(
      () => writeReportOutput(root, "../escape", report(root), false),
      /Unsafe absolute or NUL path|escapes selected root/u
    );
    await assert.rejects(
      () => writeReportOutput(root, "out/../../escape", report(root), false),
      /Unsafe absolute or NUL path|escapes selected root/u
    );
  });
});

test("an absolute path is refused", async () => {
  await withTemporaryProject("report-output-absolute", async (root) => {
    const absolute = process.platform === "win32" ? "C:\\Windows\\Temp" : "/tmp/forge-escape";
    await assert.rejects(
      () => writeReportOutput(root, absolute, report(root), false),
      /Unsafe absolute or NUL path/u
    );
  });
});

test("a symlinked destination is refused", async () => {
  await withTemporaryProject("report-output-symlink", async (root) => {
    const target = join(root, "real");
    await mkdir(target, { recursive: true });
    try {
      await symlink(target, join(root, "link"), "dir");
    } catch {
      // Windows without developer mode cannot create symlinks; the guard is covered elsewhere.
      return;
    }
    await assert.rejects(
      () => writeReportOutput(root, "link", report(root), false),
      /Refusing symlinked/u
    );
  });
});

test("re-writing identical output is preserved rather than rewritten", async () => {
  await withTemporaryProject("report-output-identical", async (root) => {
    const source = report(root);
    await writeReportOutput(root, "out", source, false);
    const second = await writeReportOutput(root, "out", source, false);
    assert.deepEqual(
      second.files.map((file) => file.action),
      ["preserve-identical", "preserve-identical"]
    );
    assert.deepEqual(second.written, []);
  });
});

test("modified managed output is never overwritten silently", async () => {
  await withTemporaryProject("report-output-modified", async (root) => {
    const source = report(root);
    await writeReportOutput(root, "out", source, false);
    await writeFile(join(root, "out", "report.md"), "# hand edited\n", "utf8");
    await assert.rejects(
      () => writeReportOutput(root, "out", source, false),
      /Refusing to overwrite modified managed output/u
    );
    // The operator's edit survives the refusal.
    assert.equal(await readFile(join(root, "out", "report.md"), "utf8"), "# hand edited\n");
  });
});

test("an unowned pre-existing file is never overwritten", async () => {
  await withTemporaryProject("report-output-unowned", async (root) => {
    await mkdir(join(root, "out"), { recursive: true });
    await writeFile(join(root, "out", "report.json"), "{}\n", "utf8");
    await assert.rejects(
      () => writeReportOutput(root, "out", report(root), false),
      /Refusing to overwrite unowned report output/u
    );
  });
});

test("an updated report replaces owned output and refreshes the ownership record", async () => {
  await withTemporaryProject("report-output-update", async (root) => {
    await writeReportOutput(root, "out", report(root), false);
    const next = createReport(root, profile(root), [FINDING], "all");
    const result = await writeReportOutput(root, "out", next, false);
    assert.deepEqual(
      result.files.map((file) => file.action),
      ["update", "update"]
    );
    const json = JSON.parse(
      await readFile(join(root, "out", "report.json"), "utf8")
    ) as AuditReport;
    assert.equal(json.scope, "all");
  });
});

test("planning never writes the ownership manifest", async () => {
  await withTemporaryProject("report-output-plan", async (root) => {
    const plan = await planReportOutput(root, "out", report(root), true);
    assert.equal(plan.relative_directory, "out");
    await assert.rejects(
      () => readFile(join(root, "out", ".forge-output.json"), "utf8"),
      /ENOENT/u
    );
  });
});

test("an empty output value is refused", async () => {
  await withTemporaryProject("report-output-empty", async (root) => {
    await assert.rejects(
      () => writeReportOutput(root, "   ", report(root), false),
      /--output requires a directory path/u
    );
  });
});
