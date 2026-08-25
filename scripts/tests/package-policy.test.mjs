import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicPackagePath,
  assertPublishableArchivePath,
  assertPublishableNpmPath,
  GENERATED_BUILD_RUNTIME_PATHS,
  packageCommonPaths
} from "../lib/package-policy.mjs";

const VERSION = "0.3.0";
const OWNED_PATHS = new Set([
  ".agents/skills/fullstack-forge/SKILL.md",
  "skills/fullstack-forge/SKILL.md",
  "skills/forge-security/SKILL.md",
  ".claude/skills/forge-security/SKILL.md",
  ".github/skills/forge-feature/agents/openai.yaml",
  ".fullstack-forge/skills/fullstack-forge/SKILL.md",
  ".fullstack-forge/skills/forge-security/SKILL.md",
  ".fullstack-forge/skills/fullstack-forge/references/shared/module-contract.md",
  ".fullstack-forge/skills/forge/assets/fullstack-forge-icon.png",
  ".fullstack-forge/runtime/cli/src/composition-entry.js"
]);

test("package policy accepts only declared common files and managed platform roots", () => {
  for (const path of packageCommonPaths(VERSION))
    assert.doesNotThrow(() => assertPublishableArchivePath(path, VERSION), path);
  for (const path of [
    ".agents/skills/fullstack-forge/SKILL.md",
    "skills/fullstack-forge/SKILL.md",
    ".claude/skills/forge-security/SKILL.md",
    ".github/skills/forge-feature/agents/openai.yaml"
  ])
    assert.doesNotThrow(() => assertPublishableArchivePath(path, VERSION, OWNED_PATHS), path);

  // Host adapters are pointers, so the canonical tree they name must be publishable too.
  for (const path of [
    ".fullstack-forge/skills/fullstack-forge/SKILL.md",
    ".fullstack-forge/skills/forge-security/SKILL.md",
    ".fullstack-forge/skills/fullstack-forge/references/shared/module-contract.md",
    ".fullstack-forge/skills/forge/assets/fullstack-forge-icon.png"
  ])
    assert.doesNotThrow(() => assertPublishableArchivePath(path, VERSION, OWNED_PATHS), path);

  for (const path of [
    "package.json",
    "cli/src/index.ts",
    "docs/unlisted-local-note.md",
    "research/private-clone/README.md"
  ])
    assert.throws(() => assertPublishableArchivePath(path, VERSION), /allowlist|Forbidden/u, path);
});

test("package policy includes the packaged user-documentation link closure", () => {
  const paths = new Set(packageCommonPaths("0.2.0"));
  for (const path of [
    "docs/BUILD_MODE.md",
    "docs/CLI_REFERENCE.md",
    "docs/REPOSITORY_INVENTORY.md",
    "docs/REPORT_SCHEMA.md",
    "docs/TRACEABILITY.md",
    "docs/TRACEABILITY_MATRIX.md",
    "docs/EXTERNAL_EXPERTS.md",
    "config/external-experts.json",
    "docs/MIGRATION_v0.2.1.md",
    "docs/RELEASE_NOTES_v0.2.2.md",
    "docs/RELEASE_VERIFICATION_v0.2.2.md",
    "research/ADAPTATION_NOTES.md",
    "research/FRONTEND_UI_UX_SYSTEM.md",
    "research/LICENSE_MATRIX.md",
    "research/SOURCES.md"
  ]) {
    assert.equal(paths.has(path), true, path);
    assert.doesNotThrow(() => assertPublishableArchivePath(path, "0.2.0"), path);
  }
});

test("package policy rejects private state, specifications, credentials, logs, and unsafe paths", () => {
  for (const path of [
    ".agents/skills/.audit/report.md",
    ".agents/skills/.audit-work/notes.md",
    ".agents/skills/.forge/report.json",
    ".agents/skills/fullstack-forge/FULLSTACK_FORGE_SPEC.md",
    ".agents/skills/fullstack-forge/fullstack-forge-development-vision/GOAL.md",
    ".agents/skills/fullstack-forge/fullstack-forge-dual-spec-audit.md",
    ".agents/skills/fullstack-forge/.env",
    ".agents/skills/fullstack-forge/release.log",
    ".agents/skills/fullstack-forge/credentials.json",
    "skills/fullstack-forge/.env",
    "skills/fullstack-forge/release.log",
    "uploads/private.sqlite",
    "logs/application.log",
    "backups/database.tar",
    ".agents/skills/fullstack-forge/../../escape.md",
    "C:/absolute.md",
    ".agents\\skills\\fullstack-forge\\SKILL.md",
    // Only `.fullstack-forge/skills/` is exempt; installed-project state stays private, and the
    // exemption must not become a hole for private segments nested below it.
    ".fullstack-forge/install-manifest.json",
    ".fullstack-forge/skills/node_modules/pkg/index.js",
    ".fullstack-forge/skills/forge/.env",
    ".fullstack-forge/skills/forge/release.log"
  ])
    assert.throws(
      () => assertPublishableArchivePath(path, VERSION),
      /Unsafe|forward slashes|Forbidden/u,
      path
    );
});

test("public package boundary rejects private npm paths without imposing the archive allowlist", () => {
  for (const path of ["scripts/check-release.mjs", "build/cli/src/index.js", "package.json"])
    assert.doesNotThrow(() => assertPublicPackagePath(path), path);

  for (const path of [
    "scripts/private-inputs.json",
    "docs/fullstack-forge-private-spec.md",
    "scripts/credentials.json",
    "research/private-clone/README.md"
  ])
    assert.throws(() => assertPublicPackagePath(path), /Forbidden/u, path);
});

test("npm package boundary allows only reviewed runtime, plugin, and archive content", () => {
  for (const path of [
    "package.json",
    "skill.json",
    ".codex-plugin/plugin.json",
    ".agents/plugins/marketplace.json",
    "build/cli/src/index.js",
    "build/cli/src/index.d.ts",
    "docs/RELEASE.md",
    ".fullstack-forge/runtime/cli/src/composition-entry.js",
    "skills/forge-security/SKILL.md"
  ])
    assert.doesNotThrow(() => assertPublishableNpmPath(path, VERSION, OWNED_PATHS), path);

  for (const path of [
    "scripts/customer-spec.md",
    "research/acme-clone/README.md",
    "scripts/audit-report.json",
    "docs/internal-roadmap.md",
    "build/cli/src/internal-roadmap.md",
    "build/cli/src/customer-private-data.js",
    "build/cli/src/postinstall.js",
    "src/fullstack-forge/local-note.md",
    "config/local.json"
  ])
    assert.throws(() => assertPublishableNpmPath(path, VERSION), /npm package path/u, path);
});

test("generated CLI runtime ownership is exact and complete", () => {
  assert.equal(GENERATED_BUILD_RUNTIME_PATHS.length, 116);
  assert.equal(new Set(GENERATED_BUILD_RUNTIME_PATHS).size, 116);
  for (const path of [
    "build/cli/src/index.js",
    "build/cli/src/index.d.ts",
    "build/cli/src/legacy-install-hashes.js",
    "build/cli/src/legacy-install-hashes.d.ts",
    "build/cli/src/project-command-execution.js",
    "build/cli/src/project-command-execution.d.ts"
  ]) {
    assert.equal(GENERATED_BUILD_RUNTIME_PATHS.includes(path), true, path);
    assert.doesNotThrow(() => assertPublishableNpmPath(path, VERSION), path);
  }
  for (const path of [
    "build/cli/src/customer-private-data.js",
    "build/cli/src/index.js.map",
    "build/cli/src/index.test.js"
  ]) {
    assert.equal(GENERATED_BUILD_RUNTIME_PATHS.includes(path), false, path);
    assert.throws(() => assertPublishableNpmPath(path, VERSION), /npm package path/u, path);
  }
});

test("managed package roots require exact generated ownership", () => {
  for (const path of [
    ".agents/skills/client-notes.md",
    ".fullstack-forge/skills/client-notes.md",
    ".fullstack-forge/upstream/example/client-notes.md",
    ".fullstack-forge/runtime/client-notes.md"
  ]) {
    assert.throws(
      () => assertPublishableArchivePath(path, VERSION, OWNED_PATHS),
      /release allowlist/u,
      path
    );
    assert.throws(
      () => assertPublishableNpmPath(path, VERSION, OWNED_PATHS),
      /npm package path/u,
      path
    );
  }
});

test("package policy validates the semantic version used to build the allowlist", () => {
  assert.throws(() => packageCommonPaths("latest"), /Invalid package version/u);
});
