import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATE_PROJECT_CHECKS, ReportAuditLedger, buildAuditPlan, commandNetworkPolicy, isNetworkDependent, orchestrateAudit } from "../src/audit-orchestration.js";
function command(name, definition) {
    return { name, executable: "npm", args: ["run", name], source: "package.json", definition };
}
const COMMANDS = [
    command("lint", "eslint ."),
    command("test", "node --test"),
    command("audit:dependencies", "npm audit --ignore-scripts"),
    command("start", "node server.js"),
    command("dev", "vite dev")
];
const succeedingRunner = () => Promise.resolve({ exitCode: 0, stdout: "ok", stderr: "" });
function baseInput(overrides = {}) {
    return {
        root: "/repo",
        modules: ["security"],
        commands: COMMANDS,
        allowRun: false,
        offline: false,
        dryRun: false,
        ledger: new ReportAuditLedger(),
        runCommand: succeedingRunner,
        ...overrides
    };
}
function ids(checks) {
    return checks.map((check) => check.id);
}
test("a static-only security audit plans modules and never executes a command", async () => {
    const ledger = new ReportAuditLedger();
    const result = await orchestrateAudit(baseInput({ ledger }));
    assert.deepEqual(ids(result.planned).filter((id) => id.startsWith("module:")), ["module:security"]);
    assert.equal(result.execution.length, 0);
    const commandOutcomes = result.outcomes.filter((outcome) => outcome.kind === "project-command");
    assert.ok(commandOutcomes.length > 0);
    assert.ok(commandOutcomes.every((outcome) => outcome.status === "NOT_RUN"));
    assert.ok(commandOutcomes.every((outcome) => outcome.cause === "unauthorized"));
    // Static-only is a complete audit of what it claims to cover: nothing was requested and refused.
    assert.equal(result.evidence_complete, true);
});
test("the planned-check list never includes an unknown project server script", () => {
    const planned = buildAuditPlan({ modules: ["ui"], commands: COMMANDS });
    assert.equal(planned.some((check) => check.name === "start" || check.name === "dev"), false);
    for (const check of planned) {
        if (check.kind !== "project-command")
            continue;
        assert.ok(CANDIDATE_PROJECT_CHECKS.includes(check.name));
    }
});
test("planned-check order is deterministic regardless of input ordering", () => {
    const first = buildAuditPlan({
        modules: ["ui", "api", "security"],
        commands: COMMANDS,
        url: "http://127.0.0.1:3000/"
    });
    const second = buildAuditPlan({
        modules: ["security", "ui", "api"],
        commands: [...COMMANDS].reverse(),
        url: "http://127.0.0.1:3000/"
    });
    assert.deepEqual(ids(first), ids(second));
    assert.deepEqual(ids(first).slice(0, 3), ["module:api", "module:security", "module:ui"]);
    assert.equal(ids(first).at(-1), "runtime:rendered-ui");
});
test("authorized command execution is recorded in the execution ledger", async () => {
    const ledger = new ReportAuditLedger();
    const executed = [];
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        ledger,
        runCommand: (definition) => {
            executed.push(definition.name);
            return Promise.resolve({ exitCode: 0, stdout: "done", stderr: "" });
        }
    }));
    assert.deepEqual(executed, ["lint", "test", "audit:dependencies"]);
    assert.equal(result.execution.length, 3);
    assert.equal(ledger.execution.length, 3);
    assert.ok(result.execution.every((record) => record.started_at !== undefined));
    assert.ok(result.execution.every((record) => record.duration_ms !== undefined));
});
test("an unauthorized command is recorded as not run with its reason", async () => {
    const ledger = new ReportAuditLedger();
    await orchestrateAudit(baseInput({ ledger }));
    const findings = ledger.findings();
    const blocked = findings.find((finding) => finding.title.includes("command:lint"));
    assert.ok(blocked, "expected a not-run finding for the lint command");
    // NOT_VERIFIED, not BLOCKED: an unauthorized check is missing evidence, not an obstructed defect,
    // so it must stay out of the `forge fix` candidate set.
    assert.equal(blocked.status, "NOT_VERIFIED");
    assert.ok(blocked.evidence[0]?.includes("cause=unauthorized"));
    assert.ok(blocked.recommendation.includes("--allow-run"));
});
test("offline refuses an authorized network-dependent command before spawning it", async () => {
    const ledger = new ReportAuditLedger();
    const executed = [];
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        offline: true,
        ledger,
        runCommand: (definition) => {
            executed.push(definition.name);
            return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
        }
    }));
    // Nothing arbitrary runs offline. `audit:dependencies` is provably network-dependent, and
    // `lint`/`test` are arbitrary project scripts whose network behaviour is UNKNOWN. Forge
    // implements no OS-level network isolation, so none of the three may execute under --offline.
    assert.deepEqual(executed, []);
    const escalated = result.outcomes.find((entry) => entry.id === "command:audit:dependencies");
    assert.ok(escalated);
    assert.equal(escalated.status, "NOT_RUN");
    assert.equal(escalated.cause, "offline-policy");
    for (const id of ["command:lint", "command:test"]) {
        const outcome = result.outcomes.find((entry) => entry.id === id);
        assert.ok(outcome, `${id} must be planned`);
        assert.equal(outcome.status, "NOT_RUN", `${id} must not execute under --offline`);
        assert.equal(outcome.cause, "offline-policy");
        assert.match(String(outcome.reason), /UNKNOWN/u);
    }
});
test("a keyword-free arbitrary project script stays UNKNOWN and is still blocked offline", async () => {
    // Cross-branch regression guarding the v0.1.7 offline policy against the v0.1.9 orchestrator.
    // The definition contains no network keyword whatsoever. Absence of keywords is not proof of
    // offline safety, so the planned check must remain UNKNOWN and must never execute offline.
    const quiet = command("test", "node ./scripts/whatever.js");
    assert.equal(isNetworkDependent(quiet), false);
    assert.equal(commandNetworkPolicy(quiet, { offline: true, forgeOwned: false }), "UNKNOWN");
    const executed = [];
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        offline: true,
        commands: [quiet],
        runCommand: (definition) => {
            executed.push(definition.name);
            return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
        }
    }));
    assert.deepEqual(executed, []);
    const outcome = result.outcomes.find((entry) => entry.id === "command:test");
    assert.ok(outcome);
    assert.equal(outcome.status, "NOT_RUN");
    assert.equal(outcome.cause, "offline-policy");
});
test("no arbitrary project command can reach OFFLINE_SAFE, and a blocked check never passes", async () => {
    for (const definition of ["eslint .", "tsc --noEmit", "node build/index.js", "echo ok"]) {
        assert.notEqual(commandNetworkPolicy(command("check", definition), { offline: true, forgeOwned: false }), "OFFLINE_SAFE", `'${definition}' must never be classified offline-safe`);
    }
    const ledger = new ReportAuditLedger();
    await orchestrateAudit(baseInput({ allowRun: true, offline: true, ledger, commands: [command("lint", "eslint .")] }));
    const check = ledger.ledgers().planned_checks.find((entry) => entry.check_id === "command:lint");
    assert.ok(check);
    assert.equal(check.status, "BLOCKED");
    assert.equal(check.network_policy, "UNKNOWN");
});
test("network-dependent detection reads the script definition, not its name", () => {
    assert.equal(isNetworkDependent(command("check", "npm audit --ignore-scripts")), true);
    assert.equal(isNetworkDependent(command("check", "curl https://example.test")), true);
    assert.equal(isNetworkDependent(command("check", "npx tsc")), true);
    assert.equal(isNetworkDependent(command("check", "eslint .")), false);
});
test("--check restricts execution to the selected checks", async () => {
    const executed = [];
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        select: ["lint"],
        runCommand: (definition) => {
            executed.push(definition.name);
            return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
        }
    }));
    assert.deepEqual(executed, ["lint"]);
    const moduleOutcome = result.outcomes.find((entry) => entry.id === "module:security");
    assert.equal(moduleOutcome?.status, "NOT_RUN");
    assert.equal(moduleOutcome.cause, "deselected");
});
test("--skip-check excludes a check even when it is otherwise eligible", async () => {
    const executed = [];
    await orchestrateAudit(baseInput({
        allowRun: true,
        skip: ["command:test"],
        runCommand: (definition) => {
            executed.push(definition.name);
            return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
        }
    }));
    assert.equal(executed.includes("test"), false);
    assert.ok(executed.includes("lint"));
});
test("an unknown check name is rejected instead of silently ignored", async () => {
    await assert.rejects(() => orchestrateAudit(baseInput({ select: ["lnit"] })), /Unknown --check value 'lnit'/u);
    await assert.rejects(() => orchestrateAudit(baseInput({ skip: ["module:nonexistent"] })), /Unknown --skip-check value/u);
});
test("a dry run plans every executable check without running any of it", async () => {
    const executed = [];
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        dryRun: true,
        runCommand: (definition) => {
            executed.push(definition.name);
            return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
        }
    }));
    assert.deepEqual(executed, []);
    assert.equal(result.execution.length, 0);
    assert.ok(result.planned.length > 1);
});
test("a supplied URL collects rendered evidence and records it", async () => {
    const ledger = new ReportAuditLedger();
    const collector = (input) => Promise.resolve({
        kind: "rendered-ui",
        status: "COMPLETE",
        url: input.url,
        evidence_dir: input.evidenceDir ?? ".forge/evidence/ui",
        artifacts: ["a.png"],
        limitations: [],
        complete: true
    });
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        ledger,
        url: "http://127.0.0.1:3000/",
        evidenceDir: "artifacts/ui",
        collectRuntimeEvidence: collector
    }));
    assert.equal(result.runtime_evidence.length, 1);
    assert.equal(result.runtime_evidence[0]?.evidence_dir, "artifacts/ui");
    assert.equal(result.evidence_complete, true);
    assert.equal(ledger.runtime.length, 1);
});
test("rendered evidence that is unavailable fails the audit closed", async () => {
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        url: "http://127.0.0.1:3000/",
        collectRuntimeEvidence: () => Promise.resolve({
            kind: "rendered-ui",
            status: "BLOCKED",
            artifacts: [],
            limitations: ["no browser driver is installed"],
            complete: false
        })
    }));
    assert.equal(result.evidence_complete, false);
    const outcome = result.outcomes.find((entry) => entry.id === "runtime:rendered-ui");
    assert.equal(outcome?.status, "NOT_RUN");
    assert.equal(outcome.cause, "failed-closed");
    assert.ok(outcome.reason?.includes("no browser driver is installed"));
});
test("partial rendered evidence is never treated as complete", async () => {
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        url: "http://127.0.0.1:3000/",
        collectRuntimeEvidence: () => Promise.resolve({
            kind: "rendered-ui",
            status: "PARTIAL",
            artifacts: ["desktop.png"],
            limitations: ["only 1 of 3 viewports captured"],
            complete: false
        })
    }));
    assert.equal(result.evidence_complete, false);
    assert.equal(result.runtime_evidence[0]?.artifacts.length, 1);
});
test("requested rendered evidence without authorization fails closed", async () => {
    const result = await orchestrateAudit(baseInput({
        allowRun: false,
        url: "http://127.0.0.1:3000/",
        collectRuntimeEvidence: () => {
            throw new Error("must not be called without --allow-run");
        }
    }));
    assert.equal(result.evidence_complete, false);
    const outcome = result.outcomes.find((entry) => entry.id === "runtime:rendered-ui");
    assert.equal(outcome?.cause, "unauthorized");
});
test("a failing authorized command produces a FAIL finding", async () => {
    const ledger = new ReportAuditLedger();
    await orchestrateAudit(baseInput({
        allowRun: true,
        select: ["lint"],
        ledger,
        runCommand: () => Promise.resolve({ exitCode: 2, stdout: "3 problems", stderr: "" })
    }));
    const failing = ledger.findings().filter((finding) => finding.status === "FAIL");
    assert.equal(failing.length, 1);
    assert.ok(failing[0]?.evidence[0]?.includes("exit 2"));
    assert.equal(failing[0]?.severity, "HIGH");
});
test("a UI audit and an all-module audit plan the modules they were given", async () => {
    const ui = await orchestrateAudit(baseInput({ modules: ["ui"] }));
    assert.deepEqual(ids(ui.planned).filter((id) => id.startsWith("module:")), ["module:ui"]);
    const all = await orchestrateAudit(baseInput({ modules: ["api", "security", "ui"] }));
    assert.deepEqual(ids(all.planned).filter((id) => id.startsWith("module:")), ["module:api", "module:security", "module:ui"]);
});
test("a changed-scope audit plans only the modules the scope selected", async () => {
    const result = await orchestrateAudit(baseInput({ modules: ["queries"] }));
    assert.deepEqual(ids(result.planned).filter((id) => id.startsWith("module:")), ["module:queries"]);
});
test("every planned check reaches exactly one terminal outcome", async () => {
    const ledger = new ReportAuditLedger();
    const result = await orchestrateAudit(baseInput({
        allowRun: true,
        ledger,
        url: "http://127.0.0.1:3000/",
        collectRuntimeEvidence: () => Promise.resolve({
            kind: "rendered-ui",
            status: "COMPLETE",
            artifacts: [],
            limitations: [],
            complete: true
        })
    }));
    assert.equal(result.outcomes.length, result.planned.length);
    assert.deepEqual(ids(result.planned).sort(), result.outcomes.map((o) => o.id).sort());
    assert.deepEqual(ids(ledger.planned), ids(result.planned));
});
test("the default ledger records residual risk about what was not executed", async () => {
    const ledger = new ReportAuditLedger();
    await orchestrateAudit(baseInput({ ledger }));
    assert.ok(ledger.residualRisk().some((line) => line.includes("No project command was executed")));
});
test("deselected checks are summarized in a single scope finding", async () => {
    const ledger = new ReportAuditLedger();
    await orchestrateAudit(baseInput({ allowRun: true, ledger, skip: ["lint", "test"] }));
    const scope = ledger.findings().filter((finding) => finding.id === "FF-AUDIT-SCOPE-001");
    assert.equal(scope.length, 1);
    assert.equal(scope[0]?.status, "NOT_VERIFIED");
    assert.equal(scope[0].evidence.length, 2);
});
