import type { GateEvidence, GateEvidenceType } from "./types.js";
export declare const EVIDENCE_ENVELOPE_VERSION = "1";
export declare const EVIDENCE_CONTRACT = "fullstack-forge.gate-evidence/v1";
export declare const BUILD_EVIDENCE_CONTRACT = "fullstack-forge.build-evidence/v1";
export type EvidenceDomain = "Audit" | "Ship" | "Build";
/** A file is meaningful evidence only as this inseparable path/hash/media-type tuple. */
export type EvidenceArtifact = {
    path: string;
    sha256: string;
    media_type: string;
};
export type EvidenceCommand = {
    name: string;
    argv: string[];
    definition: string;
    exit_code: number;
    started_at: string;
    duration_ms: number;
    output_sha256: string;
    input_manifest: EvidenceArtifact[];
};
export type EvidenceEnvironment = {
    platform: string;
    architecture: string;
    node: string;
    ci: boolean;
};
export type EvidenceRuntimeContext = {
    url: string;
    role: string;
    state: string;
    viewport: {
        name: string;
        width: number;
        height: number;
    };
};
export type EvidenceEnvelope = {
    schema_version: 1;
    domain: EvidenceDomain;
    producer: string;
    producer_version: string;
    contract: string;
    canonical_root: string;
    revision: string;
    artifacts: EvidenceArtifact[];
    criterion: string;
    status: string;
    run_id: string;
    produced_at: string;
    expires_at: string;
    environment: EvidenceEnvironment;
    limitations: string[];
    instance_ids: string[];
    evidence_type?: GateEvidenceType;
    claim_sha256: string;
    command?: EvidenceCommand;
    runtime?: EvidenceRuntimeContext[];
};
type RegisteredProducer = {
    domain: Exclude<EvidenceDomain, "Build">;
    producer: string;
    producer_version: string;
    contract: string;
    evidence_types: readonly GateEvidenceType[];
    command_contract: "forbidden" | "required";
    commands?: Readonly<Partial<Record<GateEvidenceType, readonly string[]>>>;
};
/**
 * Code-owned allowlist. A producer name in a report is not authority; it must match one of these
 * complete domain/version/contract combinations and its artifacts must still verify on disk.
 */
export declare const EVIDENCE_PRODUCER_REGISTRY: readonly RegisteredProducer[];
export type EnvelopeVerification = {
    verified: true;
} | {
    verified: false;
    reasons: string[];
};
export declare function createEvidenceEnvelope(input: {
    root: string;
    revision: string;
    domain: Exclude<EvidenceDomain, "Build">;
    claim: Omit<GateEvidence, "envelope">;
    artifacts: Array<{
        path: string;
        media_type: string;
    }>;
}): Promise<EvidenceEnvelope>;
/** Rehashes every artifact when evidence is consumed; no stored digest is trusted on its own. */
export declare function verifyEvidenceEnvelope(input: {
    root: string;
    revision: string;
    evidence: GateEvidence;
}): Promise<EnvelopeVerification>;
/** Stable digest of every release-significant outer claim field. */
export declare function evidenceClaimDigest(evidence: Omit<GateEvidence, "envelope"> | GateEvidence): string;
/** Build uses the same envelope primitive but a separate producer trust registry. */
export type BuildEvidenceClaim = {
    criterion: string;
    discipline?: string;
    security_control: boolean;
    status: string;
    producer: string;
    producer_version: string;
    evidence: string[];
    limitations: string[];
    files: Array<{
        path: string;
        sha256: string;
    }>;
    instance_ids: string[];
    recorded_at: string;
    expires_at: string;
    command?: EvidenceCommand;
    not_applicable_reason?: string;
    runtime?: EvidenceRuntimeContext[];
};
export declare function createBuildEvidenceEnvelope(input: {
    root: string;
    revision: string;
    claim: BuildEvidenceClaim;
    artifacts: Array<{
        path: string;
        media_type: string;
    }>;
    environment?: EvidenceEnvironment;
}): Promise<EvidenceEnvelope>;
export declare function verifyBuildEvidenceEnvelopeIntegrity(input: {
    root: string;
    revision: string;
    claim: BuildEvidenceClaim & {
        envelope?: EvidenceEnvelope;
    };
}): Promise<EnvelopeVerification>;
export declare function buildEvidenceClaimDigest(claim: BuildEvidenceClaim): string;
export declare function assertEvidenceEnvelopeShape(value: unknown): asserts value is EvidenceEnvelope;
/** Normalizes runtime collector output to trusted, one-to-one artifact records. */
export declare function bindRuntimeArtifacts(root: string, artifacts: Array<string | EvidenceArtifact>): Promise<EvidenceArtifact[]>;
/** Captures the manifest that a command or producer used as an input at evidence creation time. */
export declare function captureEvidenceArtifacts(root: string, artifacts: Array<{
    path: string;
    media_type: string;
}>): Promise<EvidenceArtifact[]>;
export declare function assertEvidenceArtifacts(artifacts: unknown): asserts artifacts is EvidenceArtifact[];
export {};
