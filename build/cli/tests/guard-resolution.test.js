import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";
const ROUTE = "FF-AUTHZ-ROUTE-001";
const UNRESOLVED = "FF-AUTHZ-NOT-VERIFIED-001";
/** The sensitive route under test; only the guard in front of it varies between cases. */
const ROUTE_SOURCE = (importLine, guard) => `${importLine}
app.delete("/accounts/:id", ${guard}, async (req, res) => {
  await db.account.delete({ where: { id: req.params.id } });
  res.end();
});
`;
async function authorizationFindings(name, files) {
    return withTemporaryProject(name, async (root) => {
        for (const [relative, source] of Object.entries(files)) {
            const full = join(root, relative);
            await mkdir(dirname(full), { recursive: true });
            await writeFile(full, source, "utf8");
        }
        return (await runAnalyzers("authorization", root)).flatMap((run) => run.findings);
    });
}
async function authorizationIds(name, files) {
    return new Set((await authorizationFindings(name, files)).map((finding) => finding.id));
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
        "routes.ts": ROUTE_SOURCE(`import { requireAdmin } from "./middleware/auth.js";`, "requireAdmin")
    });
    assert.ok(ids.has(ROUTE), "a middleware named requireAdmin that never denies must not be accepted as a guard");
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
        "routes.ts": ROUTE_SOURCE(`import { requireRole } from "./middleware/auth.js";`, `requireRole("admin")`)
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
/*
 * Authorization precision.
 *
 * Every middleware below terminates the request with 401 or 403. Only the ones whose terminating
 * branch is controlled by an authorization question may clear the route; a status code paired with
 * a CSRF, quota, MIME, or rate-limit predicate must leave the route reported.
 */
/** Middleware that reject for a reason that says nothing about the caller's authority. */
const UNRELATED_MIDDLEWARE = {
    csrf: `export function verifyCsrf(req, res, next) {
  if (req.headers["x-csrf-token"] !== req.body._csrf)
    return res.status(403).json({ error: "invalid csrf token" });
  next();
}
`,
    quota: `const MONTHLY_QUOTA = 1000;
export function enforceQuota(req, res, next) {
  const used = counters.get(req.user.id) ?? 0;
  if (used >= MONTHLY_QUOTA) return res.status(403).json({ error: "quota exceeded" });
  next();
}
`,
    mime: `const ALLOWED_MIME_TYPES = ["image/png"];
export function onlyImages(req, res, next) {
  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype))
    return res.status(403).send("unsupported type");
  next();
}
`,
    rateLimit: `export function limitRequests(req, res, next) {
  const hits = bucket.take(req.ip);
  if (hits > 60) return res.sendStatus(429);
  if (bucket.isBanned(req.ip)) return res.status(403).end();
  next();
}
`,
    maintenance: `export function maintenanceWindow(req, res, next) {
  if (config.maintenance) return res.status(403).send("maintenance");
  next();
}
`,
    featureFlag: `export function featureGate(req, res, next) {
  if (!flags.featureFlag("accounts.delete")) return res.status(403).end();
  next();
}
`,
    geography: `export function regionGate(req, res, next) {
  if (!SERVED_COUNTRIES.has(req.headers["cf-ipcountry"])) return res.status(451).end();
  if (geoBlocked(req.ip)) return res.status(403).end();
  next();
}
`,
    shape: `export function validateBody(req, res, next) {
  if (!requestSchema.safeParse(req.body).success) return res.status(400).end();
  if (typeof req.params.id !== "string") return res.status(403).end();
  next();
}
`
};
const UNRELATED_EXPORTS = {
    csrf: "verifyCsrf",
    quota: "enforceQuota",
    mime: "onlyImages",
    rateLimit: "limitRequests",
    maintenance: "maintenanceWindow",
    featureFlag: "featureGate",
    geography: "regionGate",
    shape: "validateBody"
};
for (const [concern, source] of Object.entries(UNRELATED_MIDDLEWARE)) {
    const exported = UNRELATED_EXPORTS[concern];
    test(`a ${concern} rejection is not accepted as an authorization guard`, async () => {
        const ids = await authorizationIds(`guard-unrelated-${concern}`, {
            "middleware/unrelated.ts": source,
            "routes.ts": ROUTE_SOURCE(`import { ${exported} } from "./middleware/unrelated.js";`, exported ?? "")
        });
        assert.ok(ids.has(ROUTE), `a ${concern} rejection answers 401/403 without deciding authority and must not clear the route`);
        assert.ok(!ids.has(UNRESOLVED), "the body was read, so the verdict is a failure, not unknown");
    });
}
/** Guards whose terminating branch is controlled by a genuine authorization question. */
const AUTHORIZATION_MIDDLEWARE = {
    role: [
        "requireEditorRole",
        `export function requireEditorRole(req, res, next) {
  if (req.user.role !== "editor") return res.status(403).end();
  next();
}
`
    ],
    ownership: [
        "requireOwnership",
        `export async function requireOwnership(req, res, next) {
  const account = await db.account.findUnique({ where: { id: req.params.id } });
  if (account.ownerId !== req.user.id) return res.status(403).end();
  next();
}
`
    ],
    tenantMembership: [
        "requireTenantMembership",
        `export async function requireTenantMembership(req, res, next) {
  const membership = await db.membership.findFirst({
    where: { userId: req.user.id, tenantId: req.params.tenantId }
  });
  if (membership === null) return res.status(403).end();
  next();
}
`
    ],
    subjectPresence: [
        "requireSession",
        `export function requireSession(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  next();
}
`
    ],
    aliasedPolicy: [
        "requirePolicy",
        `export async function requirePolicy(req, res, next) {
  const verdict = await evaluatePermission(req.user, "accounts.delete");
  if (!verdict) return res.status(403).end();
  next();
}
`
    ],
    positiveEarlyExit: [
        "adminOrReject",
        `export function adminOrReject(req, res, next) {
  if (req.user.roles.includes("editor")) return next();
  return res.status(403).end();
}
`
    ],
    delegatedAssertion: [
        "requireGrantedAccess",
        `function assertGranted(user) {
  if (!user || !user.permissions.includes("accounts.delete")) throw new ForbiddenError();
}
export function requireGrantedAccess(req, res, next) {
  assertGranted(req.user);
  next();
}
`
    ]
};
for (const [shape, [exported, source]] of Object.entries(AUTHORIZATION_MIDDLEWARE)) {
    test(`a guard deciding on ${shape} clears the route`, async () => {
        const ids = await authorizationIds(`guard-authorization-${shape}`, {
            "middleware/guard.ts": source,
            "routes.ts": ROUTE_SOURCE(`import { ${exported} } from "./middleware/guard.js";`, exported)
        });
        assert.ok(!ids.has(ROUTE), `${shape} is an authorization ground and must clear the route`);
        assert.ok(!ids.has(UNRESOLVED), `${shape} was resolved and must not be reported as unknown`);
    });
}
test("a guard declared in the route file itself is resolved", async () => {
    const ids = await authorizationIds("guard-local-declaration", {
        "routes.ts": `function ensureAdmin(req, res, next) {
${DENYING_BODY}
}
${ROUTE_SOURCE("", "ensureAdmin")}`
    });
    assert.ok(!ids.has(ROUTE), "a local guard body must be read like an imported one");
});
test("an unrelated middleware beside a real guard does not hide the guard", async () => {
    const ids = await authorizationIds("guard-unrelated-plus-real", {
        "middleware/unrelated.ts": UNRELATED_MIDDLEWARE["csrf"] ?? "",
        "middleware/guard.ts": `export function ensureAdmin(req, res, next) {\n${DENYING_BODY}\n}\n`,
        "routes.ts": ROUTE_SOURCE(`import { verifyCsrf } from "./middleware/unrelated.js";
import { ensureAdmin } from "./middleware/guard.js";`, "verifyCsrf, ensureAdmin")
    });
    assert.ok(!ids.has(ROUTE), "one proven guard in the chain is enough");
});
test("a branch that delegates after answering is not a denial", async () => {
    const ids = await authorizationIds("guard-delegating-branch", {
        "middleware/auth.ts": `export function auditOnly(req, res, next) {
  if (!req.user) {
    res.set("x-anonymous", "1");
    next();
    return;
  }
  next();
}
`,
        "routes.ts": ROUTE_SOURCE(`import { auditOnly } from "./middleware/auth.js";`, "auditOnly")
    });
    assert.ok(ids.has(ROUTE), "a branch that calls next() has not denied the request");
});
test("a success response inside an authorization branch is not a denial", async () => {
    const ids = await authorizationIds("guard-success-branch", {
        "middleware/auth.ts": `export function annotate(req, res, next) {
  if (req.user.role === "admin") res.locals.elevated = true;
  next();
}
`,
        "routes.ts": ROUTE_SOURCE(`import { annotate } from "./middleware/auth.js";`, "annotate")
    });
    assert.ok(ids.has(ROUTE), "an authorization branch that never rejects is not a guard");
});
test("a thrown authorization error only counts when a predicate controls it", async () => {
    const unconditional = await authorizationIds("guard-throw-unconditional", {
        "middleware/auth.ts": `export function tagRequest(req, res, next) {
  try {
    req.tag = decorate(req);
  } catch (error) {
    throw new ForbiddenError("Unauthorized");
  }
  next();
}
`,
        "routes.ts": ROUTE_SOURCE(`import { tagRequest } from "./middleware/auth.js";`, "tagRequest")
    });
    assert.ok(unconditional.has(ROUTE), "a Forbidden error thrown from a catch block decides no authorization question");
    const connected = await authorizationIds("guard-throw-connected", {
        "middleware/auth.ts": `export function requireScope(req, res, next) {
  if (!req.auth.scopes.includes("accounts:delete")) throw new ForbiddenError();
  next();
}
`,
        "routes.ts": ROUTE_SOURCE(`import { requireScope } from "./middleware/auth.js";`, "requireScope")
    });
    assert.ok(!connected.has(ROUTE), "a throw controlled by a scope predicate is a real denial");
});
test("route findings are byte-identical across repeated runs", async () => {
    const files = {
        "middleware/unrelated.ts": UNRELATED_MIDDLEWARE["quota"] ?? "",
        "routes.ts": ROUTE_SOURCE(`import { enforceQuota } from "./middleware/unrelated.js";`, "enforceQuota")
    };
    const first = await authorizationFindings("guard-determinism-a", files);
    const second = await authorizationFindings("guard-determinism-b", files);
    assert.ok(first.length > 0, "the fixture must produce findings to compare");
    assert.deepEqual(first.map((finding) => [finding.id, finding.instance_id, finding.status, finding.evidence]), second.map((finding) => [finding.id, finding.instance_id, finding.status, finding.evidence]));
});
