import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { runShipGates } from "../src/gates.js";
import { createReport } from "../src/report.js";
import { GATE_EVIDENCE_TYPES } from "../src/types.js";
import { newFeature, newProject, saveFeature, saveProject } from "../src/build-state.js";
import { withTemporaryProject } from "./helpers.js";
const BUILD_CRITERIA = ["scope-resolution", "static-analysis", "discipline:auth", "project:test"];
test("build criterion ids are not release-gate evidence types", () => {
    for (const criterion of BUILD_CRITERIA)
        assert.ok(!GATE_EVIDENCE_TYPES.includes(criterion), `${criterion} must never be a gate evidence type`);
});
test("release gates ignore build state entirely and re-derive their own evidence", async () => {
    await withTemporaryProject("build-no-ship", async (root) => {
        await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "ordinary-project", private: true }, null, 2)}\n`, "utf8");
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const before = await runShipGates(root, profile, previous, [], false);
        // Introduce build state that claims everything passed. A gate must not read it.
        const project = newProject("planted", "high");
        await saveProject(root, project, false);
        const feature = newFeature("planted", "high", "planted");
        feature.phase = "done";
        feature.evidence = BUILD_CRITERIA.map((criterion) => ({
            criterion,
            security_control: criterion.startsWith("discipline:"),
            status: "PASS",
            producer: "build",
            evidence: ["planted PASS that must never satisfy a ship gate"],
            files: [],
            instance_ids: [],
            recorded_at: new Date().toISOString()
        }));
        await saveFeature(root, feature, false);
        const after = await runShipGates(root, profile, previous, [], false);
        // The overall outcome and every gate status are unchanged by the planted build state.
        assert.equal(after.status, before.status);
        const statuses = (gates) => gates
            .map((gate) => `${gate.gate_id}:${gate.status}`)
            .sort()
            .join(",");
        assert.equal(statuses(after.gates), statuses(before.gates));
        // No gate evidence record was produced by the build layer.
        for (const record of after.evidence)
            assert.ok(!record.producer.startsWith("build"), record.producer);
    });
});
//# sourceMappingURL=build-ship-isolation.test.js.map