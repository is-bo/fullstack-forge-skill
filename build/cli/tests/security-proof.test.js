import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { classifyDestination } from "../src/destination-policy.js";
import { withTemporaryProject } from "./helpers.js";
/**
 * Two related failures are covered here.
 *
 * 1. Protection used to be granted from a callee *name*. A function called `validate`, `sanitize`,
 *    `assertAllowed`, `allowlist`, `trusted`, or `safe` suppressed findings whether or not it did
 *    anything, so a single no-op wrapper silenced the analyzer across every sink.
 * 2. A destination map used to be accepted as SSRF proof because it was a `const` object of URL
 *    strings — which blesses `http://127.0.0.1:3000/` and the cloud metadata endpoint, and ignores
 *    that `const` stops neither `MAP.key = req.query.url` nor `mutate(MAP)`.
 */
async function securityIds(name, source, section = "security") {
    let ids = new Set();
    await withTemporaryProject(name, async (root) => {
        await writeFile(join(root, "case.ts"), source, "utf8");
        const runs = await runAnalyzers(section, root);
        ids = new Set(runs.flatMap((run) => run.findings).map((finding) => finding.id));
    });
    return ids;
}
/** Every helper below is a deliberate no-op with a maximally reassuring name. */
const NO_OP_HELPERS = `function parse(value) { return value; }
function validate(value) { return value; }
function assertValid(value) { return value; }
function sanitize(value) { return value; }
function allowlist(value) { return value; }
function assertAllowed(value) { return value; }
function requireAllowed(value) { return value; }
function allowedValue(value) { return value; }
function trusted(value) { return value; }
function safe(value) { return value; }
`;
const NAMES = [
    "parse",
    "validate",
    "assertValid",
    "sanitize",
    "allowlist",
    "assertAllowed",
    "requireAllowed",
    "allowedValue",
    "trusted",
    "safe"
];
test("no-op helpers never suppress SQL injection", async () => {
    for (const name of NAMES) {
        const ids = await securityIds(`noop-sql-${name}`, `${NO_OP_HELPERS}
export async function load(req, db) {
  const id = ${name}(req.params.id);
  return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}`);
        assert.ok(ids.has("FF-SEC-SQL-001"), `${name} must not launder a SQL sink argument`);
    }
});
test("no-op helpers never suppress shell injection", async () => {
    for (const name of NAMES) {
        const ids = await securityIds(`noop-shell-${name}`, `${NO_OP_HELPERS}
import { exec, spawn } from "node:child_process";
export function run(req) {
  exec(${name}(req.body.command));
  return spawn("git", ["show", ${name}(req.query.ref)], { shell: false });
}`);
        assert.ok(ids.has("FF-SEC-SHELL-001"), `${name} must not prove shell argument safety`);
    }
});
test("no-op helpers never suppress SSRF", async () => {
    for (const name of NAMES) {
        const ids = await securityIds(`noop-ssrf-${name}`, `${NO_OP_HELPERS}
export function proxy(req) {
  return fetch(${name}(req.query.url), { redirect: "manual" });
}`);
        assert.ok(ids.has("FF-SEC-SSRF-001"), `${name} must not prove a destination is external`);
    }
});
test("no-op helpers never suppress an open redirect", async () => {
    for (const name of NAMES) {
        const ids = await securityIds(`noop-redirect-${name}`, `${NO_OP_HELPERS}
export function handler(req, res) {
  return res.redirect(${name}(req.query.next));
}`);
        assert.ok(ids.has("FF-SEC-REDIRECT-001"), `${name} must not prove a redirect target is local`);
    }
});
test("no-op helpers never suppress mass assignment", async () => {
    for (const name of NAMES) {
        const ids = await securityIds(`noop-mass-${name}`, `${NO_OP_HELPERS}
export async function update(req, prisma) {
  return prisma.user.update({ where: { id: req.params.id }, data: ${name}(req.body) });
}`);
        assert.ok(ids.has("FF-SEC-MASS-ASSIGN-001"), `${name} must not prove a request body is field-bounded`);
    }
});
test("no-op helpers never suppress an unrestricted upload boundary", async () => {
    const ids = await securityIds("noop-upload", `${NO_OP_HELPERS}
import multer from "multer";
const upload = multer({ dest: "uploads/" });
export const route = upload.any();
export function store(req) {
  return writeFile(safe(req.file.originalname), req.file.buffer);
}`, "uploads");
    assert.ok(ids.has("FF-UPLOAD-ANY-001"), "an unrestricted multipart boundary stays reported");
    assert.ok(ids.has("FF-UPLOAD-FILENAME-001"), "a no-op wrapper around a client-supplied filename proves nothing");
});
test("no-op helpers never suppress an irreversible AI action sink", async () => {
    const ids = await securityIds("noop-ai", `${NO_OP_HELPERS}
export async function agent(req, model, billing) {
  const completion = await model.invoke({ prompt: trusted(req.body.prompt) });
  return billing.refund(safe(completion.text));
}`, "ai");
    assert.ok(ids.has("FF-AI-IRREVERSIBLE-001"), `a no-op wrapper must not clear an irreversible AI action; got ${[...ids].join(", ")}`);
});
test("structurally proven protections still resolve their findings", async () => {
    const shell = await securityIds("proven-shell", `import { spawn } from "node:child_process";
export function run(req) {
  const ref = z.string().regex(/^[a-z0-9-]+$/).parse(req.query.ref);
  return spawn("git", ["show", ref], { shell: false });
}`);
    assert.ok(!shell.has("FF-SEC-SHELL-001"), "a supported schema API plus argument separation holds");
    const sql = await securityIds("proven-sql", `export async function load(req, db) {
  return db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
}`);
    assert.ok(!sql.has("FF-SEC-SQL-001"), "driver parameter binding remains structural proof");
});
test("a same-file helper is judged by its analyzed body, not its name", async () => {
    const laundering = await securityIds("helper-identity", `function toSafeRef(value) { return value; }
import { spawn } from "node:child_process";
export function run(req) {
  return spawn("git", ["show", toSafeRef(req.query.ref)], { shell: false });
}`);
    assert.ok(laundering.has("FF-SEC-SHELL-001"), "an identity helper proves nothing");
    const analyzed = await securityIds("helper-analyzed", `function toSafeRef(value) { return z.string().regex(/^[a-z0-9-]+$/).parse(value); }
import { spawn } from "node:child_process";
export function run(req) {
  return spawn("git", ["show", toSafeRef(req.query.ref)], { shell: false });
}`);
    assert.ok(!analyzed.has("FF-SEC-SHELL-001"), "a helper whose body is a supported schema call is actually analyzed");
});
/* ------------------------------------------------------------------ destination map proof --- */
const REDIRECT_SAFE_SINK = 'fetch(destination, { redirect: "manual" })';
function mapCase(declaration, extra = "") {
    return `${declaration}
${extra}
export function proxy(req) {
  const destination = DESTINATIONS[req.query.key];
  return ${REDIRECT_SAFE_SINK};
}`;
}
test("a property write on the destination map defeats the proof", async () => {
    const ids = await securityIds("map-property-write", mapCase(`const DESTINATIONS = { docs: "https://docs.example.com/" };`, "DESTINATIONS.docs = req.query.url;"));
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("a deleted destination entry defeats the proof", async () => {
    const ids = await securityIds("map-delete", mapCase(`const DESTINATIONS = { docs: "https://docs.example.com/" };`, "delete DESTINATIONS.docs;"));
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("a frozen map of cloud-metadata destinations is not safe", async () => {
    const ids = await securityIds("map-metadata", mapCase(`const DESTINATIONS = Object.freeze({ metadata: "http://169.254.169.254/latest/meta-data/" });`));
    assert.ok(ids.has("FF-SEC-SSRF-001"), "the metadata endpoint is the SSRF target, not the defence");
});
test("a frozen map of loopback destinations is not safe", async () => {
    const ids = await securityIds("map-loopback", mapCase(`const DESTINATIONS = Object.freeze({ local: "http://127.0.0.1:3000/" });`));
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("passing the map to an unknown function defeats the proof", async () => {
    const ids = await securityIds("map-unknown-call", mapCase(`const DESTINATIONS = Object.freeze({ docs: "https://docs.example.com/" });`, "mutate(DESTINATIONS);"));
    assert.ok(ids.has("FF-SEC-SSRF-001"), "Object.freeze does not bound what mutate() may do");
});
test("aliasing the map into another binding defeats the proof", async () => {
    const ids = await securityIds("map-alias", mapCase(`const DESTINATIONS = { docs: "https://docs.example.com/" };`, `const alias = DESTINATIONS;
alias.docs = req.query.url;`));
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("exporting or returning the map defeats the proof", async () => {
    const exported = await securityIds("map-exported", `export const DESTINATIONS = { docs: "https://docs.example.com/" };
export function proxy(req) {
  const destination = DESTINATIONS[req.query.key];
  return ${REDIRECT_SAFE_SINK};
}`);
    assert.ok(exported.has("FF-SEC-SSRF-001"));
    const returned = await securityIds("map-returned", mapCase(`const DESTINATIONS = { docs: "https://docs.example.com/" };`, "function leak() { return DESTINATIONS; }"));
    assert.ok(returned.has("FF-SEC-SSRF-001"));
});
test("a proven immutable map of external destinations still suppresses SSRF", async () => {
    const ids = await securityIds("map-known-safe", mapCase(`const DESTINATIONS = Object.freeze({
  docs: "https://docs.example.com/",
  support: "https://support.example.com/"
});`));
    assert.ok(!ids.has("FF-SEC-SSRF-001"));
});
test("a proven map without a redirect constraint does not suppress SSRF", async () => {
    const ids = await securityIds("map-redirect-unbounded", `const DESTINATIONS = Object.freeze({ docs: "https://docs.example.com/" });
export function proxy(req) {
  return fetch(DESTINATIONS[req.query.key]);
}`);
    assert.ok(ids.has("FF-SEC-SSRF-001"), "a following redirect can leave the proven destination");
});
test("a proven destination concatenated with request data loses the proof", async () => {
    const ids = await securityIds("map-concatenated", `const DESTINATIONS = Object.freeze({ docs: "https://docs.example.com/" });
export function proxy(req) {
  const destination = DESTINATIONS[req.query.key] + req.query.path;
  return fetch(destination, { redirect: "manual" });
}`);
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("literal destination classification refuses every internal range", () => {
    const unsafe = [
        "http://127.0.0.1/",
        "http://127.255.255.254/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://172.31.255.255/",
        "http://192.168.1.1/",
        "http://169.254.169.254/",
        "http://169.254.1.1/",
        "http://0.0.0.0/",
        "http://100.64.0.1/",
        "http://224.0.0.1/",
        "http://240.0.0.1/",
        "http://255.255.255.255/",
        "http://[::1]/",
        "http://[::]/",
        "http://[fc00::1]/",
        "http://[fd00::1]/",
        "http://[fe80::1]/",
        "http://[ff02::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://[::ffff:169.254.169.254]/",
        "http://localhost/",
        "http://localhost./",
        "http://api.localhost/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://user:secret@docs.example.com/",
        "ftp://docs.example.com/",
        "file:///etc/passwd",
        "/relative/path"
    ];
    for (const value of unsafe)
        assert.equal(classifyDestination(value).safe, false, `${value} must not be treated as external`);
});
test("literal destination classification accepts genuinely external destinations", () => {
    for (const value of [
        "https://docs.example.com/",
        "https://93.184.216.34/",
        "http://[2606:2800::1]/"
    ])
        assert.equal(classifyDestination(value).safe, true, `${value} should be external`);
});
test("hostname destinations are accepted but recorded as DNS-dependent", () => {
    const verdict = classifyDestination("https://docs.example.com/");
    assert.equal(verdict.safe, true);
    assert.equal(verdict.dns_dependent, true, "no resolution is performed, so DNS rebinding stays outside the proof");
    assert.equal(classifyDestination("https://93.184.216.34/").dns_dependent, false);
});
/**
 * An address guard used to be credited from its callee *name*, so a no-op named `isPrivate`
 * suppressed SSRF while blocking nothing. Only a same-file implementation whose behavior is
 * actually modeled may suppress the finding.
 */
const ADDRESS_GUARD_NAMES = ["isPrivate", "isLinkLocal", "isInternal", "privateAddress"];
test("no-op address guards never suppress SSRF", async () => {
    for (const name of ADDRESS_GUARD_NAMES) {
        const ids = await securityIds(`noop-address-${name}`, `const ALLOWED = new Set(["https://docs.example.com/"]);
function ${name}(value) {
  return false;
}
export function proxy(req) {
  if (!ALLOWED.has(req.query.url)) throw new Error("denied");
  if (${name}(req.query.url)) throw new Error("blocked");
  return fetch(req.query.url, { redirect: "manual" });
}`);
        assert.ok(ids.has("FF-SEC-SSRF-001"), `a no-op ${name} must not prove the destination is public`);
    }
});
test("an address guard with no local implementation stays unverified", async () => {
    const ids = await securityIds("imported-address-guard", `import { isPrivate } from "netutils";
const ALLOWED = new Set(["https://docs.example.com/"]);
export function proxy(req) {
  if (!ALLOWED.has(req.query.url)) throw new Error("denied");
  if (isPrivate(req.query.url)) throw new Error("blocked");
  return fetch(req.query.url, { redirect: "manual" });
}`);
    assert.ok(ids.has("FF-SEC-SSRF-001"), "an unmodeled imported guard must be reported, not credited");
});
test("a modeled address guard still suppresses SSRF", async () => {
    const ids = await securityIds("modeled-address-guard", `const ALLOWED = new Set(["https://docs.example.com/"]);
function isPrivate(host) {
  return (
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host === "::1"
  );
}
export function proxy(req) {
  if (!ALLOWED.has(req.query.url)) throw new Error("denied");
  if (isPrivate(req.query.url)) throw new Error("blocked");
  return fetch(req.query.url, { redirect: "manual" });
}`);
    assert.ok(!ids.has("FF-SEC-SSRF-001"), "a genuine structurally proven address guard must still suppress");
});
