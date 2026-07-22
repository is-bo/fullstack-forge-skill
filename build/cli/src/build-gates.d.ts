import type { BuildApplicabilityResult } from "./build-applicability.js";
import type { BuildTier, CriterionEvidence, CriterionStatus } from "./build-state.js";
import type { CommandDefinition, ProjectProfile } from "./types.js";
export type BuildGateStatus = CriterionStatus;
export type BuildGateId = "FF-BUILD-GATE-SCOPE" | "FF-BUILD-GATE-APPLICABILITY" | "FF-BUILD-GATE-STATIC" | "FF-BUILD-GATE-BEHAVIOR" | "FF-BUILD-GATE-DISCIPLINES" | "FF-BUILD-GATE-RUNTIME" | "FF-BUILD-GATE-DESIGN-DIRECTION" | "FF-BUILD-GATE-MIGRATION" | "FF-BUILD-GATE-MIGRATION-RECOVERY" | "FF-BUILD-GATE-NEGATIVE-SECURITY" | "FF-BUILD-GATE-AUTHENTICATION-NEGATIVE" | "FF-BUILD-GATE-AUTHORIZATION-NEGATIVE" | "FF-BUILD-GATE-TENANCY-ISOLATION" | "FF-BUILD-GATE-UPLOAD-HOSTILE-FILE" | "FF-BUILD-GATE-WEBHOOK-SAFETY" | "FF-BUILD-GATE-PRIVACY-DATA-FLOW" | "FF-BUILD-GATE-INTEGRATION" | "FF-BUILD-GATE-SECURITY-REVIEW" | `FF-BUILD-GATE-DISCIPLINE-${string}` | `FF-BUILD-GATE-PROJECT-${string}`;
export type BuildWaiverPolicy = "never" | "advisory" | "operational-human";
export type BuildGate = {
    id: BuildGateId;
    name: string;
    tier: BuildTier;
    criteria: string[];
    required: boolean;
    waiver_policy: BuildWaiverPolicy;
    /** Compatibility rendering; `waiver_policy` is authoritative. */
    non_waivable: boolean;
    reason: string;
};
export type BuildGatePlanInput = {
    tier: BuildTier;
    commands: readonly CommandDefinition[];
    applicability: BuildApplicabilityResult;
    profile: ProjectProfile;
    runtime_available?: boolean;
};
export type BuildGatePlan = {
    gates: BuildGate[];
    required_criteria: string[];
};
export type EvaluatedBuildGate = BuildGate & {
    status: BuildGateStatus;
    missing: string[];
};
/**
 * A pure, Build-only registry. It shares no state with Ship and has no authority to execute a
 * command. Callers must still apply command allow-run and offline policy before producing evidence.
 */
export declare function planBuildGates(input: BuildGatePlanInput): BuildGatePlan;
/** Evaluates criteria without mutating feature state or converting missing evidence into a pass. */
export declare function evaluateBuildGates(plan: BuildGatePlan, evidence: readonly CriterionEvidence[], accepted_risks?: readonly string[]): EvaluatedBuildGate[];
