export declare const VERSION = "0.1.0";
export declare const PACKAGE_ROOT: string;
export declare const MODULE_SLUGS: readonly ["discover", "requirements", "architecture", "code", "ui", "ux", "accessibility", "i18n", "seo", "frontend", "api", "jobs", "integrations", "auth", "authorization", "security", "privacy", "tenancy", "uploads", "database", "queries", "cache", "storage", "testing", "performance", "scale", "observability", "reliability", "recovery", "deployment", "infrastructure", "supply-chain", "cost", "docs", "analytics", "notifications", "ai", "payments", "realtime", "offline", "all", "ship"];
export type ModuleSlug = (typeof MODULE_SLUGS)[number];
/**
 * Build-mode verbs, dispatched before module-slug parsing. `feature` takes a slug and an optional
 * reserved sub-verb. These names are reserved so a feature slug can never shadow a command.
 */
export declare const BUILD_VERBS: readonly ["new", "feature", "resume", "migrate"];
export declare const BUILD_SUB_VERBS: readonly ["frame", "plan", "check", "done", "accept-risk", "abandon", "status"];
export declare const PLATFORM_CONFIG: {
    readonly agents: {
        readonly label: "Codex and generic Agent Skills";
        readonly projectPath: readonly [".agents", "skills"];
        readonly globalPath: readonly [".agents", "skills"];
        readonly sourcePath: readonly [".agents", "skills"];
    };
    readonly antigravity: {
        readonly label: "Google Antigravity";
        readonly projectPath: readonly [".agents", "skills"];
        readonly globalPath: readonly [".gemini", "config", "skills"];
        readonly sourcePath: readonly [".agents", "skills"];
    };
    readonly claude: {
        readonly label: "Claude Code";
        readonly projectPath: readonly [".claude", "skills"];
        readonly globalPath: readonly [".claude", "skills"];
        readonly sourcePath: readonly [".claude", "skills"];
    };
    readonly cursor: {
        readonly label: "Cursor";
        readonly projectPath: readonly [".cursor", "skills"];
        readonly globalPath: readonly [".cursor", "skills"];
        readonly sourcePath: readonly [".cursor", "skills"];
    };
    readonly gemini: {
        readonly label: "Gemini CLI";
        readonly projectPath: readonly [".gemini", "skills"];
        readonly globalPath: readonly [".gemini", "skills"];
        readonly sourcePath: readonly [".gemini", "skills"];
    };
    readonly github: {
        readonly label: "GitHub Copilot";
        readonly projectPath: readonly [".github", "skills"];
        readonly globalPath: readonly [".copilot", "skills"];
        readonly sourcePath: readonly [".github", "skills"];
    };
    readonly windsurf: {
        readonly label: "Windsurf/Devin Cascade";
        readonly projectPath: readonly [".windsurf", "skills"];
        readonly globalPath: readonly [".codeium", "windsurf", "skills"];
        readonly sourcePath: readonly [".windsurf", "skills"];
    };
};
export type Platform = keyof typeof PLATFORM_CONFIG;
export declare const PLATFORMS: Platform[];
export declare const PLATFORM_ALIASES: {
    readonly generic: "agents";
    readonly codex: "agents";
};
export declare const TOOL_NAMES: readonly ["detect-stack", "discover-project", "detect-project-commands", "run-project-command", "inspect-env-template", "scan-secret-patterns", "inspect-routes", "inspect-auth-boundaries", "inspect-authorization", "inspect-upload-pipeline", "inspect-database-schema", "inspect-query-patterns", "inspect-cache-usage", "inspect-dependencies", "inspect-ci", "inspect-deployment-config", "inspect-platform-skills", "inspect-rendered-ui", "generate-report", "ingest-agent-findings", "snapshot-evidence", "validate-finding-schema", "validate-skill", "sync-platform-assets", "check-platform-assets", "package-platforms", "smoke-install"];
export type ToolName = (typeof TOOL_NAMES)[number];
export declare const ALWAYS_APPLICABLE: Set<"discover" | "requirements" | "architecture" | "code" | "ui" | "ux" | "accessibility" | "i18n" | "seo" | "frontend" | "api" | "jobs" | "integrations" | "auth" | "authorization" | "security" | "privacy" | "tenancy" | "uploads" | "database" | "queries" | "cache" | "storage" | "testing" | "performance" | "scale" | "observability" | "reliability" | "recovery" | "deployment" | "infrastructure" | "supply-chain" | "cost" | "docs" | "analytics" | "notifications" | "ai" | "payments" | "realtime" | "offline" | "all" | "ship">;
export declare const SECTION_CAPABILITY: Partial<Record<ModuleSlug, string>>;
