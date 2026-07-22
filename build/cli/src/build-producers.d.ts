import type { CriterionStatus } from "./build-state.js";
import type { CommandDefinition } from "./types.js";
/**
 * Build-mode command producers are intentionally separate from Audit and Ship evidence.  An
 * observation returned here is a short-lived input to Build state; it is never a GateEvidence and
 * cannot satisfy a Ship gate.
 */
export declare const BUILD_PRODUCER_CONTRACT = "fullstack-forge.build-producer/v1";
export declare const BUILD_PRODUCER_VERSION = "1";
export declare const BUILD_PRODUCER_EXPIRY_MS: number;
export type BuildInputHash = {
    path: string;
    sha256: string;
};
export type BuildProducer = {
    id: string;
    version: typeof BUILD_PRODUCER_VERSION;
    contract: typeof BUILD_PRODUCER_CONTRACT;
    kind: "command" | "internal";
    script_name?: string;
    criterion: string;
    discipline: string;
    security_control: boolean;
    non_waivable: boolean;
};
export declare const BUILD_PRODUCER_REGISTRY: readonly BuildProducer[];
/** Fixed in-process producers. Their implementation accepts no caller-provided code. */
export declare const BUILD_INTERNAL_PRODUCER_REGISTRY: readonly BuildProducer[];
export declare const BUILD_UNAVAILABLE_PRODUCER = "fullstack-forge/build-unavailable";
export type BuildProducerCommand = {
    name: string;
    argv: string[];
    definition: string;
    exit_code?: number;
    started_at?: string;
    duration_ms?: number;
    output_sha256?: string;
    output_excerpt?: string;
};
export type BuildProducerObservation = {
    domain: "Build";
    producer_id: string;
    producer_version: typeof BUILD_PRODUCER_VERSION;
    contract: typeof BUILD_PRODUCER_CONTRACT;
    criterion: string;
    discipline: string;
    status: CriterionStatus;
    security_control: boolean;
    non_waivable: boolean;
    command: BuildProducerCommand;
    input_manifest: BuildInputHash[];
    recorded_at: string;
    expires_at: string;
    limitations: string[];
};
export type BuildProducerRunner = (command: CommandDefinition, root: string) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}>;
export type ExecuteBuildProducerInput = {
    root: string;
    criterion: string;
    command?: CommandDefinition;
    input_manifest: readonly BuildInputHash[];
    /** The caller must explicitly attest that every relevant input file was supplied. */
    input_manifest_complete: boolean;
    allow_run: boolean;
    offline: boolean;
    /** True only when root is the Fullstack Forge checkout, for the narrow offline exemption. */
    forge_owned?: boolean;
    now?: () => string;
    run_command?: BuildProducerRunner;
};
export declare function registeredBuildProducer(scriptName: string, criterion?: string): BuildProducer | undefined;
export declare function registeredBuildProducerById(producerId: string, criterion: string): BuildProducer | undefined;
export type BuildProducerClaimContract = {
    producer: string;
    producer_version: string;
    criterion: string;
    discipline?: string;
    security_control: boolean;
    status: string;
    not_applicable_reason?: string;
    command?: {
        name: string;
        argv: string[];
        definition: string;
        exit_code: number;
        started_at: string;
        duration_ms: number;
        output_sha256: string;
    };
};
/** Validates code-owned producer identity and status semantics; it never treats prose as proof. */
export declare function buildProducerContractProblems(claim: BuildProducerClaimContract): string[];
/**
 * Runs one registered, already-detected script using its exact executable/argv. It deliberately
 * does not accept a shell command string, discover scripts, or mint an Audit/Ship envelope.
 */
export declare function executeBuildProducer(input: ExecuteBuildProducerInput): Promise<BuildProducerObservation>;
