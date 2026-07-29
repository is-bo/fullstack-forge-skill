const PROJECT_COMMANDS = new Set([
    "format",
    "format:check",
    "lint",
    "typecheck",
    "test",
    "test:unit",
    "test:integration",
    "test:e2e",
    "build"
]);
const LIGHT_PROJECT_COMMANDS = new Set(["test", "test:unit", "test:integration", "test:e2e"]);
const HIGH_SECURITY = new Set([
    "auth",
    "authorization",
    "security",
    "privacy",
    "tenancy",
    "uploads",
    "payments"
]);
const NON_WAIVABLE_DISCIPLINES = new Set([
    "code",
    "testing",
    "auth",
    "authorization",
    "security",
    "privacy",
    "tenancy",
    "uploads",
    "payments",
    "database",
    "queries",
    "cache",
    "storage",
    "accessibility",
    "integrations",
    "deployment",
    "reliability",
    "recovery"
]);
/**
 * A pure, Build-only registry. It shares no state with Ship and has no authority to execute a
 * command. Callers must still apply command allow-run and offline policy before producing evidence.
 */
export function planBuildGates(input) {
    const gates = [
        gate("FF-BUILD-GATE-APPLICABILITY", "Resolved discipline applicability", input.tier, ["applicability"], true, "never", "Unresolved applicability questions must be resolved before completion."),
        gate("FF-BUILD-GATE-SCOPE", "Resolved feature scope", input.tier, ["scope-resolution"], true, "never", "Every tier must bind evidence to the changed or recorded touched paths."),
        gate("FF-BUILD-GATE-STATIC", "Supported static analysis", input.tier, ["supported-static-patterns"], true, "never", "Bounded supported-pattern evidence is required, but never represents whole-feature security."),
        gate("FF-BUILD-GATE-BEHAVIOR", "Changed behavior proof", input.tier, ["behavior-verification"], true, "never", "A feature cannot complete solely from static pattern analysis.")
    ];
    for (const discipline of input.applicability.required) {
        const never = input.tier === "high" || NON_WAIVABLE_DISCIPLINES.has(discipline);
        gates.push(gate(`FF-BUILD-GATE-DISCIPLINE-${discipline.toUpperCase().replace(/[^A-Z0-9]/gu, "-")}`, `Applicable discipline ${discipline}`, input.tier, [`discipline:${discipline}`], true, never ? "never" : "operational-human", `Applicability evidence requires '${discipline}' independently of the agent's explicit selections.`));
    }
    for (const command of input.commands) {
        if (!PROJECT_COMMANDS.has(command.name))
            continue;
        if (input.tier === "light" && !LIGHT_PROJECT_COMMANDS.has(command.name))
            continue;
        gates.push(gate(`FF-BUILD-GATE-PROJECT-${command.name.toUpperCase().replace(/[^A-Z0-9]/gu, "-")}`, `Project command ${command.name}`, input.tier, [`project:${command.name}`], true, "never", `Detected project command '${command.name}' is required at ${input.tier} tier.`));
    }
    if (input.tier === "high") {
        const required = new Set(input.applicability.required);
        const has = (discipline) => required.has(discipline);
        if ([...HIGH_SECURITY].some(has))
            gates.push(gate("FF-BUILD-GATE-NEGATIVE-SECURITY", "Negative security proof", "high", ["security-negative-tests"], true, "never", "High-risk security capabilities require a negative test, not only a positive path."));
        if (has("authorization"))
            gates.push(gate("FF-BUILD-GATE-AUTHORIZATION-NEGATIVE", "Authorization denial proof", "high", ["authorization-negative-tests"], true, "never", "Authorization changes require an observed denied path."));
        if (has("auth"))
            gates.push(gate("FF-BUILD-GATE-AUTHENTICATION-NEGATIVE", "Authentication abuse-path proof", "high", ["authentication-negative-tests"], true, "never", "Authentication changes require invalid, expired, replayed, and recovery abuse-path tests."));
        if (has("tenancy"))
            gates.push(gate("FF-BUILD-GATE-TENANCY-ISOLATION", "Tenant isolation proof", "high", ["tenant-isolation-tests"], true, "never", "Tenant data requires a cross-tenant denial test."));
        if (has("uploads"))
            gates.push(gate("FF-BUILD-GATE-UPLOAD-HOSTILE-FILE", "Hostile upload proof", "high", ["upload-hostile-file-tests"], true, "never", "Upload handling requires hostile-file rejection evidence."));
        if (has("payments"))
            gates.push(gate("FF-BUILD-GATE-WEBHOOK-SAFETY", "Webhook replay and signature proof", "high", ["webhook-safety-tests"], true, "never", "Payment webhooks require signature, replay, and idempotency proof."));
        if (has("database") || input.profile.databases.length > 0) {
            gates.push(gate("FF-BUILD-GATE-MIGRATION", "Migration validation", "high", ["migration-validation"], true, "never", "A database or migration capability requires migration validation."));
            gates.push(gate("FF-BUILD-GATE-MIGRATION-RECOVERY", "Migration rollback or forward-fix proof", "high", ["migration-recovery"], true, "never", "High-risk schema changes require tested rollback or forward-fix evidence."));
        }
        if (has("ui") || has("frontend") || has("accessibility") || has("ux")) {
            gates.push(gate("FF-BUILD-GATE-RUNTIME", "Rendered runtime evidence", "high", ["runtime:rendered-ui"], true, "never", input.runtime_available === false
                ? "A UI capability was detected but no runtime is available; this required gate stays blocked."
                : "High-tier UI work requires complete runtime evidence."));
            gates.push(gate("FF-BUILD-GATE-DESIGN-DIRECTION", "Design direction record", "high", ["design-direction"], true, "never", "UI work requires an intentional design-direction record or a reasoned deviation."));
        }
        if (has("privacy"))
            gates.push(gate("FF-BUILD-GATE-PRIVACY-DATA-FLOW", "Sensitive-data flow proof", "high", ["privacy-data-flow"], true, "never", "High-risk personal-data work requires collection, storage, logging, retention, and deletion evidence."));
        gates.push(gate("FF-BUILD-GATE-INTEGRATION", "Runtime or integration proof", "high", ["integration-verification"], true, "never", "High-tier behavior requires direct integration or runtime proof."));
        gates.push(gate("FF-BUILD-GATE-SECURITY-REVIEW", "Independent security review", "high", ["security-review"], true, "never", "High tier has a non-waivable security review criterion."));
    }
    const ordered = gates.sort((left, right) => left.id.localeCompare(right.id));
    return {
        gates: ordered,
        required_criteria: [...new Set(ordered.flatMap((entry) => entry.criteria))].sort()
    };
}
/** Evaluates criteria without mutating feature state or converting missing evidence into a pass. */
export function evaluateBuildGates(plan, evidence, accepted_risks = []) {
    const byCriterion = new Map(evidence.map((entry) => [entry.criterion, entry]));
    const accepted = new Set(accepted_risks);
    return plan.gates.map((current) => {
        const missing = [];
        let status = "PASS";
        for (const criterion of current.criteria) {
            const result = byCriterion.get(criterion);
            if (result === undefined) {
                missing.push(`${criterion}: missing evidence`);
                status = strongest(status, "NOT_VERIFIED");
                continue;
            }
            if (result.status === "NOT_APPLICABLE") {
                missing.push(`${criterion}: reasoned NOT_APPLICABLE is not sufficient for this required gate`);
                status = strongest(status, "NOT_VERIFIED");
                continue;
            }
            if (result.status !== "PASS") {
                const waived = current.waiver_policy !== "never" && accepted.has(criterion);
                if (!waived)
                    missing.push(`${criterion}: ${result.status}`);
                if (!waived)
                    status = strongest(status, result.status);
            }
        }
        return { ...current, status, missing };
    });
}
function gate(id, name, tier, criteria, required, waiverPolicy, reason) {
    return {
        id,
        name,
        tier,
        criteria,
        required,
        waiver_policy: waiverPolicy,
        non_waivable: waiverPolicy === "never",
        reason
    };
}
function strongest(current, next) {
    const rank = {
        PASS: 0,
        NOT_APPLICABLE: 1,
        NOT_VERIFIED: 2,
        BLOCKED: 3,
        FAIL: 4
    };
    return rank[next] > rank[current] ? next : current;
}
