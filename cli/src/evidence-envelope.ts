import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BUILD_PRODUCER_VERSION, buildProducerContractProblems } from "./build-producers.js";
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
export const BUILD_EVIDENCE_CONTRACT = "fullstack-forge.build-evidence/v1";
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
  viewport: { name: string; width: number; height: number };
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
    producer: "fullstack-forge/ship-inspector",
    producer_version: EVIDENCE_ENVELOPE_VERSION,
    contract: EVIDENCE_CONTRACT,
    evidence_types: [
      "secret-scan",
      "dependency-audit",
      "lockfile-inspection",
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
  const envelope: EvidenceEnvelope = {
    schema_version: 1,
    domain: input.domain,
    producer: registered.producer,
    producer_version: registered.producer_version,
    contract: registered.contract,
    canonical_root: canonicalRoot,
    revision: input.revision,
    artifacts,
    criterion: input.claim.evidence_type,
    status: input.claim.status,
    run_id: randomUUID(),
    produced_at: input.claim.timestamp,
    expires_at: new Date(Date.parse(input.claim.timestamp) + 24 * 60 * 60_000).toISOString(),
    environment: currentEnvironment(),
    limitations: [...input.claim.limitations],
    instance_ids: [...input.claim.relevant_instance_ids],
    evidence_type: input.claim.evidence_type,
    claim_sha256: evidenceClaimDigest(input.claim),
    ...(input.claim.command === undefined ? {} : { command: structuredClone(input.claim.command) })
  };
  assertEvidenceEnvelopeShape(envelope);
  return envelope;
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
  try {
    assertEvidenceEnvelopeShape(envelope);
  } catch (error) {
    return { verified: false, reasons: [(error as Error).message] };
  }
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
    input.evidence.evidence_type !== envelope.evidence_type ||
    input.evidence.evidence_type !== envelope.criterion ||
    input.evidence.status !== envelope.status ||
    input.evidence.timestamp !== envelope.produced_at ||
    !sameJson(input.evidence.limitations, envelope.limitations) ||
    !sameJson(input.evidence.relevant_instance_ids, envelope.instance_ids)
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
  if (Date.parse(envelope.expires_at) < Date.now())
    return { verified: false, reasons: ["Evidence envelope has expired."] };
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
  files: Array<{ path: string; sha256: string }>;
  instance_ids: string[];
  recorded_at: string;
  expires_at: string;
  command?: EvidenceCommand;
  not_applicable_reason?: string;
  runtime?: EvidenceRuntimeContext[];
};

export async function createBuildEvidenceEnvelope(input: {
  root: string;
  revision: string;
  claim: BuildEvidenceClaim;
  artifacts: Array<{ path: string; media_type: string }>;
  environment?: EvidenceEnvironment;
}): Promise<EvidenceEnvelope> {
  if (input.claim.criterion.length === 0 || input.claim.producer.length === 0)
    throw new Error("Build evidence requires a producer and exact criterion.");
  const producerProblems = buildProducerContractProblems(input.claim);
  if (producerProblems.length > 0) throw new Error(producerProblems.join(" "));
  assertBuildRuntimeClaim(input.claim);
  if (!Number.isFinite(Date.parse(input.claim.recorded_at)))
    throw new Error("Build evidence requires a valid production timestamp.");
  if (
    !Number.isFinite(Date.parse(input.claim.expires_at)) ||
    Date.parse(input.claim.expires_at) <= Date.parse(input.claim.recorded_at)
  )
    throw new Error("Build evidence expiration must be later than its production time.");
  const canonicalRoot = await canonicalDirectory(input.root);
  const artifacts = await bindArtifacts(canonicalRoot, input.artifacts);
  const envelope: EvidenceEnvelope = {
    schema_version: 1,
    domain: "Build",
    producer: input.claim.producer,
    producer_version: input.claim.producer_version,
    contract: BUILD_EVIDENCE_CONTRACT,
    canonical_root: canonicalRoot,
    revision: input.revision,
    artifacts,
    criterion: input.claim.criterion,
    status: input.claim.status,
    run_id: randomUUID(),
    produced_at: input.claim.recorded_at,
    expires_at: input.claim.expires_at,
    environment: input.environment ?? currentEnvironment(),
    limitations: [...input.claim.limitations],
    instance_ids: [...input.claim.instance_ids],
    claim_sha256: buildEvidenceClaimDigest(input.claim),
    ...(input.claim.command === undefined ? {} : { command: structuredClone(input.claim.command) }),
    ...(input.claim.runtime === undefined ? {} : { runtime: structuredClone(input.claim.runtime) })
  };
  assertEvidenceEnvelopeShape(envelope);
  const claimedFiles = input.claim.files.map((file) => `${file.path}:${file.sha256}`).sort();
  const artifactFiles = envelope.artifacts
    .map((artifact) => `${artifact.path}:${artifact.sha256}`)
    .sort();
  if (!sameJson(claimedFiles, artifactFiles))
    throw new Error("Build evidence files must match its artifact manifest one-to-one.");
  return envelope;
}

export async function verifyBuildEvidenceEnvelopeIntegrity(input: {
  root: string;
  revision: string;
  claim: BuildEvidenceClaim & { envelope?: EvidenceEnvelope };
}): Promise<EnvelopeVerification> {
  const envelope = input.claim.envelope;
  if (envelope === undefined)
    return { verified: false, reasons: ["Build evidence has no verified envelope."] };
  try {
    assertEvidenceEnvelopeShape(envelope);
  } catch (error) {
    return { verified: false, reasons: [(error as Error).message] };
  }
  if (
    envelope.domain !== "Build" ||
    envelope.contract !== BUILD_EVIDENCE_CONTRACT ||
    envelope.producer_version !== input.claim.producer_version ||
    envelope.producer_version !== BUILD_PRODUCER_VERSION
  )
    return {
      verified: false,
      reasons: ["Build producer domain, version, or contract is invalid."]
    };
  const producerProblems = buildProducerContractProblems(input.claim);
  if (producerProblems.length > 0) return { verified: false, reasons: producerProblems };
  try {
    assertBuildRuntimeClaim(input.claim);
  } catch (error) {
    return { verified: false, reasons: [(error as Error).message] };
  }
  if (
    envelope.producer !== input.claim.producer ||
    envelope.criterion !== input.claim.criterion ||
    envelope.status !== input.claim.status ||
    envelope.produced_at !== input.claim.recorded_at ||
    envelope.expires_at !== input.claim.expires_at ||
    !sameJson(envelope.limitations, input.claim.limitations) ||
    !sameJson(envelope.instance_ids, input.claim.instance_ids) ||
    !sameJson(envelope.command, input.claim.command) ||
    !sameJson(envelope.runtime, input.claim.runtime)
  )
    return { verified: false, reasons: ["Build envelope and outer criterion claim disagree."] };
  if (buildEvidenceClaimDigest(input.claim) !== envelope.claim_sha256)
    return { verified: false, reasons: ["Build evidence claim digest does not match."] };
  if (Date.parse(envelope.expires_at) < Date.now())
    return { verified: false, reasons: ["Build evidence envelope has expired."] };
  const canonicalRoot = await canonicalDirectory(input.root);
  if (envelope.canonical_root !== canonicalRoot)
    return { verified: false, reasons: ["Build evidence belongs to another repository root."] };
  if (envelope.revision !== input.revision)
    return { verified: false, reasons: ["Build evidence belongs to another revision."] };
  const claimedFiles = [...input.claim.files].map((file) => `${file.path}:${file.sha256}`).sort();
  const artifactFiles = [...envelope.artifacts]
    .map((artifact) => `${artifact.path}:${artifact.sha256}`)
    .sort();
  if (!sameJson(claimedFiles, artifactFiles))
    return {
      verified: false,
      reasons: ["Build evidence file hashes do not match its artifact manifest one-to-one."]
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

export function buildEvidenceClaimDigest(claim: BuildEvidenceClaim): string {
  return sha256(
    JSON.stringify({
      criterion: claim.criterion,
      ...(claim.discipline === undefined ? {} : { discipline: claim.discipline }),
      security_control: claim.security_control,
      status: claim.status,
      producer: claim.producer,
      producer_version: claim.producer_version,
      evidence: claim.evidence,
      limitations: claim.limitations,
      files: claim.files,
      instance_ids: claim.instance_ids,
      recorded_at: claim.recorded_at,
      expires_at: claim.expires_at,
      ...(claim.not_applicable_reason === undefined
        ? {}
        : { not_applicable_reason: claim.not_applicable_reason }),
      ...(claim.runtime === undefined ? {} : { runtime: claim.runtime }),
      ...(claim.command === undefined ? {} : { command: claim.command })
    })
  );
}

export function assertEvidenceEnvelopeShape(value: unknown): asserts value is EvidenceEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Evidence envelope must be an object.");
  const envelope = value as Record<string, unknown>;
  assertExactKeys(envelope, [
    "schema_version",
    "domain",
    "producer",
    "producer_version",
    "contract",
    "canonical_root",
    "revision",
    "artifacts",
    "criterion",
    "status",
    "run_id",
    "produced_at",
    "expires_at",
    "environment",
    "limitations",
    "instance_ids",
    "evidence_type",
    "claim_sha256",
    "command",
    "runtime"
  ]);
  if (
    envelope.schema_version !== 1 ||
    typeof envelope.domain !== "string" ||
    !["Audit", "Ship", "Build"].includes(envelope.domain) ||
    ![
      envelope.producer,
      envelope.producer_version,
      envelope.contract,
      envelope.canonical_root,
      envelope.revision,
      envelope.criterion,
      envelope.status,
      envelope.run_id
    ].every((field) => typeof field === "string" && field.length > 0) ||
    typeof envelope.status !== "string" ||
    !["PASS", "FAIL", "NOT_VERIFIED", "NOT_APPLICABLE", "BLOCKED"].includes(envelope.status) ||
    typeof envelope.produced_at !== "string" ||
    !Number.isFinite(Date.parse(envelope.produced_at)) ||
    typeof envelope.expires_at !== "string" ||
    !Number.isFinite(Date.parse(envelope.expires_at)) ||
    Date.parse(envelope.expires_at) <= Date.parse(envelope.produced_at) ||
    typeof envelope.claim_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(envelope.claim_sha256)
  )
    throw new Error("Evidence envelope identity, timing, or claim digest is invalid.");
  assertEvidenceArtifacts(envelope.artifacts);
  if (
    (envelope.domain === "Build" && envelope.evidence_type !== undefined) ||
    (envelope.domain !== "Build" &&
      (typeof envelope.evidence_type !== "string" || envelope.evidence_type.length === 0))
  )
    throw new Error("Evidence envelope type is invalid for its domain.");
  if (
    typeof envelope.environment !== "object" ||
    envelope.environment === null ||
    Array.isArray(envelope.environment) ||
    !Array.isArray(envelope.limitations) ||
    !envelope.limitations.every((item) => typeof item === "string") ||
    !Array.isArray(envelope.instance_ids) ||
    !envelope.instance_ids.every((item) => typeof item === "string")
  )
    throw new Error("Evidence envelope environment, limitations, or instances are invalid.");
  const environment = envelope.environment as Record<string, unknown>;
  assertExactKeys(environment, ["platform", "architecture", "node", "ci"]);
  if (
    typeof environment.platform !== "string" ||
    typeof environment.architecture !== "string" ||
    typeof environment.node !== "string" ||
    typeof environment.ci !== "boolean"
  )
    throw new Error("Evidence envelope environment is invalid.");
  if (envelope.command !== undefined) assertEvidenceCommand(envelope.command);
  if (envelope.runtime !== undefined) {
    if (envelope.domain !== "Build")
      throw new Error("Runtime context is allowed only on Build evidence.");
    if (!Array.isArray(envelope.runtime) || envelope.runtime.length === 0)
      throw new Error("Evidence runtime context requires at least one case.");
    for (const runtime of envelope.runtime) assertEvidenceRuntimeContext(runtime);
  }
}

function assertEvidenceCommand(value: unknown): asserts value is EvidenceCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Evidence command contract is invalid.");
  const command = value as Record<string, unknown>;
  assertExactKeys(command, [
    "name",
    "argv",
    "definition",
    "exit_code",
    "started_at",
    "duration_ms",
    "output_sha256",
    "input_manifest"
  ]);
  if (
    typeof command.name !== "string" ||
    command.name.length === 0 ||
    !Array.isArray(command.argv) ||
    command.argv.length === 0 ||
    command.argv.some((part) => typeof part !== "string" || part.length === 0) ||
    typeof command.definition !== "string" ||
    command.definition.length === 0 ||
    typeof command.exit_code !== "number" ||
    !Number.isInteger(command.exit_code) ||
    command.exit_code < 0 ||
    typeof command.started_at !== "string" ||
    !Number.isFinite(Date.parse(command.started_at)) ||
    typeof command.duration_ms !== "number" ||
    !Number.isFinite(command.duration_ms) ||
    command.duration_ms < 0 ||
    typeof command.output_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(command.output_sha256)
  )
    throw new Error("Evidence command contract is invalid.");
  assertEvidenceArtifacts(command.input_manifest);
}

function assertEvidenceRuntimeContext(value: unknown): asserts value is EvidenceRuntimeContext {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Evidence runtime context is invalid.");
  const runtime = value as Record<string, unknown>;
  assertExactKeys(runtime, ["url", "role", "state", "viewport"]);
  if (
    typeof runtime.url !== "string" ||
    runtime.url.length === 0 ||
    typeof runtime.role !== "string" ||
    runtime.role.length === 0 ||
    typeof runtime.state !== "string" ||
    runtime.state.length === 0 ||
    typeof runtime.viewport !== "object" ||
    runtime.viewport === null ||
    Array.isArray(runtime.viewport)
  )
    throw new Error("Evidence runtime context is invalid.");
  const viewport = runtime.viewport as Record<string, unknown>;
  assertExactKeys(viewport, ["name", "width", "height"]);
  if (
    typeof viewport.name !== "string" ||
    viewport.name.length === 0 ||
    typeof viewport.width !== "number" ||
    !Number.isInteger(viewport.width) ||
    typeof viewport.height !== "number" ||
    !Number.isInteger(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    throw new Error("Evidence runtime context is invalid.");
  let parsed: URL;
  try {
    parsed = new URL(runtime.url);
  } catch {
    throw new Error("Evidence runtime URL is invalid.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  )
    throw new Error("Evidence runtime URL must be credential-free HTTP(S).");
}

function assertBuildRuntimeClaim(claim: BuildEvidenceClaim): void {
  if (claim.criterion !== "runtime:rendered-ui") {
    if (claim.runtime !== undefined)
      throw new Error("Runtime context is allowed only on rendered-UI Build evidence.");
    return;
  }
  if (claim.runtime === undefined) {
    if (claim.status === "PASS")
      throw new Error("Rendered-UI PASS requires a complete typed runtime matrix.");
    return;
  }
  if (!Array.isArray(claim.runtime) || claim.runtime.length === 0)
    throw new Error("Rendered-UI runtime context must contain observed cases.");
  const ids = new Set<string>();
  for (const runtime of claim.runtime) {
    assertEvidenceRuntimeContext(runtime);
    const id = `${runtime.state}\u0000${runtime.viewport.name}`;
    if (ids.has(id)) throw new Error(`Rendered-UI runtime case '${id}' is duplicated.`);
    ids.add(id);
  }
  if (claim.status !== "PASS") return;
  const states = [
    "loading",
    "empty",
    "error",
    "success",
    "permission-denied",
    "disabled",
    "destructive-confirmation",
    "long-content"
  ];
  const viewports = ["desktop:1280x800", "tablet:768x1024", "mobile:375x812"];
  const expected = states.flatMap((state) =>
    viewports.map((viewport) => `${state}\u0000${viewport}`)
  );
  const actual = claim.runtime.map(
    (runtime) =>
      `${runtime.state}\u0000${runtime.viewport.name}:${runtime.viewport.width}x${runtime.viewport.height}`
  );
  if (expected.length !== actual.length || expected.some((id) => !actual.includes(id)))
    throw new Error(
      "Rendered-UI PASS requires all required state and viewport cases exactly once."
    );
}

function currentEnvironment(): EvidenceEnvironment {
  return {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    ci: process.env.CI !== undefined
  };
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
    const candidate = artifact as Record<string, unknown>;
    assertExactKeys(candidate, ["path", "sha256", "media_type"]);
    if (typeof candidate.path !== "string" || candidate.path.length === 0)
      throw new Error("Evidence artifact path must be a non-empty string.");
    assertSafeRelative(candidate.path);
    if (typeof candidate.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(candidate.sha256))
      throw new Error(`Evidence artifact '${candidate.path}' must have a lowercase sha256 digest.`);
    if (
      typeof candidate.media_type !== "string" ||
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

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const keys = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !keys.has(key));
  if (unknown !== undefined) throw new Error(`Evidence record has unknown field '${unknown}'.`);
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
