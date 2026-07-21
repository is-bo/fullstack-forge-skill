import { assertSafeRelativePath } from "./fs-safety.mjs";

const PLATFORM_PREFIXES = Object.freeze([
  ".agents/skills/",
  ".claude/skills/",
  ".cursor/skills/",
  ".gemini/skills/",
  ".github/skills/",
  ".windsurf/skills/"
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
  "coverage",
  "dist",
  "graphify-out",
  "node_modules"
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
    `docs/AUDIT_CLASSIFICATION_v${version}.md`,
    "docs/ARCHITECTURE.md",
    "docs/ANALYZER_SUPPORT.md",
    "docs/BRAND.md",
    "docs/COMMANDS.md",
    "docs/COVERAGE.md",
    "docs/DEVELOPMENT.md",
    "docs/FINDING_SCHEMA.md",
    "docs/IMAGE_GENERATION_BRIEF.md",
    "docs/PLATFORM_SUPPORT.md",
    `docs/RELEASE_NOTES_v${version}.md`,
    `docs/RELEASE_VERIFICATION_v${version}.md`,
    "docs/RELEASE.md",
    "docs/RELEASING.md",
    "docs/SECURITY_MODEL.md",
    "docs/assets/fullstack-forge-hero.png",
    "docs/assets/fullstack-forge-social-preview.png",
    "docs/assets/fullstack-forge-icon.png"
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
  if (
    segments.some((segment) => PRIVATE_SEGMENTS.has(segment)) ||
    normalized.endsWith(".log") ||
    PRIVATE_NAME.test(normalized) ||
    segments.some((segment) => CREDENTIAL_SEGMENT.test(segment))
  )
    throw new Error(`Forbidden private or local package path: ${path}`);

  const common = new Set(packageCommonPaths(version));
  const managedPlatformPath = PLATFORM_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!common.has(path) && !managedPlatformPath)
    throw new Error(`Undeclared package path outside the release allowlist: ${path}`);
}
