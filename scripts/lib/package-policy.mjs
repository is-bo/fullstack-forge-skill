import { assertSafeRelativePath } from "./fs-safety.mjs";
import { generatedBuildRuntimePaths } from "./generated-ownership.mjs";

export const PACKAGE_OWNERSHIP_ROOTS = Object.freeze([
  Object.freeze({ root: ".agents/skills", platform: "agents" }),
  Object.freeze({ root: "skills", platform: "codex-plugin" }),
  Object.freeze({ root: ".claude/skills", platform: "claude" }),
  Object.freeze({ root: ".cursor/skills", platform: "cursor" }),
  Object.freeze({ root: ".gemini/skills", platform: "gemini" }),
  Object.freeze({ root: ".github/skills", platform: "github" }),
  Object.freeze({ root: ".windsurf/skills", platform: "windsurf" }),
  Object.freeze({ root: ".fullstack-forge/skills", platform: "canonical" }),
  Object.freeze({ root: ".fullstack-forge/upstream", platform: "upstream" }),
  Object.freeze({ root: ".fullstack-forge/manifests", platform: "manifests" }),
  Object.freeze({ root: ".fullstack-forge/runtime", platform: "runtime" })
]);

/**
 * The one publishable path below `.fullstack-forge/`.
 *
 * `.fullstack-forge` is otherwise private: in an installed project it holds the ownership manifest
 * and other local state that must never be published. The bundled canonical managed content lives
 * under `.fullstack-forge/skills/`, and every host adapter in a release archive points at it, so an
 * archive without this tree extracts into a damaged installation. Only the leading segment is
 * exempted; every segment below it is still scanned for private, credential, and log names.
 */
const MANAGED_ARCHIVE_PREFIXES = Object.freeze(
  PACKAGE_OWNERSHIP_ROOTS.filter(({ root }) => root.startsWith(".fullstack-forge/")).map(
    ({ root }) => `${root}/`
  )
);

const PRIVATE_SEGMENTS = new Set([
  ".audit",
  ".audit-work",
  ".codex",
  ".forge",
  ".fullstack-forge",
  ".git",
  ".tmp",
  "attachments",
  "backups",
  "coverage",
  "dist",
  "graphify-out",
  "logs",
  "node_modules",
  "uploads"
]);

const PRIVATE_NAME =
  /(?:fullstack[-_ ]forge.*(?:private|spec|vision)|dual[-_ ]spec.*audit|development[-_ ]vision|pasted[-_ ]text|private[-_ ](?:inputs?|clones?))/iu;
const CREDENTIAL_SEGMENT =
  /^(?:\.env(?:\..*)?|.*\.(?:key|pem|p12|pfx|jks|keystore)|credentials?(?:\..*)?|secrets?(?:\..*)?|tokens?(?:\..*))$/iu;
export const NPM_ONLY_PACKAGE_PATHS = Object.freeze([
  ".agents/plugins/marketplace.json",
  ".codex-plugin/plugin.json",
  "package.json",
  "skill.json"
]);
const NPM_ONLY_PATHS = new Set(NPM_ONLY_PACKAGE_PATHS);
// Build output is generated code, but the npm boundary must still be exact.  Export an immutable
// array for diagnostics/tests and keep the internal Set private to prevent policy mutation.
export const GENERATED_BUILD_RUNTIME_PATHS = Object.freeze(
  [...generatedBuildRuntimePaths()].sort()
);
const GENERATED_BUILD_RUNTIME_PATH_SET = new Set(GENERATED_BUILD_RUNTIME_PATHS);

export function packageCommonPaths(version) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version))
    throw new Error(`Invalid package version: ${version}`);
  return Object.freeze(
    [
      "README.md",
      "LICENSE",
      "NOTICE",
      "THIRD_PARTY_NOTICES.md",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      "SECURITY.md",
      "CHANGELOG.md",
      "config/external-experts.json",
      "docs/ADDING_A_MODULE.md",
      "docs/ADDING_A_PLATFORM.md",
      "docs/ADVANCED_CLI.md",
      "docs/AUDIT_YOUR_APPLICATION.md",
      "docs/ARCHITECTURE.md",
      "docs/ANALYZER_SUPPORT.md",
      "docs/BRAND.md",
      "docs/BUILD_MODE.md",
      "docs/BUILD_YOUR_FIRST_FEATURE.md",
      "docs/CLI_REFERENCE.md",
      "docs/COMMANDS.md",
      "docs/COVERAGE.md",
      "docs/DEVELOPMENT.md",
      "docs/EXTERNAL_EXPERTS.md",
      "docs/FINDING_SCHEMA.md",
      "docs/FIX_AND_VERIFY.md",
      "docs/GETTING_STARTED.md",
      "docs/IMAGE_GENERATION_BRIEF.md",
      `docs/MIGRATION_v${version}.md`,
      "docs/MIGRATION_v0.2.0.md",
      "docs/MIGRATION_v0.2.1.md",
      "docs/MIGRATION_v0.2.2.md",
      "docs/MIGRATION_v0.3.0.md",
      "docs/PLATFORM_SUPPORT.md",
      "docs/NONTECHNICAL_GUIDE.md",
      `docs/RELEASE_NOTES_v${version}.md`,
      `docs/RELEASE_VERIFICATION_v${version}.md`,
      "docs/RELEASE_NOTES_v0.2.0.md",
      "docs/RELEASE_NOTES_v0.2.1.md",
      "docs/RELEASE_NOTES_v0.2.2.md",
      "docs/RELEASE_NOTES_v0.3.0.md",
      "docs/RELEASE_VERIFICATION_v0.2.0.md",
      "docs/RELEASE_VERIFICATION_v0.2.1.md",
      "docs/RELEASE_VERIFICATION_v0.2.2.md",
      "docs/RELEASE_VERIFICATION_v0.3.0.md",
      "docs/RELEASE.md",
      "docs/RELEASE_CHANNEL.md",
      "docs/RELEASING.md",
      "docs/REPOSITORY_INVENTORY.md",
      "docs/REPORT_SCHEMA.md",
      "docs/SECURITY_MODEL.md",
      "docs/SHIP_A_RELEASE.md",
      "docs/TRACEABILITY.md",
      "docs/TRACEABILITY_MATRIX.md",
      "docs/TROUBLESHOOTING.md",
      "examples/quickstart-demo/src/App.tsx",
      "examples/quickstart-demo/README.md",
      "examples/quickstart-demo/app.test.js",
      "examples/quickstart-demo/package.json",
      "docs/assets/fullstack-forge-hero.png",
      "docs/assets/fullstack-forge-social-preview.png",
      "docs/assets/fullstack-forge-icon.png",
      "research/LICENSE_MATRIX.md",
      "research/SOURCES.md",
      "research/ADAPTATION_NOTES.md",
      "research/FRONTEND_UI_UX_SYSTEM.md"
    ].filter((path, index, paths) => paths.indexOf(path) === index)
  );
}

/**
 * Reject paths that are never safe to publish, independently of any artifact-specific allowlist.
 *
 * Both the ZIP-style release archives and the npm package pass through this boundary. Keeping the
 * private-state rules here prevents a broad `package.json#files` entry from bypassing the stricter
 * release archive policy.
 */
export function assertPublicPackagePath(path, label = "package path") {
  assertSafeRelativePath(path, label);
  if (path.includes("\\")) throw new Error(`Package paths must use forward slashes: ${path}`);
  const normalized = path.toLowerCase();
  const segments = normalized.split("/");
  const canonicalManagedPath = MANAGED_ARCHIVE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix)
  );
  // Skip only the exempted leading segment for canonical content; keep scanning everything below it.
  const scanned = canonicalManagedPath ? segments.slice(1) : segments;
  const scannedPath = scanned.join("/");
  if (
    scanned.some((segment) => PRIVATE_SEGMENTS.has(segment)) ||
    normalized.endsWith(".log") ||
    PRIVATE_NAME.test(scannedPath) ||
    scanned.some((segment) => CREDENTIAL_SEGMENT.test(segment))
  )
    throw new Error(`Forbidden private or local package path: ${path}`);

  return normalized;
}

/**
 * Final archive-inventory boundary.
 *
 * Packaging already starts from explicit source roots. This check is deliberately independent:
 * a future source-root change still cannot add an undeclared top-level tree to a release archive.
 */
export function assertPublishableArchivePath(path, version, ownedPaths = new Set()) {
  const normalized = assertPublicPackagePath(path, "package archive path");
  if (!isPublishableArchivePath(path, normalized, version, ownedPaths))
    throw new Error(`Undeclared package path outside the release allowlist: ${path}`);
}

/**
 * npm publishes the same reviewed archive content plus the compiled CLI and two plugin manifests.
 * Everything else is denied, even when a broad or future `package.json#files` entry includes it.
 */
export function assertPublishableNpmPath(path, version, ownedPaths = new Set()) {
  const normalized = assertPublicPackagePath(path, "npm package path");
  if (
    !isPublishableArchivePath(path, normalized, version, ownedPaths) &&
    !NPM_ONLY_PATHS.has(path) &&
    !(path === normalized && GENERATED_BUILD_RUNTIME_PATH_SET.has(path))
  )
    throw new Error(`Undeclared npm package path outside the release allowlist: ${path}`);
}

function isPublishableArchivePath(path, normalized, version, ownedPaths) {
  const common = new Set(packageCommonPaths(version));
  const ownedRoot = PACKAGE_OWNERSHIP_ROOTS.find(({ root }) =>
    normalized.startsWith(`${root.toLowerCase()}/`)
  );
  return (
    common.has(path) ||
    (ownedRoot !== undefined && ownedPaths instanceof Set && ownedPaths.has(path))
  );
}
