import type { CliOptions, Finding } from "./types.js";
/**
 * Identity of the browser automation package that was actually imported. `source` records the trust
 * domain: `forge` packages ship with this tool and are covered by its lockfile, while `project`
 * packages come from the audited repository and execute audited-project code on import.
 */
export type DriverIdentity = {
    package: string;
    version?: string;
    path: string;
    source: "forge" | "project";
    trusted: boolean;
};
export type RenderedUiResult = {
    tool: "inspect-rendered-ui";
    status: "OK" | "BLOCKED";
    reason?: string;
    url?: string;
    driver?: string;
    driver_identity?: DriverIdentity;
    offline: boolean;
    dry_run?: boolean;
    evidence_dir?: string;
    run_id?: string;
    route_id?: string;
    artifacts: string[];
    planned_artifacts?: string[];
    console_errors: number;
    console_warnings: number;
    limitations: string[];
    findings: Finding[];
};
export declare function inspectRenderedUi(root: string, args: string[], options: CliOptions, revision: string): Promise<{
    value: RenderedUiResult;
    exitCode: number;
}>;
