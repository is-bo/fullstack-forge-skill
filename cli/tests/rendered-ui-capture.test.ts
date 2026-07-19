import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { captureRenderedUi } from "../src/rendered-ui.js";
import { withTemporaryProject } from "./helpers.js";

const LOOPBACK = "http://127.0.0.1:3000/dashboard";
const RELATIVE_DIR = join(".forge", "evidence", "ui", "rev", "run", "route");

type FakeSpec = {
  launchError?: string;
  newPageError?: string;
  closeError?: string;
  /** Viewport indices (0=desktop, 1=tablet, 2=mobile) whose navigation throws. */
  failNavigation?: number[];
  /** Viewport indices whose screenshot call throws. */
  failScreenshot?: number[];
  /** Viewport indices where screenshot resolves but writes no file. */
  skipWrite?: number[];
  console?: Array<{ type: string; text: string }>;
  pageErrors?: string[];
  /** URLs the page "requests" during each navigation, fed through the interceptor. */
  requests?: string[];
  supportsRoute?: boolean;
  supportsInitScript?: boolean;
  finalUrl?: string;
};

type FakeRecorder = {
  closeCalls: number;
  allowed: string[];
  aborted: string[];
  initScripts: string[];
  /**
   * Destinations that actually reached the network layer. A blocked request must never appear here,
   * which is the deterministic stand-in for "no DNS lookup and no connection was attempted".
   */
  reachedNetwork: string[];
};

type Chromium = Parameters<typeof captureRenderedUi>[0];

function fakeChromium(spec: FakeSpec, recorder: FakeRecorder): Chromium {
  return {
    launch: () => {
      if (spec.launchError !== undefined) throw new Error(spec.launchError);
      let viewportIndex = -1;
      let routeHandler:
        | ((
            route: { abort(code?: string): Promise<void>; continue(): Promise<void> },
            request: { url(): string; resourceType?(): string }
          ) => void | Promise<void>)
        | undefined;

      const page = {
        setDefaultTimeout: () => undefined,
        setViewportSize: () => {
          viewportIndex += 1;
          return Promise.resolve();
        },
        goto: async (target: string) => {
          if ((spec.failNavigation ?? []).includes(viewportIndex))
            throw new Error(`navigation failed for viewport ${viewportIndex}`);
          // Only the first navigation emits console output, mirroring a real page load.
          if (viewportIndex === 0) {
            for (const entry of spec.console ?? [])
              consoleHandler?.({ type: () => entry.type, text: () => entry.text });
            for (const message of spec.pageErrors ?? []) pageErrorHandler?.(new Error(message));
          }
          for (const requested of [target, ...(spec.requests ?? [])]) {
            if (routeHandler === undefined) {
              recorder.reachedNetwork.push(requested);
              continue;
            }
            await routeHandler(
              {
                abort: () => {
                  recorder.aborted.push(requested);
                  return Promise.resolve();
                },
                continue: () => {
                  recorder.allowed.push(requested);
                  recorder.reachedNetwork.push(requested);
                  return Promise.resolve();
                }
              },
              { url: () => requested, resourceType: () => "script" }
            );
          }
          return undefined;
        },
        screenshot: async (options: { path: string }) => {
          if ((spec.failScreenshot ?? []).includes(viewportIndex))
            throw new Error(`screenshot failed for viewport ${viewportIndex}`);
          if ((spec.skipWrite ?? []).includes(viewportIndex)) return undefined;
          await writeFile(options.path, `png-${viewportIndex}`, "utf8");
          return undefined;
        },
        url: () => spec.finalUrl ?? LOOPBACK,
        on: (event: string, handler: unknown) => {
          if (event === "console")
            consoleHandler = handler as (m: { type(): string; text(): string }) => void;
          if (event === "pageerror") pageErrorHandler = handler as (e: Error) => void;
        },
        ...(spec.supportsRoute === false
          ? {}
          : {
              route: (_pattern: string, handler: typeof routeHandler) => {
                routeHandler = handler;
                return Promise.resolve();
              }
            }),
        ...(spec.supportsInitScript === false
          ? {}
          : {
              addInitScript: (script: string) => {
                recorder.initScripts.push(script);
                return Promise.resolve();
              }
            })
      };
      let consoleHandler: ((m: { type(): string; text(): string }) => void) | undefined;
      let pageErrorHandler: ((e: Error) => void) | undefined;

      return Promise.resolve({
        newPage: () => {
          if (spec.newPageError !== undefined) throw new Error(spec.newPageError);
          return Promise.resolve(page);
        },
        close: () => {
          recorder.closeCalls += 1;
          if (spec.closeError !== undefined) throw new Error(spec.closeError);
          return Promise.resolve();
        }
      });
    }
  };
}

function recorder(): FakeRecorder {
  return { closeCalls: 0, allowed: [], aborted: [], initScripts: [], reachedNetwork: [] };
}

async function capture(
  spec: FakeSpec,
  overrides: { offline?: boolean } = {}
): Promise<{
  outcome: Awaited<ReturnType<typeof captureRenderedUi>>;
  record: FakeRecorder;
}> {
  let outcome!: Awaited<ReturnType<typeof captureRenderedUi>>;
  const record = recorder();
  await withTemporaryProject(`capture-${Math.random().toString(36).slice(2, 10)}`, async (root) => {
    const evidenceDirectory = join(root, RELATIVE_DIR);
    await mkdir(evidenceDirectory, { recursive: true });
    outcome = await captureRenderedUi(fakeChromium(spec, record), {
      url: LOOPBACK,
      offline: overrides.offline ?? false,
      evidenceDirectory,
      relativeEvidenceDir: RELATIVE_DIR
    });
  });
  return { outcome, record };
}

test("a fully successful capture across every viewport is COMPLETE", async () => {
  const { outcome, record } = await capture({});
  assert.equal(outcome.capture_status, "COMPLETE");
  assert.equal(outcome.viewports.length, 3);
  assert.ok(outcome.viewports.every((viewport) => viewport.status === "PASS"));
  assert.equal(outcome.screenshots.length, 3);
  assert.ok(outcome.viewports.every((viewport) => (viewport.sha256 ?? "").length === 64));
  assert.equal(record.closeCalls, 1, "the browser is closed exactly once");
});

test("every navigation failing yields FAILED with no screenshots", async () => {
  const { outcome, record } = await capture({ failNavigation: [0, 1, 2] });
  assert.equal(outcome.capture_status, "FAILED");
  assert.equal(outcome.screenshots.length, 0);
  assert.ok(outcome.viewports.every((viewport) => viewport.status === "FAIL"));
  assert.equal(record.closeCalls, 1, "cleanup still runs when every viewport fails");
});

test("one succeeding viewport and two failures is PARTIAL, never COMPLETE", async () => {
  const { outcome } = await capture({ failNavigation: [1, 2] });
  assert.equal(outcome.capture_status, "PARTIAL");
  assert.equal(outcome.screenshots.length, 1);
  // Partial evidence is preserved rather than discarded.
  assert.equal(outcome.viewports.filter((viewport) => viewport.status === "PASS").length, 1);
  assert.equal(outcome.viewports.filter((viewport) => viewport.status === "FAIL").length, 2);
});

test("a screenshot failure degrades that viewport and the overall status", async () => {
  const { outcome } = await capture({ failScreenshot: [2] });
  assert.equal(outcome.capture_status, "PARTIAL");
  const mobile = outcome.viewports.find((viewport) => viewport.name === "mobile");
  assert.ok(mobile?.error !== undefined);
  assert.equal(mobile.status, "FAIL");
  assert.match(mobile.error, /screenshot failed/u);
});

test("a screenshot that writes no artifact is a failure, not a silent pass", async () => {
  const { outcome } = await capture({ skipWrite: [0] });
  assert.equal(outcome.capture_status, "PARTIAL");
  const desktop = outcome.viewports.find((viewport) => viewport.name === "desktop");
  assert.ok(desktop?.error !== undefined);
  assert.equal(desktop.status, "FAIL");
  assert.match(desktop.error, /artifact missing/u);
  assert.equal(outcome.screenshots.length, 2);
});

test("a browser launch failure is FAILED and records no fabricated evidence", async () => {
  const { outcome, record } = await capture({ launchError: "chromium binary not found" });
  assert.equal(outcome.capture_status, "FAILED");
  assert.equal(outcome.screenshots.length, 0);
  assert.equal(record.closeCalls, 0, "nothing to close when launch never succeeded");
  assert.match(outcome.limitations.join(" "), /Browser launch failed/u);
});

test("a browser close failure is recorded honestly without discarding evidence", async () => {
  const { outcome, record } = await capture({ closeError: "close timed out" });
  assert.equal(record.closeCalls, 1);
  assert.match(outcome.limitations.join(" "), /Browser close failed/u);
  // The captured evidence is still complete; only cleanup failed.
  assert.equal(outcome.capture_status, "COMPLETE");
  assert.equal(outcome.screenshots.length, 3);
});

test("a failure while creating the page still runs cleanup and reports FAILED", async () => {
  const { outcome, record } = await capture({ newPageError: "target crashed" });
  assert.equal(outcome.capture_status, "FAILED");
  assert.equal(record.closeCalls, 1, "cleanup runs after a launch-success path");
});

test("console errors are captured without affecting capture completeness", async () => {
  const { outcome } = await capture({
    console: [
      { type: "error", text: "Uncaught TypeError" },
      { type: "warning", text: "deprecated API" }
    ],
    pageErrors: ["render crashed"]
  });
  assert.equal(outcome.capture_status, "COMPLETE");
  const types = outcome.console_entries.map((entry) => entry.type);
  assert.deepEqual(types, ["error", "warning", "pageerror"]);
});

test("offline mode aborts every non-loopback request before it reaches the network", async () => {
  const { outcome, record } = await capture(
    {
      requests: [
        "http://127.0.0.1:3000/app.js", // same-origin script: allowed
        "https://cdn.example.com/analytics.js", // remote script
        "https://images.example.com/logo.png", // remote image
        "https://fonts.example.com/f.woff2", // remote font
        "https://api.example.com/data?token=abc", // remote fetch/XHR
        "https://frames.example.com/embed", // remote iframe
        "https://worker.example.com/w.js", // remote worker
        "wss://live.example.com/socket" // remote websocket
      ]
    },
    { offline: true }
  );

  const remote = record.reachedNetwork.filter((url) => !url.includes("127.0.0.1"));
  assert.deepEqual(remote, [], "no non-loopback destination may reach the network layer");
  // Each of the three viewports renavigates, so every remote request is aborted on every pass.
  assert.equal(record.aborted.length, 21, "every remote request is aborted on every navigation");
  assert.ok(record.allowed.every((url) => url.includes("127.0.0.1")));
  assert.equal(outcome.blocked_requests.length, 7);
  // Blocked resources mean the page did not render completely.
  assert.equal(outcome.capture_status, "PARTIAL");
});

test("offline mode blocks a redirect to a public hostname", async () => {
  // A redirect surfaces as a fresh request for the new destination, which the interceptor sees.
  const { outcome, record } = await capture(
    {
      requests: ["https://evil.example.com/landing"],
      finalUrl: "https://evil.example.com/landing"
    },
    { offline: true }
  );
  assert.deepEqual(
    record.reachedNetwork.filter((url) => url.includes("evil.example.com")),
    []
  );
  assert.equal(outcome.blocked_requests.length, 1);
  const [redirectBlock] = outcome.blocked_requests;
  assert.ok(redirectBlock !== undefined);
  assert.match(redirectBlock.reason, /loopback only/u);
});

test("blocked request URLs are redacted before they are recorded", async () => {
  const sentinel = "sentinel-blocked-00001111222233334444";
  const { outcome } = await capture(
    { requests: [`https://api.example.com/data?token=${sentinel}#${sentinel}`] },
    { offline: true }
  );
  const serialized = JSON.stringify(outcome);
  assert.ok(!serialized.includes(sentinel), "no raw secret may enter blocked-request evidence");
  assert.equal(outcome.blocked_requests.length, 1);
  // The destination stays identifiable without its secrets.
  assert.match(outcome.blocked_requests[0]?.url ?? "", /api\.example\.com/u);
});

test("offline mode installs the websocket guard and records transport limitations", async () => {
  const { outcome, record } = await capture({}, { offline: true });
  assert.equal(record.initScripts.length, 1);
  const [guard] = record.initScripts;
  assert.ok(guard !== undefined);
  assert.match(guard, /WebSocket/u);
  assert.match(outcome.limitations.join(" "), /NOT_VERIFIED/u);
});

test("offline mode refuses a driver that cannot intercept requests", async () => {
  const { outcome, record } = await capture({ supportsRoute: false }, { offline: true });
  assert.equal(outcome.capture_status, "BLOCKED");
  assert.equal(outcome.screenshots.length, 0);
  assert.match(outcome.blocked_reason ?? "", /cannot intercept requests/u);
  assert.equal(record.reachedNetwork.length, 0, "no navigation may be attempted");
  assert.equal(record.closeCalls, 1, "the refused browser is still closed");
});

test("a driver without init-script support records the websocket gap honestly", async () => {
  const { outcome } = await capture({ supportsInitScript: false }, { offline: true });
  assert.match(outcome.limitations.join(" "), /WebSocket connections could not be guarded/u);
});

test("online mode intercepts nothing and reaches every destination", async () => {
  const { outcome, record } = await capture({
    requests: ["https://cdn.example.com/analytics.js"]
  });
  assert.equal(outcome.blocked_requests.length, 0);
  assert.ok(record.reachedNetwork.includes("https://cdn.example.com/analytics.js"));
  assert.equal(outcome.capture_status, "COMPLETE");
});

test("captured screenshot hashes match the bytes actually written to disk", async () => {
  await withTemporaryProject("capture-hash", async (root) => {
    const evidenceDirectory = join(root, RELATIVE_DIR);
    await mkdir(evidenceDirectory, { recursive: true });
    const outcome = await captureRenderedUi(fakeChromium({}, recorder()), {
      url: LOOPBACK,
      offline: false,
      evidenceDirectory,
      relativeEvidenceDir: RELATIVE_DIR
    });
    for (const shot of outcome.screenshots) {
      const bytes = await readFile(join(root, shot.path));
      const { createHash } = await import("node:crypto");
      assert.equal(shot.sha256, createHash("sha256").update(bytes).digest("hex"));
    }
  });
});
