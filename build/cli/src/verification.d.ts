import type { RepositoryInventory } from "./repository-inventory.js";
import { type AuditReport } from "./report.js";
import type { ProjectProfile } from "./types.js";
export type VerificationResult = {
    report: AuditReport;
    report_paths: string[];
};
export declare function verifyFindings(rootInput: string, section: string, profile: ProjectProfile, options: {
    allowRun: boolean;
    dryRun: boolean;
    inventory?: RepositoryInventory;
}): Promise<VerificationResult>;
