import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";

test("security analyzer traces redirect, credential, sensitive logging, and validation boundaries", async () => {
  await withTemporaryProject("analyzer-security", async (root) => {
    await writeFile(
      join(root, "server.ts"),
      `const PAYMENT_API_SECRET = "prod_secret_1234567890";
app.get("/redirect", (req, res) => {
  console.log(req.body.password);
  res.redirect(req.query.next);
});
`,
      "utf8"
    );
    const ids = await findingIds(root, "security");
    for (const id of ["FF-SEC-CREDENTIAL-001", "FF-SEC-LOG-001", "FF-SEC-REDIRECT-001"])
      assert.ok(ids.has(id), id);
  });
});

test("tenancy analyzer detects unscoped background and export queries", async () => {
  await withTemporaryProject("analyzer-tenant-job", async (root) => {
    await writeFile(
      join(root, "export-job.ts"),
      "export async function exportJob() { return db.invoice.findMany({ where: {} }); }\n",
      "utf8"
    );
    assert.ok((await findingIds(root, "tenancy")).has("FF-TENANT-BACKGROUND-001"));
  });
});

test("an ordinary exported handler is not a background-job signal", async () => {
  await withTemporaryProject("analyzer-exported-handler", async (root) => {
    await writeFile(
      join(root, "api.ts"),
      "export async function listInvoices() { return db.invoice.findMany({ where: {} }); }\n",
      "utf8"
    );
    assert.ok(!(await findingIds(root, "tenancy")).has("FF-TENANT-BACKGROUND-001"));
  });
});

test("upload analyzer detects missing scan, original filename paths, and absent limits", async () => {
  await withTemporaryProject("analyzer-upload", async (root) => {
    await writeFile(
      join(root, "upload.ts"),
      `app.post("/upload", upload.any(), async (req, res) => {
  const file = req.files[0];
  await save(\`quarantine/\${file.originalname}\`, file.buffer);
  res.sendStatus(201);
});
`,
      "utf8"
    );
    const ids = await findingIds(root, "uploads");
    for (const id of [
      "FF-UPLOAD-ANY-001",
      "FF-UPLOAD-SCAN-001",
      "FF-UPLOAD-FILENAME-001",
      "FF-UPLOAD-LIMITS-001"
    ])
      assert.ok(ids.has(id), id);
  });
});

test("query analyzer detects pagination without deterministic ordering", async () => {
  await withTemporaryProject("analyzer-order", async (root) => {
    await writeFile(
      join(root, "query.ts"),
      "export const page = prisma.invoice.findMany({ take: 20, cursor: { id } });\n",
      "utf8"
    );
    assert.ok((await findingIds(root, "queries")).has("FF-QUERY-ORDER-001"));
  });
});

test("payment analyzer detects parsed-payload verification and client-controlled amounts", async () => {
  await withTemporaryProject("analyzer-payment", async (root) => {
    await writeFile(
      join(root, "payments.ts"),
      `app.post("/webhooks/stripe", async (req, res) => {
  stripe.webhooks.constructEvent(req.body, req.headers.signature, secret);
  await chargeInvoice(req.body.invoice);
  res.sendStatus(200);
});
export const pay = (req) => stripe.paymentIntents.create({ amount: req.body.amount });
`,
      "utf8"
    );
    const ids = await findingIds(root, "payments");
    assert.ok(ids.has("FF-PAY-WEBHOOK-RAW-001"));
    assert.ok(ids.has("FF-PAY-AMOUNT-001"));
    assert.ok(ids.has("FF-PAY-IDEMPOTENCY-001"));
  });
});

async function findingIds(root: string, section: string): Promise<Set<string>> {
  const findings = (await runAnalyzers(section, root)).flatMap((run) => run.findings);
  assert.ok(findings.every((finding) => finding.location[0]?.line !== undefined));
  assert.ok(findings.every((finding) => finding.trace && finding.trace.length > 0));
  return new Set(findings.map((finding) => finding.id));
}

async function authorizationIds(name: string, source: string): Promise<Set<string>> {
  let ids = new Set<string>();
  await withTemporaryProject(name, async (root) => {
    await writeFile(join(root, "route.ts"), source, "utf8");
    ids = await findingIds(root, "authorization");
  });
  return ids;
}

test("authorization ignores unrelated policy strings and unused imports", async () => {
  for (const [name, prelude] of [
    ["policy-string", 'const policyName = "owner policy";'],
    ["unused-import", 'import { canAccess } from "./policy.js";']
  ]) {
    const ids = await authorizationIds(
      `authz-${name}`,
      `${prelude}
export function load(req) {
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
    );
    assert.ok(ids.has("FF-AUTHZ-OBJECT-001"), name);
  }
});

test("authorization after release or for another object does not protect the lookup", async () => {
  const after = await authorizationIds(
    "authz-after-release",
    `export async function load(req, res) {
  const record = await prisma.record.findUnique({ where: { id: req.params.id } });
  res.json(record);
  await authorize(req.user, req.params.id);
}`
  );
  assert.ok(after.has("FF-AUTHZ-OBJECT-001"));

  const different = await authorizationIds(
    "authz-different-object",
    `export async function load(req) {
  await authorize(req.user, req.params.otherId);
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(different.has("FF-AUTHZ-OBJECT-001"));
});

test("authorization accepts a connected owner predicate and dominating policy guard", async () => {
  const owner = await authorizationIds(
    "authz-owner-predicate",
    `export function load(req) {
  return prisma.record.findUnique({
    where: { id: req.params.id, ownerId: req.user.id }
  });
}`
  );
  assert.ok(!owner.has("FF-AUTHZ-OBJECT-001"));

  const guard = await authorizationIds(
    "authz-dominating-guard",
    `export async function load(req) {
  if (!(await canAccess(req.user, req.params.id))) throw new Error("forbidden");
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(!guard.has("FF-AUTHZ-OBJECT-001"));
});

test("authorization requires both subject and object connection", async () => {
  const missingSubject = await authorizationIds(
    "authz-no-subject",
    `export async function load(req) {
  if (!(await canAccess(req.params.id))) throw new Error("forbidden");
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(missingSubject.has("FF-AUTHZ-OBJECT-001"));

  const crossTenant = await authorizationIds(
    "authz-cross-tenant",
    `export function load(req) {
  return prisma.record.findUnique({
    where: { id: req.params.id, tenantId: req.params.tenantId }
  });
}`
  );
  assert.ok(crossTenant.has("FF-AUTHZ-OBJECT-001"));
});

test("conditional or non-dominating authorization calls do not protect a lookup", async () => {
  const conditionalCall = await authorizationIds(
    "authz-conditional-call",
    `export async function load(req) {
  if (req.query.check) await authorize(req.user, req.params.id);
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(conditionalCall.has("FF-AUTHZ-OBJECT-001"));

  const conditionalExit = await authorizationIds(
    "authz-conditional-exit",
    `export async function load(req) {
  if (!(await canAccess(req.user, req.params.id))) {
    if (req.query.soft) return null;
  }
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(conditionalExit.has("FF-AUTHZ-OBJECT-001"));
});

test("subject-shaped output fields are not query authorization predicates", async () => {
  const ids = await authorizationIds(
    "authz-output-owner",
    `export function load(req) {
  return prisma.record.findUnique({
    where: { id: req.params.id },
    select: { id: true, ownerId: req.user.id }
  });
}`
  );
  assert.ok(ids.has("FF-AUTHZ-OBJECT-001"));
});
