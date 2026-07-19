import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { toPosix, utcNow } from "./utils.js";
const VIEWPORTS = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 812 }
];
const NAVIGATION_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 90_000;
export async function inspectRenderedUi(root, args, options) {
    const url = args.find((argument) => !argument.startsWith("-"));
    if (url === undefined) {
        return blocked("A target URL is required: forge tool inspect-rendered-ui <url>. Start the application " +
            "yourself and pass its address; this tool never guesses or launches project servers.");
    }
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        return blocked(`'${url}' is not a valid absolute URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return blocked("Only http and https URLs are supported.");
    if (!isLoopbackHost(parsed.hostname) && !options.allowRun) {
        return blocked("Non-loopback URLs require explicit --allow-run. Runtime inspection defaults to local " +
            "development servers so audited content never leaves the machine unintentionally.");
    }
    const chromium = await resolveChromium(root);
    if (chromium === undefined) {
        return blocked("Playwright is not installed in the audited project. Install it as a devDependency " +
            "(npm i -D playwright && npx playwright install chromium) to enable rendered-UI evidence; " +
            "until then rendered-state criteria stay NOT_VERIFIED.");
    }
    const evidenceDirectory = join(root, ".forge", "evidence", "ui");
    if (options.dryRun) {
        return {
            value: {
                tool: "inspect-rendered-ui",
                status: "OK",
                url,
                driver: chromium.driver,
                dry_run: true,
                artifacts: VIEWPORTS.map((viewport) => toPosix(join(".forge", "evidence", "ui", `${viewport.name}.png`))),
                console_errors: 0,
                console_warnings: 0,
                findings: []
            },
            exitCode: 0
        };
    }
    await mkdir(evidenceDirectory, { recursive: true });
    const consoleEntries = [];
    const artifacts = [];
    const startedAt = Date.now();
    const browser = await chromium.module.launch({ headless: true });
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
        page.on("console", (message) => {
            consoleEntries.push({ type: message.type(), text: message.text().slice(0, 500) });
        });
        page.on("pageerror", (error) => {
            consoleEntries.push({ type: "pageerror", text: String(error.message).slice(0, 500) });
        });
        for (const viewport of VIEWPORTS) {
            if (Date.now() - startedAt > TOTAL_BUDGET_MS)
                throw new Error("Rendered-UI inspection exceeded its total time budget.");
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto(url, { waitUntil: "load" });
            const artifact = join(evidenceDirectory, `${viewport.name}.png`);
            await page.screenshot({ path: artifact, fullPage: false });
            artifacts.push(toPosix(join(".forge", "evidence", "ui", `${viewport.name}.png`)));
        }
    }
    finally {
        await browser.close();
    }
    const consolePath = join(evidenceDirectory, "console.json");
    await writeFile(consolePath, `${JSON.stringify({ url, captured_at: utcNow(), entries: consoleEntries }, null, 2)}\n`, "utf8");
    artifacts.push(toPosix(join(".forge", "evidence", "ui", "console.json")));
    const errors = consoleEntries.filter((entry) => entry.type === "error" || entry.type === "pageerror");
    const warnings = consoleEntries.filter((entry) => entry.type === "warning");
    const findings = [];
    if (errors.length > 0) {
        findings.push({
            id: "FF-UI-CONSOLE-001",
            section: "ui",
            title: "Rendered page emits browser console errors",
            severity: "MEDIUM",
            confidence: "HIGH",
            status: "FAIL",
            location: [{ path: toPosix(join(".forge", "evidence", "ui", "console.json")) }],
            evidence: errors
                .slice(0, 5)
                .map((entry) => `${entry.type}: ${entry.text} (captured at ${url})`),
            impact: "Console errors indicate broken scripts, failed requests, or rendering defects.",
            recommendation: "Resolve every console error on the inspected route before release.",
            safe_fix: false,
            verification: ["Re-run inspect-rendered-ui against the same URL and confirm zero errors."],
            standards: ["Fullstack Forge evidence protocol"]
        });
    }
    else {
        findings.push({
            id: "FF-UI-RENDER-001",
            section: "ui",
            title: "Route rendered at three viewports without console errors",
            severity: "INFO",
            confidence: "HIGH",
            status: "PASS",
            location: artifacts.map((artifact) => ({ path: artifact })),
            evidence: [
                `Captured desktop, tablet, and mobile screenshots of ${url} with zero console errors.`
            ],
            impact: "Direct running-application evidence for the rendered-state criteria of this route.",
            recommendation: "Review the captured screenshots for visual-hierarchy, state, and consistency criteria; " +
                "screenshots prove rendering, not design quality.",
            safe_fix: false,
            verification: ["Re-run inspect-rendered-ui against the same URL."],
            standards: ["Fullstack Forge evidence protocol"]
        });
    }
    return {
        value: {
            tool: "inspect-rendered-ui",
            status: "OK",
            url,
            driver: chromium.driver,
            artifacts,
            console_errors: errors.length,
            console_warnings: warnings.length,
            findings
        },
        exitCode: errors.length > 0 ? 1 : 0
    };
}
function blocked(reason) {
    return {
        value: {
            tool: "inspect-rendered-ui",
            status: "BLOCKED",
            reason,
            artifacts: [],
            console_errors: 0,
            console_warnings: 0,
            findings: []
        },
        exitCode: 2
    };
}
function isLoopbackHost(hostname) {
    return (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "[::1]" ||
        hostname.endsWith(".localhost"));
}
async function resolveChromium(root) {
    const require = createRequire(join(root, "package.json"));
    for (const candidate of ["playwright", "@playwright/test", "playwright-core"]) {
        let resolved;
        try {
            resolved = require.resolve(candidate);
        }
        catch {
            continue;
        }
        const imported = (await import(pathToFileURL(resolved).href));
        const chromium = imported.chromium ?? imported.default?.chromium;
        if (chromium !== undefined)
            return { module: chromium, driver: candidate };
    }
    return undefined;
}
//# sourceMappingURL=rendered-ui.js.map