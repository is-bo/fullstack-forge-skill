import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { install } from "../src/installer.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
test("no-argument and help output are simple-first while advanced help remains available", async () => {
    const menu = await runFile(process.execPath, [cli], PACKAGE_ROOT);
    assert.equal(menu.exitCode, 0, menu.stderr);
    assert.match(menu.stdout, /1\. Build something/u);
    assert.doesNotMatch(menu.stdout, /--runtime-case/u);
    const help = await runFile(process.execPath, [cli, "help"], PACKAGE_ROOT);
    assert.equal(help.exitCode, 0, help.stderr);
    assert.match(help.stdout, /forge audit all/u);
    assert.doesNotMatch(help.stdout, /accept-risk/u);
    const advanced = await runFile(process.execPath, [cli, "help", "advanced"], PACKAGE_ROOT);
    assert.equal(advanced.exitCode, 0, advanced.stderr);
    assert.match(advanced.stdout, /accept-risk/u);
    assert.match(advanced.stdout, /forge <section> <audit\|fix\|verify\|report>/u);
});
test("plain-language build creates a safe feature and continue resumes the only unfinished item", async () => {
    await withTemporaryProject("simple-build", async (root) => {
        const built = await runFile(process.execPath, [cli, "build", "add customer login", "--root", root], root);
        assert.equal(built.exitCode, 0, built.stderr);
        assert.match(built.stdout, /Feature: customer-login/u);
        assert.match(built.stdout, /tier high/u);
        const state = JSON.parse(await readFile(join(root, ".forge", "build", "features", "customer-login.json"), "utf8"));
        assert.equal(state.summary, "add customer login");
        assert.equal(state.phase, "frame");
        const resumed = await runFile(process.execPath, [cli, "continue", "--root", root], root);
        assert.equal(resumed.exitCode, 0, resumed.stderr);
        assert.match(resumed.stdout, /Operation: resume/u);
        assert.match(resumed.stdout, /customer-login/u);
    });
});
test("plain-language slug collisions are deterministic and do not overwrite prior state", async () => {
    await withTemporaryProject("simple-collision", async (root) => {
        const first = await runFile(process.execPath, [cli, "build", "add customer login", "--root", root], root);
        assert.equal(first.exitCode, 0, first.stderr);
        const second = await runFile(process.execPath, [cli, "build", "create customer login", "--root", root], root);
        assert.equal(second.exitCode, 0, second.stderr);
        const files = (await readdir(join(root, ".forge", "build", "features"))).sort();
        assert.equal(files.length, 2);
        assert.ok(files.includes("customer-login.json"));
        assert.ok(files.some((file) => /^customer-login-[a-f0-9]{8}\.json$/u.test(file)));
    });
});
test("continue refuses to guess when several features are unfinished", async () => {
    await withTemporaryProject("simple-continue-ambiguous", async (root) => {
        for (const slug of ["first-feature", "second-feature"]) {
            const result = await runFile(process.execPath, [cli, "feature", slug, "--summary", slug, "--root", root], root);
            assert.equal(result.exitCode, 0, result.stderr);
        }
        const resumed = await runFile(process.execPath, [cli, "continue", "--root", root], root);
        assert.equal(resumed.exitCode, 1);
        assert.match(resumed.stderr, /will not guess/u);
        assert.match(resumed.stderr, /forge feature first-feature/u);
        assert.match(resumed.stderr, /forge feature second-feature/u);
    });
});
test("simple audit, verify, ship, and status use concise output while JSON stays machine-readable", async () => {
    await withTemporaryProject("simple-audit", async (root) => {
        const audit = await runFile(process.execPath, [cli, "audit", "security", "--root", root], root);
        assert.equal(audit.exitCode, 0, audit.stderr);
        assert.match(audit.stdout, /Audit finished/u);
        assert.match(audit.stdout, /Evidence gaps:/u);
        assert.doesNotMatch(audit.stdout, /## Tool inventory/u);
        const detailed = await runFile(process.execPath, [cli, "audit", "security", "--details", "--root", root], root);
        assert.equal(detailed.exitCode, 0, detailed.stderr);
        assert.match(detailed.stdout, /## Tool inventory/u);
        const json = await runFile(process.execPath, [cli, "audit", "security", "--json", "--root", root], root);
        assert.equal(json.exitCode, 0, json.stderr);
        const parsed = JSON.parse(json.stdout);
        assert.equal(parsed.report.schema_version, 2);
        assert.equal(parsed.report.scope, "security");
        const verify = await runFile(process.execPath, [cli, "verify", "--root", root], root);
        assert.match(verify.stdout, /Verify finished/u);
        const ship = await runFile(process.execPath, [cli, "ship", "--root", root], root);
        assert.equal(ship.exitCode, 2);
        assert.match(ship.stdout, /Ship finished/u);
        const status = await runFile(process.execPath, [cli, "status", "--root", root], root);
        assert.equal(status.exitCode, 0, status.stderr);
        assert.match(status.stdout, /Latest report: ship/u);
        assert.match(status.stdout, /Release readiness: see latest Ship report/u);
    });
});
test("default audit falls back explicitly to full scope without a reliable Git base", async () => {
    await withTemporaryProject("simple-audit-default", async (root) => {
        const result = await runFile(process.execPath, [cli, "audit", "--root", root], root);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.match(result.stdout, /Scope selection: full applicable project/u);
        assert.match(result.stdout, /Scope: full/u);
    });
});
test("simple command mistakes receive actionable recovery", async () => {
    const typo = await runFile(process.execPath, [cli, "autdit"], PACKAGE_ROOT);
    assert.equal(typo.exitCode, 1);
    assert.match(typo.stderr, /Did you mean 'forge audit'/u);
    const noColor = await runFile(process.execPath, [cli, "help", "--no-color"], PACKAGE_ROOT);
    assert.equal(noColor.exitCode, 0, noColor.stderr);
    assert.equal(noColor.stdout.includes(`${String.fromCharCode(27)}[`), false);
    const ambiguous = await runFile(process.execPath, [cli, "audit", "CI"], PACKAGE_ROOT);
    assert.equal(ambiguous.exitCode, 1);
    assert.match(ambiguous.stderr, /ambiguous.*deployment, supply-chain/iu);
});
test("a transparent composite audit request runs each named discipline", async () => {
    await withTemporaryProject("simple-audit-composite", async (root) => {
        const result = await runFile(process.execPath, [cli, "audit", "uploads and file storage", "--json", "--root", root], root);
        assert.notEqual(result.exitCode, 1, result.stderr);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.report.scope, "areas:uploads,storage");
        assert.deepEqual(parsed.report.module_decisions.map((decision) => decision.module), ["uploads", "storage"]);
    });
});
test("verify exits incomplete when disappearance does not prove resolution", async () => {
    await withTemporaryProject("simple-verify-not-verified", async (root) => {
        const source = join(root, "server.ts");
        await writeFile(source, "export async function handler(req) {\n  return db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);\n}\n", "utf8");
        const audit = await runFile(process.execPath, [cli, "audit", "security", "--root", root], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        await writeFile(source, "export const queryRemoved = true;\n", "utf8");
        const verify = await runFile(process.execPath, [cli, "verify", "security", "--json", "--root", root], root);
        assert.equal(verify.exitCode, 2, verify.stderr);
        const parsed = JSON.parse(verify.stdout);
        assert.ok(parsed.report.findings.some((finding) => finding.status === "NOT_VERIFIED"));
        assert.ok(parsed.report.findings.some((finding) => finding.evidence.some((item) => item.includes("disappearance alone"))));
    });
});
test("install success and doctor distinguish incomplete, ready, and modified states", async () => {
    await withTemporaryProject("simple-doctor", async (root) => {
        const before = await runFile(process.execPath, [cli, "doctor", "--offline", "--root", root], root);
        assert.equal(before.exitCode, 2, before.stderr);
        assert.match(before.stdout, /Overall: setup incomplete/u);
        assert.match(before.stdout, /Fix: Run 'forge init all'/u);
        const installed = await runFile(process.execPath, [cli, "init", "all", "--root", root], root);
        assert.equal(installed.exitCode, 0, installed.stderr);
        assert.match(installed.stdout, /Fullstack Forge .* is ready/u);
        assert.match(installed.stdout, /Skills: 46/u);
        assert.match(installed.stdout, /Check the installation:\s+forge doctor/u);
        assert.match(installed.stdout, /Build something:\s+\/forge build/u);
        assert.match(installed.stdout, /Check an existing application:\s+\/forge audit/u);
        assert.match(installed.stdout, /See all commands:\s+\/forge help/u);
        const ready = await runFile(process.execPath, [cli, "doctor", "--offline", "--root", root], root);
        assert.equal(ready.exitCode, 0, ready.stderr);
        assert.match(ready.stdout, /Overall: ready with warnings/u);
        assert.match(ready.stdout, /\[WARNING\] update availability/u);
        assert.match(ready.stdout, /\[PASS\] bundled generated copies/u);
        assert.match(ready.stdout, /installed skill integrity: 46 skills/iu);
        const forgeSkill = join(root, ".agents", "skills", "forge", "SKILL.md");
        await writeFile(forgeSkill, `${await readFile(forgeSkill, "utf8")}\nmodified\n`, "utf8");
        const modified = await runFile(process.execPath, [cli, "doctor", "--offline", "--root", root], root);
        assert.equal(modified.exitCode, 1);
        assert.match(modified.stdout, /Overall: needs attention/u);
        assert.match(modified.stdout, /1 changed/u);
        assert.match(modified.stdout, /will not overwrite changed or unowned files/u);
    });
});
test("doctor gives the exact resume command for an interrupted installation", async () => {
    await withTemporaryProject("simple-doctor-interrupted", async (root) => {
        await assert.rejects(install(root, "generic", {
            global: false,
            dryRun: false,
            interruptAfter: 0
        }), /interruption after ownership preparation/u);
        const interrupted = await runFile(process.execPath, [cli, "doctor", "--offline", "--root", root], root);
        assert.equal(interrupted.exitCode, 1, interrupted.stderr);
        assert.match(interrupted.stdout, /[1-9]\d* missing/u);
        assert.match(interrupted.stdout, /Run 'forge update all' to resume or repair the incomplete installation/u);
        const repaired = await runFile(process.execPath, [cli, "update", "generic", "--root", root], root);
        assert.equal(repaired.exitCode, 0, repaired.stderr);
        const healthy = await runFile(process.execPath, [cli, "doctor", "--offline", "--root", root], root);
        assert.equal(healthy.exitCode, 0, healthy.stderr);
    });
});
test("the quickstart demo completes audit, preview, safe fix, and verification", async () => {
    await withTemporaryProject("simple-demo", async (root) => {
        const demo = join(PACKAGE_ROOT, "examples", "quickstart-demo");
        await mkdir(join(root, "src"));
        await copyFile(join(demo, "src", "App.tsx"), join(root, "src", "App.tsx"));
        await copyFile(join(demo, "package.json"), join(root, "package.json"));
        await copyFile(join(demo, "app.test.js"), join(root, "app.test.js"));
        const audit = await runFile(process.execPath, [cli, "audit", "frontend", "--root", root], root);
        assert.equal(audit.exitCode, 1, audit.stderr);
        assert.match(audit.stdout, /new-tab|target.*blank/iu);
        const preview = await runFile(process.execPath, [cli, "fix", "frontend", "--root", root], root);
        assert.equal(preview.exitCode, 2, preview.stderr);
        assert.match(preview.stdout, /no files changed/u);
        assert.doesNotMatch(await readFile(join(root, "src", "App.tsx"), "utf8"), /noopener/u);
        const applied = await runFile(process.execPath, [cli, "fix", "frontend", "--safe", "--root", root], root);
        assert.equal(applied.exitCode, 0, applied.stderr);
        assert.match(await readFile(join(root, "src", "App.tsx"), "utf8"), /rel="noopener noreferrer"/u);
        const verified = await runFile(process.execPath, [cli, "verify", "frontend", "--root", root], root);
        assert.notEqual(verified.exitCode, 1, verified.stderr);
        assert.doesNotMatch(verified.stdout, /new-tab link can control/iu);
        const shipped = await runFile(process.execPath, [cli, "ship", "--root", root], root);
        assert.equal(shipped.exitCode, 2, shipped.stderr);
        assert.match(shipped.stdout, /Ship finished.*evidence is incomplete/iu);
        assert.match(shipped.stdout, /resolve the named gates/iu);
    });
});
//# sourceMappingURL=cli-simple.test.js.map