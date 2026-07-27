import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";
const MISSING = "FF-DATA-TRANSACTION-001";
const UNRESOLVED = "FF-DATA-TRANSACTION-NOT-VERIFIED-001";
async function transactionFindings(name, source) {
    let findings = [];
    await withTemporaryProject(name, async (root) => {
        await writeFile(join(root, "workflow.ts"), source, "utf8");
        findings = (await runAnalyzers("database", root)).flatMap((run) => run.findings);
    });
    return findings;
}
async function transactionIds(name, source) {
    return new Set((await transactionFindings(name, source)).map((finding) => finding.id));
}
test("related writes sharing an entity identifier without a boundary are reported", async () => {
    const ids = await transactionIds("txn-related-missing", `export async function checkout(req, res) {
  const order = await prisma.order.create({ data: { userId: req.user.id } });
  await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: req.body.total } });
  res.json(order);
}
`);
    assert.ok(ids.has(MISSING), `expected ${MISSING}, got ${[...ids].join(", ")}`);
});
test("the same workflow inside a proven Prisma transaction is clean", async () => {
    const ids = await transactionIds("txn-prisma-wrapped", `export async function checkout(req, res) {
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({ data: { userId: req.user.id } });
    await tx.ledgerEntry.create({ data: { orderId: created.id, amount: req.body.total } });
    return created;
  });
  res.json(order);
}
`);
    assert.ok(!ids.has(MISSING), `unexpected ${MISSING}`);
    assert.ok(!ids.has(UNRESOLVED), `unexpected ${UNRESOLVED}`);
});
test("a Knex transaction over related writes is recognised", async () => {
    const ids = await transactionIds("txn-knex-wrapped", `export async function transfer(req, res) {
  await knex.transaction(async (trx) => {
    await trx("accounts").where({ id: req.body.from }).decrement("balance", req.body.amount);
    await trx("ledger").insert({ accountId: req.body.from, amount: req.body.amount });
  });
  res.end();
}
`);
    assert.ok(!ids.has(MISSING), `unexpected ${MISSING}`);
});
test("two genuinely independent writes stay clean", async () => {
    const ids = await transactionIds("txn-independent", `export async function unrelated(req, res) {
  await prisma.auditLog.create({ data: { action: "login" } });
  await prisma.featureFlag.update({ where: { key: "beta" }, data: { on: true } });
  res.end();
}
`);
    assert.ok(!ids.has(MISSING), `unexpected ${MISSING} on independent writes`);
});
test("an unresolved custom wrapper is NOT_VERIFIED rather than pass or fail", async () => {
    const findings = await transactionFindings("txn-unresolved-wrapper", `export async function settle(req, res) {
  await mysteryUnit(async (handle) => {
    await handle.invoice.update({ where: { id: req.body.id }, data: { status: "PAID" } });
    await handle.receipt.create({ data: { invoiceId: req.body.id, amount: req.body.total } });
  });
  res.end();
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(UNRESOLVED), `expected ${UNRESOLVED}, got ${[...ids].join(", ")}`);
    assert.ok(!ids.has(MISSING), "an unresolved boundary must not become a confident failure");
    const unresolved = findings.filter((finding) => finding.id === UNRESOLVED);
    for (const finding of unresolved)
        assert.equal(finding.status, "NOT_VERIFIED", "unresolved boundaries must be NOT_VERIFIED");
});
test("financial writes justify a higher severity than ordinary parent/child writes", async () => {
    const ledger = await transactionFindings("txn-severity-ledger", `export async function refund(req, res) {
  const payment = await prisma.payment.update({
    where: { id: req.body.paymentId },
    data: { status: "REFUNDED" }
  });
  await prisma.ledgerEntry.create({ data: { paymentId: payment.id, amount: req.body.amount } });
  res.end();
}
`);
    const financial = ledger.filter((finding) => finding.id === MISSING);
    assert.ok(financial.length > 0, "expected a financial consistency finding");
    assert.ok(financial.every((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL"), `financial severity was ${financial.map((finding) => finding.severity).join(", ")}`);
});
test("a reported missing boundary carries locating evidence", async () => {
    const findings = await transactionFindings("txn-evidence", `export async function checkout(req, res) {
  const order = await prisma.order.create({ data: { userId: req.user.id } });
  await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: req.body.total } });
  res.end();
}
`);
    const missing = findings.filter((finding) => finding.id === MISSING);
    assert.ok(missing.length > 0);
    for (const finding of missing) {
        assert.ok(finding.trace && finding.trace.length > 0, "finding must carry trace evidence");
        assert.ok(finding.location.length > 0, "finding must identify the related writes");
        assert.ok(finding.evidence.length > 0, "finding must carry evidence");
    }
});
test("repeated runs over the same source produce identical finding identity", async () => {
    const source = `export async function checkout(req, res) {
  const order = await prisma.order.create({ data: { userId: req.user.id } });
  await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: req.body.total } });
  res.end();
}
`;
    const first = await transactionFindings("txn-determinism-a", source);
    const second = await transactionFindings("txn-determinism-b", source);
    assert.deepEqual(first.map((finding) => `${finding.instance_id ?? finding.id}:${finding.severity}`).sort(), second.map((finding) => `${finding.instance_id ?? finding.id}:${finding.severity}`).sort());
});
//# sourceMappingURL=transactions.test.js.map