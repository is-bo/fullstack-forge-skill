import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";

const ROUTE = "FF-AUTHZ-ROUTE-001";
const UNRESOLVED = "FF-AUTHZ-NOT-VERIFIED-001";

/** The sensitive route under test; only the guard in front of it varies between cases. */
const ROUTE_SOURCE = (importLine: string, guard: string) =>
  `${importLine}
app.delete("/accounts/:id", ${guard}, async (req, res) => {
  await db.account.delete({ where: { id: req.params.id } });
  res.end();
});
`;

async function authorizationIds(name: string, files: Record<string, string>) {
  let ids = new Set<string>();
  await withTemporaryProject(name, async (root) => {
    for (const [relative, source] of Object.entries(files)) {
      const full = join(root, relative);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, source, "utf8");
    }
    const findings = (await runAnalyzers("authorization", root)).flatMap((run) => run.findings);
    ids = new Set(findings.map((finding) => finding.id));
  });
  return ids;
}

const DENYING_BODY = `  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "denied" });
  next();`;
const PERMISSIVE_BODY = `  console.log("checking", req.user);
  next();`;

test("a directly imported local guard is resolved and the route is clean", async () => {
  const ids = await authorizationIds("guard-direct-import", {
    "middleware/auth.ts": `export function ensureAdmin(req, res, next) {\n${DENYING_BODY}\n}\n`,
    "routes.ts": ROUTE_SOURCE(`import { ensureAdmin } from "./middleware/auth.js";`, "ensureAdmin")
  });
  assert.ok(!ids.has(ROUTE), "a resolved denying guard must not be reported");
});

test("a renamed import is resolved through its original declaration", async () => {
  const ids = await authorizationIds("guard-renamed-import", {
    "middleware/auth.ts": `export function ensureAdmin(req, res, next) {\n${DENYING_BODY}\n}\n`,
    "routes.ts": ROUTE_SOURCE(`import { ensureAdmin as gate } from "./middleware/auth.js";`, "gate")
  });
  assert.ok(!ids.has(ROUTE), "a renamed import must resolve to the same body");
});

test("a default-exported guard is resolved", async () => {
  const ids = await authorizationIds("guard-default-export", {
    "middleware/auth.ts": `export default function guardRoute(req, res, next) {\n${DENYING_BODY}\n}\n`,
    "routes.ts": ROUTE_SOURCE(`import guardRoute from "./middleware/auth.js";`, "guardRoute")
  });
  assert.ok(!ids.has(ROUTE), "a default export must resolve");
});

test("a barrel re-export is followed to the real guard", async () => {
  const ids = await authorizationIds("guard-barrel", {
    "middleware/real.ts": `export function checkAccess(req, res, next) {\n${DENYING_BODY}\n}\n`,
    "middleware/index.ts": `export { checkAccess } from "./real.js";\n`,
    "routes.ts": ROUTE_SOURCE(`import { checkAccess } from "./middleware/index.js";`, "checkAccess")
  });
  assert.ok(!ids.has(ROUTE), "a barrel re-export must resolve");
});

test("cyclic imports terminate without reporting a resolved guard as absent", async () => {
  const ids = await authorizationIds("guard-cyclic", {
    "middleware/a.ts": `export { guardB as guardA } from "./b.js";\n`,
    "middleware/b.ts": `export { guardA as guardB } from "./a.js";\n`,
    "routes.ts": ROUTE_SOURCE(`import { guardA } from "./middleware/a.js";`, "guardA")
  });
  // The contract is that resolution terminates and stays honest rather than inventing a verdict.
  assert.ok(ids.has(UNRESOLVED), "a cycle is unresolvable and must be reported as such");
  assert.ok(!ids.has(ROUTE), "a cycle must not become a confident route failure");
});

test("an authorization-style name with no rejection is not trusted", async () => {
  const ids = await authorizationIds("guard-misleading-name", {
    "middleware/auth.ts": `export function requireAdmin(req, res, next) {\n${PERMISSIVE_BODY}\n}\n`,
    "routes.ts": ROUTE_SOURCE(
      `import { requireAdmin } from "./middleware/auth.js";`,
      "requireAdmin"
    )
  });
  assert.ok(
    ids.has(ROUTE),
    "a middleware named requireAdmin that never denies must not be accepted as a guard"
  );
});

test("an unrelated name containing a real rejection is recognised", async () => {
  const ids = await authorizationIds("guard-honest-odd-name", {
    "middleware/gate.ts": `export function tollbooth(req, res, next) {\n${DENYING_BODY}\n}\n`,
    "routes.ts": ROUTE_SOURCE(`import { tollbooth } from "./middleware/gate.js";`, "tollbooth")
  });
  assert.ok(!ids.has(ROUTE), "recognition must follow the body, not the identifier");
});

test("a middleware factory is followed into the handler it returns", async () => {
  const ids = await authorizationIds("guard-factory", {
    "middleware/auth.ts": `export function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) return res.sendStatus(403);
    next();
  };
}
`,
    "routes.ts": ROUTE_SOURCE(
      `import { requireRole } from "./middleware/auth.js";`,
      `requireRole("admin")`
    )
  });
  assert.ok(!ids.has(ROUTE), "a factory returning a denying handler must resolve");
});

test("a two-hop local wrapper is resolved within the hop budget", async () => {
  const ids = await authorizationIds("guard-two-hop", {
    "middleware/base.ts": `export function denyUnlessAdmin(req, res, next) {\n${DENYING_BODY}\n}\n`,
    "middleware/wrap.ts": `export { denyUnlessAdmin as wrapped } from "./base.js";\n`,
    "routes.ts": ROUTE_SOURCE(`import { wrapped } from "./middleware/wrap.js";`, "wrapped")
  });
  assert.ok(!ids.has(ROUTE), "two local hops must stay resolvable");
});

test("middleware from an external package is NOT_VERIFIED rather than proven", async () => {
  const ids = await authorizationIds("guard-external-package", {
    "routes.ts": ROUTE_SOURCE(`import { requireAuth } from "@clerk/express";`, "requireAuth")
  });
  assert.ok(ids.has(UNRESOLVED), "an unreadable external guard must be reported as unresolved");
  assert.ok(!ids.has(ROUTE), "an unresolved guard must not become a confident route failure");
});

test("a dynamically imported guard is not treated as proven", async () => {
  const ids = await authorizationIds("guard-dynamic-import", {
    "routes.ts": `const mod = await import("./middleware/auth.js");
app.delete("/accounts/:id", mod.requireAdmin, async (req, res) => {
  await db.account.delete({ where: { id: req.params.id } });
  res.end();
});
`
  });
  assert.ok(ids.has(UNRESOLVED), "a dynamic import is unresolvable and must be reported as such");
  assert.ok(!ids.has(ROUTE), "an unresolved dynamic guard must not become a confident failure");
});
