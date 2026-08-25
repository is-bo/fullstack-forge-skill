import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");

type AuditOutput = {
  planned_checks: Array<{ id: string; kind: string }>;
  check_outcomes: Array<{
    id: string;
    status: string;
    reason?: string;
    cause?: string;
    exit_code?: number;
  }>;
  runtime_evidence: unknown[];
  evidence_complete: boolean;
  report: {
    execution: Array<{ command: string[]; exitCode: number }>;
    findings: Array<{ section: string; status: string }>;
    residual_risk: string[];
  };
};

/** A project whose only scripts are safe, fast, and deterministic. */
async function seedProject(root: string, scripts: Record<string, string> = {}): Promise<void> {
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify(
      { name: "orchestration-fixture", version: "0.0.0", private: true, scripts },
      null,
      2
    )}\n`,
    "utf8"
  );
  // Keep command-orchestration assertions independent of unsupported-analyzer coverage.
  await writeFile(join(root, "app.ts"), "export const ready = true;\n", "utf8");
}

async function audit(
  root: string,
  args: string[]
): Promise<{ exitCode: number; parsed: AuditOutput; stderr: string }> {
  const result = await runFile(process.execPath, [cli, ...args, "--root", root, "--json"], root);
  return {
    exitCode: result.exitCode,
    parsed: result.stdout.startsWith("{")
      ? (JSON.parse(result.stdout) as AuditOutput)
      : ({} as AuditOutput),
    stderr: result.stderr
  };
}

test("a static-only security audit executes no project command", async () => {
  await withTemporaryProject("cli-audit-static", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(0)"' });
    const { exitCode, parsed } = await audit(root, ["security", "audit"]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.evidence_complete, true);
    assert.ok(
      parsed.report.findings.some(
        (finding) => finding.section === "security" && finding.status === "NOT_VERIFIED"
      )
    );
    assert.equal(parsed.report.execution.length, 0);
    const lint = parsed.check_outcomes.find((outcome) => outcome.id === "command:lint");
    assert.equal(lint?.status, "NOT_RUN");
    assert.equal(lint.cause, "unauthorized");
  });
});

test("a broad audit cannot exit successfully when every selected inspection is unverified", async () => {
  await withTemporaryProject("cli-audit-empty-all", async (root) => {
    const { exitCode, parsed } = await audit(root, ["all", "audit", "--dry-run"]);
    assert.equal(exitCode, 2);
    assert.ok(
      parsed.report.findings.some((finding) => finding.status === "NOT_VERIFIED"),
      "the report must retain the missing-evidence finding"
    );
  });
});

test("an audit cannot override its workflow with build composition", async () => {
  await withTemporaryProject("cli-audit-workflow-override", async (root) => {
    await seedProject(root);
    const result = await runFile(
      process.execPath,
      [cli, "code", "audit", "--workflow", "build", "--root", root, "--dry-run", "--json"],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /--workflow.*only valid.*compose/iu);
    assert.equal(result.stdout, "");
  });
});

test("an explicitly selected command without authorization fails closed", async () => {
  await withTemporaryProject("cli-audit-explicit-unauthorized", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(0)"' });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--check",
      "command:lint"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.evidence_complete, false);
    assert.equal(parsed.report.execution.length, 0);
    const lint = parsed.check_outcomes.find((outcome) => outcome.id === "command:lint");
    assert.equal(lint?.status, "NOT_RUN");
    assert.equal(lint.cause, "unauthorized");
  });
});

test("--allow-run executes the authorized project command and records it", async () => {
  await withTemporaryProject("cli-audit-allow-run", async (root) => {
    await seedProject(root, { lint: "node -e \"console.log('lint ok')\"" });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--check",
      "module:security",
      "--check",
      "command:lint"
    ]);
    assert.equal(exitCode, 2);
    assert.ok(
      parsed.report.findings.some(
        (finding) => finding.section === "security" && finding.status === "NOT_VERIFIED"
      )
    );
    assert.equal(parsed.report.execution.length, 1);
    assert.equal(parsed.report.execution[0]?.exitCode, 0);
    const lint = parsed.check_outcomes.find((outcome) => outcome.id === "command:lint");
    assert.equal(lint?.status, "EXECUTED");
  });
});

test("an authorized command that fails makes the audit exit 1", async () => {
  await withTemporaryProject("cli-audit-fail", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(3)"' });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--check",
      "module:security",
      "--check",
      "command:lint"
    ]);
    assert.equal(exitCode, 1);
    assert.equal(parsed.report.execution[0]?.exitCode, 3);
  });
});

test("offline blocks a network-dependent command without spawning it", async () => {
  await withTemporaryProject("cli-audit-offline", async (root) => {
    await seedProject(root, { "audit:dependencies": "npm audit --ignore-scripts" });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--offline"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.report.execution.length, 0);
    const outcome = parsed.check_outcomes.find(
      (entry) => entry.id === "command:audit:dependencies"
    );
    assert.equal(outcome?.cause, "offline-policy");
  });
});

test("an explicitly selected command blocked by offline policy fails closed", async () => {
  await withTemporaryProject("cli-audit-explicit-offline", async (root) => {
    await seedProject(root, { "audit:dependencies": "npm audit --ignore-scripts" });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--offline",
      "--check",
      "command:audit:dependencies"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.evidence_complete, false);
    assert.equal(parsed.report.execution.length, 0);
    const outcome = parsed.check_outcomes.find(
      (entry) => entry.id === "command:audit:dependencies"
    );
    assert.equal(outcome?.status, "NOT_RUN");
    assert.equal(outcome.cause, "offline-policy");
  });
});

test("--skip-check excludes a check that would otherwise run", async () => {
  await withTemporaryProject("cli-audit-skip", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(0)"' });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--skip-check",
      "command:lint"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.report.execution.length, 0);
    const outcome = parsed.check_outcomes.find((entry) => entry.id === "command:lint");
    assert.equal(outcome?.cause, "deselected");
  });
});

test("the same check cannot be both explicitly selected and skipped", async () => {
  await withTemporaryProject("cli-audit-contradictory-selection", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(0)"' });
    const result = await runFile(
      process.execPath,
      [
        cli,
        "security",
        "audit",
        "--root",
        root,
        "--check",
        "command:lint",
        "--skip-check",
        "command:lint",
        "--json"
      ],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("cannot be both selected and skipped"));
  });
});

test("an unknown --check value is rejected", async () => {
  await withTemporaryProject("cli-audit-unknown", async (root) => {
    await seedProject(root);
    const result = await runFile(
      process.execPath,
      [cli, "security", "audit", "--root", root, "--check", "does-not-exist", "--json"],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("Unknown --check value 'does-not-exist'"));
  });
});

test("a malformed --url is rejected before any audit work", async () => {
  await withTemporaryProject("cli-audit-bad-url", async (root) => {
    await seedProject(root);
    const result = await runFile(
      process.execPath,
      [cli, "ui", "audit", "--root", root, "--url", "not-a-url"],
      root
    );
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes("requires an absolute http or https URL"));
    const scheme = await runFile(
      process.execPath,
      [cli, "ui", "audit", "--root", root, "--url", "file:///etc/passwd"],
      root
    );
    assert.equal(scheme.exitCode, 1);
    assert.ok(scheme.stderr.includes("supports only http and https"));
  });
});

test("a supplied URL without a browser driver fails closed with exit 2", async () => {
  await withTemporaryProject("cli-audit-url", async (root) => {
    await seedProject(root);
    // No Playwright is installed in this fixture, so rendered evidence cannot be produced. The
    // audit must not report success merely because nothing threw.
    const { exitCode, parsed } = await audit(root, [
      "ui",
      "audit",
      "--allow-run",
      "--url",
      "http://127.0.0.1:65535/"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.evidence_complete, false);
    const outcome = parsed.check_outcomes.find((entry) => entry.id === "runtime:rendered-ui");
    assert.equal(outcome?.status, "NOT_RUN");
    assert.ok(parsed.report.residual_risk.some((line) => line.includes("rendered-ui")));
  });
});

test("requested rendered evidence without --allow-run fails closed rather than passing", async () => {
  await withTemporaryProject("cli-audit-url-unauth", async (root) => {
    await seedProject(root);
    const { exitCode, parsed } = await audit(root, [
      "ui",
      "audit",
      "--url",
      "http://198.51.100.7:8080/"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.evidence_complete, false);
  });
});

test("a dry-run audit plans checks without executing or writing", async () => {
  await withTemporaryProject("cli-audit-dry", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(0)"' });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--dry-run"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.report.execution.length, 0);
    assert.ok(parsed.planned_checks.some((check) => check.id === "command:lint"));
  });
});

test("an explicitly selected command in dry-run mode remains incomplete", async () => {
  await withTemporaryProject("cli-audit-explicit-dry", async (root) => {
    await seedProject(root, { lint: 'node -e "process.exit(0)"' });
    const { exitCode, parsed } = await audit(root, [
      "security",
      "audit",
      "--allow-run",
      "--dry-run",
      "--check",
      "command:lint"
    ]);
    assert.equal(exitCode, 2);
    assert.equal(parsed.evidence_complete, false);
    assert.equal(parsed.report.execution.length, 0);
    const outcome = parsed.check_outcomes.find((entry) => entry.id === "command:lint");
    assert.equal(outcome?.status, "NOT_RUN");
    assert.equal(outcome.cause, "deselected");
    assert.ok(outcome.reason?.includes("dry run"));
  });
});

test("planned-check order is stable across repeated audits", async () => {
  await withTemporaryProject("cli-audit-order", async (root) => {
    await seedProject(root, {
      test: 'node -e "process.exit(0)"',
      lint: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(0)"'
    });
    const first = await audit(root, ["all", "audit"]);
    const second = await audit(root, ["all", "audit"]);
    assert.deepEqual(
      first.parsed.planned_checks.map((check) => check.id),
      second.parsed.planned_checks.map((check) => check.id)
    );
    const commands = first.parsed.planned_checks
      .filter((check) => check.kind === "project-command")
      .map((check) => check.id);
    assert.deepEqual(commands, ["command:lint", "command:test", "command:build"]);
  });
});

test("a UI audit and an all-module audit both produce a planned-check ledger", async () => {
  await withTemporaryProject("cli-audit-modules", async (root) => {
    await seedProject(root);
    const ui = await audit(root, ["ui", "audit"]);
    assert.equal(ui.exitCode, 2);
    assert.deepEqual(
      ui.parsed.planned_checks
        .filter((check) => check.kind === "module-inspection")
        .map((c) => c.id),
      ["module:performance", "module:testing", "module:ui"],
      "UI audit should plan the explicit module plus only its directly applicable dependencies"
    );
    const all = await audit(root, ["all", "audit"]);
    assert.equal(all.exitCode, 2);
    assert.ok(
      all.parsed.planned_checks.filter((check) => check.kind === "module-inspection").length > 1
    );
  });
});

test("a changed-scope audit still records a planned-check ledger", async () => {
  await withTemporaryProject("cli-audit-changed", async (root) => {
    await seedProject(root);
    const result = await runFile(
      process.execPath,
      [cli, "all", "audit", "--scope", "changed", "--root", root, "--json"],
      root
    );
    // A non-Git fixture cannot resolve a base ref; either outcome is acceptable as long as it is
    // explicit rather than a silent pass.
    if (result.exitCode === 0) {
      const parsed = JSON.parse(result.stdout) as AuditOutput;
      assert.ok(Array.isArray(parsed.planned_checks));
    } else {
      assert.notEqual(result.stderr.trim(), "");
    }
  });
});

test("--evidence-dir relocates rendered evidence and rejects escaping paths", async () => {
  await withTemporaryProject("cli-audit-evidence-dir", async (root) => {
    await seedProject(root);
    const result = await runFile(
      process.execPath,
      [
        cli,
        "tool",
        "inspect-rendered-ui",
        "http://127.0.0.1:3000/",
        "--root",
        root,
        "--evidence-dir",
        "../escape",
        "--json"
      ],
      root
    );
    const parsed = JSON.parse(result.stdout) as { status: string; reason?: string };
    assert.equal(parsed.status, "BLOCKED");
    assert.ok(parsed.reason?.includes("Unsafe --evidence-dir"));

    const planned = await runFile(
      process.execPath,
      [
        cli,
        "tool",
        "inspect-rendered-ui",
        "http://127.0.0.1:3000/",
        "--root",
        root,
        "--evidence-dir",
        "artifacts/ui",
        "--dry-run",
        "--json"
      ],
      root
    );
    const dry = JSON.parse(planned.stdout) as { evidence_dir?: string };
    assert.ok(dry.evidence_dir?.startsWith("artifacts/ui/"));
  });
});
