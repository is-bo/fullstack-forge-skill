import type { FixResult } from "./fixes.js";
import type { InstallAction } from "./installer.js";
import type { AgentRecommendation } from "./agent-detection.js";
import type { AuditReport } from "./report.js";
import { type ModuleSlug } from "./constants.js";
export declare const SIMPLE_COMMANDS: readonly ["build", "continue", "audit", "fix", "verify", "ship", "status", "help"];
export type SimpleCommand = (typeof SIMPLE_COMMANDS)[number];
export type SimpleRoute = {
    kind: "none";
} | {
    kind: "menu";
} | {
    kind: "help";
    advanced: boolean;
} | {
    kind: "build";
    request?: string;
    flags: string[];
} | {
    kind: "continue";
    flags: string[];
} | {
    kind: "status";
    flags: string[];
} | {
    kind: "default-audit";
    flags: string[];
} | {
    kind: "audit-areas";
    sections: ModuleSlug[];
    flags: string[];
} | {
    kind: "expert";
    command: SimpleCommand;
    argv: string[];
};
type StatusSnapshot = {
    root: string;
    installed: boolean;
    installedSkills: number;
    buildInitialized: boolean;
    features: Array<{
        slug: string;
        summary?: string;
        phase: string;
        updated_at: string;
    }>;
    report?: AuditReport;
};
export type DoctorCheck = {
    name: string;
    status: "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIED";
    evidence: string;
    recovery?: string;
};
export declare function parseSimpleRoute(argv: string[]): SimpleRoute;
/**
 * Resolves a plain-language audit request to one or more explicit disciplines.
 *
 * A conjunction is accepted only when every side independently resolves to one discipline. This
 * makes `uploads and file storage` transparent (`uploads`, `storage`) without converting a compact
 * but intrinsically multi-meaning alias such as `CI` into a silent choice.
 */
export declare function resolveAuditAreas(input: string): ModuleSlug[];
export declare function resolveAuditArea(input: string): ModuleSlug;
export declare function featureSlugFromRequest(request: string): string;
export declare function featureSlugWithCollision(request: string, baseSlug: string): string;
export declare function suggestCommand(input: string): string | undefined;
export declare function renderSimpleHelp(): string;
export declare function renderSimpleMenu(): string;
export declare function menuChoiceToArgs(choice: string, buildRequest?: string): string[] | undefined;
export declare function renderPlainReport(report: AuditReport, operation: "audit" | "verify" | "ship"): string;
export declare function renderPlainFix(result: FixResult, applied: boolean): string;
export declare function renderStatus(snapshot: StatusSnapshot): string;
export declare function renderInstallResult(operation: "init" | "update" | "uninstall", selector: string, global: boolean, dryRun: boolean, actions: InstallAction[], recommendations?: AgentRecommendation[], detectionWarning?: string): string;
export declare function renderDoctor(root: string, checks: DoctorCheck[]): string;
export {};
