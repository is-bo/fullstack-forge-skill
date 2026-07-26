import { type CommandLedgerRecord, type PolicyContext } from "./offline-policy.js";
import type { AuditReport, ExecutionRecord } from "./report.js";
import type { RepositoryInventory, RepositoryInventoryOptions } from "./repository-inventory.js";
import type { CommandDefinition, Finding, GateEvidence, GateEvidenceType, ProjectProfile, Status } from "./types.js";
export type GateStatus = Extract<Status, "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED" | "NOT_APPLICABLE">;
export type ShipGate = {
    gate_id: string;
    name: string;
    category: "internal" | "project-native" | "audit-evidence" | "capability";
    required: boolean;
    status: GateStatus;
    evidence: string[];
    evidence_records: GateEvidence[];
};
/**
 * Gate applicability classes.
 *  - `forge-self`: Fullstack Forge release self-checks. Only meaningful when auditing this
 *    repository; NOT_APPLICABLE elsewhere.
 *  - `audited-application`: checks every audited project must satisfy. Never disabled merely
 *    because a Forge-specific script is absent.
 *  - `project-native`: commands detected in the audited project. These supplement the
 *    audited-application gates; they never replace them.
 */
export type GateApplicability = "forge-self" | "audited-application" | "project-native";
export type GateDefinition = {
    gate_id: string;
    name: string;
    category: ShipGate["category"];
    applicability: GateApplicability;
    required: boolean;
    command?: string;
    /** Exact evidence semantics accepted by this gate. Broad report sections are never used. */
    evidence_types?: GateEvidenceType[];
};
export declare const FORGE_GATE_REGISTRY: readonly GateDefinition[];
export type ShipGateResult = {
    status: "PASS" | "FAIL" | "BLOCKED";
    gates: ShipGate[];
    execution: ExecutionRecord[];
    evidence: GateEvidence[];
    findings: Finding[];
    profile: ProjectProfile;
    revision: string;
    /** Why every registered command ran, did not run, or was blocked by network policy. */
    command_ledger: CommandLedgerRecord[];
};
export declare function runShipGates(root: string, profile: ProjectProfile, previous: AuditReport | undefined, commands: CommandDefinition[], allowRun: boolean, policy?: PolicyContext, inventoryOptions?: RepositoryInventoryOptions): Promise<ShipGateResult>;
export declare function evaluateGateOutcome(gates: ShipGate[]): "PASS" | "FAIL" | "BLOCKED";
type CapabilityApplicability = {
    status: "APPLICABLE" | "ABSENT" | "UNKNOWN";
    reasons: string[];
};
/**
 * Decides whether a capability gate may be dismissed as NOT_APPLICABLE.
 *
 * Persisted module decisions are never inputs. Only discovery performed in the current stable
 * Ship revision can make a capability gate applicable or inapplicable.
 */
export declare function capabilityApplicability(gateId: string, profile: ProjectProfile, forgeOwned?: boolean): CapabilityApplicability;
export type ShipInspection = {
    findings: Finding[];
    evidence: GateEvidence[];
};
/**
 * Re-runs the bounded inspectors Ship depends on and seals their claims against the current tree.
 * Persisted report records never enter this function.
 */
export declare function deriveShipInspection(root: string, profile: ProjectProfile, revision: string, repositoryInventory?: RepositoryInventory): Promise<ShipInspection>;
export {};
