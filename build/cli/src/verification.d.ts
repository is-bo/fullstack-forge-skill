import type { CommandLedgerRecord } from "./offline-policy.js";
import type { RepositoryInventory } from "./repository-inventory.js";
import { type AuditReport, type ReportEnvironment } from "./report.js";
import type { ProjectProfile } from "./types.js";
export type VerificationResult = {
    report: AuditReport;
    report_paths: string[];
    command_ledger: CommandLedgerRecord[];
};
export declare function verifyFindings(rootInput: string, section: string, profile: ProjectProfile, options: {
    allowRun: boolean;
    dryRun: boolean;
    offline?: boolean;
    forgeOwned?: boolean;
    inventory?: RepositoryInventory;
    environment?: ReportEnvironment;
}): Promise<VerificationResult>;
