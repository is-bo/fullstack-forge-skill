import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { classifyAdministrativeAuthority, classifyResourcePartition, collectGlobalAdministratorRoles, decideObjectAuthorization, strongerAuthority } from "../src/authorization-policy.js";
import { withTemporaryProject } from "./helpers.js";
const OBJECT = "FF-AUTHZ-OBJECT-001";
const ADMINISTRATIVE = "FF-AUTHZ-OBJECT-ADMIN-001";
const OPEN = "FF-AUTHZ-OBJECT-NOT-VERIFIED-001";
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
/** `id=status` pairs, which is what the object-authorization matrix asserts on. */
async function objectOutcomes(name, files) {
    const findings = await authorizationFindings(name, files);
    return new Set(findings
        .filter((finding) => finding.id.startsWith("FF-AUTHZ-OBJECT"))
        .map((finding) => `${finding.id}=${finding.status}`));
}
const PLATFORM_GUARD = `export function requireSuperAdmin(req, res, next) {
  if (req.user.role !== "superadmin") return res.status(403).end();
  next();
}
`;
const TENANT_GUARD = `export function requireOrgAdmin(req, res, next) {
  if (req.user.role !== "orgAdmin") return res.status(403).end();
  next();
}
`;
const PLAIN_ADMIN_GUARD = `export function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).end();
  next();
}
`;
const ROLE_GUARD = `export function requireEditor(req, res, next) {
  if (req.user.role !== "editor") return res.status(403).end();
  next();
}
`;
/** A delete addressed only by a global identifier: the operation the object rule is about. */
const route = (importLine, guard, body) => `${importLine}
app.delete("/admin/audit-logs/:id", ${guard}async (req, res) => {
${body ?? ""}  await db.auditLog.delete({ where: { id: req.params.id } });
  res.end();
});
`;
/* --- The decision table, exercised directly. --------------------------------------------- */
test("the object-authorization decision table is total and fail-closed", () => {
    const authorities = ["global", "tenant", "ambiguous", "none"];
    const partitions = ["global", "partitioned"];
    const observed = [];
    for (const authority of authorities)
        for (const partition of partitions) {
            observed.push(`${authority}/${partition}=${decideObjectAuthorization({ boundPredicate: false, authority, partition }).outcome}`);
            assert.equal(decideObjectAuthorization({ boundPredicate: true, authority, partition }).outcome, "authorized", "a predicate bound to the object always wins");
        }
    assert.deepEqual(observed, [
        "global/global=administrative",
        "global/partitioned=unresolved",
        "tenant/global=missing",
        "tenant/partitioned=missing",
        "ambiguous/global=unresolved",
        "ambiguous/partitioned=unresolved",
        "none/global=missing",
        "none/partitioned=missing"
    ]);
});
test("an unread guard body never yields platform authority", () => {
    const roles = new Set();
    assert.equal(classifyAdministrativeAuthority({ resolved: false, text: "requireSuperAdmin" }, roles), "ambiguous");
    assert.equal(classifyAdministrativeAuthority({ resolved: true, text: 'role !== "superadmin"' }, roles), "global");
    assert.equal(classifyAdministrativeAuthority({ resolved: true, text: 'role !== "orgAdmin"' }, roles), "tenant");
    assert.equal(classifyAdministrativeAuthority({ resolved: true, text: 'role !== "admin"' }, roles), "ambiguous");
    assert.equal(classifyAdministrativeAuthority({ resolved: true, text: 'role !== "editor"' }, roles), "none");
});
test("a narrower partition administrator is never widened by a nearby global role name", () => {
    const authority = classifyAdministrativeAuthority({ resolved: true, text: 'requireOrgAdmin superadmin role !== "orgAdmin"' }, new Set());
    assert.equal(authority, "tenant", "the gate that can actually be satisfied decides");
    assert.equal(strongerAuthority("tenant", "ambiguous"), "tenant");
    assert.equal(strongerAuthority("ambiguous", "global"), "global");
});
test("an explicit role mapping is the only way a plain admin role becomes global", () => {
    const roles = collectGlobalAdministratorRoles([
        { path: "policy.ts", content: 'export const GLOBAL_ADMIN_ROLES = ["admin", "root"];\n' }
    ]);
    assert.deepEqual([...roles].sort(), ["admin", "root"]);
    assert.equal(classifyAdministrativeAuthority({ resolved: true, text: 'role !== "admin"' }, roles), "global");
    assert.equal(classifyAdministrativeAuthority({ resolved: true, text: 'role !== "admin"' }, new Set()), "ambiguous");
});
test("ownership and tenancy keys make a resource partitioned", () => {
    const tenant = /\b(?:tenantId)\b/u;
    assert.equal(classifyResourcePartition("db.auditLog.delete", tenant), "global");
    assert.equal(classifyResourcePartition("record.ownerId", tenant), "partitioned");
    assert.equal(classifyResourcePartition("audit(record.tenantId)", tenant), "partitioned");
});
/* --- The same matrix, adversarially, through the analyzer. -------------------------------- */
test("a proven platform administrator on unpartitioned state is a policy note, not a defect", async () => {
    const outcomes = await objectOutcomes("object-authz-global-admin", {
        "guards.ts": PLATFORM_GUARD,
        "routes.ts": route(`import { requireSuperAdmin } from "./guards.js";`, "requireSuperAdmin, ")
    });
    assert.ok(!outcomes.has(`${OBJECT}=FAIL`), "a platform operator is not a BOLA defect");
    assert.ok(outcomes.has(`${ADMINISTRATIVE}=WARNING`), "the reliance on a role grant is still published");
});
test("a tenant administrator deleting by global identifier is still a defect", async () => {
    const outcomes = await objectOutcomes("object-authz-tenant-admin", {
        "guards.ts": TENANT_GUARD,
        "routes.ts": route(`import { requireOrgAdmin } from "./guards.js";`, "requireOrgAdmin, ")
    });
    assert.ok(outcomes.has(`${OBJECT}=FAIL`), "an organisation administrator proves nothing about another organisation's object");
    assert.ok(!outcomes.has(`${ADMINISTRATIVE}=WARNING`));
});
test("an ordinary caller deleting by identifier is still a defect", async () => {
    const outcomes = await objectOutcomes("object-authz-no-guard", {
        "routes.ts": route("", "")
    });
    assert.ok(outcomes.has(`${OBJECT}=FAIL`));
});
test("a role guard that is not administrative is never suppressed", async () => {
    const outcomes = await objectOutcomes("object-authz-role-only", {
        "guards.ts": ROLE_GUARD,
        "routes.ts": route(`import { requireEditor } from "./guards.js";`, "requireEditor, ")
    });
    assert.ok(outcomes.has(`${OBJECT}=FAIL`), "a role gate without proof of global object scope must not clear the object rule");
});
test("a plain administrator role degrades to NOT_VERIFIED rather than to either verdict", async () => {
    const outcomes = await objectOutcomes("object-authz-plain-admin", {
        "guards.ts": PLAIN_ADMIN_GUARD,
        "routes.ts": route(`import { requireAdmin } from "./guards.js";`, "requireAdmin, ")
    });
    assert.ok(outcomes.has(`${OPEN}=NOT_VERIFIED`), "the role's object scope was never stated");
    assert.ok(!outcomes.has(`${OBJECT}=FAIL`));
    assert.ok(!outcomes.has(`${ADMINISTRATIVE}=WARNING`));
});
test("an unresolvable external administrator guard is never proven global", async () => {
    const outcomes = await objectOutcomes("object-authz-external-admin", {
        "routes.ts": route(`import { requireSuperAdmin } from "@acme/authz";`, "requireSuperAdmin, ")
    });
    assert.ok(outcomes.has(`${OPEN}=NOT_VERIFIED`), "a package name is not proof of platform-wide reach");
    assert.ok(!outcomes.has(`${ADMINISTRATIVE}=WARNING`));
});
test("a platform administrator over partitioned data stays NOT_VERIFIED", async () => {
    const outcomes = await objectOutcomes("object-authz-global-admin-partitioned", {
        "guards.ts": PLATFORM_GUARD,
        "routes.ts": route(`import { requireSuperAdmin } from "./guards.js";`, "requireSuperAdmin, ", "  audit(req.query.tenantId);\n")
    });
    assert.ok(outcomes.has(`${OPEN}=NOT_VERIFIED`), "nothing proves a platform role spans every partition of a partitioned resource");
    assert.ok(!outcomes.has(`${ADMINISTRATIVE}=WARNING`));
});
test("an explicit global-administrator mapping clears a plain admin gate", async () => {
    const outcomes = await objectOutcomes("object-authz-declared-mapping", {
        "policy.ts": 'export const GLOBAL_ADMIN_ROLES = ["admin"];\n',
        "guards.ts": PLAIN_ADMIN_GUARD,
        "routes.ts": route(`import { requireAdmin } from "./guards.js";`, "requireAdmin, ")
    });
    assert.ok(outcomes.has(`${ADMINISTRATIVE}=WARNING`));
    assert.ok(!outcomes.has(`${OBJECT}=FAIL`));
    assert.ok(!outcomes.has(`${OPEN}=NOT_VERIFIED`));
});
test("an ownership predicate outranks every role verdict", async () => {
    const outcomes = await objectOutcomes("object-authz-ownership-wins", {
        "guards.ts": TENANT_GUARD,
        "routes.ts": `import { requireOrgAdmin } from "./guards.js";
app.delete("/admin/audit-logs/:id", requireOrgAdmin, async (req, res) => {
  await db.auditLog.delete({ where: { id: req.params.id, ownerId: req.user.id } });
  res.end();
});
`
    });
    assert.equal(outcomes.size, 0, "a bound object predicate answers the question outright");
});
test("a dominating in-function platform check protects a service module", async () => {
    const outcomes = await objectOutcomes("object-authz-dominating-check", {
        "service.ts": `export async function purge(req) {
  if (req.user.role !== "superadmin") throw new Error("forbidden");
  return db.auditLog.delete({ where: { id: req.params.id } });
}
`
    });
    assert.ok(outcomes.has(`${ADMINISTRATIVE}=WARNING`));
    assert.ok(!outcomes.has(`${OBJECT}=FAIL`));
});
test("a router-mounted platform guard covers the handlers below it", async () => {
    const outcomes = await objectOutcomes("object-authz-mounted-guard", {
        "guards.ts": PLATFORM_GUARD,
        "routes.ts": `import { requireSuperAdmin } from "./guards.js";
router.use(requireSuperAdmin);
router.delete("/audit-logs/:id", async (req, res) => {
  await db.auditLog.delete({ where: { id: req.params.id } });
  res.end();
});
`
    });
    assert.ok(outcomes.has(`${ADMINISTRATIVE}=WARNING`));
    assert.ok(!outcomes.has(`${OBJECT}=FAIL`));
});
test("object-authorization findings are identical across repeated runs", async () => {
    const files = {
        "guards.ts": PLAIN_ADMIN_GUARD,
        "routes.ts": route(`import { requireAdmin } from "./guards.js";`, "requireAdmin, ")
    };
    const first = await authorizationFindings("object-authz-determinism-a", files);
    const second = await authorizationFindings("object-authz-determinism-b", files);
    assert.ok(first.length > 0);
    assert.deepEqual(first.map((finding) => [finding.id, finding.instance_id, finding.status, finding.evidence]), second.map((finding) => [finding.id, finding.instance_id, finding.status, finding.evidence]));
});
