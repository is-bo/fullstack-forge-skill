import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";
test("security analyzer traces redirect, credential, sensitive logging, and validation boundaries", async () => {
    await withTemporaryProject("analyzer-security", async (root) => {
        await writeFile(join(root, "server.ts"), `const PAYMENT_API_SECRET = "prod_secret_1234567890";
app.get("/redirect", (req, res) => {
  console.log(req.body.password);
  res.redirect(req.query.next);
});
`, "utf8");
        const ids = await findingIds(root, "security");
        for (const id of ["FF-SEC-CREDENTIAL-001", "FF-SEC-LOG-001", "FF-SEC-REDIRECT-001"])
            assert.ok(ids.has(id), id);
    });
});
test("tenancy analyzer detects unscoped background and export queries", async () => {
    await withTemporaryProject("analyzer-tenant-job", async (root) => {
        await writeFile(join(root, "export-job.ts"), "export async function exportJob() { return db.invoice.findMany({ where: {} }); }\n", "utf8");
        assert.ok((await findingIds(root, "tenancy")).has("FF-TENANT-BACKGROUND-001"));
    });
});
test("upload analyzer detects missing scan, original filename paths, and absent limits", async () => {
    await withTemporaryProject("analyzer-upload", async (root) => {
        await writeFile(join(root, "upload.ts"), `app.post("/upload", upload.any(), async (req, res) => {
  const file = req.files[0];
  await save(\`quarantine/\${file.originalname}\`, file.buffer);
  res.sendStatus(201);
});
`, "utf8");
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
        await writeFile(join(root, "query.ts"), "export const page = prisma.invoice.findMany({ take: 20, cursor: { id } });\n", "utf8");
        assert.ok((await findingIds(root, "queries")).has("FF-QUERY-ORDER-001"));
    });
});
test("payment analyzer detects parsed-payload verification and client-controlled amounts", async () => {
    await withTemporaryProject("analyzer-payment", async (root) => {
        await writeFile(join(root, "payments.ts"), `app.post("/webhooks/stripe", async (req, res) => {
  stripe.webhooks.constructEvent(req.body, req.headers.signature, secret);
  await chargeInvoice(req.body.invoice);
  res.sendStatus(200);
});
export const pay = (req) => stripe.paymentIntents.create({ amount: req.body.amount });
`, "utf8");
        const ids = await findingIds(root, "payments");
        assert.ok(ids.has("FF-PAY-WEBHOOK-RAW-001"));
        assert.ok(ids.has("FF-PAY-AMOUNT-001"));
        assert.ok(ids.has("FF-PAY-IDEMPOTENCY-001"));
    });
});
async function findingIds(root, section) {
    const findings = (await runAnalyzers(section, root)).flatMap((run) => run.findings);
    assert.ok(findings.every((finding) => finding.location[0]?.line !== undefined));
    assert.ok(findings.every((finding) => finding.trace && finding.trace.length > 0));
    return new Set(findings.map((finding) => finding.id));
}
//# sourceMappingURL=analyzers.test.js.map