import { readFile } from "node:fs/promises";
import type { GateEvidence, GateEvidenceCommand, GateEvidenceType } from "./types.js";
import {
  assertNoSymlinkPath,
  assertSafeRelative,
  canonicalDirectory,
  resolveInside,
  sha256
} from "./utils.js";

export const EVIDENCE_ENVELOPE_VERSION = "1";
export const EVIDENCE_CONTRACT = "fullstack-forge.gate-evidence/v1";
export type EvidenceDomain = "Audit" | "Ship" | "Build";

/** A file is meaningful evidence only as this inseparable path/hash/media-type tuple. */
export type EvidenceArtifact = {
  path: string;
  sha256: string;
  media_type: string;
};

export type EvidenceEnvelope = {
  domain: EvidenceDomain;
  producer: string;
  producer_version: string;
  contract: string;
  canonical_root: string;
  revision: string;
  artifacts: EvidenceArtifact[];
  evidence_type: GateEvidenceType;
  claim_sha256: string;
  command?: GateEvidenceCommand;
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
export const EVIDENCE_PRODUCER_REGISTRY: readonly RegisteredProducer[] = [
  {
    domain: "Audit",
    producer: "fullstack-forge/audit",
    producer_version: EVIDENCE_ENVELOPE_VERSION,
    contract: EVIDENCE_CONTRACT,
    evidence_types: [
      "secret-scan",
      "dependency-audit",
      "lockfile-inspection",
      "license-scan",
      "authorization-evaluation",
      "tenant-isolation-evaluation",
      "upload-security-evaluation",
      "application-security-static-analysis",
      "migration-validation"
    ],
    command_contract: "forbidden"
  },
  {
    domain: "Ship",
    producer: "fullstack-forge/ship-command",
    producer_version: EVIDENCE_ENVELOPE_VERSION,
    contract: EVIDENCE_CONTRACT,
    evidence_types: [
      "secret-scan",
      "dependency-audit",
      "lockfile-inspection",
      "license-scan",
      "project-test",
      "release-artifact-validation"
    ],
    command_contract: "required",
    commands: {
      "secret-scan": ["scan:secrets"],
      "dependency-audit": ["audit:dependencies"],
      "license-scan": ["check:licenses"],
      "project-test": ["test"],
      "release-artifact-validation": ["validate:dist", "package:platforms", "smoke:install"]
    }
  }
];

export type EnvelopeVerification = { verified: true } | { verified: false; reasons: string[] };

export async function createEvidenceEnvelope(input: {
  root: string;
  revision: string;
  domain: Exclude<EvidenceDomain, "Build">;
  claim: Omit<GateEvidence, "envelope">;
  artifacts: Array<{ path: string; media_type: string }>;
}): Promise<EvidenceEnvelope> {
  const registered = registeredProducer(
    input.domain,
    input.claim.producer,
    input.claim.evidence_type
  );
  if (registered === undefined)
    throw new Error(`Unregistered evidence producer '${input.domain}/${input.claim.producer}'.`);
  if (input.claim.revision !== input.revision)
    throw new Error("Evidence claim revision must match its envelope revision.");
  assertProducerContract(registered, input.claim);
  const canonicalRoot = await canonicalDirectory(input.root);
  const artifacts = await bindArtifacts(canonicalRoot, input.artifacts);
  return {
    domain: input.domain,
    producer: registered.producer,
    producer_version: registered.producer_version,
    contract: registered.contract,
    canonical_root: canonicalRoot,
    revision: input.revision,
    artifacts,
    evidence_type: input.claim.evidence_type,
    claim_sha256: evidenceClaimDigest(input.claim),
    ...(input.claim.command === undefined ? {} : { command: structuredClone(input.claim.command) })
  };
}

/** Rehashes every artifact when evidence is consumed; no stored digest is trusted on its own. */
export async function verifyEvidenceEnvelope(input: {
  root: string;
  revision: string;
  evidence: GateEvidence;
}): Promise<EnvelopeVerification> {
  const envelope = input.evidence.envelope;
  if (envelope === undefined)
    return {
      verified: false,
      reasons: ["Evidence has no v0.3 verified envelope (legacy diagnostic only)."]
    };
  if (envelope.domain === "Build")
    return {
      verified: false,
      reasons: ["Build-domain evidence is never eligible for Ship gates."]
    };
  const registered = registeredProducer(
    envelope.domain,
    envelope.producer,
    input.evidence.evidence_type
  );
  if (
    registered === undefined ||
    envelope.producer_version !== registered.producer_version ||
    envelope.contract !== registered.contract
  )
    return {
      verified: false,
      reasons: ["Evidence domain, producer, version, or contract is not registered."]
    };
  if (
    input.evidence.producer !== envelope.producer ||
    input.evidence.revision !== envelope.revision ||
    input.evidence.evidence_type !== envelope.evidence_type
  )
    return {
      verified: false,
      reasons: ["Evidence record and envelope disagree on producer, type, or revision."]
    };
  if (evidenceClaimDigest(input.evidence) !== envelope.claim_sha256)
    return { verified: false, reasons: ["Evidence claim digest does not match the outer record."] };
  try {
    assertProducerContract(registered, input.evidence);
    if (registered.command_contract === "required" && envelope.command === undefined)
      throw new Error("Registered Ship evidence envelope requires a command contract.");
    if (registered.command_contract === "forbidden" && envelope.command !== undefined)
      throw new Error("Audit evidence envelope must not carry a command contract.");
    if (envelope.command !== undefined && !sameJson(envelope.command, input.evidence.command))
      throw new Error("Evidence command contract does not match the outer record.");
  } catch (error) {
    return { verified: false, reasons: [(error as Error).message] };
  }
  const canonicalRoot = await canonicalDirectory(input.root);
  if (envelope.canonical_root !== canonicalRoot)
    return {
      verified: false,
      reasons: ["Evidence canonical root does not match the selected root."]
    };
  if (envelope.revision !== input.revision)
    return {
      verified: false,
      reasons: ["Evidence revision does not match the selected root revision."]
    };
  try {
    await verifyArtifacts(canonicalRoot, envelope.artifacts);
    if (envelope.command !== undefined)
      await verifyArtifacts(canonicalRoot, envelope.command.input_manifest);
  } catch (error) {
    return { verified: false, reasons: [(error as Error).message] };
  }
  return { verified: true };
}

/** Stable digest of every release-significant outer claim field. */
export function evidenceClaimDigest(
  evidence: Omit<GateEvidence, "envelope"> | GateEvidence
): string {
  return sha256(
    JSON.stringify({
      evidence_type: evidence.evidence_type,
      producer: evidence.producer,
      scope: evidence.scope,
      timestamp: evidence.timestamp,
      revision: evidence.revision,
      status: evidence.status,
      relevant_instance_ids: evidence.relevant_instance_ids,
      absence_proves_success: evidence.absence_proves_success,
      limitations: evidence.limitations,
      ...(evidence.command === undefined ? {} : { command: evidence.command })
    })
  );
}

/** Normalizes runtime collector output to trusted, one-to-one artifact records. */
export async function bindRuntimeArtifacts(
  root: string,
  artifacts: Array<string | EvidenceArtifact>
): Promise<EvidenceArtifact[]> {
  if (artifacts.length === 0) return [];
  const canonicalRoot = await canonicalDirectory(root);
  const declarations = artifacts.map((artifact) =>
    typeof artifact === "string"
      ? { path: artifact, media_type: mediaTypeForPath(artifact) }
      : artifact
  );
  const bound = await bindArtifacts(canonicalRoot, declarations);
  for (const [index, artifact] of artifacts.entries()) {
    if (typeof artifact !== "string" && bound[index]?.sha256 !== artifact.sha256)
      throw new Error(`Runtime artifact hash mismatch for ${artifact.path}.`);
  }
  return bound;
}

/** Captures the manifest that a command or producer used as an input at evidence creation time. */
export async function captureEvidenceArtifacts(
  root: string,
  artifacts: Array<{ path: string; media_type: string }>
): Promise<EvidenceArtifact[]> {
  return bindArtifacts(await canonicalDirectory(root), artifacts);
}

export function assertEvidenceArtifacts(
  artifacts: unknown
): asserts artifacts is EvidenceArtifact[] {
  if (!Array.isArray(artifacts) || artifacts.length === 0)
    throw new Error("Evidence envelope requires at least one artifact.");
  const paths = new Set<string>();
  for (const artifact of artifacts) {
    if (typeof artifact !== "object" || artifact === null || Array.isArray(artifact))
      throw new Error("Evidence artifact must be an object.");
    const candidate = artifact as EvidenceArtifact;
    assertSafeRelative(candidate.path);
    if (!/^[a-f0-9]{64}$/u.test(candidate.sha256))
      throw new Error(`Evidence artifact '${candidate.path}' must have a lowercase sha256 digest.`);
    if (
      !/^[a-z]+\/[a-z0-9!#$&^_.+-]+(?:;[a-z0-9!#$&^_.+-]+=[a-z0-9!#$&^_.+-]+)?$/iu.test(
        candidate.media_type
      )
    )
      throw new Error(`Evidence artifact '${candidate.path}' has an invalid media type.`);
    if (paths.has(candidate.path))
      throw new Error(`Evidence artifact path '${candidate.path}' is duplicated.`);
    paths.add(candidate.path);
  }
}

function registeredProducer(
  domain: Exclude<EvidenceDomain, "Build">,
  producer: string,
  evidenceType: GateEvidenceType
): RegisteredProducer | undefined {
  return EVIDENCE_PRODUCER_REGISTRY.find(
    (entry) =>
      entry.domain === domain &&
      entry.producer === producer &&
      entry.evidence_types.includes(evidenceType)
  );
}

function assertProducerContract(
  registered: RegisteredProducer,
  evidence: Omit<GateEvidence, "envelope"> | GateEvidence
): void {
  if (registered.command_contract === "forbidden") {
    if (evidence.command !== undefined)
      throw new Error("This producer must not carry a command contract.");
    return;
  }
  const command = evidence.command;
  if (command === undefined)
    throw new Error("Registered Ship command evidence requires a command contract.");
  const allowed = registered.commands?.[evidence.evidence_type] ?? [];
  if (!allowed.includes(command.name))
    throw new Error(`Command '${command.name}' is not registered for ${evidence.evidence_type}.`);
  if (
    !Array.isArray(command.argv) ||
    command.argv.length === 0 ||
    command.argv.some((part) => part.length === 0)
  )
    throw new Error("Command contract requires a non-empty argv.");
  if (typeof command.definition !== "string" || command.definition.length === 0)
    throw new Error("Command contract requires its detected definition.");
  if (!Number.isInteger(command.exit_code) || command.exit_code < 0)
    throw new Error("Command contract requires a non-negative exit code.");
  if (!Number.isFinite(Date.parse(command.started_at)) || command.duration_ms < 0)
    throw new Error("Command contract requires a timestamp and non-negative duration.");
  if (!/^[a-f0-9]{64}$/u.test(command.output_sha256))
    throw new Error("Command contract requires a lowercase output sha256 digest.");
  assertEvidenceArtifacts(command.input_manifest);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function bindArtifacts(
  root: string,
  artifacts: Array<{ path: string; media_type: string; sha256?: string }>
): Promise<EvidenceArtifact[]> {
  if (artifacts.length === 0) throw new Error("Evidence envelope requires at least one artifact.");
  const bound: EvidenceArtifact[] = [];
  for (const artifact of artifacts) {
    assertSafeRelative(artifact.path);
    const target = resolveInside(root, artifact.path);
    await assertNoSymlinkPath(root, target);
    bound.push({
      path: artifact.path,
      sha256: sha256(await readFile(target)),
      media_type: artifact.media_type
    });
  }
  assertEvidenceArtifacts(bound);
  return bound;
}

async function verifyArtifacts(root: string, artifacts: EvidenceArtifact[]): Promise<void> {
  assertEvidenceArtifacts(artifacts);
  for (const artifact of artifacts) {
    const target = resolveInside(root, artifact.path);
    await assertNoSymlinkPath(root, target);
    if (sha256(await readFile(target)) !== artifact.sha256)
      throw new Error(`Evidence artifact hash mismatch for ${artifact.path}.`);
  }
}

function mediaTypeForPath(path: string): string {
  const extension = path.toLowerCase().split(".").at(-1);
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "json") return "application/json";
  if (extension === "html") return "text/html";
  return "application/octet-stream";
}
