import type { Finding, ProjectProfile } from "./types.js";
/**
 * Converts a bounded inventory limitation into evidence, never into a product defect or a pass.
 * The profile retains every signal collected before the limit was reached.
 */
export declare function inventoryLimitationFinding(profile: ProjectProfile, section: string): Finding | undefined;
