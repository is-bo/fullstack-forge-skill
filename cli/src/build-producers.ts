import { decideCommandExecution, type PolicyContext } from "./offline-policy.js";
import { redactToString } from "./redaction.js";
import type { CriterionStatus } from "./build-state.js";
import type { CommandDefinition } from "./types.js";
import { assertSafeRelative, runFile, sha256, utcNow } from "./utils.js";

/**
 * Build-mode command producers are intentionally separate from Audit and Ship evidence.  An
 * observation returned here is a short-lived input to Build state; it is never a GateEvidence and
 * cannot satisfy a Ship gate.
 */
export const BUILD_PRODUCER_CONTRACT = "fullstack-forge.build-producer/v1";
export const BUILD_PRODUCER_VERSION = "1";
export const BUILD_PRODUCER_EXPIRY_MS = 24 * 60 * 60 * 1000;

export type BuildInputHash = { path: string; sha256: string };

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

/**
 * Code-owned, exact-name registry. A package script is arbitrary code, so names such as `test` or
 * `verify` do not prove a specialized discipline unless they are explicitly registered below.
 */
const SECURITY_DISCIPLINES = new Set([
  "auth",
  "authorization",
  "privacy",
  "security",
  "tenancy",
  "uploads",
  "payments"
]);

const DISCIPLINE_SCRIPTS = [
  "requirements",
  "architecture",
  "code",
  "ui",
  "ux",
  "accessibility",
  "i18n",
  "seo",
  "frontend",
  "api",
  "jobs",
  "integrations",
  "auth",
  "authorization",
  "security",
  "privacy",
  "tenancy",
  "uploads",
  "database",
  "queries",
  "cache",
  "storage",
  "testing",
  "performance",
  "scale",
  "observability",
  "reliability",
  "recovery",
  "deployment",
  "infrastructure",
  "supply-chain",
  "cost",
  "docs",
  "analytics",
  "notifications",
  "ai",
  "payments",
  "realtime",
  "offline"
] as const;

const DISCIPLINE_PRODUCERS = DISCIPLINE_SCRIPTS.map((discipline) =>
  producer(
    `test:${discipline}`,
    `discipline:${discipline}`,
    discipline,
    SECURITY_DISCIPLINES.has(discipline),
    SECURITY_DISCIPLINES.has(discipline)
  )
);

export const BUILD_PRODUCER_REGISTRY: readonly BuildProducer[] = uniqueProducers([
  producer("test", "behavior-verification", "testing"),
  producer("test", "discipline:testing", "testing"),
  producer("test", "project:test", "testing"),
  producer("test:unit", "behavior-verification", "testing"),
  producer("test:unit", "discipline:testing", "testing"),
  producer("test:unit", "project:test:unit", "testing"),
  producer("test:integration", "integration-verification", "integrations"),
  producer("test:integration", "discipline:integrations", "integrations"),
  producer("test:integration", "project:test:integration", "testing"),
  producer("test:e2e", "behavior-verification", "testing"),
  producer("test:e2e", "project:test:e2e", "testing"),
  producer("lint", "discipline:code", "code"),
  producer("typecheck", "discipline:code", "code"),
  producer("format", "project:format", "code"),
  producer("format:check", "project:format:check", "code"),
  producer("lint", "project:lint", "code"),
  producer("typecheck", "project:typecheck", "code"),
  producer("build", "project:build", "deployment"),
  producer("test:auth", "discipline:auth", "auth", true, true),
  producer("test:authentication-negative", "authentication-negative-tests", "auth", true, true),
  producer("test:authorization", "discipline:authorization", "authorization", true, true),
  producer(
    "test:authorization-negative",
    "authorization-negative-tests",
    "authorization",
    true,
    true
  ),
  producer("test:tenancy", "discipline:tenancy", "tenancy", true, true),
  producer("test:tenant-isolation", "tenant-isolation-tests", "tenancy", true, true),
  producer("test:uploads", "discipline:uploads", "uploads", true, true),
  producer("test:upload-hostile-files", "upload-hostile-file-tests", "uploads", true, true),
  producer("test:payments", "discipline:payments", "payments", true, true),
  producer("test:webhook-safety", "webhook-safety-tests", "payments", true, true),
  producer("test:ui", "discipline:ui", "ui"),
  producer("test:accessibility", "discipline:accessibility", "accessibility", true, true),
  producer("test:database", "discipline:database", "database"),
  producer("test:migrations", "migration-validation", "database", true, true),
  producer("test:migration-recovery", "migration-recovery", "database", true, true),
  producer("test:queries", "discipline:queries", "queries"),
  producer("test:cache", "discipline:cache", "cache"),
  producer("test:deployment", "discipline:deployment", "deployment"),
  producer("test:reliability", "discipline:reliability", "reliability"),
  producer("test:privacy-data-flow", "privacy-data-flow", "privacy", true, true),
  producer("check:security-review", "security-review", "security", true, true),
  producer("check:security-review", "discipline:security", "security", true, true),
  producer("test:security-negative", "security-negative-tests", "security", true, true),
  ...DISCIPLINE_PRODUCERS
]);

/** Fixed in-process producers. Their implementation accepts no caller-provided code. */
export const BUILD_INTERNAL_PRODUCER_REGISTRY: readonly BuildProducer[] = [
  internalProducer("fullstack-forge/build-scope", "scope-resolution", "code"),
  internalProducer("fullstack-forge/build-analyzers", "supported-static-patterns", "code"),
  internalProducer("fullstack-forge/build-runtime", "runtime:rendered-ui", "ui", true, true),
  internalProducer("fullstack-forge/build-design", "design-direction", "ui"),
  internalProducer("fullstack-forge/build-applicability", "applicability", "requirements"),
  ...DISCIPLINE_SCRIPTS.map((discipline) =>
    internalProducer(
      `fullstack-forge/build-applicability/${discipline}`,
      `discipline:${discipline}`,
      discipline,
      SECURITY_DISCIPLINES.has(discipline),
      SECURITY_DISCIPLINES.has(discipline)
    )
  )
];

export const BUILD_UNAVAILABLE_PRODUCER = "fullstack-forge/build-unavailable";

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

export type BuildProducerRunner = (
  command: CommandDefinition,
  root: string
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

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

export function registeredBuildProducer(
  scriptName: string,
  criterion?: string
): BuildProducer | undefined {
  return BUILD_PRODUCER_REGISTRY.find(
    (entry) =>
      entry.script_name === scriptName && (criterion === undefined || entry.criterion === criterion)
  );
}

export function registeredBuildProducerById(
  producerId: string,
  criterion: string
): BuildProducer | undefined {
  return [...BUILD_PRODUCER_REGISTRY, ...BUILD_INTERNAL_PRODUCER_REGISTRY].find(
    (entry) => entry.id === producerId && entry.criterion === criterion
  );
}

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
export function buildProducerContractProblems(claim: BuildProducerClaimContract): string[] {
  const problems: string[] = [];
  if (!["PASS", "FAIL", "NOT_VERIFIED", "NOT_APPLICABLE", "BLOCKED"].includes(claim.status))
    problems.push("Build producer status is invalid.");
  if (
    claim.status === "NOT_APPLICABLE" &&
    (claim.not_applicable_reason === undefined || claim.not_applicable_reason.trim().length === 0)
  )
    problems.push("NOT_APPLICABLE requires a direct, reasoned exclusion.");
  if (claim.producer_version !== BUILD_PRODUCER_VERSION)
    problems.push("Build producer version is not registered.");
  if (claim.producer === BUILD_UNAVAILABLE_PRODUCER) {
    if (claim.status === "PASS")
      problems.push("The unavailable Build producer can never emit PASS.");
    if (claim.status === "NOT_APPLICABLE")
      problems.push("The unavailable Build producer cannot prove a direct exclusion.");
    if (claim.command !== undefined)
      problems.push("The unavailable Build producer cannot carry an executed command.");
    return problems;
  }
  const producer = registeredBuildProducerById(claim.producer, claim.criterion);
  if (producer === undefined) {
    problems.push("Build producer and criterion are not a registered pair.");
    return problems;
  }
  if (claim.discipline !== undefined && claim.discipline !== producer.discipline)
    problems.push("Build producer discipline does not match its registry entry.");
  if (claim.security_control !== producer.security_control)
    problems.push(
      "Build producer security-control classification does not match its registry entry."
    );
  if (producer.kind === "internal") {
    if (claim.command !== undefined)
      problems.push("A fixed internal Build producer must not carry a project command.");
    if (
      claim.status === "NOT_APPLICABLE" &&
      !producer.id.startsWith("fullstack-forge/build-applicability/")
    )
      problems.push("Only a registered applicability producer may emit NOT_APPLICABLE.");
    return problems;
  }
  if (claim.status === "NOT_APPLICABLE")
    problems.push("A project command producer cannot emit NOT_APPLICABLE.");
  if (claim.status === "PASS" || claim.status === "FAIL") {
    if (claim.command === undefined) {
      problems.push("An executed Build command result requires a complete command contract.");
      return problems;
    }
    if (claim.command.name !== producer.script_name)
      problems.push("Build command name does not match its registered producer.");
    if (claim.status === "PASS" && claim.command.exit_code !== 0)
      problems.push("A Build command may emit PASS only when it exits zero.");
    if (claim.status === "FAIL" && claim.command.exit_code === 0)
      problems.push("A zero-exit Build command cannot be recorded as FAIL.");
  } else if (claim.command !== undefined) {
    problems.push("An unexecuted Build result must not carry a completed command contract.");
  }
  return problems;
}

/**
 * Runs one registered, already-detected script using its exact executable/argv. It deliberately
 * does not accept a shell command string, discover scripts, or mint an Audit/Ship envelope.
 */
export async function executeBuildProducer(
  input: ExecuteBuildProducerInput
): Promise<BuildProducerObservation> {
  const now = input.now ?? utcNow;
  const recordedAt = now();
  const expiresAt = new Date(Date.parse(recordedAt) + BUILD_PRODUCER_EXPIRY_MS).toISOString();
  const command = input.command;
  const matched =
    command === undefined ? undefined : registeredBuildProducer(command.name, input.criterion);
  const base = (producer: BuildProducer, status: CriterionStatus, limitations: string[]) =>
    observation(
      producer,
      command,
      status,
      input.input_manifest,
      recordedAt,
      expiresAt,
      limitations
    );

  if (command === undefined)
    return unavailableObservation(
      input.criterion,
      input.input_manifest,
      recordedAt,
      expiresAt,
      "No detected command was supplied for this Build criterion."
    );
  if (matched === undefined)
    return unavailableObservation(
      input.criterion,
      input.input_manifest,
      recordedAt,
      expiresAt,
      `Detected script '${command.name}' has no registered Build producer for '${input.criterion}'.`
    );
  if (!isDetectedCommand(command))
    return base(matched, "NOT_VERIFIED", [
      "The command definition is incomplete, so it is not accepted as a detected executable command."
    ]);
  const manifestProblem = validateInputManifest(
    input.input_manifest,
    input.input_manifest_complete
  );
  if (manifestProblem !== undefined) return base(matched, "NOT_VERIFIED", [manifestProblem]);
  if (!input.allow_run)
    return base(matched, "BLOCKED", [
      "Build command execution requires explicit --allow-run after reviewing the detected command definition."
    ]);

  const policy: PolicyContext = {
    offline: input.offline,
    forgeOwned: input.forge_owned ?? false
  };
  const decision = decideCommandExecution(command, policy);
  if (!decision.permitted) return base(matched, "BLOCKED", [decision.reason]);

  const startedAt = now();
  const started = Date.now();
  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    result = await (input.run_command ?? defaultBuildProducerRunner)(command, input.root);
  } catch (error) {
    return base(matched, "BLOCKED", [
      `The registered producer could not start: ${redactToString(errorMessage(error), 500)}`
    ]);
  }
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return {
    ...base(matched, result.exitCode === 0 ? "PASS" : "FAIL", [
      ...(result.exitCode === 0 ? [] : [`Registered command exited ${result.exitCode}.`]),
      decision.reason
    ]),
    command: {
      name: command.name,
      argv: [command.executable, ...command.args],
      definition: command.definition,
      exit_code: result.exitCode,
      started_at: startedAt,
      duration_ms: Date.now() - started,
      output_sha256: sha256(output),
      output_excerpt: redactToString(output, 2_000)
    }
  };
}

function producer(
  scriptName: string,
  criterion: string,
  discipline: string,
  securityControl = false,
  nonWaivable = false
): BuildProducer {
  return {
    id: `fullstack-forge/build-command/${scriptName}/${criterion}`,
    version: BUILD_PRODUCER_VERSION,
    contract: BUILD_PRODUCER_CONTRACT,
    kind: "command",
    script_name: scriptName,
    criterion,
    discipline,
    security_control: securityControl,
    non_waivable: nonWaivable
  };
}

function internalProducer(
  id: string,
  criterion: string,
  discipline: string,
  securityControl = false,
  nonWaivable = false
): BuildProducer {
  return {
    id,
    version: BUILD_PRODUCER_VERSION,
    contract: BUILD_PRODUCER_CONTRACT,
    kind: "internal",
    criterion,
    discipline,
    security_control: securityControl,
    non_waivable: nonWaivable
  };
}

function uniqueProducers(entries: BuildProducer[]): BuildProducer[] {
  const unique = new Map<string, BuildProducer>();
  for (const entry of entries) unique.set(`${entry.script_name}\0${entry.criterion}`, entry);
  return [...unique.values()];
}

function observation(
  producer: BuildProducer,
  command: CommandDefinition | undefined,
  status: CriterionStatus,
  inputManifest: readonly BuildInputHash[],
  recordedAt: string,
  expiresAt: string,
  limitations: string[]
): BuildProducerObservation {
  return {
    domain: "Build",
    producer_id: producer.id,
    producer_version: producer.version,
    contract: producer.contract,
    criterion: producer.criterion,
    discipline: producer.discipline,
    status,
    security_control: producer.security_control,
    non_waivable: producer.non_waivable,
    command:
      command === undefined
        ? { name: "unavailable", argv: [], definition: "" }
        : {
            name: command.name,
            argv: [command.executable, ...command.args],
            definition: command.definition
          },
    input_manifest: inputManifest.map((entry) => ({ ...entry })),
    recorded_at: recordedAt,
    expires_at: expiresAt,
    limitations
  };
}

function unavailableObservation(
  criterion: string,
  inputManifest: readonly BuildInputHash[],
  recordedAt: string,
  expiresAt: string,
  limitation: string
): BuildProducerObservation {
  return {
    domain: "Build",
    producer_id: BUILD_UNAVAILABLE_PRODUCER,
    producer_version: BUILD_PRODUCER_VERSION,
    contract: BUILD_PRODUCER_CONTRACT,
    criterion,
    discipline: "unresolved",
    status: "NOT_VERIFIED",
    security_control: false,
    non_waivable: false,
    command: { name: "unavailable", argv: [], definition: "" },
    input_manifest: inputManifest.map((entry) => ({ ...entry })),
    recorded_at: recordedAt,
    expires_at: expiresAt,
    limitations: [limitation]
  };
}

function isDetectedCommand(command: CommandDefinition): boolean {
  return (
    command.name.length > 0 &&
    command.executable.length > 0 &&
    command.source.length > 0 &&
    command.definition.trim().length > 0 &&
    command.args.every((argument) => argument.length > 0 && !argument.includes("\0"))
  );
}

function validateInputManifest(
  inputManifest: readonly BuildInputHash[],
  complete: boolean
): string | undefined {
  if (!complete)
    return "The caller did not attest that the input manifest covers every relevant input file.";
  if (inputManifest.length === 0) return "A Build producer requires a non-empty input manifest.";
  const paths = new Set<string>();
  try {
    for (const input of inputManifest) {
      assertSafeRelative(input.path);
      if (!/^[a-f0-9]{64}$/u.test(input.sha256))
        return `Input manifest path '${input.path}' has an invalid SHA-256 hash.`;
      if (paths.has(input.path)) return `Input manifest path '${input.path}' is duplicated.`;
      paths.add(input.path);
    }
  } catch (error) {
    return redactToString(errorMessage(error), 500);
  }
  return undefined;
}

async function defaultBuildProducerRunner(
  command: CommandDefinition,
  root: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return runFile(command.executable, command.args, root);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
