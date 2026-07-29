import { assertSafeRelativePath } from "./fs-safety.mjs";

const PLATFORM_PREFIXES = Object.freeze([
  ".agents/skills/",
  ".claude/skills/",
  ".cursor/skills/",
  ".gemini/skills/",
  ".github/skills/",
  ".windsurf/skills/"
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
const MANAGED_ARCHIVE_PREFIXES = Object.freeze([
  ".fullstack-forge/skills/",
  ".fullstack-forge/upstream/",
  ".fullstack-forge/manifests/",
  ".fullstack-forge/runtime/"
]);

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
  /(?:fullstack[-_ ]forge.*(?:private|spec|vision)|dual[-_ ]spec.*audit|development[-_ ]vision|pasted[-_ ]text|private[-_ ]inputs?)/iu;
const CREDENTIAL_SEGMENT =
  /^(?:\.env(?:\..*)?|.*\.(?:key|pem|p12|pfx|jks|keystore)|credentials?(?:\..*)?|secrets?(?:\..*)?|tokens?(?:\..*))$/iu;

export function packageCommonPaths(version) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version))
    throw new Error(`Invalid package version: ${version}`);
  return Object.freeze([
    "README.md",
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "CHANGELOG.md",
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
    "docs/FINDING_SCHEMA.md",
    "docs/FIX_AND_VERIFY.md",
    "docs/GETTING_STARTED.md",
    "docs/IMAGE_GENERATION_BRIEF.md",
    `docs/MIGRATION_v${version}.md`,
    "docs/PLATFORM_SUPPORT.md",
    "docs/NONTECHNICAL_GUIDE.md",
    `docs/RELEASE_NOTES_v${version}.md`,
    `docs/RELEASE_VERIFICATION_v${version}.md`,
    "docs/RELEASE.md",
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
    "research/SOURCES.md"
  ]);
}

/**
 * Final package-inventory boundary.
 *
 * Packaging already starts from explicit source roots. This check is deliberately independent:
 * a future source-root change still cannot smuggle local audit state, specifications, credentials,
 * or an undeclared top-level tree into a release archive.
 */
export function assertPublishableArchivePath(path, version) {
  assertSafeRelativePath(path, "package archive path");
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

  const common = new Set(packageCommonPaths(version));
  const managedPlatformPath = PLATFORM_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!common.has(path) && !managedPlatformPath && !canonicalManagedPath)
    throw new Error(`Undeclared package path outside the release allowlist: ${path}`);
}
