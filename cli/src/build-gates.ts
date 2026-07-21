import type { BuildApplicabilityResult } from "./build-applicability.js";
import type { BuildTier, CriterionEvidence, CriterionStatus } from "./build-state.js";
import type { CommandDefinition, ProjectProfile } from "./types.js";

export type BuildGateStatus = CriterionStatus;
export type BuildGateId =
  | "FF-BUILD-GATE-SCOPE"
  | "FF-BUILD-GATE-STATIC"
  | "FF-BUILD-GATE-BEHAVIOR"
  | "FF-BUILD-GATE-DISCIPLINES"
  | "FF-BUILD-GATE-RUNTIME"
  | "FF-BUILD-GATE-DESIGN-DIRECTION"
  | "FF-BUILD-GATE-MIGRATION"
  | "FF-BUILD-GATE-NEGATIVE-SECURITY"
  | "FF-BUILD-GATE-AUTHORIZATION-NEGATIVE"
  | "FF-BUILD-GATE-TENANCY-ISOLATION"
  | "FF-BUILD-GATE-UPLOAD-HOSTILE-FILE"
  | "FF-BUILD-GATE-WEBHOOK-SAFETY"
  | "FF-BUILD-GATE-SECURITY-REVIEW"
  | `FF-BUILD-GATE-PROJECT-${string}`;

export type BuildGate = {
  id: BuildGateId;
  name: string;
  tier: BuildTier;
  criteria: string[];
  required: boolean;
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

export type BuildGatePlan = { gates: BuildGate[]; required_criteria: string[] };

export type EvaluatedBuildGate = BuildGate & {
  status: BuildGateStatus;
  missing: string[];
};

const PROJECT_COMMANDS = new Set(["format:check", "lint", "typecheck", "test", "build"]);
const HIGH_SECURITY = new Set(["auth", "authorization", "tenancy", "uploads", "payments"]);

/**
 * A pure, Build-only registry. It shares no state with Ship and has no authority to execute a
 * command. Callers must still apply command allow-run and offline policy before producing evidence.
 */
export function planBuildGates(input: BuildGatePlanInput): BuildGatePlan {
  const gates: BuildGate[] = [
    gate(
      "FF-BUILD-GATE-SCOPE",
      "Resolved feature scope",
      input.tier,
      ["scope-resolution"],
      true,
      true,
      "Every tier must bind evidence to the changed or recorded touched paths."
    ),
    gate(
      "FF-BUILD-GATE-STATIC",
      "Supported static analysis",
      input.tier,
      ["static-analysis"],
      true,
      true,
      "Static evidence is bounded, but required as one input to completion."
    ),
    gate(
      "FF-BUILD-GATE-BEHAVIOR",
      "Changed behavior proof",
      input.tier,
      ["behavior-verification"],
      true,
      true,
      "A feature cannot complete solely from static pattern analysis."
    ),
    gate(
      "FF-BUILD-GATE-DISCIPLINES",
      "Applicable discipline evidence",
      input.tier,
      input.applicability.required.map((discipline) => `discipline:${discipline}`),
      true,
      input.tier === "high",
      "Mandatory disciplines are derived independently of frame and plan choices."
    )
  ];

  if (input.tier !== "light") {
    for (const command of input.commands) {
      if (!PROJECT_COMMANDS.has(command.name)) continue;
      gates.push(
        gate(
          `FF-BUILD-GATE-PROJECT-${command.name.toUpperCase().replace(/[^A-Z0-9]/gu, "-")}`,
          `Project command ${command.name}`,
          input.tier,
          [`project:${command.name}`],
          true,
          true,
          `Detected project command '${command.name}' is required at ${input.tier} tier.`
        )
      );
    }
  }

  if (input.tier === "high") {
    const required = new Set(input.applicability.required);
    const has = (discipline: string): boolean => required.has(discipline);
    if ([...HIGH_SECURITY].some(has))
      gates.push(
        gate(
          "FF-BUILD-GATE-NEGATIVE-SECURITY",
          "Negative security proof",
          "high",
          ["security-negative-tests"],
          true,
          true,
          "High-risk security capabilities require a negative test, not only a positive path."
        )
      );
    if (has("authorization"))
      gates.push(
        gate(
          "FF-BUILD-GATE-AUTHORIZATION-NEGATIVE",
          "Authorization denial proof",
          "high",
          ["authorization-negative-tests"],
          true,
          true,
          "Authorization changes require an observed denied path."
        )
      );
    if (has("tenancy"))
      gates.push(
        gate(
          "FF-BUILD-GATE-TENANCY-ISOLATION",
          "Tenant isolation proof",
          "high",
          ["tenant-isolation-tests"],
          true,
          true,
          "Tenant data requires a cross-tenant denial test."
        )
      );
    if (has("uploads"))
      gates.push(
        gate(
          "FF-BUILD-GATE-UPLOAD-HOSTILE-FILE",
          "Hostile upload proof",
          "high",
          ["upload-hostile-file-tests"],
          true,
          true,
          "Upload handling requires hostile-file rejection evidence."
        )
      );
    if (has("payments"))
      gates.push(
        gate(
          "FF-BUILD-GATE-WEBHOOK-SAFETY",
          "Webhook replay and signature proof",
          "high",
          ["webhook-safety-tests"],
          true,
          true,
          "Payment webhooks require signature, replay, and idempotency proof."
        )
      );
    if (has("database") || input.profile.databases.length > 0)
      gates.push(
        gate(
          "FF-BUILD-GATE-MIGRATION",
          "Migration validation",
          "high",
          ["migration-validation"],
          true,
          true,
          "A database or migration capability requires migration validation."
        )
      );
    if (has("ui") || has("frontend") || has("accessibility") || has("ux")) {
      gates.push(
        gate(
          "FF-BUILD-GATE-RUNTIME",
          "Rendered runtime evidence",
          "high",
          ["runtime:rendered-ui"],
          true,
          true,
          input.runtime_available === false
            ? "A UI capability was detected but no runtime is available; this required gate stays blocked."
            : "High-tier UI work requires complete runtime evidence."
        )
      );
      gates.push(
        gate(
          "FF-BUILD-GATE-DESIGN-DIRECTION",
          "Design direction record",
          "high",
          ["design-direction"],
          true,
          true,
          "UI work requires an intentional design-direction record or a reasoned deviation."
        )
      );
    }
    gates.push(
      gate(
        "FF-BUILD-GATE-SECURITY-REVIEW",
        "Independent security review",
        "high",
        ["security-review"],
        true,
        true,
        "High tier has a non-waivable security review criterion."
      )
    );
  }

  const ordered = gates.sort((left, right) => left.id.localeCompare(right.id));
  return {
    gates: ordered,
    required_criteria: [...new Set(ordered.flatMap((entry) => entry.criteria))].sort()
  };
}

/** Evaluates criteria without mutating feature state or converting missing evidence into a pass. */
export function evaluateBuildGates(
  plan: BuildGatePlan,
  evidence: readonly CriterionEvidence[],
  accepted_risks: readonly string[] = []
): EvaluatedBuildGate[] {
  const byCriterion = new Map(evidence.map((entry) => [entry.criterion, entry]));
  const accepted = new Set(accepted_risks);
  return plan.gates.map((current) => {
    const missing: string[] = [];
    let status: BuildGateStatus = "PASS";
    for (const criterion of current.criteria) {
      const result = byCriterion.get(criterion);
      if (result === undefined) {
        missing.push(`${criterion}: missing evidence`);
        status = strongest(status, "NOT_VERIFIED");
        continue;
      }
      if (result.status === "NOT_APPLICABLE") {
        missing.push(
          `${criterion}: reasoned NOT_APPLICABLE is not sufficient for this required gate`
        );
        status = strongest(status, "NOT_VERIFIED");
        continue;
      }
      if (result.status !== "PASS") {
        const waived = !current.non_waivable && accepted.has(criterion);
        if (!waived) missing.push(`${criterion}: ${result.status}`);
        if (!waived) status = strongest(status, result.status);
      }
    }
    return { ...current, status, missing };
  });
}

function gate(
  id: BuildGateId,
  name: string,
  tier: BuildTier,
  criteria: string[],
  required: boolean,
  nonWaivable: boolean,
  reason: string
): BuildGate {
  return { id, name, tier, criteria, required, non_waivable: nonWaivable, reason };
}

function strongest(current: BuildGateStatus, next: BuildGateStatus): BuildGateStatus {
  const rank: Record<BuildGateStatus, number> = {
    PASS: 0,
    NOT_APPLICABLE: 1,
    NOT_VERIFIED: 2,
    BLOCKED: 3,
    FAIL: 4
  };
  return rank[next] > rank[current] ? next : current;
}
