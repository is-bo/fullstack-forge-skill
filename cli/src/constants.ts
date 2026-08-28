import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = "0.3.1";
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const MODULE_SLUGS = [
  "discover",
  "requirements",
  "architecture",
  "code",
  "ui",
  "ux",
  "accessibility",
  "i18n",
  "seo",
  "frontend",
  "api",
  "jobs",
  "integrations",
  "auth",
  "authorization",
  "security",
  "privacy",
  "tenancy",
  "uploads",
  "database",
  "queries",
  "cache",
  "storage",
  "testing",
  "performance",
  "scale",
  "observability",
  "reliability",
  "recovery",
  "deployment",
  "infrastructure",
  "supply-chain",
  "cost",
  "docs",
  "analytics",
  "notifications",
  "ai",
  "payments",
  "realtime",
  "offline",
  "all",
  "ship"
] as const;

export type ModuleSlug = (typeof MODULE_SLUGS)[number];

/**
 * Build-mode verbs, dispatched before module-slug parsing. `feature` takes a slug and an optional
 * reserved sub-verb. These names are reserved so a feature slug can never shadow a command.
 */
export const BUILD_VERBS = ["new", "feature", "resume", "migrate"] as const;
export const BUILD_SUB_VERBS = [
  "frame",
  "plan",
  "check",
  "done",
  "accept-risk",
  "abandon",
  "status"
] as const;

export const PLATFORM_CONFIG = {
  agents: {
    label: "Codex and generic Agent Skills",
    projectPath: [".agents", "skills"],
    globalPath: [".agents", "skills"],
    sourcePath: [".agents", "skills"]
  },
  antigravity: {
    label: "Google Antigravity",
    projectPath: [".agents", "skills"],
    globalPath: [".gemini", "config", "skills"],
    sourcePath: [".agents", "skills"]
  },
  claude: {
    label: "Claude Code",
    projectPath: [".claude", "skills"],
    globalPath: [".claude", "skills"],
    sourcePath: [".claude", "skills"]
  },
  cursor: {
    label: "Cursor",
    projectPath: [".cursor", "skills"],
    globalPath: [".cursor", "skills"],
    sourcePath: [".cursor", "skills"]
  },
  gemini: {
    label: "Gemini CLI",
    projectPath: [".gemini", "skills"],
    globalPath: [".gemini", "skills"],
    sourcePath: [".gemini", "skills"]
  },
  github: {
    label: "GitHub Copilot",
    projectPath: [".github", "skills"],
    globalPath: [".copilot", "skills"],
    sourcePath: [".github", "skills"]
  },
  windsurf: {
    label: "Windsurf/Devin Cascade",
    projectPath: [".windsurf", "skills"],
    globalPath: [".codeium", "windsurf", "skills"],
    sourcePath: [".windsurf", "skills"]
  }
} as const;

export type Platform = keyof typeof PLATFORM_CONFIG;
export const PLATFORMS = Object.keys(PLATFORM_CONFIG) as Platform[];
export const PLATFORM_ALIASES = {
  generic: "agents",
  codex: "agents"
} as const satisfies Record<string, Platform>;

export const TOOL_NAMES = [
  "detect-stack",
  "discover-project",
  "detect-project-commands",
  "run-project-command",
  "inspect-env-template",
  "scan-secret-patterns",
  "inspect-routes",
  "inspect-auth-boundaries",
  "inspect-authorization",
  "inspect-upload-pipeline",
  "inspect-database-schema",
  "inspect-query-patterns",
  "inspect-cache-usage",
  "inspect-dependencies",
  "inspect-ci",
  "inspect-deployment-config",
  "inspect-platform-skills",
  "inspect-rendered-ui",
  "generate-report",
  "ingest-agent-findings",
  "snapshot-evidence",
  "validate-finding-schema",
  "validate-skill",
  "sync-platform-assets",
  "check-platform-assets",
  "package-platforms",
  "smoke-install"
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const ALWAYS_APPLICABLE = new Set<ModuleSlug>([
  "discover",
  "requirements",
  "architecture",
  "code",
  "security",
  "testing",
  "supply-chain",
  "docs",
  "all",
  "ship"
]);

export const SECTION_CAPABILITY: Partial<Record<ModuleSlug, string>> = {
  ui: "frontend",
  ux: "frontend",
  accessibility: "frontend",
  i18n: "internationalization",
  seo: "public-web",
  frontend: "frontend",
  api: "api",
  jobs: "jobs",
  integrations: "integrations",
  auth: "authentication",
  authorization: "authorization",
  privacy: "personal-data",
  tenancy: "tenancy",
  uploads: "uploads",
  database: "database",
  queries: "database",
  cache: "cache",
  storage: "storage",
  performance: "runtime",
  scale: "runtime",
  observability: "observability",
  reliability: "runtime",
  recovery: "database",
  deployment: "deployment",
  infrastructure: "infrastructure",
  cost: "paid-services",
  analytics: "analytics",
  notifications: "notifications",
  ai: "ai",
  payments: "payments",
  realtime: "realtime",
  offline: "offline"
};
