import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { inspectRenderedUi } from "../src/rendered-ui.js";
import { withTemporaryProject } from "./helpers.js";
const REVISION = "git:0123456789abcdef0123456789abcdef01234567";
function options(overrides = {}) {
    return {
        cwd: process.cwd(),
        json: true,
        dryRun: false,
        global: false,
        offline: false,
        allowRun: false,
        safe: false,
        ...overrides
    };
}
async function emptyProject(root) {
    await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "rendered-ui-test", private: true })}\n`, "utf8");
}
/**
 * Plants a project-local `playwright` package whose top-level code writes a sentinel file. Any
 * import of this package by Fullstack Forge is observable, which is what makes the trust boundary
 * testable rather than merely asserted.
 */
async function plantMaliciousDriver(root) {
    const sentinel = join(root, "IMPORTED.txt");
    const packageDirectory = join(root, "node_modules", "playwright");
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(join(packageDirectory, "package.json"), `${JSON.stringify({ name: "playwright", version: "9.9.9-evil", main: "index.js" })}\n`, "utf8");
    await writeFile(join(packageDirectory, "index.js"), [
        "import { writeFileSync } from 'node:fs';",
        `writeFileSync(${JSON.stringify(sentinel)}, 'imported');`,
        "export const chromium = { launch: async () => { throw new Error('should never launch'); } };"
    ].join("\n"), "utf8");
    await writeFile(join(packageDirectory, "package.json"), `${JSON.stringify({
        name: "playwright",
        version: "9.9.9-evil",
        type: "module",
        main: "index.js"
    })}\n`, "utf8");
    return sentinel;
}
/**
 * Plants a project-local `playwright` whose browser is fully controllable from a JSON spec. This is
 * what lets the fail-closed state machine be exercised end to end — including the written evidence
 * files, findings, and exit codes — without adding Playwright or a browser binary as a dependency.
 */
async function plantWorkingDriver(root, spec) {
    const packageDirectory = join(root, "node_modules", "playwright");
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(join(packageDirectory, "package.json"), `${JSON.stringify({
        name: "playwright",
        version: "1.0.0-fake",
        type: "module",
        main: "index.js"
    })}\n`, "utf8");
    await writeFile(join(packageDirectory, "index.js"), `import { writeFileSync } from 'node:fs';
const SPEC = ${JSON.stringify(spec)};
export const chromium = {
  launch: async () => {
    if (SPEC.launchError) throw new Error(SPEC.launchError);
    let vp = -1;
    let onConsole;
    let onPageError;
    const page = {
      setDefaultTimeout() {},
      async setViewportSize() { vp += 1; },
      async goto() {
        if ((SPEC.failNavigation || []).includes(vp)) throw new Error('navigation failed ' + vp);
        if (vp === 0) {
          for (const entry of SPEC.console || []) {
            onConsole && onConsole({ type: () => entry.type, text: () => entry.text });
          }
          for (const message of SPEC.pageErrors || []) {
            onPageError && onPageError(new Error(message));
          }
        }
      },
      async screenshot(options) {
        if ((SPEC.failScreenshot || []).includes(vp)) throw new Error('screenshot failed ' + vp);
        writeFileSync(options.path, 'png-' + vp);
      },
      url() { return SPEC.finalUrl || 'http://127.0.0.1:3000/dashboard'; },
      on(event, handler) {
        if (event === 'console') onConsole = handler;
        if (event === 'pageerror') onPageError = handler;
      },
      async route() {},
      async addInitScript() {},
      ...(SPEC.noStructuralAdapter ? {} : {
        keyboard: { async press() {} },
        async evaluate() {
          return (SPEC.structural || [])[vp] || {
            horizontal_overflow: false,
            tab_focus: true,
            visible_focus: true,
            unlabeled_interactive: 0,
            custom_control_defects: 0
          };
        }
      })
    };
    return { newPage: async () => page, close: async () => {} };
  }
};
`, "utf8");
}
async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}
test("rendered-ui inspection blocks without a URL instead of guessing one", async () => {
    await withTemporaryProject("rendered-ui-no-url", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, [], options(), REVISION);
        assert.equal(response.exitCode, 2);
        assert.equal(response.value.status, "BLOCKED");
        assert.match(response.value.reason ?? "", /URL is required/u);
        assert.equal(response.value.findings.length, 0);
    });
});
test("rendered-ui inspection rejects invalid and non-http URLs", async () => {
    await withTemporaryProject("rendered-ui-bad-url", async (root) => {
        await emptyProject(root);
        const invalid = await inspectRenderedUi(root, ["not-a-url"], options(), REVISION);
        assert.equal(invalid.value.status, "BLOCKED");
        const fileUrl = await inspectRenderedUi(root, ["file:///etc/passwd"], options(), REVISION);
        assert.equal(fileUrl.value.status, "BLOCKED");
        assert.match(fileUrl.value.reason ?? "", /http and https/u);
    });
});
test("rendered-ui inspection requires --allow-run for non-loopback destinations", async () => {
    await withTemporaryProject("rendered-ui-remote", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["https://example.com/"], options(), REVISION);
        assert.equal(response.exitCode, 2);
        assert.equal(response.value.status, "BLOCKED");
        assert.match(response.value.reason ?? "", /--allow-run/u);
    });
});
test("rendered-ui inspection blocks when no browser driver is available", async () => {
    await withTemporaryProject("rendered-ui-no-driver", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/"], options(), REVISION);
        assert.equal(response.exitCode, 2);
        assert.equal(response.value.status, "BLOCKED");
        assert.match(response.value.reason ?? "", /NOT_VERIFIED/u);
        await assert.rejects(access(join(root, ".forge")), "BLOCKED runs must not write evidence");
    });
});
test("offline mode refuses remote destinations even with --allow-run", async () => {
    await withTemporaryProject("rendered-ui-offline-remote", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["https://example.com/"], options({ offline: true, allowRun: true }), REVISION);
        assert.equal(response.exitCode, 2);
        assert.equal(response.value.status, "BLOCKED");
        assert.equal(response.value.offline, true);
        assert.match(response.value.reason ?? "", /Offline mode refuses non-loopback/u);
        assert.match(response.value.reason ?? "", /No DNS resolution/u);
        await assert.rejects(access(join(root, ".forge")), "offline blocks must not write evidence");
    });
});
test("offline mode still permits loopback inspection and reaches driver resolution", async () => {
    await withTemporaryProject("rendered-ui-offline-loopback", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["http://localhost:5173/"], options({ offline: true }), REVISION);
        // Loopback is not refused for being remote; it stops only at driver availability.
        assert.equal(response.value.status, "BLOCKED");
        assert.doesNotMatch(response.value.reason ?? "", /non-loopback/u);
    });
});
test("a hostile project-local driver is not imported without authorization", async () => {
    await withTemporaryProject("rendered-ui-hostile-driver", async (root) => {
        await emptyProject(root);
        const sentinel = await plantMaliciousDriver(root);
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/"], options(), REVISION);
        assert.equal(response.value.status, "BLOCKED");
        assert.match(response.value.reason ?? "", /--allow-run/u);
        await assert.rejects(access(sentinel), "audited-project driver must not be imported");
        await assert.rejects(access(join(root, ".forge")));
    });
});
test("offline mode refuses the audited-project driver even with --allow-run", async () => {
    await withTemporaryProject("rendered-ui-offline-driver", async (root) => {
        await emptyProject(root);
        const sentinel = await plantMaliciousDriver(root);
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/"], options({ offline: true, allowRun: true }), REVISION);
        assert.equal(response.value.status, "BLOCKED");
        assert.match(response.value.reason ?? "", /Offline mode refuses to resolve a browser driver/u);
        await assert.rejects(access(sentinel), "offline must not import the audited-project driver");
    });
});
test("dry run resolves no driver, imports nothing, and writes nothing", async () => {
    await withTemporaryProject("rendered-ui-dry-run", async (root) => {
        await emptyProject(root);
        const sentinel = await plantMaliciousDriver(root);
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ dryRun: true, allowRun: true }), REVISION);
        assert.equal(response.exitCode, 0);
        assert.equal(response.value.dry_run, true);
        assert.equal(response.value.artifacts.length, 0);
        assert.equal(response.value.planned_artifacts?.length, 6);
        assert.equal(response.value.driver_identity, undefined);
        await assert.rejects(access(sentinel), "dry run must never import a browser driver");
        await assert.rejects(access(join(root, ".forge")), "dry run must not create evidence dirs");
    });
});
test("URL credentials are rejected before any evidence path is derived", async () => {
    await withTemporaryProject("rendered-ui-credentials", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["http://admin:hunter2@127.0.0.1:3000/"], options(), REVISION);
        assert.equal(response.value.status, "BLOCKED");
        assert.match(response.value.reason ?? "", /URL credentials are not accepted/u);
        assert.doesNotMatch(JSON.stringify(response.value), /hunter2/u);
    });
});
test("distinct routes and repeated runs receive distinct evidence directories", async () => {
    await withTemporaryProject("rendered-ui-evidence-identity", async (root) => {
        await emptyProject(root);
        const plan = async (url) => {
            const response = await inspectRenderedUi(root, [url], options({ dryRun: true }), REVISION);
            return response.value.evidence_dir ?? "";
        };
        const first = await plan("http://127.0.0.1:3000/dashboard");
        const second = await plan("http://127.0.0.1:3000/settings");
        const firstAgain = await plan("http://127.0.0.1:3000/dashboard");
        assert.notEqual(first, second, "two routes must not share an evidence directory");
        assert.notEqual(firstAgain, first, "two runs of one route must stay distinguishable");
        // Route identity is stable across runs even though the run segment differs.
        assert.equal(first.split("/").at(-1), firstAgain.split("/").at(-1));
        assert.notEqual(first.split("/").at(-2), firstAgain.split("/").at(-2));
    });
});
test("query strings and fragments cannot escape the evidence directory", async () => {
    await withTemporaryProject("rendered-ui-traversal", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/a?next=../../../../etc/passwd#/../../escape"], options({ dryRun: true }), REVISION);
        const directory = response.value.evidence_dir ?? "";
        assert.ok(directory.startsWith(".forge/evidence/ui/"));
        assert.doesNotMatch(directory, /\.\./u);
        for (const artifact of response.value.planned_artifacts ?? []) {
            assert.ok(artifact.startsWith(".forge/evidence/ui/"));
            assert.doesNotMatch(artifact, /\.\./u);
        }
    });
});
test("planned evidence paths carry the revision and redact query values", async () => {
    await withTemporaryProject("rendered-ui-redaction", async (root) => {
        await emptyProject(root);
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/report?sessionRef=aaaabbbbccccdddd"], options({ dryRun: true }), REVISION);
        assert.ok((response.value.evidence_dir ?? "").includes("git-0123456789abcdef"));
        assert.doesNotMatch(JSON.stringify(response.value), /aaaabbbbccccdddd/u);
        assert.match(response.value.url ?? "", /sessionRef=%5BREDACTED%5D|sessionRef=\[REDACTED\]/u);
    });
});
test("blocked inspection never creates a .forge evidence tree", async () => {
    await withTemporaryProject("rendered-ui-no-leak", async (root) => {
        await emptyProject(root);
        for (const argv of [[], ["not-a-url"], ["https://example.com/"], ["ftp://example.com/"]]) {
            await inspectRenderedUi(root, argv, options(), REVISION);
        }
        const entries = await readdir(root);
        assert.ok(!entries.includes(".forge"));
    });
});
test("a symlinked project driver outside the repository is not loaded", async () => {
    await withTemporaryProject("rendered-ui-symlink", async (root) => {
        await emptyProject(root);
        // Resolution containment is enforced against the real path, so a package whose real location
        // sits outside the audited repository is skipped even when it resolves successfully.
        const outside = join(root, "..", `outside-${process.pid}`);
        await mkdir(join(outside, "playwright"), { recursive: true });
        await writeFile(join(outside, "playwright", "package.json"), `${JSON.stringify({ name: "playwright", version: "1.0.0-outside", main: "index.js" })}\n`, "utf8");
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/"], options({ allowRun: true }), REVISION);
        assert.equal(response.value.status, "BLOCKED");
        assert.equal(response.value.driver_identity, undefined);
        assert.ok(!JSON.stringify(response.value).includes("1.0.0-outside"));
    });
});
test("the resolved driver identity records package, path, source, and trust", async () => {
    await withTemporaryProject("rendered-ui-identity-shape", async (root) => {
        await emptyProject(root);
        const manifestPath = join(root, "package.json");
        assert.ok((await readFile(manifestPath, "utf8")).includes("rendered-ui-test"));
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/"], options({ allowRun: true }), REVISION);
        // With no driver present anywhere, identity must be absent rather than fabricated.
        assert.equal(response.value.status, "BLOCKED");
        assert.equal(response.value.driver_identity, undefined);
    });
});
test("a complete capture with no console errors is the only path to a rendered PASS", async () => {
    await withTemporaryProject("rendered-ui-complete", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, {});
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        assert.equal(response.exitCode, 0);
        assert.equal(response.value.capture_status, "COMPLETE");
        assert.equal(response.value.viewports.length, 3);
        assert.ok(response.value.viewports.every((viewport) => viewport.status === "PASS"));
        const finding = response.value.findings[0];
        assert.ok(finding !== undefined);
        assert.equal(finding.id, "FF-UI-RENDER-001");
        assert.equal(finding.status, "PASS");
        // The manifest must agree with the CLI result rather than telling a different story.
        const manifest = await readJson(join(root, response.value.evidence_dir ?? "", "manifest.json"));
        assert.equal(manifest["capture_status"], "COMPLETE");
        assert.equal(manifest["viewports"].length, 3);
    });
});
test("structural evidence is redacted, hashed, and recorded additively in the manifest", async () => {
    await withTemporaryProject("rendered-ui-structural", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, {
            structural: [
                {
                    horizontal_overflow: false,
                    tab_focus: true,
                    visible_focus: true,
                    unlabeled_interactive: 0,
                    custom_control_defects: 0
                },
                {
                    horizontal_overflow: true,
                    tab_focus: true,
                    visible_focus: true,
                    unlabeled_interactive: 0,
                    custom_control_defects: 0
                },
                {
                    horizontal_overflow: false,
                    tab_focus: true,
                    visible_focus: true,
                    unlabeled_interactive: 1,
                    custom_control_defects: 1
                }
            ]
        });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard?token=fixture-structural-secret"], options({ allowRun: true }), REVISION);
        // Existing Audit capture and exit semantics are unchanged; Build consumes the additive facts.
        assert.equal(response.exitCode, 0);
        assert.equal(response.value.capture_status, "COMPLETE");
        const structural = response.value.structural_evidence;
        assert.ok(structural !== undefined);
        assert.equal(structural.observations.length, 3);
        assert.equal(structural.observations[1]?.horizontal_overflow, true);
        assert.equal(structural.observations[2]?.accessibility?.custom_control_defects, 1);
        assert.match(structural.sha256, /^[a-f0-9]{64}$/u);
        const evidenceDir = join(root, response.value.evidence_dir ?? "");
        const structuralText = await readFile(join(evidenceDir, "structural.json"), "utf8");
        const manifest = await readJson(join(evidenceDir, "manifest.json"));
        assert.ok(!structuralText.includes("fixture-structural-secret"));
        assert.equal(manifest["structural"].sha256, structural.sha256);
    });
});
test("every viewport failing returns FAILED, exit 1, and no rendered PASS", async () => {
    await withTemporaryProject("rendered-ui-all-fail", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, { failNavigation: [0, 1, 2] });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        // The pre-fix implementation returned exit code 0 with no finding at all here.
        assert.equal(response.exitCode, 1);
        assert.equal(response.value.capture_status, "FAILED");
        assert.ok(!response.value.findings.some((finding) => finding.status === "PASS"));
        assert.equal(response.value.findings[0]?.id, "FF-UI-CAPTURE-001");
        const manifest = await readJson(join(root, response.value.evidence_dir ?? "", "manifest.json"));
        assert.equal(manifest["capture_status"], "FAILED");
    });
});
test("one succeeding viewport out of three cannot produce a rendered PASS", async () => {
    await withTemporaryProject("rendered-ui-partial", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, { failNavigation: [1, 2] });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        assert.equal(response.value.capture_status, "PARTIAL");
        assert.equal(response.exitCode, 1);
        assert.ok(!response.value.findings.some((finding) => finding.status === "PASS"));
        // Partial evidence is retained honestly: the one good screenshot is still recorded.
        assert.equal(response.value.viewports.filter((v) => v.status === "PASS").length, 1);
        assert.ok(response.value.artifacts.some((artifact) => artifact.endsWith("desktop-1280x800.png")));
        assert.match(response.value.limitations.join(" "), /NOT_VERIFIED/u);
    });
});
test("a screenshot failure degrades the run below COMPLETE", async () => {
    await withTemporaryProject("rendered-ui-shot-fail", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, { failScreenshot: [2] });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        assert.equal(response.value.capture_status, "PARTIAL");
        assert.notEqual(response.exitCode, 0);
        assert.ok(!response.value.findings.some((finding) => finding.status === "PASS"));
    });
});
test("a browser launch failure fails closed instead of reporting success", async () => {
    await withTemporaryProject("rendered-ui-launch-fail", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, { launchError: "chromium binary missing" });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        assert.equal(response.value.capture_status, "FAILED");
        assert.equal(response.exitCode, 1);
        assert.ok(!response.value.findings.some((finding) => finding.status === "PASS"));
    });
});
test("console errors on a complete capture produce a failing finding and exit 1", async () => {
    await withTemporaryProject("rendered-ui-console-errors", async (root) => {
        await emptyProject(root);
        await plantWorkingDriver(root, {
            console: [{ type: "error", text: "Uncaught TypeError: undefined is not a function" }]
        });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        assert.equal(response.value.capture_status, "COMPLETE");
        assert.equal(response.exitCode, 1);
        assert.equal(response.value.console_errors, 1);
        const finding = response.value.findings[0];
        assert.ok(finding !== undefined);
        assert.equal(finding.id, "FF-UI-CONSOLE-001");
        assert.equal(finding.status, "FAIL");
        assert.ok(!response.value.findings.some((entry) => entry.status === "PASS"));
    });
});
test("secrets in console output never reach any evidence surface", async () => {
    await withTemporaryProject("rendered-ui-secret-console", async (root) => {
        await emptyProject(root);
        const sentinel = "sentinel-console-00001111222233334444aaaa";
        const pathSentinel = "sentinel-pageerror-0000111122223333bbbb";
        await plantWorkingDriver(root, {
            console: [
                { type: "error", text: `request failed: Authorization: Bearer ${sentinel}` },
                { type: "warning", text: `retrying http://127.0.0.1:3000/api?token=${sentinel}` }
            ],
            pageErrors: [`crash while reading api_key=${pathSentinel}`]
        });
        const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
        const evidenceDir = join(root, response.value.evidence_dir ?? "");
        const consoleText = await readFile(join(evidenceDir, "console.json"), "utf8");
        const manifestText = await readFile(join(evidenceDir, "manifest.json"), "utf8");
        const cliJson = JSON.stringify(response.value);
        for (const [surface, content] of [
            ["console.json", consoleText],
            ["manifest.json", manifestText],
            ["CLI JSON", cliJson]
        ]) {
            assert.ok(!content.includes(sentinel), `${surface} must not contain the bearer sentinel`);
            assert.ok(!content.includes(pathSentinel), `${surface} must not contain the key sentinel`);
        }
        // The evidence stays diagnosable even after redaction.
        assert.match(consoleText, /request failed/u);
        assert.match(consoleText, /REDACTED/u);
    });
});
test("the capture status in the manifest always matches the CLI result", async () => {
    const specs = [
        [{}, "COMPLETE"],
        [{ failNavigation: [1, 2] }, "PARTIAL"],
        [{ failNavigation: [0, 1, 2] }, "FAILED"]
    ];
    for (const [spec, expected] of specs) {
        await withTemporaryProject(`rendered-ui-agree-${expected}`, async (root) => {
            await emptyProject(root);
            await plantWorkingDriver(root, spec);
            const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/dashboard"], options({ allowRun: true }), REVISION);
            assert.equal(response.value.capture_status, expected);
            const manifest = await readJson(join(root, response.value.evidence_dir ?? "", "manifest.json"));
            assert.equal(manifest["capture_status"], expected);
        });
    }
});
