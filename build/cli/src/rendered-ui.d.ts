import type { CliOptions, Finding } from "./types.js";
export type RenderedUiResult = {
    tool: "inspect-rendered-ui";
    status: "OK" | "BLOCKED";
    reason?: string;
    url?: string;
    driver?: string;
    dry_run?: boolean;
    artifacts: string[];
    console_errors: number;
    console_warnings: number;
    findings: Finding[];
};
export declare function inspectRenderedUi(root: string, args: string[], options: CliOptions): Promise<{
    value: RenderedUiResult;
    exitCode: number;
}>;
