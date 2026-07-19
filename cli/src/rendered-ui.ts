import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGE_ROOT } from "./constants.js";
import type { CliOptions, Finding } from "./types.js";
import { assertNoSymlinkPath, isInside, sha256, toPosix, utcNow } from "./utils.js";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 }
] as const;

const DRIVER_CANDIDATES = ["playwright", "@playwright/test", "playwright-core"] as const;

const NAVIGATION_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 90_000;

type ConsoleEntry = { type: string; text: string };

/**
 * Identity of the browser automation package that was actually imported. `source` records the trust
 * domain: `forge` packages ship with this tool and are covered by its lockfile, while `project`
 * packages come from the audited repository and execute audited-project code on import.
 */
export type DriverIdentity = {
  package: string;
  version?: string;
  path: string;
  source: "forge" | "project";
  trusted: boolean;
};

export type RenderedUiResult = {
  tool: "inspect-rendered-ui";
  status: "OK" | "BLOCKED";
  reason?: string;
  url?: string;
  driver?: string;
  driver_identity?: DriverIdentity;
  offline: boolean;
  dry_run?: boolean;
  evidence_dir?: string;
  run_id?: string;
  route_id?: string;
  artifacts: string[];
  planned_artifacts?: string[];
  console_errors: number;
  console_warnings: number;
  limitations: string[];
  findings: Finding[];
};

type MinimalPage = {
  setDefaultTimeout(timeout: number): void;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  url(): string;
  on(event: "console", handler: (message: { type(): string; text(): string }) => void): void;
  on(event: "pageerror", handler: (error: Error) => void): void;
};

type MinimalBrowser = {
  newPage(): Promise<MinimalPage>;
  close(): Promise<void>;
};

type MinimalChromium = {
  launch(options: { headless: boolean }): Promise<MinimalBrowser>;
};

export async function inspectRenderedUi(
  root: string,
  args: string[],
  options: CliOptions,
  revision: string
): Promise<{ value: RenderedUiResult; exitCode: number }> {
  const offline = options.offline;
  const url = args.find((argument) => !argument.startsWith("-"));
  if (url === undefined) {
    return blocked(
      offline,
      "A target URL is required: forge tool inspect-rendered-ui <url>. Start the application " +
        "yourself and pass its address; this tool never guesses or launches project servers."
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return blocked(offline, `'${url}' is not a valid absolute URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return blocked(offline, "Only http and https URLs are supported.");

  // Credentials embedded in a URL would otherwise reach evidence manifests and directory names.
  if (parsed.username !== "" || parsed.password !== "") {
    return blocked(
      offline,
      "URL credentials are not accepted. Remove the userinfo component and authenticate through " +
        "the application instead; credentials must never reach evidence artifacts."
    );
  }

  const loopback = isLoopbackHost(parsed.hostname);

  // Offline is enforced before any resolution so no DNS lookup or connection is attempted.
  if (offline && !loopback) {
    return blocked(
      offline,
      `Offline mode refuses non-loopback destination '${parsed.hostname}'. No DNS resolution or ` +
        "network request was attempted. Rendered-state criteria for this route stay NOT_VERIFIED."
    );
  }
  if (!loopback && !options.allowRun) {
    return blocked(
      offline,
      "Non-loopback URLs require explicit --allow-run. Runtime inspection defaults to local " +
        "development servers so audited content never leaves the machine unintentionally."
    );
  }

  const runId = `${utcNow().replace(/[:.]/gu, "-")}-${randomUUID().slice(0, 8)}`;
  const routeId = routeIdentity(parsed);
  const relativeEvidenceDir = join(
    ".forge",
    "evidence",
    "ui",
    revisionSlug(revision),
    runId,
    routeId
  );
  const plannedArtifacts = [
    ...VIEWPORTS.map((viewport) =>
      toPosix(
        join(relativeEvidenceDir, `${viewport.name}-${viewport.width}x${viewport.height}.png`)
      )
    ),
    toPosix(join(relativeEvidenceDir, "console.json")),
    toPosix(join(relativeEvidenceDir, "manifest.json"))
  ];

  // Dry run must resolve nothing and import nothing: importing a browser driver executes that
  // package's top-level code, which is exactly what a dry run promises not to do.
  if (options.dryRun) {
    return {
      value: {
        tool: "inspect-rendered-ui",
        status: "OK",
        url: redactUrl(parsed),
        offline,
        dry_run: true,
        evidence_dir: toPosix(relativeEvidenceDir),
        run_id: runId,
        route_id: routeId,
        artifacts: [],
        planned_artifacts: plannedArtifacts,
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
  if ("reason" in driver) return blocked(offline, driver.reason);

  const evidenceDirectory = join(root, relativeEvidenceDir);
  await assertNoSymlinkPath(root, evidenceDirectory);
  await mkdir(evidenceDirectory, { recursive: true });

  const consoleEntries: ConsoleEntry[] = [];
  const artifacts: string[] = [];
  const screenshots: Array<{ path: string; viewport: string; sha256: string }> = [];
  const limitations: string[] = [];
  let finalUrl: string | undefined;
  const startedAt = Date.now();
  const browser = await driver.chromium.launch({ headless: true });
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
      if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
        limitations.push(
          `Time budget exhausted after ${screenshots.length} viewport(s); remaining viewports are NOT_VERIFIED.`
        );
        break;
      }
      const name = `${viewport.name}-${viewport.width}x${viewport.height}.png`;
      const artifact = join(evidenceDirectory, name);
      try {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(url, { waitUntil: "load" });
        finalUrl = safeFinalUrl(page);
        await page.screenshot({ path: artifact, fullPage: false });
      } catch (error) {
        // Partial failure keeps the evidence captured so far rather than discarding honest results.
        limitations.push(`Viewport ${viewport.name} failed: ${(error as Error).message}`);
        continue;
      }
      const relativeArtifact = toPosix(join(relativeEvidenceDir, name));
      artifacts.push(relativeArtifact);
      screenshots.push({
        path: relativeArtifact,
        viewport: `${viewport.width}x${viewport.height}`,
        sha256: sha256(await readFile(artifact))
      });
    }
  } finally {
    // Always release the browser process, including on partial failure.
    await browser.close().catch(() => undefined);
  }

  const consoleDocument = `${JSON.stringify(
    { url: redactUrl(parsed), route_id: routeId, captured_at: utcNow(), entries: consoleEntries },
    null,
    2
  )}\n`;
  const consolePath = join(evidenceDirectory, "console.json");
  await writeFile(consolePath, consoleDocument, "utf8");
  artifacts.push(toPosix(join(relativeEvidenceDir, "console.json")));

  const errors = consoleEntries.filter(
    (entry) => entry.type === "error" || entry.type === "pageerror"
  );
  const warnings = consoleEntries.filter((entry) => entry.type === "warning");

  const manifest = {
    schema_version: 1,
    run_id: runId,
    route_id: routeId,
    revision,
    captured_at: utcNow(),
    source_url: redactUrl(parsed),
    origin: parsed.origin,
    path: parsed.pathname,
    query_keys: [...new Set([...parsed.searchParams.keys()])].sort(),
    final_url: finalUrl === undefined ? null : redactUrlString(finalUrl),
    redirected: finalUrl !== undefined && normalize(finalUrl) !== normalize(url),
    offline,
    allow_run: options.allowRun,
    driver: driver.identity,
    screenshots,
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

  const findings: Finding[] = [];
  if (errors.length > 0) {
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
  } else if (screenshots.length > 0) {
    findings.push({
      id: "FF-UI-RENDER-001",
      section: "ui",
      title: "Route rendered without console errors",
      severity: "INFO",
      confidence: "HIGH",
      status: "PASS",
      location: artifacts.map((artifact) => ({ path: artifact })),
      evidence: [
        `Captured ${screenshots.length} viewport screenshot(s) of ${redactUrl(parsed)} with zero ` +
          `console errors using ${driver.identity.package}@${driver.identity.version ?? "unknown"}.`
      ],
      impact: "Direct running-application evidence for the rendered-state criteria of this route.",
      recommendation:
        "Review the captured screenshots for visual-hierarchy, state, and consistency criteria; " +
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
      url: redactUrl(parsed),
      driver: driver.identity.package,
      driver_identity: driver.identity,
      offline,
      evidence_dir: toPosix(relativeEvidenceDir),
      run_id: runId,
      route_id: routeId,
      artifacts,
      console_errors: errors.length,
      console_warnings: warnings.length,
      limitations,
      findings
    },
    exitCode: errors.length > 0 ? 1 : 0
  };
}

function blocked(offline: boolean, reason: string): { value: RenderedUiResult; exitCode: number } {
  return {
    value: {
      tool: "inspect-rendered-ui",
      status: "BLOCKED",
      reason,
      offline,
      artifacts: [],
      console_errors: 0,
      console_warnings: 0,
      limitations: ["Rendered-state criteria for this route remain NOT_VERIFIED."],
      findings: []
    },
    exitCode: 2
  };
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Stable, collision-resistant identity for a route. The readable prefix is sanitized to a single
 * path segment so query strings, fragments, and traversal sequences cannot influence the directory
 * layout; the hash suffix preserves the distinction between routes that sanitize identically.
 */
function routeIdentity(parsed: URL): string {
  const readable =
    `${parsed.hostname}-${parsed.port === "" ? "" : `${parsed.port}-`}${parsed.pathname}`
      .replace(/[^a-zA-Z0-9._-]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .replace(/\.+/gu, ".")
      .slice(0, 60);
  const hash = sha256(normalize(parsed.href)).slice(0, 16);
  return `${readable === "" ? "route" : readable}-${hash}`;
}

function revisionSlug(revision: string): string {
  const sanitized = revision.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
  return sanitized === "" ? "unknown-revision" : sanitized.slice(0, 80);
}

function normalize(href: string): string {
  const parsed = new URL(href);
  parsed.hash = "";
  return parsed.href;
}

/** Query values can carry tokens or personal data, so only keys survive into public evidence. */
function redactUrl(parsed: URL): string {
  const copy = new URL(parsed.href);
  copy.username = "";
  copy.password = "";
  copy.hash = "";
  for (const key of [...new Set([...copy.searchParams.keys()])])
    copy.searchParams.set(key, "[REDACTED]");
  return copy.href;
}

function redactUrlString(href: string): string {
  try {
    return redactUrl(new URL(href));
  } catch {
    return "[UNPARSEABLE]";
  }
}

function safeFinalUrl(page: MinimalPage): string | undefined {
  try {
    return page.url();
  } catch {
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
async function resolveDriver(
  root: string,
  options: CliOptions
): Promise<{ chromium: MinimalChromium; identity: DriverIdentity } | { reason: string }> {
  const trusted = await loadFrom(PACKAGE_ROOT, "forge", PACKAGE_ROOT);
  if (trusted !== undefined) return trusted;

  if (!options.allowRun) {
    return {
      reason:
        "No Fullstack Forge-owned browser driver is installed, and importing the audited " +
        "project's driver executes that project's code. Re-run with --allow-run to authorize " +
        "importing the audited-project driver, or install a driver alongside Fullstack Forge. " +
        "Until then rendered-state criteria stay NOT_VERIFIED."
    };
  }
  if (options.offline) {
    return {
      reason:
        "Offline mode refuses to resolve a browser driver from the audited project because " +
        "resolution may trigger installation or network access. Rendered-state criteria stay " +
        "NOT_VERIFIED."
    };
  }
  const project = await loadFrom(root, "project", root);
  if (project !== undefined) return project;
  return {
    reason:
      "Playwright is not installed in the audited project. Install it as a devDependency " +
      "(npm i -D playwright && npx playwright install chromium) to enable rendered-UI evidence; " +
      "until then rendered-state criteria stay NOT_VERIFIED."
  };
}

async function loadFrom(
  from: string,
  source: DriverIdentity["source"],
  containment: string
): Promise<{ chromium: MinimalChromium; identity: DriverIdentity } | undefined> {
  const require = createRequire(join(from, "package.json"));
  for (const candidate of DRIVER_CANDIDATES) {
    let resolved: string;
    try {
      resolved = require.resolve(candidate);
    } catch {
      continue;
    }
    // Resolve symlinks before the containment check so a symlinked or redirected package inside the
    // audited repository cannot smuggle in code that lives outside the trust domain it claims.
    let real: string;
    try {
      real = await realpath(resolved);
    } catch {
      continue;
    }
    const realContainment = await realpath(containment).catch(() => containment);
    if (!isInside(realContainment, real)) continue;
    const version = await packageVersion(real, candidate, realContainment);
    const imported = (await import(pathToFileURL(real).href)) as {
      chromium?: MinimalChromium;
      default?: { chromium?: MinimalChromium };
    };
    const chromium = imported.chromium ?? imported.default?.chromium;
    if (chromium === undefined) continue;
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

async function packageVersion(
  entry: string,
  name: string,
  containment: string
): Promise<string | undefined> {
  let current = dirname(entry);
  // Never invent a version: walk up to the package manifest and report absence as unknown.
  while (isInside(containment, current)) {
    try {
      const manifest = JSON.parse(await readFile(join(current, "package.json"), "utf8")) as {
        name?: unknown;
        version?: unknown;
      };
      if (manifest.name === name && typeof manifest.version === "string") return manifest.version;
    } catch {
      // Keep walking: intermediate directories often have no manifest.
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}
