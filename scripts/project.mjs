import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const canonicalRoot = join(projectRoot, "src", "fullstack-forge");
export const commandRoot = join(canonicalRoot, "commands");
export const manifestName = ".fullstack-forge-generated.json";

export const expectedSlugs = Object.freeze([
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
]);

export const expectedBuildCommands = Object.freeze(["forge", "forge-new", "forge-feature"]);

export const platformTargets = Object.freeze([
  {
    id: "agents",
    label: "Codex, Antigravity project, and generic Agent Skills",
    path: ".agents/skills"
  },
  {
    id: "codex-plugin",
    label: "Codex plugin bundle (thin adapters)",
    path: "skills"
  },
  { id: "claude", label: "Claude Code", path: ".claude/skills" },
  { id: "cursor", label: "Cursor", path: ".cursor/skills" },
  { id: "gemini", label: "Gemini CLI", path: ".gemini/skills" },
  { id: "github", label: "GitHub Copilot", path: ".github/skills" },
  { id: "windsurf", label: "Windsurf/Devin Cascade", path: ".windsurf/skills" }
]);

export async function readCatalog() {
  return JSON.parse(await readFile(join(projectRoot, "config", "modules.json"), "utf8"));
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
