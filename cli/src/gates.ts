import { readFile } from "node:fs/promises";
import {
  captureEvidenceArtifacts,
  createEvidenceEnvelope,
  verifyEvidenceEnvelope
} from "./evidence-envelope.js";
import { validateFinding } from "./finding.js";
import {
  decideCommandExecution,
  ledgerRecord,
  type CommandLedgerRecord,
  type PolicyContext
} from "./offline-policy.js";
import type { AuditReport, ExecutionRecord } from "./report.js";
import type {
  CommandDefinition,
  GateEvidence,
  GateEvidenceType,
  ProjectProfile,
  Status
} from "./types.js";
import {
  assertNoSymlinkPath,
  assertSafeRelative,
  resolveInside,
  runFile,
  sha256,
  utcNow,
  workingTreeRevision
} from "./utils.js";

export type GateStatus = Extract<
  Status,
  "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED" | "NOT_APPLICABLE"
>;

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

export const FORGE_GATE_REGISTRY: readonly GateDefinition[] = [
  gate("FF-GATE-SCHEMA", "Finding-schema validation", "internal", "audited-application"),
  gate(
    "FF-GATE-AUDIT-FRESHNESS",
    "Prior audit evidence freshness",
    "audit-evidence",
    "audited-application"
  ),
  // Forge self-release gates.
  gate("FF-GATE-SKILLS", "Skill validation", "internal", "forge-self", "validate"),
  gate(
    "FF-GATE-PLATFORMS",
    "Generated platform synchronization",
    "internal",
    "forge-self",
    "check:platforms"
  ),
  gate("FF-GATE-ARCHIVES", "Archive validation", "internal", "forge-self", "validate:dist"),
  gate(
    "FF-GATE-PACKAGING",
    "Packaging completeness",
    "internal",
    "forge-self",
    "package:platforms"
  ),
  gate("FF-GATE-SMOKE", "Smoke installation", "internal", "forge-self", "smoke:install"),
  gate(
    "FF-GATE-INSTALLER",
    "Installer path and symlink protections",
    "internal",
    "forge-self",
    "test"
  ),
  gate("FF-GATE-EVALS", "Executable evaluation suite", "internal", "forge-self", "test"),
  // Audited-application gates. These apply to ordinary projects and fall back to audit
  // evidence when the project exposes no corresponding command.
  gate(
    "FF-GATE-SECRETS",
    "Secret exposure inspection",
    "audit-evidence",
    "audited-application",
    "scan:secrets",
    ["secret-scan"]
  ),
  gate(
    "FF-GATE-DEPENDENCIES",
    "Dependency and lockfile inspection",
    "audit-evidence",
    "audited-application",
    "audit:dependencies",
    ["dependency-audit", "lockfile-inspection"]
  ),
  gate(
    "FF-GATE-LICENSES",
    "License and attribution validation",
    "audit-evidence",
    "audited-application",
    "check:licenses",
    ["license-scan"]
  ),
  gate(
    "FF-GATE-AUTH-EVAL",
    "Authorization evaluation",
    "capability",
    "audited-application",
    undefined,
    ["authorization-evaluation"]
  ),
  gate(
    "FF-GATE-TENANT-EVAL",
    "Tenant-isolation evaluation",
    "capability",
    "audited-application",
    undefined,
    ["tenant-isolation-evaluation"]
  ),
  gate(
    "FF-GATE-UPLOAD-EVAL",
    "Upload-security evaluation",
    "capability",
    "audited-application",
    undefined,
    ["upload-security-evaluation"]
  ),
  gate(
    "FF-GATE-SECURITY-EVAL",
    "Application-security evaluation",
    "capability",
    "audited-application",
    undefined,
    ["application-security-static-analysis"]
  ),
  gate(
    "FF-GATE-MIGRATIONS",
    "Migration and configuration inspection",
    "capability",
    "audited-application",
    undefined,
    ["migration-validation"]
  ),
  gate(
    "FF-GATE-OPEN-FINDINGS",
    "Open critical and required high findings",
    "audit-evidence",
    "audited-application"
  )
];

export type ShipGateResult = {
  status: "PASS" | "FAIL" | "BLOCKED";
  gates: ShipGate[];
  execution: ExecutionRecord[];
  evidence: GateEvidence[];
  /** Why every registered command ran, did not run, or was blocked by network policy. */
  command_ledger: CommandLedgerRecord[];
};

type CommandResult = { exitCode: number; output: string; started_at: string; duration_ms: number };

export async function runShipGates(
  root: string,
  profile: ProjectProfile,
  previous: AuditReport | undefined,
  commands: CommandDefinition[],
  allowRun: boolean,
  policy: PolicyContext = { offline: false, forgeOwned: false }
): Promise<ShipGateResult> {
  const execution: ExecutionRecord[] = [];
  const ledger: CommandLedgerRecord[] = [];
  const preflight = [schemaGate(root, previous), openFindingsGate(previous)];
  const preflightPassed = evaluateGateOutcome(preflight) === "PASS";
  const commandResults =
    allowRun && preflightPassed
      ? await runRegisteredCommands(root, commands, execution, ledger, policy)
      : new Map<string, CommandResult>();
  if (!allowRun || !preflightPassed) {
    for (const command of registeredCommands(commands)) {
      ledger.push(
        ledgerRecord(command, decideCommandExecution(command, policy), "NOT_RUN", policy.offline)
      );
    }
  }
  // Commands are explicitly authorized but project-owned. Bind their evidence to the tree after
  // they ran so a command that mutates the checkout cannot inherit a pre-execution revision.
  const revision = await workingTreeRevision(root);
  const ledgerByName = new Map(ledger.map((record) => [record.name, record] as const));
  const isForgeRepository =
    profile.repository.name === "fullstack-forge-skill" ||
    commands.some((command) => command.name === "check:platforms");
  const gates: ShipGate[] = [];

  gates.push(...preflight);
  gates.push(await auditFreshnessGate(root, previous));
  for (const definition of FORGE_GATE_REGISTRY) {
    if (
      ["FF-GATE-SCHEMA", "FF-GATE-AUDIT-FRESHNESS", "FF-GATE-OPEN-FINDINGS"].includes(
        definition.gate_id
      )
    )
      continue;
    if (definition.category === "capability") {
      gates.push(await capabilityGate(root, definition, profile, previous, revision));
      continue;
    }
    // Forge self-release gates are genuinely inapplicable to an audited application.
    if (definition.applicability === "forge-self" && !isForgeRepository) {
      gates.push({
        gate_id: definition.gate_id,
        name: definition.name,
        category: definition.category,
        required: false,
        status: "NOT_APPLICABLE",
        evidence: [
          "This Fullstack Forge self-release check does not apply to the audited project."
        ],
        evidence_records: []
      });
      continue;
    }
    if (definition.evidence_types !== undefined) {
      const commandEvidence =
        definition.command === undefined
          ? []
          : await evidenceFromCommand(
              root,
              commands.find((candidate) => candidate.name === definition.command),
              commandResults.get(definition.command),
              revision
            );
      gates.push(await evidenceGate(root, definition, previous, commandEvidence, revision));
      continue;
    }
    if (definition.command !== undefined) {
      const detected = commands.find((command) => command.name === definition.command);
      const result = commandResults.get(definition.command);
      gates.push(
        await commandGate(
          root,
          definition,
          detected,
          result,
          allowRun,
          revision,
          ledgerByName.get(definition.command)
        )
      );
      continue;
    }
  }

  const projectNative: ShipGate[] = [];
  for (const name of ["format:check", "lint", "typecheck", "test", "build"]) {
    const command = commands.find((candidate) => candidate.name === name);
    if (command === undefined) continue;
    const result = commandResults.get(name);
    projectNative.push(
      await commandGate(
        root,
        {
          gate_id: `FF-GATE-PROJECT-${name.toUpperCase().replace(/[^A-Z0-9]/gu, "-")}`,
          name: `Project command ${name}`,
          category: "project-native",
          applicability: "project-native",
          required: true,
          command: name
        },
        command,
        result,
        allowRun,
        revision,
        ledgerByName.get(name)
      )
    );
  }
  gates.push(...projectNative);
  if (projectNative.length === 0) {
    gates.push({
      gate_id: "FF-GATE-PROJECT-NONE",
      name: "Applicable project-native commands",
      category: "project-native",
      required: true,
      status: "BLOCKED",
      evidence: [
        "No recognized project-native format, lint, typecheck, test, or build command was detected."
      ],
      evidence_records: []
    });
  }
  return {
    status: evaluateGateOutcome(gates),
    gates,
    execution,
    evidence: gates.flatMap((gate) => gate.evidence_records),
    command_ledger: ledger
  };
}

export function evaluateGateOutcome(gates: ShipGate[]): "PASS" | "FAIL" | "BLOCKED" {
  if (gates.some((gate) => gate.required && gate.status === "FAIL")) return "FAIL";
  if (gates.some((gate) => gate.required && ["BLOCKED", "NOT_VERIFIED"].includes(gate.status)))
    return "BLOCKED";
  return "PASS";
}

const ORDERED_GATE_COMMANDS = [
  "format:check",
  "lint",
  "typecheck",
  "test",
  "build",
  "validate",
  "check:platforms",
  "scan:secrets",
  "audit:dependencies",
  "check:licenses",
  "package:platforms",
  "validate:dist",
  "smoke:install"
] as const;

function registeredCommands(commands: CommandDefinition[]): CommandDefinition[] {
  return ORDERED_GATE_COMMANDS.flatMap((name) => {
    const command = commands.find((candidate) => candidate.name === name);
    return command === undefined ? [] : [command];
  });
}

async function runRegisteredCommands(
  root: string,
  commands: CommandDefinition[],
  execution: ExecutionRecord[],
  ledger: CommandLedgerRecord[],
  policy: PolicyContext
): Promise<Map<string, CommandResult>> {
  const results = new Map<string, CommandResult>();
  let halted = false;
  for (const command of registeredCommands(commands)) {
    const name = command.name;
    if (results.has(name)) continue;
    const decision = decideCommandExecution(command, policy);
    if (halted) {
      ledger.push(
        ledgerRecord(
          command,
          {
            ...decision,
            reason: `A prior required command failed, so '${name}' did not run.`
          },
          "NOT_RUN",
          policy.offline
        )
      );
      continue;
    }
    if (!decision.permitted) {
      // No execution record and no CommandResult: a blocked command cannot become PASS evidence.
      ledger.push(ledgerRecord(command, decision, "BLOCKED", policy.offline));
      continue;
    }
    const started = Date.now();
    const startedAt = utcNow();
    const result = await runFile(command.executable, command.args, root, 15 * 60_000);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    execution.push({
      command: [command.executable, ...command.args],
      exitCode: result.exitCode,
      output,
      started_at: startedAt,
      duration_ms: Date.now() - started
    });
    results.set(name, {
      exitCode: result.exitCode,
      output,
      started_at: startedAt,
      duration_ms: Date.now() - started
    });
    ledger.push(ledgerRecord(command, decision, "RAN", policy.offline, result.exitCode));
    if (result.exitCode !== 0) halted = true;
  }
  return results;
}

function schemaGate(root: string, previous: AuditReport | undefined): ShipGate {
  if (previous === undefined)
    return gateValue("FF-GATE-SCHEMA", "Finding-schema validation", "internal", "BLOCKED", [
      "No previous audit report is available."
    ]);
  const errors = previous.findings.flatMap((finding, index) =>
    validateFinding(finding).map((error) => `[${index}] ${error}`)
  );
  if (previous.root !== root)
    errors.push(`Report root '${previous.root}' does not match selected root '${root}'.`);
  return gateValue(
    "FF-GATE-SCHEMA",
    "Finding-schema validation",
    "internal",
    errors.length === 0 ? "PASS" : "FAIL",
    errors.length === 0 ? [`Validated ${previous.findings.length} finding(s).`] : errors
  );
}

async function auditFreshnessGate(
  root: string,
  previous: AuditReport | undefined
): Promise<ShipGate> {
  if (previous === undefined)
    return gateValue(
      "FF-GATE-AUDIT-FRESHNESS",
      "Prior audit evidence freshness",
      "audit-evidence",
      "BLOCKED",
      ["No previous audit evidence is available."]
    );
  const snapshots = new Map<string, string>();
  for (const finding of previous.findings) {
    for (const snapshot of finding.evidence_snapshot ?? []) {
      try {
        assertSafeRelative(snapshot.path);
      } catch (error) {
        return gateValue(
          "FF-GATE-AUDIT-FRESHNESS",
          "Prior audit evidence freshness",
          "audit-evidence",
          "FAIL",
          [(error as Error).message]
        );
      }
      const current = snapshots.get(snapshot.path);
      if (current !== undefined && current !== snapshot.sha256)
        return gateValue(
          "FF-GATE-AUDIT-FRESHNESS",
          "Prior audit evidence freshness",
          "audit-evidence",
          "FAIL",
          [`Conflicting evidence hashes were recorded for ${snapshot.path}.`]
        );
      snapshots.set(snapshot.path, snapshot.sha256);
    }
  }
  if (snapshots.size === 0)
    return gateValue(
      "FF-GATE-AUDIT-FRESHNESS",
      "Prior audit evidence freshness",
      "audit-evidence",
      "NOT_VERIFIED",
      ["The prior report contains no source evidence snapshots to check for staleness."]
    );
  const stale: string[] = [];
  for (const [path, expected] of snapshots) {
    try {
      const target = resolveInside(root, path);
      await assertNoSymlinkPath(root, target);
      const current = sha256(await readFile(target));
      if (current !== expected) stale.push(`${path}: content hash changed`);
    } catch (error) {
      stale.push(`${path}: ${(error as Error).message}`);
    }
  }
  return gateValue(
    "FF-GATE-AUDIT-FRESHNESS",
    "Prior audit evidence freshness",
    "audit-evidence",
    stale.length === 0 ? "PASS" : "BLOCKED",
    stale.length === 0
      ? [`Confirmed ${snapshots.size} source evidence snapshot(s).`]
      : stale.slice(0, 20)
  );
}

function openFindingsGate(previous: AuditReport | undefined): ShipGate {
  if (previous === undefined)
    return gateValue(
      "FF-GATE-OPEN-FINDINGS",
      "Open critical and required high findings",
      "audit-evidence",
      "BLOCKED",
      ["No previous audit evidence is available."]
    );
  const failed = previous.findings.filter(
    (finding) =>
      finding.section !== "ship" &&
      ["FAIL", "WARNING"].includes(finding.status) &&
      ["CRITICAL", "HIGH"].includes(finding.severity)
  );
  const unresolved = previous.findings.filter(
    (finding) =>
      finding.section !== "ship" &&
      ["BLOCKED", "NOT_VERIFIED"].includes(finding.status) &&
      ["CRITICAL", "HIGH"].includes(finding.severity)
  );
  return gateValue(
    "FF-GATE-OPEN-FINDINGS",
    "Open critical and required high findings",
    "audit-evidence",
    failed.length > 0 ? "FAIL" : unresolved.length > 0 ? "BLOCKED" : "PASS",
    failed.length === 0 && unresolved.length === 0
      ? ["No open critical or high FAIL finding was recorded."]
      : [...failed, ...unresolved].map(
          (finding) => `${finding.id}: ${finding.severity} ${finding.status}`
        )
  );
}

/** Exact evidence types replace broad section-level inference. */
async function evidenceGate(
  root: string,
  definition: GateDefinition,
  previous: AuditReport | undefined,
  currentCommandEvidence: GateEvidence[],
  revision: string
): Promise<ShipGate> {
  const expected = definition.evidence_types ?? [];
  const records = [
    ...(previous?.gate_evidence ?? []).filter((record) => expected.includes(record.evidence_type)),
    ...currentCommandEvidence.filter((record) => expected.includes(record.evidence_type))
  ];
  const verification = await Promise.all(
    records.map(async (record) => ({
      record,
      result: await verifyEvidenceEnvelope({ root, revision, evidence: record })
    }))
  );
  const verified = verification.filter(
    (entry): entry is typeof entry & { result: { verified: true } } => entry.result.verified
  );
  const rejected = verification.filter(
    (entry): entry is typeof entry & { result: { verified: false; reasons: string[] } } =>
      !entry.result.verified
  );
  const fresh = verified
    .map((entry) => entry.record)
    .filter((record) => evidenceIsFresh(record, revision));
  const stale = verified
    .map((entry) => entry.record)
    .filter((record) => !evidenceIsFresh(record, revision));
  const missing = expected.filter((type) => !fresh.some((record) => record.evidence_type === type));
  const failed = fresh.filter((record) => record.status === "FAIL");
  const blocked = fresh.filter((record) => record.status === "BLOCKED");
  const unproven = expected.filter(
    (type) =>
      !fresh.some(
        (record) =>
          record.evidence_type === type && record.status === "PASS" && record.absence_proves_success
      )
  );
  const status: GateStatus =
    failed.length > 0
      ? "FAIL"
      : stale.length > 0 && fresh.length === 0
        ? "BLOCKED"
        : blocked.length > 0
          ? "BLOCKED"
          : missing.length > 0 || unproven.length > 0
            ? "NOT_VERIFIED"
            : "PASS";
  const details = [
    ...fresh.map(
      (record) =>
        `${record.evidence_type} from ${record.producer}: ${record.status} at ${record.timestamp}; absence proves success=${record.absence_proves_success}`
    ),
    ...stale.map(
      (record) =>
        `${record.evidence_type} from ${record.producer} is stale (record ${record.revision}; current ${revision}).`
    ),
    ...rejected.map(
      (entry) =>
        `${entry.record.evidence_type} from ${entry.record.producer} was rejected: ${entry.result.reasons.join(" ")}`
    ),
    ...(missing.length === 0 ? [] : [`Missing verified evidence types: ${missing.join(", ")}.`]),
    ...(unproven.length === 0
      ? []
      : [`No fresh, success-proving record exists for: ${unproven.join(", ")}.`])
  ];
  return {
    gate_id: definition.gate_id,
    name: definition.name,
    category: definition.category,
    required: true,
    status,
    evidence: details.length > 0 ? details : ["No exact typed evidence was recorded."],
    evidence_records: records
  };
}

/** Modules whose applicability decision governs each capability gate. */
const GATE_MODULES: Record<string, string[]> = {
  "FF-GATE-AUTH-EVAL": ["auth", "authorization"],
  "FF-GATE-TENANT-EVAL": ["tenancy"],
  "FF-GATE-UPLOAD-EVAL": ["uploads"],
  "FF-GATE-SECURITY-EVAL": ["security"],
  "FF-GATE-MIGRATIONS": ["database", "deployment"]
};

/**
 * Decides whether a capability gate may be dismissed as NOT_APPLICABLE.
 *
 * A gate is only inapplicable when the capability genuinely does not exist. If the prior report
 * recorded that the module exists (or might exist) but simply was not audited — out of changed
 * scope, excluded by a risk filter, or capability unknown — the gate stays required and
 * unverified. Otherwise a narrowed audit would silently switch off release gates, which is the
 * exact failure this ledger exists to prevent.
 */
function capabilityApplicability(
  gateId: string,
  profile: ProjectProfile,
  previous: AuditReport | undefined
): { applicable: boolean; reasons: string[] } {
  const discovered: Record<string, boolean> = {
    "FF-GATE-AUTH-EVAL": profile.authentication.length > 0 || profile.authorization.length > 0,
    "FF-GATE-TENANT-EVAL": profile.tenant_boundaries.length > 0,
    "FF-GATE-UPLOAD-EVAL": profile.upload_pipelines.length > 0,
    "FF-GATE-SECURITY-EVAL": true,
    "FF-GATE-MIGRATIONS": profile.databases.length > 0 || profile.deployment.length > 0
  };
  if (discovered[gateId] === true)
    return { applicable: true, reasons: ["Project discovery found the capability."] };
  const decisions = (previous?.module_decisions ?? []).filter((decision) =>
    (GATE_MODULES[gateId] ?? []).includes(decision.module)
  );
  const unproven = decisions.filter((decision) => decision.capability_status !== "ABSENT");
  if (unproven.length > 0)
    return {
      applicable: true,
      reasons: unproven.map(
        (decision) =>
          `Module '${decision.module}' was recorded capability ${decision.capability_status} / selection ${decision.selection_status}. It was not audited, which does not make this gate inapplicable.`
      )
    };
  return {
    applicable: false,
    reasons: [
      decisions.length === 0
        ? "Project discovery found no applicable capability."
        : `The prior audit proved the capability absent for: ${decisions.map((decision) => decision.module).join(", ")}.`
    ]
  };
}

async function capabilityGate(
  root: string,
  definition: GateDefinition,
  profile: ProjectProfile,
  previous: AuditReport | undefined,
  revision: string
): Promise<ShipGate> {
  const applicability = capabilityApplicability(definition.gate_id, profile, previous);
  if (!applicability.applicable) {
    return {
      gate_id: definition.gate_id,
      name: definition.name,
      category: definition.category,
      required: false,
      status: "NOT_APPLICABLE",
      evidence: applicability.reasons,
      evidence_records: []
    };
  }
  const gate = await evidenceGate(root, definition, previous, [], revision);
  return { ...gate, evidence: [...applicability.reasons, ...gate.evidence] };
}

function evidenceIsFresh(record: GateEvidence, revision: string): boolean {
  const timestamp = Date.parse(record.timestamp);
  const age = Date.now() - timestamp;
  return (
    record.revision === revision &&
    Number.isFinite(timestamp) &&
    age >= -5 * 60_000 &&
    age <= 24 * 60 * 60_000
  );
}

async function evidenceFromCommand(
  root: string,
  command: CommandDefinition | undefined,
  result: CommandResult | undefined,
  revision: string
): Promise<GateEvidence[]> {
  if (result === undefined || command === undefined) return [];
  const mapping: Partial<Record<string, GateEvidenceType>> = {
    "scan:secrets": "secret-scan",
    "audit:dependencies": "dependency-audit",
    "check:licenses": "license-scan",
    test: "project-test",
    "validate:dist": "release-artifact-validation",
    "package:platforms": "release-artifact-validation",
    "smoke:install": "release-artifact-validation"
  };
  const evidenceType = mapping[command.name];
  if (evidenceType === undefined) return [];
  const manifest = await captureEvidenceArtifacts(root, [
    { path: command.source, media_type: "application/json" }
  ]);
  const record: GateEvidence = {
    evidence_type: evidenceType,
    producer: "fullstack-forge/ship-command",
    scope: ["repository"],
    timestamp: result.started_at,
    revision,
    status: result.exitCode === 0 ? "PASS" : "FAIL",
    relevant_instance_ids: [],
    absence_proves_success: true,
    limitations: [
      `The record proves only that the discovered '${command.name}' command exited ${result.exitCode} for this revision.`
    ],
    command: {
      name: command.name,
      argv: [command.executable, ...command.args],
      definition: command.definition,
      exit_code: result.exitCode,
      started_at: result.started_at,
      duration_ms: result.duration_ms,
      output_sha256: sha256(result.output),
      input_manifest: manifest
    }
  };
  try {
    record.envelope = await createEvidenceEnvelope({
      root,
      revision,
      domain: "Ship",
      claim: record,
      artifacts: [{ path: command.source, media_type: "application/json" }]
    });
  } catch (error) {
    record.limitations.push(`Evidence envelope was not created: ${(error as Error).message}`);
  }
  return [record];
}

async function commandGate(
  root: string,
  definition: GateDefinition,
  command: CommandDefinition | undefined,
  result: CommandResult | undefined,
  allowRun: boolean,
  revision: string,
  ledger?: CommandLedgerRecord
): Promise<ShipGate> {
  if (command === undefined)
    return gateValue(
      definition.gate_id,
      definition.name,
      definition.category,
      "BLOCKED",
      [`Required command '${definition.command ?? "unknown"}' was not detected.`],
      definition.required
    );
  if (!allowRun)
    return gateValue(
      definition.gate_id,
      definition.name,
      definition.category,
      "BLOCKED",
      [`${command.executable} ${command.args.join(" ")} requires --allow-run.`],
      definition.required
    );
  if (ledger?.disposition === "BLOCKED")
    return gateValue(
      definition.gate_id,
      definition.name,
      definition.category,
      "BLOCKED",
      [
        `${command.executable} ${command.args.join(" ")} was blocked by offline network policy (${ledger.network_policy}, sandbox=${ledger.sandbox}): ${ledger.reason}`
      ],
      definition.required
    );
  if (result === undefined)
    return gateValue(
      definition.gate_id,
      definition.name,
      definition.category,
      "BLOCKED",
      [ledger?.reason ?? "A prior required command failed, so this command did not run."],
      definition.required
    );
  return gateValue(
    definition.gate_id,
    definition.name,
    definition.category,
    result.exitCode === 0 ? "PASS" : "FAIL",
    [`${command.executable} ${command.args.join(" ")} exited ${result.exitCode}.`],
    definition.required,
    await evidenceFromCommand(root, command, result, revision)
  );
}

function gate(
  gateId: string,
  name: string,
  category: GateDefinition["category"],
  applicability: GateApplicability,
  command?: string,
  evidenceTypes?: GateEvidenceType[]
): GateDefinition {
  return {
    gate_id: gateId,
    name,
    category,
    applicability,
    required: true,
    ...(command === undefined ? {} : { command }),
    ...(evidenceTypes === undefined ? {} : { evidence_types: evidenceTypes })
  };
}

function gateValue(
  gateId: string,
  name: string,
  category: ShipGate["category"],
  status: GateStatus,
  evidence: string[],
  required = true,
  evidenceRecords: GateEvidence[] = []
): ShipGate {
  return {
    gate_id: gateId,
    name,
    category,
    required,
    status,
    evidence,
    evidence_records: evidenceRecords
  };
}
