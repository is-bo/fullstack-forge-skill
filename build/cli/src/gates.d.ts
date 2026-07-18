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
export type GateDefinition = {
    gate_id: string;
    name: string;
    category: ShipGate["category"];
    required: boolean;
    command?: string;
};
export declare const FORGE_GATE_REGISTRY: readonly GateDefinition[];
export type ShipGateResult = {
    status: "PASS" | "FAIL" | "BLOCKED";
    gates: ShipGate[];
    execution: ExecutionRecord[];
};
export declare function runShipGates(root: string, profile: ProjectProfile, previous: AuditReport | undefined, commands: CommandDefinition[], allowRun: boolean): Promise<ShipGateResult>;
export declare function evaluateGateOutcome(gates: ShipGate[]): "PASS" | "FAIL" | "BLOCKED";
