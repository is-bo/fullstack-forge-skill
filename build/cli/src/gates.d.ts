import type { AuditReport, ExecutionRecord } from "./report.js";
import type { CommandDefinition, ProjectProfile, Status } from "./types.js";
export type GateStatus = Extract<Status, "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED" | "NOT_APPLICABLE">;
export type ShipGate = {
    gate_id: string;
    name: string;
    category: "internal" | "project-native" | "audit-evidence" | "capability";
    required: boolean;
    status: GateStatus;
    evidence: string[];
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
    /** Finding sections that can satisfy this gate from audit evidence when no command exists. */
    evidence_sections?: string[];
};
export declare const FORGE_GATE_REGISTRY: readonly GateDefinition[];
export type ShipGateResult = {
    status: "PASS" | "FAIL" | "BLOCKED";
    gates: ShipGate[];
    execution: ExecutionRecord[];
};
export declare function runShipGates(root: string, profile: ProjectProfile, previous: AuditReport | undefined, commands: CommandDefinition[], allowRun: boolean): Promise<ShipGateResult>;
export declare function evaluateGateOutcome(gates: ShipGate[]): "PASS" | "FAIL" | "BLOCKED";
