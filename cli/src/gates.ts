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

export type GateDefinition = {
  gate_id: string;
  name: string;
  category: ShipGate["category"];
  required: boolean;
  command?: string;
};

export const FORGE_GATE_REGISTRY: readonly GateDefinition[] = [
  gate("FF-GATE-SCHEMA", "Finding-schema validation", "internal"),
  gate("FF-GATE-AUDIT-FRESHNESS", "Prior audit evidence freshness", "audit-evidence"),
  gate("FF-GATE-SKILLS", "Skill validation", "internal", "validate"),
  gate("FF-GATE-PLATFORMS", "Generated platform synchronization", "internal", "check:platforms"),
  gate("FF-GATE-SECRETS", "Secret scanning", "internal", "scan:secrets"),
  gate("FF-GATE-DEPENDENCIES", "Dependency inspection", "internal", "audit:dependencies"),
  gate("FF-GATE-LICENSES", "License and attribution validation", "internal", "check:licenses"),
  gate("FF-GATE-ARCHIVES", "Archive validation", "internal", "validate:dist"),
  gate("FF-GATE-PACKAGING", "Packaging completeness", "internal", "package:platforms"),
  gate("FF-GATE-SMOKE", "Smoke installation", "internal", "smoke:install"),
  gate("FF-GATE-INSTALLER", "Installer path and symlink protections", "internal", "test"),
  gate("FF-GATE-EVALS", "Executable evaluation suite", "internal", "test"),
  gate("FF-GATE-AUTH-EVAL", "Authorization evaluation", "capability"),
  gate("FF-GATE-TENANT-EVAL", "Tenant-isolation evaluation", "capability"),
  gate("FF-GATE-UPLOAD-EVAL", "Upload-security evaluation", "capability"),
  gate("FF-GATE-SECURITY-EVAL", "Application-security evaluation", "capability"),
  gate("FF-GATE-MIGRATIONS", "Migration and configuration inspection", "capability"),
  gate("FF-GATE-OPEN-FINDINGS", "Open critical and required high findings", "audit-evidence")
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
    if (definition.command !== undefined) {
      if (!isForgeRepository && definition.category === "internal") {
        gates.push({
          gate_id: definition.gate_id,
          name: definition.name,
          category: definition.category,
          required: false,
          status: "NOT_APPLICABLE",
          evidence: ["This Fullstack Forge self-check does not apply to the audited project."]
        });
        continue;
      }
      const detected = commands.find((command) => command.name === definition.command);
      const result = commandResults.get(definition.command);
      gates.push(commandGate(definition, detected, result, allowRun));
      continue;
    }
    if (definition.gate_id === "FF-GATE-DEPENDENCIES") {
      const dependencyEvidence =
        previous?.findings.filter((finding) => finding.section === "supply-chain") ?? [];
      gates.push({
        gate_id: definition.gate_id,
        name: definition.name,
        category: definition.category,
        required: true,
        status: dependencyEvidence.some((finding) => finding.status === "FAIL")
          ? "FAIL"
          : dependencyEvidence.some((finding) => finding.status === "PASS")
            ? "PASS"
            : "NOT_VERIFIED",
        evidence:
          dependencyEvidence.length > 0
            ? dependencyEvidence.map((finding) => `${finding.id}: ${finding.status}`)
            : ["No direct dependency inspection evidence was recorded."]
      });
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
  command?: string
): GateDefinition {
  return {
    gate_id: gateId,
    name,
    category,
    required: true,
    ...(command === undefined ? {} : { command })
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
