import { readFile } from "node:fs/promises";
import { validateFinding } from "./finding.js";
import type { AuditReport, ExecutionRecord } from "./report.js";
import type { CommandDefinition, ProjectProfile, Status } from "./types.js";
import {
  assertNoSymlinkPath,
  assertSafeRelative,
  resolveInside,
  runFile,
  sha256,
  utcNow
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
  gate("FF-GATE-PACKAGING", "Packaging completeness", "internal", "forge-self", "package:platforms"),
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
    ["security"]
  ),
  gate(
    "FF-GATE-DEPENDENCIES",
    "Dependency and lockfile inspection",
    "audit-evidence",
    "audited-application",
    "audit:dependencies",
    ["supply-chain"]
  ),
  gate(
    "FF-GATE-LICENSES",
    "License and attribution validation",
    "audit-evidence",
    "audited-application",
    "check:licenses",
    ["supply-chain", "docs"]
  ),
  gate("FF-GATE-AUTH-EVAL", "Authorization evaluation", "capability", "audited-application"),
  gate("FF-GATE-TENANT-EVAL", "Tenant-isolation evaluation", "capability", "audited-application"),
  gate("FF-GATE-UPLOAD-EVAL", "Upload-security evaluation", "capability", "audited-application"),
  gate(
    "FF-GATE-SECURITY-EVAL",
    "Application-security evaluation",
    "capability",
    "audited-application"
  ),
  gate(
    "FF-GATE-MIGRATIONS",
    "Migration and configuration inspection",
    "capability",
    "audited-application"
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
};

export async function runShipGates(
  root: string,
  profile: ProjectProfile,
  previous: AuditReport | undefined,
  commands: CommandDefinition[],
  allowRun: boolean
): Promise<ShipGateResult> {
  const execution: ExecutionRecord[] = [];
  const preflight = [schemaGate(root, previous), openFindingsGate(previous)];
  const preflightPassed = evaluateGateOutcome(preflight) === "PASS";
  const commandResults =
    allowRun && preflightPassed
      ? await runRegisteredCommands(root, commands, execution)
      : new Map<string, { exitCode: number; output: string }>();
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
      gates.push(capabilityGate(definition, profile, previous));
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
        evidence: ["This Fullstack Forge self-release check does not apply to the audited project."]
      });
      continue;
    }
    if (definition.command !== undefined) {
      const detected = commands.find((command) => command.name === definition.command);
      // An audited-application gate must not be skipped merely because the project exposes no
      // matching script. It falls back to recorded audit evidence and stays required.
      if (detected === undefined && definition.evidence_sections !== undefined) {
        gates.push(evidenceGate(definition, definition.evidence_sections, previous));
        continue;
      }
      const result = commandResults.get(definition.command);
      gates.push(commandGate(definition, detected, result, allowRun));
      continue;
    }
  }

  const projectNative = ["format:check", "lint", "typecheck", "test", "build"].flatMap((name) => {
    const command = commands.find((candidate) => candidate.name === name);
    if (command === undefined) return [];
    const result = commandResults.get(name);
    return [
      commandGate(
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
        allowRun
      )
    ];
  });
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
      ]
    });
  }
  return { status: evaluateGateOutcome(gates), gates, execution };
}

export function evaluateGateOutcome(gates: ShipGate[]): "PASS" | "FAIL" | "BLOCKED" {
  if (gates.some((gate) => gate.required && gate.status === "FAIL")) return "FAIL";
  if (gates.some((gate) => gate.required && ["BLOCKED", "NOT_VERIFIED"].includes(gate.status)))
    return "BLOCKED";
  return "PASS";
}

async function runRegisteredCommands(
  root: string,
  commands: CommandDefinition[],
  execution: ExecutionRecord[]
): Promise<Map<string, { exitCode: number; output: string }>> {
  const results = new Map<string, { exitCode: number; output: string }>();
  const ordered = [
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
  ];
  for (const name of ordered) {
    const command = commands.find((candidate) => candidate.name === name);
    if (command === undefined || results.has(name)) continue;
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
    results.set(name, { exitCode: result.exitCode, output });
    if (result.exitCode !== 0) break;
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

/**
 * Satisfies an audited-application gate from recorded audit evidence when the project exposes no
 * corresponding command. Missing evidence is NOT_VERIFIED and still blocks; it is never PASS.
 */
function evidenceGate(
  definition: GateDefinition,
  sections: string[],
  previous: AuditReport | undefined
): ShipGate {
  const evidence = previous?.findings.filter((finding) => sections.includes(finding.section)) ?? [];
  const failed = evidence.some((finding) => ["FAIL", "WARNING"].includes(finding.status));
  const proven = evidence.some((finding) => finding.status === "PASS");
  const unresolved = evidence.some((finding) =>
    ["BLOCKED", "NOT_VERIFIED"].includes(finding.status)
  );
  return {
    gate_id: definition.gate_id,
    name: definition.name,
    category: definition.category,
    required: true,
    status: failed ? "FAIL" : proven && !unresolved ? "PASS" : "NOT_VERIFIED",
    evidence:
      evidence.length === 0
        ? [
            `No '${definition.command ?? definition.gate_id}' command was detected and no ${sections.join("/")} audit evidence was recorded.`
          ]
        : evidence.map((finding) => `${finding.id}: ${finding.status}`)
  };
}

function capabilityGate(
  definition: GateDefinition,
  profile: ProjectProfile,
  previous: AuditReport | undefined
): ShipGate {
  const mapping: Record<string, { applicable: boolean; sections: string[] }> = {
    "FF-GATE-AUTH-EVAL": {
      applicable: profile.authentication.length > 0 || profile.authorization.length > 0,
      sections: ["auth", "authorization"]
    },
    "FF-GATE-TENANT-EVAL": {
      applicable: profile.tenant_boundaries.length > 0,
      sections: ["tenancy"]
    },
    "FF-GATE-UPLOAD-EVAL": {
      applicable: profile.upload_pipelines.length > 0,
      sections: ["uploads"]
    },
    "FF-GATE-SECURITY-EVAL": {
      applicable: true,
      sections: ["security"]
    },
    "FF-GATE-MIGRATIONS": {
      applicable: profile.databases.length > 0 || profile.deployment.length > 0,
      sections: ["database", "deployment"]
    }
  };
  const config = mapping[definition.gate_id];
  if (config === undefined || !config.applicable) {
    return {
      gate_id: definition.gate_id,
      name: definition.name,
      category: definition.category,
      required: false,
      status: "NOT_APPLICABLE",
      evidence: ["Project discovery found no applicable capability."]
    };
  }
  const evidence =
    previous?.findings.filter((finding) => config.sections.includes(finding.section)) ?? [];
  const failed = evidence.some((finding) => ["FAIL", "WARNING"].includes(finding.status));
  const unresolved =
    evidence.length === 0 ||
    !evidence.some((finding) => finding.status === "PASS") ||
    evidence.some((finding) => ["BLOCKED", "NOT_VERIFIED"].includes(finding.status));
  return {
    gate_id: definition.gate_id,
    name: definition.name,
    category: definition.category,
    required: true,
    status: failed ? "FAIL" : unresolved ? "NOT_VERIFIED" : "PASS",
    evidence:
      evidence.length === 0
        ? [`No ${config.sections.join("/")} evaluation evidence was recorded.`]
        : evidence.map((finding) => `${finding.id}: ${finding.status}`)
  };
}

function commandGate(
  definition: GateDefinition,
  command: CommandDefinition | undefined,
  result: { exitCode: number; output: string } | undefined,
  allowRun: boolean
): ShipGate {
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
  if (result === undefined)
    return gateValue(
      definition.gate_id,
      definition.name,
      definition.category,
      "BLOCKED",
      ["A prior required command failed, so this command did not run."],
      definition.required
    );
  return gateValue(
    definition.gate_id,
    definition.name,
    definition.category,
    result.exitCode === 0 ? "PASS" : "FAIL",
    [`${command.executable} ${command.args.join(" ")} exited ${result.exitCode}.`],
    definition.required
  );
}

function gate(
  gateId: string,
  name: string,
  category: GateDefinition["category"],
  applicability: GateApplicability,
  command?: string,
  evidenceSections?: string[]
): GateDefinition {
  return {
    gate_id: gateId,
    name,
    category,
    applicability,
    required: true,
    ...(command === undefined ? {} : { command }),
    ...(evidenceSections === undefined ? {} : { evidence_sections: evidenceSections })
  };
}

function gateValue(
  gateId: string,
  name: string,
  category: ShipGate["category"],
  status: GateStatus,
  evidence: string[],
  required = true
): ShipGate {
  return { gate_id: gateId, name, category, required, status, evidence };
}
