import { readFile } from "node:fs/promises";
import type { GateEvidence, GateEvidenceType } from "./types.js";
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
};

type RegisteredProducer = {
  domain: Exclude<EvidenceDomain, "Build">;
  producer: string;
  producer_version: string;
  contract: string;
  evidence_types: readonly GateEvidenceType[];
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
    ]
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
    ]
  }
];

export type EnvelopeVerification = { verified: true } | { verified: false; reasons: string[] };

export async function createEvidenceEnvelope(input: {
  root: string;
  revision: string;
  domain: Exclude<EvidenceDomain, "Build">;
  producer: string;
  evidence_type: GateEvidenceType;
  artifacts: Array<{ path: string; media_type: string }>;
}): Promise<EvidenceEnvelope> {
  const registered = registeredProducer(input.domain, input.producer, input.evidence_type);
  if (registered === undefined)
    throw new Error(`Unregistered evidence producer '${input.domain}/${input.producer}'.`);
  const canonicalRoot = await canonicalDirectory(input.root);
  const artifacts = await bindArtifacts(canonicalRoot, input.artifacts);
  return {
    domain: input.domain,
    producer: registered.producer,
    producer_version: registered.producer_version,
    contract: registered.contract,
    canonical_root: canonicalRoot,
    revision: input.revision,
    artifacts
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
    input.evidence.revision !== envelope.revision
  )
    return {
      verified: false,
      reasons: ["Evidence record and envelope disagree on producer or revision."]
    };
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
  } catch (error) {
    return { verified: false, reasons: [(error as Error).message] };
  }
  return { verified: true };
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
