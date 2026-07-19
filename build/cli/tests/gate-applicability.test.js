import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { FORGE_GATE_REGISTRY, runShipGates } from "../src/gates.js";
import { createReport } from "../src/report.js";
import { withTemporaryProject } from "./helpers.js";
async function writePackage(root, name, dependencies = {}) {
    await writeFile(join(root, "package.json"), `${JSON.stringify({ name, private: true, dependencies }, null, 2)}\n`, "utf8");
}
function gateById(gates, id) {
    const gate = gates.find((candidate) => candidate.gate_id === id);
    assert.ok(gate, `expected gate ${id}`);
    return gate;
}
/**
 * The previous implementation marked every command-backed "internal" gate NOT_APPLICABLE and
 * required:false for any project that was not Fullstack Forge itself. That silently disabled
 * secret, dependency, and license inspection for every audited application.
 */
test("an ordinary application still requires the secret-exposure gate", async () => {
    await withTemporaryProject("gate-app-secrets", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        const secrets = gateById(result.gates, "FF-GATE-SECRETS");
        assert.equal(secrets.required, true, "secret inspection must stay required for applications");
        assert.notEqual(secrets.status, "NOT_APPLICABLE", "a normal project must not have secret scanning disabled");
        assert.equal(secrets.status, "NOT_VERIFIED", "with no command and no evidence the gate is unverified, never PASS");
    });
});
test("an ordinary application still requires the dependency gate", async () => {
    await withTemporaryProject("gate-app-dependencies", async (root) => {
        await writePackage(root, "ordinary-project", { express: "0.0.0-fixture" });
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        const dependencies = gateById(result.gates, "FF-GATE-DEPENDENCIES");
        assert.equal(dependencies.required, true);
        assert.notEqual(dependencies.status, "NOT_APPLICABLE");
        assert.equal(result.status, "BLOCKED", "unverified application gates must block the release");
    });
});
test("a failing dependency finding fails the application dependency gate", async () => {
    await withTemporaryProject("gate-app-dependency-fail", async (root) => {
        await writePackage(root, "ordinary-project", { express: "0.0.0-fixture" });
        const profile = await discoverProject(root);
        const finding = {
            id: "FF-SUPPLY-DEP-001",
            section: "supply-chain",
            title: "Vulnerable dependency",
            severity: "HIGH",
            confidence: "HIGH",
            status: "FAIL",
            location: [{ path: "package.json", line: 1 }],
            evidence: ["A known-vulnerable dependency version is declared."],
            impact: "A published advisory affects the resolved version.",
            recommendation: "Upgrade to a fixed release.",
            safe_fix: false,
            verification: ["Re-run dependency inspection."],
            standards: ["OWASP A06"]
        };
        const previous = createReport(root, profile, [finding], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        assert.equal(gateById(result.gates, "FF-GATE-DEPENDENCIES").status, "FAIL");
        assert.equal(result.status, "FAIL");
    });
});
test("Forge self-release gates are not applicable to an ordinary application", async () => {
    await withTemporaryProject("gate-forge-separation", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        for (const gateId of [
            "FF-GATE-PLATFORMS",
            "FF-GATE-PACKAGING",
            "FF-GATE-ARCHIVES",
            "FF-GATE-SMOKE",
            "FF-GATE-SKILLS"
        ]) {
            const gate = gateById(result.gates, gateId);
            assert.equal(gate.status, "NOT_APPLICABLE", `${gateId} is a Forge self-release check and must not be demanded of an application`);
            assert.equal(gate.required, false);
        }
    });
});
test("Forge self-release gates remain applicable to the Forge repository", async () => {
    await withTemporaryProject("gate-forge-self", async (root) => {
        await writePackage(root, "fullstack-forge-skill");
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        const platforms = gateById(result.gates, "FF-GATE-PLATFORMS");
        assert.notEqual(platforms.status, "NOT_APPLICABLE", "Forge must still hold itself to its own release checks");
        assert.equal(platforms.required, true);
    });
});
test("every registry gate declares an explicit applicability class", () => {
    for (const definition of FORGE_GATE_REGISTRY)
        assert.ok(["forge-self", "audited-application", "project-native"].includes(definition.applicability), `${definition.gate_id} must declare an applicability class`);
});
test("no registry gate is both forge-self and backed by application evidence", () => {
    for (const definition of FORGE_GATE_REGISTRY)
        if (definition.applicability === "forge-self")
            assert.equal(definition.evidence_sections, undefined, `${definition.gate_id} cannot be a self-check and an application evidence gate at once`);
});
//# sourceMappingURL=gate-applicability.test.js.map