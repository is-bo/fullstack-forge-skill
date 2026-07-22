import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILD_PRODUCER_REGISTRY,
  executeBuildProducer,
  registeredBuildProducer,
  type BuildInputHash
} from "../src/build-producers.js";
import type { CommandDefinition } from "../src/types.js";

const manifest: BuildInputHash[] = [{ path: "src/feature.ts", sha256: "a".repeat(64) }];
const fixedNow = () => "2026-07-21T12:00:00.000Z";

function command(name: string): CommandDefinition {
  return {
    name,
    executable: process.execPath,
    args: ["--version"],
    source: "package.json",
    definition: "node --version"
  };
}

async function pass(scriptName: string, criterion: string): Promise<void> {
  const result = await executeBuildProducer({
    root: process.cwd(),
    criterion,
    command: command(scriptName),
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: true,
    offline: false,
    now: fixedNow,
    run_command: () => Promise.resolve({ exitCode: 0, stdout: "ok", stderr: "" })
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.domain, "Build");
  assert.equal(result.command.argv[0], process.execPath);
  assert.equal(result.command.output_sha256?.length, 64);
  assert.equal(result.expires_at, "2026-07-22T12:00:00.000Z");
}

test("registered producers cover each material Build discipline PASS path", async (t) => {
  const paths: Array<[string, string]> = [
    ["test:auth", "discipline:auth"],
    ["test:authorization", "discipline:authorization"],
    ["test:tenancy", "discipline:tenancy"],
    ["test:uploads", "discipline:uploads"],
    ["test:payments", "discipline:payments"],
    ["test:ui", "discipline:ui"],
    ["test:accessibility", "discipline:accessibility"],
    ["test:database", "discipline:database"],
    ["test:queries", "discipline:queries"],
    ["test:cache", "discipline:cache"],
    ["test", "behavior-verification"],
    ["test:deployment", "discipline:deployment"]
  ];
  for (const [scriptName, criterion] of paths)
    await t.test(scriptName, () => pass(scriptName, criterion));
});

test("high-tier security and migration criteria have exact registered producers", () => {
  for (const criterion of [
    "security-negative-tests",
    "authentication-negative-tests",
    "authorization-negative-tests",
    "tenant-isolation-tests",
    "upload-hostile-file-tests",
    "webhook-safety-tests",
    "migration-validation",
    "migration-recovery",
    "privacy-data-flow",
    "integration-verification",
    "security-review"
  ])
    assert.ok(
      BUILD_PRODUCER_REGISTRY.some((entry) => entry.criterion === criterion),
      criterion
    );
  assert.equal(
    new Set(BUILD_PRODUCER_REGISTRY.map((entry) => `${entry.script_name}\u0000${entry.criterion}`))
      .size,
    BUILD_PRODUCER_REGISTRY.length
  );
  assert.equal(
    new Set(BUILD_PRODUCER_REGISTRY.map((entry) => entry.id)).size,
    BUILD_PRODUCER_REGISTRY.length
  );
});

test("missing, unsupported, and cross-criterion scripts never manufacture PASS", async () => {
  const missing = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:auth",
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: true,
    offline: false,
    now: fixedNow
  });
  assert.equal(missing.status, "NOT_VERIFIED");
  const unsupported = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:auth",
    command: command("test:invented"),
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: true,
    offline: false,
    now: fixedNow
  });
  assert.equal(unsupported.status, "NOT_VERIFIED");
  const crossed = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:authorization",
    command: command("test:auth"),
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: true,
    offline: false,
    now: fixedNow
  });
  assert.equal(crossed.status, "NOT_VERIFIED");
  assert.equal(registeredBuildProducer("test:auth")?.criterion, "discipline:auth");
});

test("authorization and offline refusals are visible BLOCKED observations", async () => {
  const denied = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:auth",
    command: command("test:auth"),
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: false,
    offline: false,
    now: fixedNow
  });
  assert.equal(denied.status, "BLOCKED");
  const offline = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:auth",
    command: command("test:auth"),
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: true,
    offline: true,
    now: fixedNow
  });
  assert.equal(offline.status, "BLOCKED");
  assert.match(offline.limitations.join(" "), /offline/u);
});

test("failure, incomplete manifests, and redacted output remain visible", async () => {
  const failure = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:auth",
    command: command("test:auth"),
    input_manifest: manifest,
    input_manifest_complete: true,
    allow_run: true,
    offline: false,
    now: fixedNow,
    run_command: () =>
      Promise.resolve({ exitCode: 7, stdout: "token=fixture-secret-value", stderr: "failed" })
  });
  assert.equal(failure.status, "FAIL");
  assert.equal(failure.command.exit_code, 7);
  assert.match(failure.command.output_excerpt ?? "", /\[REDACTED\]/u);
  const incomplete = await executeBuildProducer({
    root: process.cwd(),
    criterion: "discipline:auth",
    command: command("test:auth"),
    input_manifest: [],
    input_manifest_complete: false,
    allow_run: true,
    offline: false,
    now: fixedNow
  });
  assert.equal(incomplete.status, "NOT_VERIFIED");
});
