import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { deriveApplicationInspection } from "../src/application-inspection.js";
import { discoverProjectWithInventory } from "../src/discovery.js";
import { inspectSection } from "../src/inspectors.js";
import { createReport } from "../src/report.js";
import { decideModules } from "../src/scope.js";
import type { Finding } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

const MANIFEST = JSON.stringify({
  name: "readiness-fixture",
  version: "1.0.0",
  private: true,
  type: "module",
  dependencies: { express: "^4.19.2", pg: "^8.11.0", "@prisma/client": "^5.10.0" }
});

async function project(root: string, files: Record<string, string>): Promise<void> {
  await writeFile(join(root, "package.json"), MANIFEST, "utf8");
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
}

async function inspect(root: string, section: string): Promise<Finding[]> {
  const { profile, inventory } = await discoverProjectWithInventory(root);
  const inspection = await deriveApplicationInspection({
    root,
    profile,
    inventory,
    revision: "test:revision",
    modules: [section as never]
  });
  return inspection.findings;
}

const UNPROTECTED_DELETE = `import express from "express";
import { prisma } from "./db.js";
export const router = express.Router();
router.delete("/admin/patients/:id", async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});
`;

const DB = `import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
`;

/* V-1 — execution must follow the same applicability decision the report publishes. */

test("an unprotected destructive route is analyzed when no authorization control exists", async () => {
  await withTemporaryProject("readiness-v1-absent", async (root) => {
    await project(root, { "src/routes/admin.ts": UNPROTECTED_DELETE, "src/db.ts": DB });
    const findings = await inspect(root, "authorization");
    assert.ok(
      findings.some((finding) => finding.id === "FF-AUTHZ-ROUTE-001" && finding.status === "FAIL"),
      "the missing route guard must be reported"
    );
    assert.ok(
      !findings.some((finding) => finding.status === "NOT_APPLICABLE"),
      "an observed risk surface must never yield a non-applicability verdict"
    );
  });
});

test("an unused authorization helper does not change authorization findings", async () => {
  const run = async (extra: Record<string, string>): Promise<string[]> =>
    withTemporaryProject("readiness-v1-dead", async (root) => {
      await project(root, { "src/routes/admin.ts": UNPROTECTED_DELETE, "src/db.ts": DB, ...extra });
      return (await inspect(root, "authorization"))
        .map((finding) => `${finding.id}=${finding.status}`)
        .sort();
    });
  const without = await run({});
  const withDeadHelper = await run({
    "src/unrelated.ts":
      "export function requireRole(user: { role: string }, role: string) { return user.role === role; }\n"
  });
  assert.deepEqual(withDeadHelper, without);
});

test("module decisions, execution, and finding status cannot disagree", async () => {
  await withTemporaryProject("readiness-v1-agree", async (root) => {
    await project(root, { "src/routes/admin.ts": UNPROTECTED_DELETE, "src/db.ts": DB });
    const { profile } = await discoverProjectWithInventory(root);
    const decision = decideModules({
      candidates: ["authorization"],
      profile,
      explicit: false
    })[0];
    assert.equal(decision?.applicability_status, "APPLICABLE");
    const result = await inspectSection(
      "authorization",
      root,
      profile,
      undefined,
      undefined,
      decision
    );
    assert.ok(
      !result.findings.some((finding) => finding.status === "NOT_APPLICABLE"),
      "an APPLICABLE decision must not produce a non-applicability finding"
    );
  });
});

/* V-2 — tenancy applicability follows the inferred ownership boundary, not an identifier list. */

const TENANT_KEYS = [
  "tenantId",
  "clinicId",
  "cabinetId",
  "practiceId",
  "hospitalId",
  "accountId",
  "merchantId",
  "schoolId",
  "workspaceId",
  // Deliberately absent from every built-in list: inference must be structural.
  "franchiseId"
] as const;

for (const key of TENANT_KEYS)
  test(`tenancy activates and detects an unscoped read for '${key}'`, async () => {
    await withTemporaryProject(`readiness-tenancy-${key}`, async (root) => {
      await project(root, {
        "prisma/schema.prisma": `model Patient {\n  id String @id\n  ${key} String\n  name String\n}\nmodel Appointment {\n  id String @id\n  ${key} String\n}\n`,
        "src/db.ts": 'import pg from "pg";\nexport const pool = new pg.Pool({});\n',
        "src/app.ts": `import { pool } from "./db.js";
export async function scoped(req: any) {
  const ${key} = req.session.user.${key};
  return pool.query("SELECT id FROM patients WHERE ${key} = $1 AND name = $2", [${key}, req.query.term]);
}
export async function unscoped(req: any) {
  const ${key} = req.session.user.${key};
  return pool.query("SELECT id FROM patients WHERE id = $1", [req.query.id]);
}
`
      });
      const { profile } = await discoverProjectWithInventory(root);
      assert.ok(profile.tenancy, "discovery must record an ownership assessment");
      assert.equal(profile.tenancy.status, "PRESENT", "ownership boundary must be inferred");
      assert.equal(profile.tenancy.key, key);
      const decision = decideModules({ candidates: ["tenancy"], profile, explicit: false })[0];
      assert.ok(decision, "tenancy must receive a module decision");
      assert.equal(decision.capability_status, "PRESENT");
      assert.equal(decision.selection_status, "SELECTED");
      const findings = await inspect(root, "tenancy");
      assert.ok(
        findings.some(
          (finding) => finding.id === "FF-TENANT-SCOPE-001" && finding.status === "FAIL"
        ),
        `the unscoped read must be detected for '${key}'`
      );
    });
  });

test("a single-tenant project with no ownership boundary stays bounded-scope ABSENT", async () => {
  await withTemporaryProject("readiness-tenancy-single", async (root) => {
    await project(root, {
      "prisma/schema.prisma": "model Note {\n  id String @id\n  body String\n}\n",
      "src/app.ts": "export const noop = 1;\n"
    });
    const { profile } = await discoverProjectWithInventory(root);
    assert.equal(profile.tenancy?.status, "ABSENT");
  });
});

test("equally scoring ownership candidates stay UNKNOWN rather than being guessed", async () => {
  await withTemporaryProject("readiness-tenancy-ambiguous", async (root) => {
    await project(root, {
      "prisma/schema.prisma":
        "model A {\n  id String @id\n  clinicId String\n  vendorId String\n}\nmodel B {\n  id String @id\n  clinicId String\n  vendorId String\n}\n"
    });
    const { profile } = await discoverProjectWithInventory(root);
    assert.ok(profile.tenancy);
    assert.equal(profile.tenancy.status, "UNKNOWN");
    assert.ok(profile.tenancy.candidates.length > 1);
  });
});

/* V-3 — authorization precision. */

const GUARDS = `import type { Request, Response, NextFunction } from "express";
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).user?.role !== role) return res.status(403).end();
    next();
  };
}
`;

const AUTHZ_CASES = `import express from "express";
import { prisma } from "./db.js";
import { requireRole } from "./guards.js";
import { dynamicGuard } from "./dynamic.js";
export const r = express.Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).end();
  next();
}
function zzUnrelatedName(req: any, res: any, next: any) {
  if (!req.user?.permissions?.includes("manage")) return res.sendStatus(403);
  next();
}

r.delete("/admin/a/:id", async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});
r.delete("/admin/b/:id", requireRole("admin"), async (_req, res) => res.sendStatus(204));
r.delete("/admin/c/:id", requireAdmin, async (_req, res) => res.sendStatus(204));
r.delete("/admin/d/:id", zzUnrelatedName, async (_req, res) => res.sendStatus(204));
r.get("/health", (_req, res) => res.json({ ok: true }));
r.get("/inline/:id", async (req: any, res) => {
  res.json(await prisma.record.findFirst({ where: { id: req.params.id, ownerId: req.user.id } }));
});
r.get("/aliased/:id", async (req: any, res) => {
  const user = req.user;
  res.json(await prisma.record.findFirst({ where: { id: req.params.id, ownerId: user.id } }));
});
r.delete("/admin/e/:id", dynamicGuard(), async (_req, res) => res.sendStatus(204));
`;

async function authorizationFindings(root: string): Promise<Finding[]> {
  await project(root, {
    "src/db.ts": DB,
    "src/guards.ts": GUARDS,
    "src/dynamic.ts":
      'const registry: Record<string, unknown> = {};\nexport function dynamicGuard(): any { return (registry as any)["guard"]; }\n',
    "src/cases.ts": AUTHZ_CASES
  });
  const runs = await runAnalyzers("authorization", root);
  return runs.flatMap((run) => run.findings);
}

test("structurally proven route guards are not reported, whatever they are named", async () => {
  await withTemporaryProject("readiness-v3-guards", async (root) => {
    const findings = await authorizationFindings(root);
    const routeLines = new Set(
      findings
        .filter((finding) => finding.id === "FF-AUTHZ-ROUTE-001")
        .flatMap((finding) => finding.location.map((location) => location.line))
    );
    // Only the unguarded `/admin/a/:id` registration may be reported.
    assert.equal(
      routeLines.size,
      1,
      `unexpected route findings at lines ${[...routeLines].join(", ")}`
    );
    assert.ok(
      findings.some((finding) => finding.id === "FF-AUTHZ-ROUTE-001" && finding.status === "FAIL")
    );
  });
});

test("unresolved middleware indirection is NOT_VERIFIED, never a confident failure", async () => {
  await withTemporaryProject("readiness-v3-unresolved", async (root) => {
    const findings = await authorizationFindings(root);
    const unresolved = findings.filter((finding) => finding.id === "FF-AUTHZ-NOT-VERIFIED-001");
    assert.ok(unresolved.length > 0, "dynamic middleware must produce an unresolved verdict");
    for (const finding of unresolved) assert.equal(finding.status, "NOT_VERIFIED");
  });
});

test("express route registration is never treated as a data-access sink", async () => {
  await withTemporaryProject("readiness-v3-router", async (root) => {
    await project(root, {
      "src/db.ts": DB,
      "src/plain.ts": `import express from "express";
export const r = express.Router();
function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).end();
  next();
}
r.delete("/admin/plain/:id", requireAdmin, async (_req, res) => res.sendStatus(204));
`
    });
    const runs = await runAnalyzers("authorization", root);
    const findings = runs.flatMap((run) => run.findings);
    assert.ok(
      !findings.some((finding) => finding.id === "FF-AUTHZ-OBJECT-001"),
      "router.delete must not raise object authorization"
    );
  });
});

test("inline and aliased ownership predicates both count as authorization", async () => {
  await withTemporaryProject("readiness-v3-ownership", async (root) => {
    const findings = await authorizationFindings(root);
    const objectLines = new Set(
      findings
        .filter((finding) => finding.id === "FF-AUTHZ-OBJECT-001")
        .flatMap((finding) => finding.location.map((location) => location.line))
    );
    const source = AUTHZ_CASES.split("\n");
    const inline = source.findIndex((line) => line.includes("ownerId: req.user.id")) + 1;
    const aliased = source.findIndex((line) => line.includes("ownerId: user.id")) + 1;
    assert.ok(!objectLines.has(inline), "inline ownership predicate must be recognized");
    assert.ok(!objectLines.has(aliased), "aliased ownership predicate must be recognized");
  });
});

test("a real data deletion without authorization is still detected", async () => {
  await withTemporaryProject("readiness-v3-real-sink", async (root) => {
    await project(root, {
      "src/db.ts": DB,
      "src/purge.ts": `import express from "express";
import { prisma } from "./db.js";
export const r = express.Router();
r.post("/purge/:id", async (req, res) => {
  await prisma.audit.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});
`
    });
    const runs = await runAnalyzers("authorization", root);
    assert.ok(
      runs
        .flatMap((run) => run.findings)
        .some((finding) => finding.id === "FF-AUTHZ-OBJECT-001" && finding.status === "FAIL")
    );
  });
});

/* V-4 — one active conclusion per logical scope, for any producer. */

function applicabilityFinding(section: string): Finding {
  return {
    id: `FF-${section.toUpperCase()}-001`,
    section,
    title: `${section} module is not applicable in the bounded scanned scope`,
    severity: "INFO",
    confidence: "MEDIUM",
    status: "NOT_APPLICABLE",
    location: [{ path: ".forge/project-profile.json" }],
    evidence: ["synthetic"],
    impact: "none",
    recommendation: "none",
    safe_fix: false,
    verification: ["none"],
    standards: ["Fullstack Forge evidence protocol"]
  };
}

function verdict(section: string, status: Finding["status"]): Finding {
  return {
    id: `FF-${section.toUpperCase()}-900`,
    section,
    title: `${section} verdict`,
    severity: "INFO",
    confidence: "MEDIUM",
    status,
    location: [{ path: "src/app.ts", line: 1 }],
    evidence: ["observed"],
    impact: "none",
    recommendation: "none",
    safe_fix: false,
    verification: ["none"],
    standards: ["Fullstack Forge evidence protocol"]
  };
}

for (const status of ["FAIL", "WARNING", "NOT_VERIFIED", "PASS", "BLOCKED"] as const)
  test(`a synthetic non-applicability verdict is superseded by an active ${status}`, async () => {
    await withTemporaryProject(`readiness-v4-${status}`, async (root) => {
      await project(root, { "src/app.ts": "export const a = 1;\n" });
      const { profile } = await discoverProjectWithInventory(root);
      const report = createReport(
        root,
        profile,
        [applicabilityFinding("authorization"), verdict("authorization", status)],
        "test"
      );
      const scoped = report.findings.filter((finding) => finding.section === "authorization");
      const active = scoped.filter((finding) => finding.status !== "SUPERSEDED");
      assert.equal(
        active.filter((finding) => finding.status === "NOT_APPLICABLE").length,
        0,
        "no active non-applicability verdict may remain"
      );
      const retracted = scoped.find((finding) => finding.status === "SUPERSEDED");
      assert.ok(retracted, "a retracted verdict must exist");
      assert.ok(retracted.superseded_by, "the retracted verdict must name its successor");
      assert.ok(retracted.retraction_reason, "the retraction must state a reason");
    });
  });

test("distinct findings in one section are never suppressed by the invariant", async () => {
  await withTemporaryProject("readiness-v4-distinct", async (root) => {
    await project(root, { "src/app.ts": "export const a = 1;\n" });
    const { profile } = await discoverProjectWithInventory(root);
    const report = createReport(
      root,
      profile,
      [
        verdict("security", "FAIL"),
        {
          ...verdict("security", "NOT_VERIFIED"),
          id: "FF-SECURITY-901",
          title: "security coverage limitation",
          location: [{ path: "src/other.ts", line: 7 }]
        }
      ],
      "test"
    );
    const active = report.findings.filter(
      (finding) => finding.section === "security" && finding.status !== "SUPERSEDED"
    );
    assert.equal(active.length, 2);
  });
});

test("a genuinely inapplicable module keeps its single non-applicability verdict", async () => {
  await withTemporaryProject("readiness-v4-keep", async (root) => {
    await project(root, { "src/app.ts": "export const a = 1;\n" });
    const { profile } = await discoverProjectWithInventory(root);
    const report = createReport(root, profile, [applicabilityFinding("payments")], "test");
    const scoped = report.findings.filter((finding) => finding.section === "payments");
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.status, "NOT_APPLICABLE");
  });
});

/* V-5 — SQL wrapper inference is not suffix-dependent. */

test("SQL-shaped wrappers report NOT_VERIFIED regardless of naming convention", async () => {
  await withTemporaryProject("readiness-v5-wrappers", async (root) => {
    await project(root, {
      "src/db.ts": 'import pg from "pg";\nexport const pool = new pg.Pool({});\n',
      "src/cases.ts": `import { pool } from "./db.js";
async function dbQuery(sql: string, values: unknown[]) { return pool.query(sql, values); }
async function runSql(sql: string, values: unknown[]) { return pool.query(sql, values); }
async function fetchRows(sql: string, values: unknown[]) { return pool.query(sql, values); }
function formatLabel(text: string, parts: string[]) { return text + parts.join(","); }
export async function handler(req: any) {
  const t = String(req.query.t ?? "");
  await pool.query("SELECT id FROM patients WHERE name ILIKE $1", [\`%\${t}%\`]);
  await pool.query(\`SELECT id FROM patients WHERE name = '\${t}'\`);
  await dbQuery("SELECT id FROM patients WHERE a = $1", [t]);
  await runSql("SELECT id FROM patients WHERE a = $1", [t]);
  await fetchRows("SELECT id FROM patients WHERE a = $1", [t]);
  formatLabel(t, [t]);
}
`
    });
    const findings = (await runAnalyzers("security", root)).flatMap((run) => run.findings);
    const lines = (id: string): number[] =>
      findings
        .filter((finding) => finding.id === id)
        .flatMap((finding) => finding.location.map((location) => location.line ?? 0))
        .sort((left, right) => left - right);
    const unresolved = lines("FF-SEC-SQL-NOT-VERIFIED-001");
    assert.equal(unresolved.length, 3, "all three SQL-shaped wrappers must be unresolved");
    for (const finding of findings.filter(
      (candidate) => candidate.id === "FF-SEC-SQL-NOT-VERIFIED-001"
    ))
      assert.equal(finding.status, "NOT_VERIFIED");
    assert.equal(lines("FF-SEC-SQL-001").length, 1, "only the interpolated call is a defect");
  });
});
