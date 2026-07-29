import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGE_ROOT } from "./constants.js";
import { decideRequest, isLoopbackHost, websocketGuardScript } from "./net-policy.js";
import { redactError, redactToString, redactUrl } from "./redaction.js";
import { assertNoSymlinkPath, isInside, resolveInside, sha256, toPosix, utcNow } from "./utils.js";
const VIEWPORTS = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 812 }
];
const DRIVER_CANDIDATES = ["playwright", "@playwright/test", "playwright-core"];
const NAVIGATION_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 90_000;
/**
 * Drives the browser and returns exactly what it managed to capture.
 *
 * Exported so the fail-closed state machine and the offline interceptor can be tested against
 * controlled fake browser objects; this release deliberately does not add Playwright or browser
 * binaries as a required dependency.
 */
export async function captureRenderedUi(chromium, params) {
    const { url, offline, evidenceDirectory, relativeEvidenceDir } = params;
    const consoleEntries = [];
    const blockedRequests = [];
    const limitations = [];
    const viewports = [];
    const artifacts = [];
    const screenshots = [];
    const structuralObservations = [];
    let finalUrl;
    const startedAt = Date.now();
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
    }
    catch (error) {
        // A launch failure produced no evidence at all, so it can never be partial.
        return {
            capture_status: "FAILED",
            viewports: VIEWPORTS.map((viewport) => ({
                name: viewport.name,
                width: viewport.width,
                height: viewport.height,
                status: "FAIL",
                error: "browser launch failed"
            })),
            console_entries: [],
            blocked_requests: [],
            screenshots: [],
            structural_observations: [],
            artifacts: [],
            limitations: [`Browser launch failed: ${redactError(error)}`]
        };
    }
    let closeError;
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
        // Offline enforcement is only real if every request can be inspected before it is sent. A
        // driver that cannot route is refused outright rather than silently downgraded to the old
        // initial-URL-only check.
        if (offline) {
            if (typeof page.route !== "function") {
                // Returning from inside the try block still runs the cleanup in `finally`; closing here as
                // well would shut the browser down twice.
                return {
                    capture_status: "BLOCKED",
                    viewports: [],
                    console_entries: [],
                    blocked_requests: [],
                    screenshots: [],
                    structural_observations: [],
                    artifacts: [],
                    limitations: [
                        "Offline mode requires browser request interception, which this driver does not " +
                            "support. Rendered-state criteria stay NOT_VERIFIED."
                    ],
                    blocked_reason: "The resolved browser driver cannot intercept requests, so the offline boundary " +
                        "cannot be enforced. No navigation was attempted."
                };
            }
            await page.route("**/*", async (route, request) => {
                const requestUrl = request.url();
                const decision = decideRequest(requestUrl, true);
                if (decision.allowed) {
                    await route.continue();
                    return;
                }
                // Each viewport renavigates, so the same destination is refused repeatedly. Evidence
                // records the distinct destinations that were blocked, not one entry per attempt.
                const redacted = redactUrl(requestUrl);
                if (!blockedRequests.some((entry) => entry.url === redacted)) {
                    blockedRequests.push({
                        url: redacted,
                        reason: decision.reason,
                        ...(typeof request.resourceType === "function"
                            ? { resource_type: request.resourceType() }
                            : {})
                    });
                }
                // Aborting here prevents the connection and the DNS lookup that would precede it.
                await route.abort("blockedbyclient");
            });
            if (typeof page.addInitScript === "function") {
                await page.addInitScript(websocketGuardScript());
            }
            else {
                limitations.push("WebSocket connections could not be guarded: this driver does not support init " +
                    "scripts. Non-loopback WebSocket traffic is NOT_VERIFIED.");
            }
            limitations.push("Offline enforcement covers HTTP and HTTPS requests via browser interception and " +
                "WebSocket construction via an init script. Transports outside those two paths " +
                "(for example WebRTC and browser-internal telemetry) are NOT_VERIFIED.");
        }
        page.on("console", (message) => {
            const result = redactToString(message.text());
            consoleEntries.push({ type: message.type(), text: result });
        });
        page.on("pageerror", (error) => {
            consoleEntries.push({ type: "pageerror", text: redactError(error) });
        });
        for (const viewport of VIEWPORTS) {
            if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
                viewports.push({
                    name: viewport.name,
                    width: viewport.width,
                    height: viewport.height,
                    status: "BLOCKED",
                    error: "time budget exhausted before this viewport was attempted"
                });
                continue;
            }
            const name = `${viewport.name}-${viewport.width}x${viewport.height}.png`;
            const artifact = join(evidenceDirectory, name);
            try {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.goto(url, { waitUntil: "load" });
                finalUrl = safeFinalUrl(page);
                await page.screenshot({ path: artifact, fullPage: false });
            }
            catch (error) {
                viewports.push({
                    name: viewport.name,
                    width: viewport.width,
                    height: viewport.height,
                    status: "FAIL",
                    error: redactError(error)
                });
                continue;
            }
            // A screenshot call that resolves without producing a readable file is a failed capture, not
            // a successful one; the artifact is proven to exist before it is counted as evidence.
            let digest;
            try {
                digest = sha256(await readFile(artifact));
            }
            catch (error) {
                viewports.push({
                    name: viewport.name,
                    width: viewport.width,
                    height: viewport.height,
                    status: "FAIL",
                    error: `screenshot artifact missing after capture: ${redactError(error)}`
                });
                continue;
            }
            const relativeArtifact = toPosix(join(relativeEvidenceDir, name));
            artifacts.push(relativeArtifact);
            screenshots.push({
                path: relativeArtifact,
                viewport: `${viewport.width}x${viewport.height}`,
                sha256: digest
            });
            viewports.push({
                name: viewport.name,
                width: viewport.width,
                height: viewport.height,
                status: "PASS",
                artifact: relativeArtifact,
                sha256: digest
            });
            structuralObservations.push(await inspectViewportStructure(page, viewport));
        }
    }
    catch (error) {
        limitations.push(`Rendered inspection failed: ${redactError(error)}`);
    }
    finally {
        // Cleanup runs on every launch-success path, and a failure to close is recorded rather than
        // swallowed so a leaked browser process is visible in the evidence.
        try {
            await browser.close();
        }
        catch (error) {
            closeError = redactError(error);
            limitations.push(`Browser close failed: ${closeError}`);
        }
    }
    for (const request of blockedRequests) {
        limitations.push(`Offline policy blocked ${request.resource_type ?? "a"} request to ${request.url}: ${request.reason}.`);
    }
    const passed = viewports.filter((viewport) => viewport.status === "PASS").length;
    let captureStatus;
    if (passed === 0) {
        captureStatus = "FAILED";
    }
    else if (passed < VIEWPORTS.length || blockedRequests.length > 0) {
        // Any blocked request means the page did not render with all of its resources, so the capture
        // cannot be described as complete even when every viewport produced a screenshot.
        captureStatus = "PARTIAL";
    }
    else {
        captureStatus = "COMPLETE";
    }
    return {
        capture_status: captureStatus,
        viewports,
        console_entries: consoleEntries,
        blocked_requests: blockedRequests,
        screenshots,
        structural_observations: structuralObservations,
        artifacts,
        limitations,
        ...(finalUrl === undefined ? {} : { final_url: finalUrl })
    };
}
/**
 * Executes only this module's fixed structural observation. No selector, script, or command is
 * accepted from callers. A missing browser capability is an evidence gap rather than a guessed
 * clean result, while screenshot capture remains compatible with older drivers.
 */
async function inspectViewportStructure(page, viewport) {
    const base = { name: viewport.name, width: viewport.width, height: viewport.height };
    if (typeof page.evaluate !== "function" || page.keyboard === undefined)
        return {
            ...base,
            status: "NOT_VERIFIED",
            limitations: [
                "The resolved browser driver does not support the fixed keyboard and structural-observation adapter."
            ]
        };
    try {
        await page.keyboard.press("Tab");
        const observed = await page.evaluate(() => {
            const text = (element) => (element?.textContent ?? "").trim();
            const nameFor = (element) => {
                const ariaLabel = element.getAttribute("aria-label")?.trim();
                if (ariaLabel !== undefined && ariaLabel !== "")
                    return ariaLabel;
                const labelledBy = element.getAttribute("aria-labelledby")?.trim();
                if (labelledBy !== undefined && labelledBy !== "") {
                    const value = labelledBy
                        .split(/\s+/u)
                        .map((id) => text(document.getElementById(id)))
                        .join(" ")
                        .trim();
                    if (value !== "")
                        return value;
                }
                if (element instanceof HTMLInputElement) {
                    const labels = [...(element.labels ?? [])]
                        .map((label) => text(label))
                        .join(" ")
                        .trim();
                    if (labels !== "")
                        return labels;
                }
                return (element.getAttribute("title") ?? text(element)).trim();
            };
            const interactive = [
                ...document.querySelectorAll("button,a[href],input:not([type=hidden]),select,textarea,[role]")
            ].filter((element) => element.getAttribute("aria-hidden") !== "true");
            const nativeTags = new Set(["button", "a", "input", "select", "textarea"]);
            let unlabeledInteractive = 0;
            let customControlDefects = 0;
            for (const element of interactive) {
                const name = nameFor(element);
                if (name === "")
                    unlabeledInteractive += 1;
                const role = element.getAttribute("role");
                if (role !== null && !nativeTags.has(element.tagName.toLowerCase()) && name === "")
                    customControlDefects += 1;
            }
            const focused = document.activeElement;
            const tabFocus = focused !== null && focused !== document.body && focused !== document.documentElement;
            const style = focused === null ? undefined : getComputedStyle(focused);
            const visibleFocus = tabFocus &&
                style !== undefined &&
                (style.outlineStyle !== "none" ||
                    style.outlineWidth !== "0px" ||
                    style.boxShadow !== "none");
            return {
                horizontal_overflow: document.documentElement.scrollWidth > window.innerWidth,
                tab_focus: tabFocus,
                visible_focus: visibleFocus,
                unlabeled_interactive: unlabeledInteractive,
                custom_control_defects: customControlDefects
            };
        });
        if (!isStructuralObservation(observed))
            throw new Error("browser returned an invalid fixed structural-observation shape");
        const failed = observed.horizontal_overflow ||
            !observed.tab_focus ||
            !observed.visible_focus ||
            observed.unlabeled_interactive > 0 ||
            observed.custom_control_defects > 0;
        return {
            ...base,
            status: failed ? "FAIL" : "PASS",
            horizontal_overflow: observed.horizontal_overflow,
            keyboard: { tab_focus: observed.tab_focus, visible_focus: observed.visible_focus },
            accessibility: {
                unlabeled_interactive: observed.unlabeled_interactive,
                custom_control_defects: observed.custom_control_defects
            },
            limitations: []
        };
    }
    catch (error) {
        return {
            ...base,
            status: "NOT_VERIFIED",
            limitations: [`Structural observation could not run: ${redactError(error)}`]
        };
    }
}
function isStructuralObservation(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const record = value;
    return (typeof record["horizontal_overflow"] === "boolean" &&
        typeof record["tab_focus"] === "boolean" &&
        typeof record["visible_focus"] === "boolean" &&
        Number.isInteger(record["unlabeled_interactive"]) &&
        record["unlabeled_interactive"] >= 0 &&
        Number.isInteger(record["custom_control_defects"]) &&
        record["custom_control_defects"] >= 0);
}
export async function inspectRenderedUi(root, args, options, revision) {
    const offline = options.offline;
    const url = args.find((argument) => !argument.startsWith("-"));
    if (url === undefined) {
        return blocked(offline, "A target URL is required: forge tool inspect-rendered-ui <url>. Start the application " +
            "yourself and pass its address; this tool never guesses or launches project servers.");
    }
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        return blocked(offline, `'${url}' is not a valid absolute URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return blocked(offline, "Only http and https URLs are supported.");
    // Credentials embedded in a URL would otherwise reach evidence manifests and directory names.
    if (parsed.username !== "" || parsed.password !== "") {
        return blocked(offline, "URL credentials are not accepted. Remove the userinfo component and authenticate through " +
            "the application instead; credentials must never reach evidence artifacts.");
    }
    const loopback = isLoopbackHost(parsed.hostname);
    // Offline is enforced before any resolution so no DNS lookup or connection is attempted.
    if (offline && !loopback) {
        return blocked(offline, `Offline mode refuses non-loopback destination '${parsed.hostname}'. No DNS resolution or ` +
            "network request was attempted. Rendered-state criteria for this route stay NOT_VERIFIED.");
    }
    if (!loopback && !options.allowRun) {
        return blocked(offline, "Non-loopback URLs require explicit --allow-run. Runtime inspection defaults to local " +
            "development servers so audited content never leaves the machine unintentionally.");
    }
    const runId = `${utcNow().replace(/[:.]/gu, "-")}-${randomUUID().slice(0, 8)}`;
    const routeId = routeIdentity(parsed);
    // `--evidence-dir` relocates the run-scoped evidence tree but never escapes the audited root:
    // `resolveInside` rejects absolute, drive-qualified, UNC, and `..` forms outright. The default is
    // unchanged, so existing evidence layouts and consumers keep working.
    let evidenceBase;
    if (options.evidenceDir === undefined) {
        evidenceBase = join(".forge", "evidence", "ui");
    }
    else {
        try {
            resolveInside(root, options.evidenceDir);
        }
        catch (error) {
            return blocked(offline, `Unsafe --evidence-dir '${options.evidenceDir}': ${redactError(error)}`);
        }
        evidenceBase = options.evidenceDir;
    }
    const relativeEvidenceDir = join(evidenceBase, revisionSlug(revision), runId, routeId);
    const plannedArtifacts = [
        ...VIEWPORTS.map((viewport) => toPosix(join(relativeEvidenceDir, `${viewport.name}-${viewport.width}x${viewport.height}.png`))),
        toPosix(join(relativeEvidenceDir, "console.json")),
        toPosix(join(relativeEvidenceDir, "structural.json")),
        toPosix(join(relativeEvidenceDir, "manifest.json"))
    ];
    // Dry run must resolve nothing and import nothing: importing a browser driver executes that
    // package's top-level code, which is exactly what a dry run promises not to do.
    if (options.dryRun) {
        return {
            value: {
                tool: "inspect-rendered-ui",
                status: "OK",
                capture_status: "BLOCKED",
                url: redactUrl(parsed),
                offline,
                dry_run: true,
                evidence_dir: toPosix(relativeEvidenceDir),
                run_id: runId,
                route_id: routeId,
                artifacts: [],
                planned_artifacts: plannedArtifacts,
                viewports: [],
                blocked_requests: [],
                console_errors: 0,
                console_warnings: 0,
                limitations: [
                    "Dry run: no browser driver was resolved, imported, or launched and no evidence was written."
                ],
                findings: []
            },
            exitCode: 0
        };
    }
    const driver = await resolveDriver(root, options);
    if ("reason" in driver)
        return blocked(offline, driver.reason);
    const evidenceDirectory = join(root, relativeEvidenceDir);
    await assertNoSymlinkPath(root, evidenceDirectory);
    await mkdir(evidenceDirectory, { recursive: true });
    const capture = await captureRenderedUi(driver.chromium, {
        url,
        offline,
        evidenceDirectory,
        relativeEvidenceDir
    });
    const consoleEntries = capture.console_entries;
    const artifacts = [...capture.artifacts];
    const limitations = [...capture.limitations];
    const consoleDocument = `${JSON.stringify({ url: redactUrl(parsed), route_id: routeId, captured_at: utcNow(), entries: consoleEntries }, null, 2)}\n`;
    const consolePath = join(evidenceDirectory, "console.json");
    await writeFile(consolePath, consoleDocument, "utf8");
    artifacts.push(toPosix(join(relativeEvidenceDir, "console.json")));
    const structuralDocument = `${JSON.stringify({
        url: redactUrl(parsed),
        route_id: routeId,
        captured_at: utcNow(),
        observations: capture.structural_observations
    }, null, 2)}\n`;
    const structuralPath = toPosix(join(relativeEvidenceDir, "structural.json"));
    await writeFile(join(evidenceDirectory, "structural.json"), structuralDocument, "utf8");
    const structuralEvidence = {
        path: structuralPath,
        sha256: sha256(structuralDocument),
        observations: capture.structural_observations
    };
    artifacts.push(structuralPath);
    const errors = consoleEntries.filter((entry) => entry.type === "error" || entry.type === "pageerror");
    const warnings = consoleEntries.filter((entry) => entry.type === "warning");
    const manifest = {
        schema_version: 2,
        run_id: runId,
        route_id: routeId,
        revision,
        captured_at: utcNow(),
        capture_status: capture.capture_status,
        source_url: redactUrl(parsed),
        origin: parsed.origin,
        path: parsed.pathname,
        query_keys: [...new Set([...parsed.searchParams.keys()])].sort(),
        final_url: capture.final_url === undefined ? null : redactUrl(capture.final_url),
        redirected: capture.final_url !== undefined && normalize(capture.final_url) !== normalize(url),
        offline,
        allow_run: options.allowRun,
        driver: driver.identity,
        viewports: capture.viewports,
        blocked_requests: capture.blocked_requests,
        screenshots: capture.screenshots,
        structural: structuralEvidence,
        console: {
            path: toPosix(join(relativeEvidenceDir, "console.json")),
            sha256: sha256(consoleDocument),
            errors: errors.length,
            warnings: warnings.length
        },
        limitations
    };
    const manifestDocument = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(join(evidenceDirectory, "manifest.json"), manifestDocument, "utf8");
    artifacts.push(toPosix(join(relativeEvidenceDir, "manifest.json")));
    const complete = capture.capture_status === "COMPLETE";
    const findings = [];
    if (complete && errors.length > 0) {
        findings.push({
            id: "FF-UI-CONSOLE-001",
            section: "ui",
            title: "Rendered page emits browser console errors",
            severity: "MEDIUM",
            confidence: "HIGH",
            status: "FAIL",
            location: [{ path: toPosix(join(relativeEvidenceDir, "console.json")) }],
            evidence: errors
                .slice(0, 5)
                .map((entry) => `${entry.type}: ${entry.text} (captured at ${redactUrl(parsed)})`),
            impact: "Console errors indicate broken scripts, failed requests, or rendering defects.",
            recommendation: "Resolve every console error on the inspected route before release.",
            safe_fix: false,
            verification: ["Re-run inspect-rendered-ui against the same URL and confirm zero errors."],
            standards: ["Fullstack Forge evidence protocol"]
        });
    }
    else if (complete) {
        // Only a complete capture with zero console errors may contribute a rendered PASS.
        findings.push({
            id: "FF-UI-RENDER-001",
            section: "ui",
            title: "Route rendered without console errors",
            severity: "INFO",
            confidence: "HIGH",
            status: "PASS",
            location: artifacts.map((artifact) => ({ path: artifact })),
            evidence: [
                `Captured all ${capture.screenshots.length} required viewport screenshot(s) of ` +
                    `${redactUrl(parsed)} with zero console errors using ` +
                    `${driver.identity.package}@${driver.identity.version ?? "unknown"}.`
            ],
            impact: "Direct running-application evidence for the rendered-state criteria of this route.",
            recommendation: "Review the captured screenshots for visual-hierarchy, state, and consistency criteria; " +
                "screenshots prove rendering, not design quality.",
            safe_fix: false,
            verification: ["Re-run inspect-rendered-ui against the same URL."],
            standards: ["Fullstack Forge evidence protocol"]
        });
    }
    else {
        // Incomplete capture fails closed: the rendered criteria are explicitly not verified, and any
        // console errors observed along the way are still reported.
        const failed = capture.viewports.filter((viewport) => viewport.status !== "PASS");
        findings.push({
            id: "FF-UI-CAPTURE-001",
            section: "ui",
            title: `Rendered inspection did not produce complete evidence (${capture.capture_status})`,
            severity: "MEDIUM",
            confidence: "HIGH",
            status: capture.capture_status === "FAILED" ? "FAIL" : "NOT_VERIFIED",
            location: [{ path: toPosix(join(relativeEvidenceDir, "manifest.json")) }],
            evidence: [
                `Capture status ${capture.capture_status}: ${capture.screenshots.length} of ` +
                    `${VIEWPORTS.length} required viewport(s) captured, ` +
                    `${capture.blocked_requests.length} request(s) blocked by offline policy.`,
                ...failed
                    .slice(0, 5)
                    .map((viewport) => `${viewport.name}: ${viewport.status} ${viewport.error ?? ""}`.trim())
            ],
            impact: "Rendered-state criteria for this route are not supported by complete evidence and must " +
                "not be treated as verified.",
            recommendation: "Re-run inspection with the application reachable and every required resource available, " +
                "or record the rendered criteria as NOT_VERIFIED.",
            safe_fix: false,
            verification: ["Re-run inspect-rendered-ui and confirm capture_status is COMPLETE."],
            standards: ["Fullstack Forge evidence protocol"]
        });
        limitations.push(`Capture status ${capture.capture_status}: rendered-state criteria remain NOT_VERIFIED.`);
    }
    return {
        value: {
            tool: "inspect-rendered-ui",
            status: "OK",
            capture_status: capture.capture_status,
            url: redactUrl(parsed),
            driver: driver.identity.package,
            driver_identity: driver.identity,
            offline,
            evidence_dir: toPosix(relativeEvidenceDir),
            run_id: runId,
            route_id: routeId,
            artifacts,
            viewports: capture.viewports,
            blocked_requests: capture.blocked_requests,
            console_errors: errors.length,
            console_warnings: warnings.length,
            structural_evidence: structuralEvidence,
            limitations,
            findings
        },
        exitCode: exitCodeFor(capture, errors.length)
    };
}
/**
 * Exit codes follow one rule: `0` is reserved for a complete capture with nothing failing.
 *
 * `1` marks an executed run that produced a failing finding or a runtime failure; `2` marks a run
 * whose evidence is merely absent, which callers treat as NOT_VERIFIED rather than as a defect.
 */
function exitCodeFor(capture, consoleErrors) {
    if (capture.capture_status === "COMPLETE")
        return consoleErrors > 0 ? 1 : 0;
    if (capture.capture_status === "BLOCKED")
        return 2;
    if (capture.capture_status === "FAILED")
        return 1;
    // PARTIAL: a genuine viewport failure is a defect; evidence withheld purely by offline policy is
    // an absence of proof.
    const failedViewport = capture.viewports.some((viewport) => viewport.status === "FAIL");
    return failedViewport || consoleErrors > 0 ? 1 : 2;
}
function blocked(offline, reason) {
    return {
        value: {
            tool: "inspect-rendered-ui",
            status: "BLOCKED",
            capture_status: "BLOCKED",
            reason,
            offline,
            artifacts: [],
            viewports: [],
            blocked_requests: [],
            console_errors: 0,
            console_warnings: 0,
            limitations: ["Rendered-state criteria for this route remain NOT_VERIFIED."],
            findings: []
        },
        exitCode: 2
    };
}
/**
 * Stable, collision-resistant identity for a route. The readable prefix is sanitized to a single
 * path segment so query strings, fragments, and traversal sequences cannot influence the directory
 * layout; the hash suffix preserves the distinction between routes that sanitize identically.
 */
function routeIdentity(parsed) {
    const readable = `${parsed.hostname}-${parsed.port === "" ? "" : `${parsed.port}-`}${parsed.pathname}`
        .replace(/[^a-zA-Z0-9._-]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .replace(/\.+/gu, ".")
        .slice(0, 60);
    const hash = sha256(normalize(parsed.href)).slice(0, 16);
    return `${readable === "" ? "route" : readable}-${hash}`;
}
function revisionSlug(revision) {
    const sanitized = revision.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
    return sanitized === "" ? "unknown-revision" : sanitized.slice(0, 80);
}
function normalize(href) {
    const parsed = new URL(href);
    parsed.hash = "";
    return parsed.href;
}
function safeFinalUrl(page) {
    try {
        return page.url();
    }
    catch {
        return undefined;
    }
}
/**
 * Resolves a browser driver from the most trusted source available.
 *
 * Importing a package executes its top-level code. Fullstack Forge therefore never imports browser
 * tooling from the audited repository by default: a hostile repository could ship a `playwright`
 * package whose import runs arbitrary code inside the auditor's process. Forge-owned packages are
 * preferred; the audited project's copy is used only under explicit `--allow-run`, only after the
 * real path is proven to live inside the audited repository, and never under `--offline`.
 */
async function resolveDriver(root, options) {
    const trusted = await loadFrom(PACKAGE_ROOT, "forge", PACKAGE_ROOT);
    if (trusted !== undefined)
        return trusted;
    if (!options.allowRun) {
        return {
            reason: "No Fullstack Forge-owned browser driver is installed, and importing the audited " +
                "project's driver executes that project's code. Re-run with --allow-run to authorize " +
                "importing the audited-project driver, or install a driver alongside Fullstack Forge. " +
                "Until then rendered-state criteria stay NOT_VERIFIED."
        };
    }
    if (options.offline) {
        return {
            reason: "Offline mode refuses to resolve a browser driver from the audited project because " +
                "resolution may trigger installation or network access. Rendered-state criteria stay " +
                "NOT_VERIFIED."
        };
    }
    const project = await loadFrom(root, "project", root);
    if (project !== undefined)
        return project;
    return {
        reason: "Playwright is not installed in the audited project. Install it as a devDependency " +
            "(npm i -D playwright && npx playwright install chromium) to enable rendered-UI evidence; " +
            "until then rendered-state criteria stay NOT_VERIFIED."
    };
}
async function loadFrom(from, source, containment) {
    const require = createRequire(join(from, "package.json"));
    for (const candidate of DRIVER_CANDIDATES) {
        let resolved;
        try {
            resolved = require.resolve(candidate);
        }
        catch {
            continue;
        }
        // Resolve symlinks before the containment check so a symlinked or redirected package inside the
        // audited repository cannot smuggle in code that lives outside the trust domain it claims.
        let real;
        try {
            real = await realpath(resolved);
        }
        catch {
            continue;
        }
        const realContainment = await realpath(containment).catch(() => containment);
        if (!isInside(realContainment, real))
            continue;
        const version = await packageVersion(real, candidate, realContainment);
        const imported = (await import(pathToFileURL(real).href));
        const chromium = imported.chromium ?? imported.default?.chromium;
        if (chromium === undefined)
            continue;
        return {
            chromium,
            identity: {
                package: candidate,
                ...(version === undefined ? {} : { version }),
                path: toPosix(real),
                source,
                trusted: source === "forge"
            }
        };
    }
    return undefined;
}
async function packageVersion(entry, name, containment) {
    let current = dirname(entry);
    // Never invent a version: walk up to the package manifest and report absence as unknown.
    while (isInside(containment, current)) {
        try {
            const manifest = JSON.parse(await readFile(join(current, "package.json"), "utf8"));
            if (manifest.name === name && typeof manifest.version === "string")
                return manifest.version;
        }
        catch {
            // Keep walking: intermediate directories often have no manifest.
        }
        const parent = dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return undefined;
}
