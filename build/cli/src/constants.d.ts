export declare const VERSION = "0.1.9";
export declare const PACKAGE_ROOT: string;
export declare const MODULE_SLUGS: readonly ["discover", "requirements", "architecture", "code", "ui", "ux", "accessibility", "i18n", "seo", "frontend", "api", "jobs", "integrations", "auth", "authorization", "security", "privacy", "tenancy", "uploads", "database", "queries", "cache", "storage", "testing", "performance", "scale", "observability", "reliability", "recovery", "deployment", "infrastructure", "supply-chain", "cost", "docs", "analytics", "notifications", "ai", "payments", "realtime", "offline", "all", "ship"];
export type ModuleSlug = (typeof MODULE_SLUGS)[number];
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
export declare const TOOL_NAMES: readonly ["detect-stack", "discover-project", "detect-project-commands", "run-project-command", "inspect-env-template", "scan-secret-patterns", "inspect-routes", "inspect-auth-boundaries", "inspect-authorization", "inspect-upload-pipeline", "inspect-database-schema", "inspect-query-patterns", "inspect-cache-usage", "inspect-dependencies", "inspect-ci", "inspect-deployment-config", "inspect-platform-skills", "inspect-rendered-ui", "generate-report", "validate-finding-schema", "validate-skill", "sync-platform-assets", "check-platform-assets", "package-platforms", "smoke-install"];
export type ToolName = (typeof TOOL_NAMES)[number];
export declare const ALWAYS_APPLICABLE: Set<"security" | "auth" | "authorization" | "tenancy" | "uploads" | "queries" | "cache" | "ai" | "payments" | "integrations" | "accessibility" | "frontend" | "deployment" | "all" | "discover" | "requirements" | "architecture" | "code" | "ui" | "ux" | "i18n" | "seo" | "api" | "jobs" | "privacy" | "database" | "storage" | "testing" | "performance" | "scale" | "observability" | "reliability" | "recovery" | "infrastructure" | "supply-chain" | "cost" | "docs" | "analytics" | "notifications" | "realtime" | "offline" | "ship">;
export declare const SECTION_CAPABILITY: Partial<Record<ModuleSlug, string>>;
