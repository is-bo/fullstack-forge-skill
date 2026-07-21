import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { missingForDone, runBuild } from "../src/build.js";
import { loadFeature, newFeature } from "../src/build-state.js";
import { withTemporaryProject } from "./helpers.js";
const VULN_SOURCE = `const PAYMENT_API_SECRET = "prod_secret_1234567890";
app.get("/redirect", (req, res) => {
  console.log(req.body.password);
  res.redirect(req.query.next);
});
`;
const PASS_SCRIPT = 'node -e "process.exit(0)"';
async function captureRun(argv) {
    const original = console.log;
    const lines = [];
    console.log = (...args) => {
        lines.push(args.map((value) => String(value)).join(" "));
    };
    try {
        const code = await runBuild(argv);
        return { code, out: lines.join("\n") };
    }
    finally {
        console.log = original;
    }
}
async function writeRunnableProject(root, scripts = ["test", "lint", "check:security-review"]) {
    await writeProjectScripts(root, Object.fromEntries(scripts.map((name) => [name, PASS_SCRIPT])));
}
async function writeProjectScripts(root, scripts) {
    await writeFile(join(root, "package.json"), `${JSON.stringify({
        name: "build-evidence-fixture",
        private: true,
        type: "module",
        scripts
    }, undefined, 2)}\n`, "utf8");
    await writeFile(join(root, "app.js"), "export const value = 1;\n", "utf8");
}
async function plantWorkingBrowserDriver(root) {
    const directory = join(root, "node_modules", "playwright");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "package.json"), `${JSON.stringify({
        name: "playwright",
        version: "1.0.0-build-fixture",
        type: "module",
        main: "index.js"
    })}\n`, "utf8");
    await writeFile(join(directory, "index.js"), `import { writeFileSync } from "node:fs";
export const chromium = {
  async launch() {
    let viewport = -1;
    let currentUrl = "http://127.0.0.1/";
    const page = {
      setDefaultTimeout() {},
      async setViewportSize() { viewport += 1; },
      async goto(url) { currentUrl = url; },
      async screenshot(options) { writeFileSync(options.path, "png-" + viewport); },
      url() { return currentUrl; },
      on() {},
      async route() {},
      async addInitScript() {},
      keyboard: { async press() {} },
      async evaluate() {
        return {
          horizontal_overflow: false,
          tab_focus: true,
          visible_focus: true,
          unlabeled_interactive: 0,
          custom_control_defects: 0
        };
      }
    };
    return { async newPage() { return page; }, async close() {} };
  }
};
`, "utf8");
}
async function planAndCheck(root, slug) {
    await captureRun([
        "feature",
        slug,
        "plan",
        "--summary",
        "bounded implementation",
        "--root",
        root
    ]);
    return captureRun(["feature", slug, "check", "--allow-run", "--root", root]);
}
test("light tier completes in two invocations through registered behavior and code producers", async () => {
    await withTemporaryProject("build-light", async (root) => {
        await writeRunnableProject(root);
        const start = await captureRun([
            "feature",
            "copy-tweak",
            "--tier",
            "light",
            "--summary",
            "bounded executable change",
            "--allow-run",
            "--root",
            root
        ]);
        assert.equal(start.code, 0, start.out);
        const afterStart = await loadFeature(root, "copy-tweak");
        assert.ok(afterStart);
        assert.equal(afterStart.phase, "check");
        for (const criterion of [
            "scope-resolution",
            "supported-static-patterns",
            "applicability",
            "behavior-verification",
            "discipline:code",
            "discipline:testing",
            "project:test"
        ])
            assert.equal(afterStart.evidence.find((entry) => entry.criterion === criterion)?.status, "PASS", criterion);
        const done = await captureRun(["feature", "copy-tweak", "done", "--root", root]);
        assert.equal(done.code, 0, done.out);
        assert.equal((await loadFeature(root, "copy-tweak"))?.phase, "done");
    });
});
test("Build command output is redacted before sealing and remains verifiable after reload", async () => {
    await withTemporaryProject("build-output-redaction", async (root) => {
        const secret = "SKfaketest12345abcdefABCDEF";
        await writeProjectScripts(root, {
            test: `node -e "console.log('api_key=${secret}')"`,
            lint: PASS_SCRIPT,
            "check:security-review": PASS_SCRIPT
        });
        const started = await captureRun([
            "feature",
            "redacted-output",
            "--tier",
            "light",
            "--allow-run",
            "--root",
            root
        ]);
        assert.equal(started.code, 0, started.out);
        const raw = await readFile(join(root, ".forge", "build", "features", "redacted-output.json"), "utf8");
        assert.equal(raw.includes(secret), false);
        assert.match(raw, /REDACTED/u);
        const done = await captureRun(["feature", "redacted-output", "done", "--root", root]);
        assert.equal(done.code, 0, done.out);
    });
});
test("a command that mutates its package-script source cannot seal PASS", async () => {
    await withTemporaryProject("build-command-source-mutation", async (root) => {
        await writeProjectScripts(root, {
            test: `node -e "require('node:fs').writeFileSync('package.json', JSON.stringify({name:'mutated'}))"`,
            lint: PASS_SCRIPT,
            "check:security-review": PASS_SCRIPT
        });
        const started = await captureRun([
            "feature",
            "mutating-command",
            "--tier",
            "light",
            "--allow-run",
            "--root",
            root
        ]);
        assert.equal(started.code, 1);
        const feature = await loadFeature(root, "mutating-command");
        const behavior = feature?.evidence.find((entry) => entry.criterion === "behavior-verification");
        assert.ok(behavior);
        assert.equal(behavior.status, "NOT_VERIFIED");
        assert.equal(behavior.envelope, undefined);
        assert.match(behavior.evidence.join(" "), /hash|artifact/u);
    });
});
test("standard phase transitions frame -> plan -> check, and terminal edges are enforced", async () => {
    await withTemporaryProject("build-transitions", async (root) => {
        await captureRun(["feature", "t", "--tier", "standard", "--summary", "s", "--root", root]);
        assert.equal((await loadFeature(root, "t"))?.phase, "frame");
        await captureRun(["feature", "t", "plan", "--summary", "the plan", "--root", root]);
        const planned = await loadFeature(root, "t");
        assert.ok(planned);
        assert.equal(planned.phase, "plan");
        assert.ok(planned.plan_hash);
        await captureRun(["feature", "t", "check", "--root", root]);
        assert.equal((await loadFeature(root, "t"))?.phase, "check");
        await captureRun(["feature", "t", "abandon", "--root", root]);
        assert.equal((await loadFeature(root, "t"))?.phase, "abandoned");
        await assert.rejects(runBuild(["feature", "t", "check", "--root", root]), /abandoned/u);
        await assert.rejects(runBuild(["feature", "t", "done", "--root", root]), /abandoned/u);
    });
});
test("done reports the exact non-waivable high-tier security gate", async () => {
    await withTemporaryProject("build-done-refuse", async (root) => {
        await writeRunnableProject(root, [
            "test",
            "lint",
            "test:integration",
            "test:security-negative",
            "check:security-review"
        ]);
        await captureRun([
            "feature",
            "secure",
            "--tier",
            "high",
            "--summary",
            "bounded identity control",
            "--discipline",
            "auth:identity proof",
            "--root",
            root
        ]);
        await planAndCheck(root, "secure");
        const featurePath = join(root, ".forge", "build", "features", "secure.json");
        const planted = JSON.parse(await readFile(featurePath, "utf8"));
        planted.gate_plan.gates = [];
        planted.gate_plan.required_criteria = [];
        await writeFile(featurePath, `${JSON.stringify(planted, undefined, 2)}\n`, "utf8");
        const result = await captureRun(["feature", "secure", "done", "--root", root]);
        assert.equal(result.code, 1);
        assert.match(result.out, /FF-BUILD-GATE-DISCIPLINE-AUTH/u);
        assert.match(result.out, /NOT_VERIFIED/u);
        assert.equal((await loadFeature(root, "secure"))?.phase, "check");
    });
});
test("accept-risk is refused for a high-tier required security control", async () => {
    await withTemporaryProject("build-accept-refuse", async (root) => {
        await writeRunnableProject(root, ["test", "lint", "check:security-review"]);
        await captureRun([
            "feature",
            "secure",
            "--tier",
            "high",
            "--summary",
            "bounded identity control",
            "--discipline",
            "auth:identity proof",
            "--root",
            root
        ]);
        await planAndCheck(root, "secure");
        const featurePath = join(root, ".forge", "build", "features", "secure.json");
        const planted = JSON.parse(await readFile(featurePath, "utf8"));
        const forgedGate = planted.gate_plan.gates.find((gate) => gate.criteria.includes("discipline:auth"));
        assert.ok(forgedGate);
        forgedGate.waiver_policy = "operational-human";
        forgedGate.non_waivable = false;
        await writeFile(featurePath, `${JSON.stringify(planted, undefined, 2)}\n`, "utf8");
        await assert.rejects(runBuild([
            "feature",
            "secure",
            "accept-risk",
            "--criterion",
            "discipline:auth",
            "--reason",
            "later",
            "--root",
            root
        ]), /non-waivable/u);
    });
});
test("operational risk acceptance requires an actor, stays distinct from PASS, and expires on change", async () => {
    await withTemporaryProject("build-accept-operational", async (root) => {
        await writeRunnableProject(root);
        await captureRun([
            "feature",
            "telemetry",
            "--tier",
            "standard",
            "--summary",
            "bounded executable change",
            "--discipline",
            "observability:operator visibility",
            "--root",
            root
        ]);
        const checked = await planAndCheck(root, "telemetry");
        assert.equal(checked.code, 1);
        await assert.rejects(runBuild([
            "feature",
            "telemetry",
            "accept-risk",
            "--criterion",
            "discipline:observability",
            "--reason",
            "tracked operational follow-up",
            "--root",
            root
        ]), /--actor/u);
        const accept = await captureRun([
            "feature",
            "telemetry",
            "accept-risk",
            "--criterion",
            "discipline:observability",
            "--risk-category",
            "operational",
            "--actor",
            "release-owner",
            "--reason",
            "tracked operational follow-up",
            "--root",
            root
        ]);
        assert.equal(accept.code, 0, accept.out);
        const accepted = await loadFeature(root, "telemetry");
        assert.ok(accepted);
        assert.equal(accepted.risk_acceptances[0]?.policy, "operational-human");
        assert.equal(accepted.evidence.find((entry) => entry.criterion === "discipline:observability")?.status, "NOT_VERIFIED");
        const done = await captureRun(["feature", "telemetry", "done", "--root", root]);
        assert.equal(done.code, 0, done.out);
        await writeFile(join(root, "app.js"), "export const value = 2;\n", "utf8");
        const staleStatus = await captureRun([
            "feature",
            "telemetry",
            "status",
            "--json",
            "--root",
            root
        ]);
        assert.equal(staleStatus.code, 0, staleStatus.out);
        assert.equal(JSON.parse(staleStatus.out).feature.phase, "check");
        const staleDone = await captureRun(["feature", "telemetry", "done", "--root", root]);
        assert.equal(staleDone.code, 1);
        const stale = await loadFeature(root, "telemetry");
        assert.ok(stale);
        assert.equal(stale.phase, "check");
        const expiredAcceptance = stale.risk_acceptances[0];
        assert.ok(expiredAcceptance);
        assert.equal(expiredAcceptance.lifecycle, "expired");
    });
});
test("the repair cap blocks a feature whose supported-pattern failure signature recurs", async () => {
    await withTemporaryProject("build-repair", async (root) => {
        await writeFile(join(root, "server.ts"), VULN_SOURCE, "utf8");
        await captureRun(["feature", "vuln", "--tier", "standard", "--summary", "s", "--root", root]);
        const first = await captureRun(["feature", "vuln", "check", "--root", root]);
        assert.equal(first.code, 1);
        let feature = await loadFeature(root, "vuln");
        assert.ok(feature);
        assert.equal(feature.phase, "check");
        assert.equal(feature.evidence.find((entry) => entry.criterion === "supported-static-patterns")?.status, "FAIL");
        assert.equal(feature.repair_counters.find((counter) => counter.criterion === "supported-static-patterns")
            ?.count, 1);
        const second = await captureRun(["feature", "vuln", "check", "--root", root]);
        assert.equal(second.code, 1);
        feature = await loadFeature(root, "vuln");
        assert.ok(feature);
        assert.equal(feature.phase, "blocked");
        assert.ok(feature.blockers.length > 0);
        const again = await captureRun(["feature", "vuln", "check", "--root", root]);
        assert.match(again.out, /blocked/iu);
    });
});
test("new-repo bootstrap scopes to recorded touched paths when there is no merge base", async () => {
    await withTemporaryProject("build-bootstrap", async (root) => {
        await writeRunnableProject(root);
        await writeFile(join(root, "other.js"), "export const other = 2;\n", "utf8");
        await captureRun([
            "feature",
            "boot",
            "--tier",
            "standard",
            "--summary",
            "s",
            "--touch",
            "app.js",
            "--root",
            root
        ]);
        const result = await captureRun([
            "feature",
            "boot",
            "check",
            "--allow-run",
            "--json",
            "--root",
            root
        ]);
        assert.equal(result.code, 0, result.out);
        const feature = await loadFeature(root, "boot");
        const scope = feature?.evidence.find((entry) => entry.criterion === "scope-resolution");
        assert.match(scope?.evidence.join(" ") ?? "", /recorded touched paths/u);
        assert.deepEqual(feature?.touched_paths, ["app.js"]);
    });
});
test("resume lists unfinished features and points at the most recent", async () => {
    await withTemporaryProject("build-resume", async (root) => {
        await writeRunnableProject(root);
        const started = await captureRun([
            "feature",
            "done-one",
            "--tier",
            "light",
            "--allow-run",
            "--root",
            root
        ]);
        assert.equal(started.code, 0, started.out);
        const completed = await captureRun(["feature", "done-one", "done", "--root", root]);
        assert.equal(completed.code, 0, completed.out);
        await captureRun([
            "feature",
            "open-two",
            "--tier",
            "standard",
            "--summary",
            "s",
            "--root",
            root
        ]);
        const projectPath = join(root, ".forge", "build", "project.json");
        const plantedIndex = JSON.parse(await readFile(projectPath, "utf8"));
        plantedIndex.features = [];
        await writeFile(projectPath, `${JSON.stringify(plantedIndex, undefined, 2)}\n`, "utf8");
        const resume = await captureRun(["resume", "--json", "--root", root]);
        assert.equal(resume.code, 0);
        const parsed = JSON.parse(resume.out);
        assert.deepEqual(parsed.unfinished_features.map((entry) => entry.slug), ["open-two"]);
        assert.equal(parsed.most_recent?.slug, "open-two");
        const rebuiltIndex = JSON.parse(await readFile(projectPath, "utf8"));
        assert.deepEqual(rebuiltIndex.features.map((entry) => entry.slug).sort(), [
            "done-one",
            "open-two"
        ]);
    });
});
test("missingForDone accepts only positive criteria verified by the current caller", () => {
    const feature = newFeature("f", "standard", "s");
    feature.phase = "check";
    feature.evidence_revision = "revision";
    feature.gate_plan = {
        recorded_at: new Date().toISOString(),
        revision: "revision",
        gates: [
            {
                id: "FF-BUILD-GATE-APPLICABILITY",
                name: "Applicability",
                tier: "standard",
                criteria: ["applicability"],
                required: true,
                waiver_policy: "never",
                non_waivable: true,
                reason: "required"
            }
        ],
        required_criteria: ["applicability"]
    };
    feature.evidence = [
        {
            criterion: "applicability",
            security_control: false,
            status: "PASS",
            producer: "hand-written",
            evidence: ["synthetic"],
            files: [],
            instance_ids: [],
            recorded_at: new Date().toISOString()
        }
    ];
    assert.ok(missingForDone(feature).some((item) => item.includes("NOT_VERIFIED")));
    assert.deepEqual(missingForDone(feature, new Set(["applicability"])), []);
});
test("registered producers can complete all twelve material discipline paths", async () => {
    await withTemporaryProject("build-discipline-e2e", async (root) => {
        const disciplines = [
            "auth",
            "authorization",
            "tenancy",
            "uploads",
            "payments",
            "ui",
            "accessibility",
            "database",
            "queries",
            "cache",
            "testing",
            "deployment"
        ];
        const scriptFor = {
            auth: "test:auth",
            authorization: "test:authorization",
            tenancy: "test:tenancy",
            uploads: "test:uploads",
            payments: "test:payments",
            ui: "test:ui",
            accessibility: "test:accessibility",
            database: "test:database",
            queries: "test:queries",
            cache: "test:cache",
            testing: "test",
            deployment: "test:deployment"
        };
        await writeRunnableProject(root, [
            "test",
            "lint",
            "check:security-review",
            ...new Set(Object.values(scriptFor))
        ]);
        const startArgs = [
            "feature",
            "material-controls",
            "--tier",
            "standard",
            "--summary",
            "bounded executable change",
            "--reason",
            "synthetic fixture exercises producer contracts without production risk"
        ];
        for (const discipline of disciplines)
            startArgs.push("--discipline", `${discipline}:material control fixture`);
        startArgs.push("--root", root);
        const start = await captureRun(startArgs);
        assert.equal(start.code, 0, start.out);
        const checked = await planAndCheck(root, "material-controls");
        assert.equal(checked.code, 0, checked.out);
        const feature = await loadFeature(root, "material-controls");
        assert.ok(feature);
        for (const discipline of disciplines) {
            const record = feature.evidence.find((entry) => entry.criterion === `discipline:${discipline}`);
            assert.equal(record?.status, "PASS", discipline);
            assert.match(record.producer, /^fullstack-forge\/build-command\//u, discipline);
        }
        const done = await captureRun(["feature", "material-controls", "done", "--root", root]);
        assert.equal(done.code, 0, done.out);
    });
});
test("a high-tier authentication and authorization feature reaches done only through real evidence", async () => {
    await withTemporaryProject("build-high-auth-e2e", async (root) => {
        await writeRunnableProject(root, [
            "test",
            "lint",
            "test:auth",
            "test:authorization",
            "test:authentication-negative",
            "test:authorization-negative",
            "test:security-negative",
            "test:integration",
            "check:security-review"
        ]);
        await captureRun([
            "feature",
            "identity-boundary",
            "--tier",
            "high",
            "--summary",
            "bounded identity boundary",
            "--discipline",
            "auth:identity proof",
            "--discipline",
            "authorization:object denial",
            "--root",
            root
        ]);
        const checked = await planAndCheck(root, "identity-boundary");
        assert.equal(checked.code, 0, checked.out);
        const feature = await loadFeature(root, "identity-boundary");
        assert.ok(feature);
        for (const criterion of [
            "discipline:auth",
            "discipline:authorization",
            "discipline:security",
            "authentication-negative-tests",
            "authorization-negative-tests",
            "security-negative-tests",
            "integration-verification",
            "security-review"
        ])
            assert.equal(feature.evidence.find((entry) => entry.criterion === criterion)?.status, "PASS", criterion);
        assert.equal(feature.risk_acceptances.length, 0);
        const done = await captureRun(["feature", "identity-boundary", "done", "--root", root]);
        assert.equal(done.code, 0, done.out);
    });
});
test("a high-tier UI feature reaches done with a bound eight-state responsive runtime matrix", async () => {
    await withTemporaryProject("build-high-ui-e2e", async (root) => {
        await writeRunnableProject(root, [
            "test",
            "lint",
            "test:ui",
            "test:ux",
            "test:accessibility",
            "test:security-negative",
            "test:integration",
            "check:security-review"
        ]);
        await plantWorkingBrowserDriver(root);
        await captureRun([
            "feature",
            "responsive-dashboard",
            "--tier",
            "high",
            "--summary",
            "bounded rendered interface",
            "--discipline",
            "ui:rendered states",
            "--discipline",
            "ux:task flow",
            "--discipline",
            "accessibility:keyboard and controls",
            "--root",
            root
        ]);
        await captureRun([
            "feature",
            "responsive-dashboard",
            "plan",
            "--summary",
            "render every required state",
            "--root",
            root
        ]);
        await mkdir(join(root, ".forge", "build"), { recursive: true });
        await writeFile(join(root, ".forge", "build", "DESIGN.md"), "# Design direction\nUse a clear responsive hierarchy.\n", "utf8");
        const checkArgs = [
            "feature",
            "responsive-dashboard",
            "check",
            "--allow-run",
            "--role",
            "signed-in-member",
            "--design-direction",
            "follows"
        ];
        for (const state of [
            "loading",
            "empty",
            "error",
            "success",
            "permission-denied",
            "disabled",
            "destructive-confirmation",
            "long-content"
        ])
            checkArgs.push("--runtime-case", `${state}=http://127.0.0.1:4173/${state}`);
        checkArgs.push("--root", root);
        const checked = await captureRun(checkArgs);
        const feature = await loadFeature(root, "responsive-dashboard");
        assert.ok(feature);
        const runtime = feature.evidence.find((entry) => entry.criterion === "runtime:rendered-ui");
        assert.equal(checked.code, 0, `${checked.out}\n${JSON.stringify(runtime, undefined, 2)}`);
        assert.ok(runtime);
        assert.equal(runtime.status, "PASS");
        assert.ok(runtime.runtime);
        assert.equal(runtime.runtime.length, 24);
        assert.deepEqual(runtime.envelope?.runtime, runtime.runtime);
        assert.equal(new Set(runtime.runtime.map((entry) => entry.state)).size, 8);
        assert.ok(runtime.files.some((file) => file.path.endsWith("structural.json")));
        assert.equal(feature.evidence.find((entry) => entry.criterion === "design-direction")?.status, "PASS");
        const done = await captureRun(["feature", "responsive-dashboard", "done", "--root", root]);
        assert.equal(done.code, 0, done.out);
    });
});
test("high-risk trigger words escalate the tier unless an override reason is recorded", async () => {
    await withTemporaryProject("build-escalate", async (root) => {
        await captureRun([
            "feature",
            "payment-webhooks",
            "--tier",
            "standard",
            "--summary",
            "Stripe webhook handling",
            "--root",
            root
        ]);
        const escalated = await loadFeature(root, "payment-webhooks");
        assert.ok(escalated);
        assert.equal(escalated.tier, "high");
        assert.ok(escalated.tier_inputs.some((input) => input.includes("high-tier triggers")));
        await captureRun([
            "feature",
            "login-copy",
            "--tier",
            "light",
            "--summary",
            "adjust login button copy",
            "--reason",
            "text-only change to an existing screen",
            "--root",
            root
        ]);
        const overridden = await loadFeature(root, "login-copy");
        assert.ok(overridden);
        assert.equal(overridden.tier, "light");
        assert.equal(overridden.tier_override_reason, "text-only change to an existing screen");
        assert.ok(overridden.tier_inputs.some((input) => input.includes("high-tier triggers")));
    });
});
test("adding a high-risk discipline at plan time re-applies the tier floor", async () => {
    await withTemporaryProject("build-plan-escalate", async (root) => {
        await captureRun([
            "feature",
            "totals-view",
            "--tier",
            "standard",
            "--summary",
            "sum view",
            "--root",
            root
        ]);
        assert.equal((await loadFeature(root, "totals-view"))?.tier, "standard");
        await captureRun([
            "feature",
            "totals-view",
            "plan",
            "--summary",
            "the plan",
            "--discipline",
            "payments:invoice totals move money",
            "--root",
            root
        ]);
        const planned = await loadFeature(root, "totals-view");
        assert.ok(planned);
        assert.equal(planned.tier, "high");
        assert.ok(planned.tier_inputs.some((input) => input.includes("high-tier triggers")));
    });
});
//# sourceMappingURL=build.test.js.map