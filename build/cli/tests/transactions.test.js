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
/* -------------------------------------------------------------------------- */
/* Independent-review regression matrix                                        */
/*                                                                             */
/* One fixture per defect class found while reviewing the analyzer, plus the   */
/* CORRECT-CODE control that each fix had to keep clean. The controls matter   */
/* as much as the defects: every fix here narrows or widens a boundary rule,   */
/* and a narrowed rule that also silences correct code is not a fix.           */
/* -------------------------------------------------------------------------- */
test("a BEGIN and COMMIT in neighbouring functions do not enclose an unrelated workflow", async () => {
    const ids = await transactionIds("txn-raw-cross-function", `const client = createPool();
export async function openBatch() {
  await client.query("BEGIN");
  await client.query("COMMIT");
}
export async function checkout(order) {
  const inserted = await client.query("INSERT INTO orders (total) VALUES ($1) RETURNING id", [order.total]);
  await client.query("INSERT INTO ledger_entries (order_id) VALUES ($1)", [inserted.rows[0].id]);
}
export async function closeBatch() {
  await client.query("BEGIN");
  await client.query("COMMIT");
}
`);
    assert.ok(ids.has(MISSING) || ids.has(UNRESOLVED), `file-global BEGIN/COMMIT markers proved a boundary that does not exist; got ${[...ids].join(", ") || "nothing"}`);
});
test("a write after COMMIT is not covered by the transaction that already closed", async () => {
    const ids = await transactionIds("txn-raw-reopened", `const client = createPool();
export async function checkout(order) {
  await client.query("BEGIN");
  const inserted = await client.query("INSERT INTO orders (total) VALUES ($1) RETURNING id", [order.total]);
  await client.query("COMMIT");
  await client.query("INSERT INTO ledger_entries (order_id) VALUES ($1)", [inserted.rows[0].id]);
  await client.query("BEGIN");
  await client.query("COMMIT");
}
`);
    assert.ok(ids.has(MISSING) || ids.has(UNRESOLVED), `a COMMIT between the BEGIN and the write must end the boundary; got ${[...ids].join(", ") || "nothing"}`);
});
test("CORRECT CODE: a raw BEGIN/COMMIT around related writes stays clean", async () => {
    const ids = await transactionIds("txn-raw-correct", `const client = createPool();
export async function checkout(order) {
  await client.query("BEGIN");
  const inserted = await client.query("INSERT INTO orders (total) VALUES ($1) RETURNING id", [order.total]);
  await client.query("INSERT INTO ledger_entries (order_id) VALUES ($1)", [inserted.rows[0].id]);
  await client.query("COMMIT");
}
`);
    assert.equal(ids.size, 0, `unexpected ${[...ids].join(", ")}`);
});
test("CORRECT CODE: a rollback-only path is still an atomic boundary", async () => {
    const ids = await transactionIds("txn-raw-rollback", `const client = createPool();
export async function checkout(order) {
  await client.query("BEGIN");
  const inserted = await client.query("INSERT INTO orders (total) VALUES ($1) RETURNING id", [order.total]);
  await client.query("INSERT INTO ledger_entries (order_id) VALUES ($1)", [inserted.rows[0].id]);
  await client.query("ROLLBACK");
}
`);
    assert.equal(ids.size, 0, `a rolled-back transaction applies all writes or none: ${[...ids].join(", ")}`);
});
test("a transaction handle declared in one function does not prove a boundary in another", async () => {
    const findings = await transactionFindings("txn-handle-scope", `export async function openTransfer() {
  const trx = await knex.transaction();
  await trx.commit();
}
export async function applyTransfer(trx, payload) {
  await trx("accounts").where({ accountId: payload.accountId }).update({ balance: payload.balance });
  await trx("ledger").insert({ accountId: payload.accountId, amount: payload.amount });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(UNRESOLVED), `a caller-supplied handle is unresolved, not proven; got ${[...ids].join(", ") || "nothing"}`);
    assert.ok(!ids.has(MISSING), "a caller-supplied handle must not become a confident failure either");
});
test("a transaction option threaded through a property path is unresolved, not absent", async () => {
    const findings = await transactionFindings("txn-option-path", `export async function checkout(ctx, order) {
  await Order.create({ orderId: order.id }, { transaction: ctx.tx });
  await LedgerEntry.create({ orderId: order.id, amount: order.total }, { transaction: ctx.tx });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(UNRESOLVED), `expected ${UNRESOLVED}, got ${[...ids].join(", ") || "nothing"}`);
    assert.ok(!ids.has(MISSING), "an explicitly threaded handle must not be reported as no transaction at all");
});
test("a payload column named like a handle does not downgrade a real defect", async () => {
    const findings = await transactionFindings("txn-payload-handle-name", `export async function checkout(order, session) {
  await prisma.order.create({ data: { id: order.id, session: session } });
  await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(MISSING), `expected a confident ${MISSING}, got ${[...ids].join(", ") || "nothing"}`);
    assert.ok(!ids.has(UNRESOLVED), "a data column must never masquerade as a transaction handle");
});
test("a receiver named as a transaction handle from an unresolvable factory is NOT_VERIFIED", async () => {
    const findings = await transactionFindings("txn-unresolved-handle-origin", `export async function checkout(order) {
  const tx = await beginWork();
  await tx.order.create({ data: { id: order.id } });
  await tx.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
  await tx.commit();
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(UNRESOLVED), `expected ${UNRESOLVED}, got ${[...ids].join(", ") || "nothing"}`);
    assert.ok(!ids.has(MISSING), "an unresolvable transaction factory must not produce a confident failure");
});
test("an ordinary client from an unresolvable factory remains a confident failure", async () => {
    const findings = await transactionFindings("txn-ordinary-client-origin", `export async function checkout(order) {
  const db = getDatabase();
  await db.order.create({ data: { id: order.id } });
  await db.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(MISSING), `the commonest genuine defect shape must stay confident; got ${[...ids].join(", ") || "nothing"}`);
    assert.ok(!ids.has(UNRESOLVED), "an ordinary client name is not evidence of a transaction");
});
test("nested transaction scopes are unproven rather than a confident split", async () => {
    const findings = await transactionFindings("txn-nested", `export async function checkout(order) {
  await prisma.$transaction(async (tx) => {
    await tx.order.create({ data: { id: order.id } });
    await tx.$transaction(async (inner) => {
      await inner.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
    });
  });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(UNRESOLVED), `expected ${UNRESOLVED}, got ${[...ids].join(", ") || "nothing"}`);
    assert.ok(!ids.has(MISSING), "savepoint versus independent-connection nesting is vendor-specific and not decidable here");
});
test("two sibling transactions over related writes remain a confident split", async () => {
    const findings = await transactionFindings("txn-sibling-transactions", `export async function checkout(order) {
  await prisma.$transaction(async (tx) => {
    await tx.order.create({ data: { id: order.id } });
  });
  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
  });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(MISSING), `expected ${MISSING}, got ${[...ids].join(", ") || "nothing"}`);
});
test("a workflow whose every write happens inside a helper is still analysed", async () => {
    const ids = await transactionIds("txn-helper-only-workflow", `async function recordEntry(orderId, amount) {
  await prisma.ledgerEntry.create({ data: { orderId: orderId, amount: amount } });
}
export async function settle(order) {
  await recordEntry(order.id, order.total);
  await recordEntry(order.id, order.fee);
}
`);
    assert.ok(ids.has(MISSING), `two calls to one helper are two related writes; got ${[...ids].join(", ") || "nothing"}`);
});
test("a helper writing through its own receiver under a caller transaction is NOT_VERIFIED", async () => {
    const findings = await transactionFindings("txn-helper-own-receiver", `async function writeLedger(orderId, amount) {
  await prisma.ledgerEntry.create({ data: { orderId: orderId, amount: amount } });
}
export async function checkout(order) {
  await prisma.$transaction(async (tx) => {
    await tx.order.create({ data: { id: order.id } });
    await writeLedger(order.id, order.total);
  });
}
`);
    const ids = new Set(findings.map((finding) => finding.id));
    assert.ok(ids.has(UNRESOLVED), `expected ${UNRESOLVED}, got ${[...ids].join(", ") || "nothing"}`);
});
test("writes sharing only an ownership or tenancy identifier are not related", async () => {
    const ownership = await transactionIds("txn-owner-scope", `export async function cleanup(req) {
  await prisma.draft.delete({ where: { userId: req.user.id } });
  await prisma.notification.create({ data: { userId: req.user.id, text: "done" } });
}
`);
    assert.equal(ownership.size, 0, `a shared owner is not one invariant: ${[...ownership].join(", ")}`);
    const tenancy = await transactionIds("txn-tenant-scope", `export async function refresh(req) {
  await prisma.reportSnapshot.deleteMany({ where: { tenantId: req.tenant.id } });
  await prisma.dashboardWidget.create({ data: { tenantId: req.tenant.id, kind: "summary" } });
}
`);
    assert.equal(tenancy.size, 0, `a shared tenant is not one invariant: ${[...tenancy].join(", ")}`);
});
test("a destructive write sharing a row identity with a dependent write is still reported", async () => {
    const ids = await transactionIds("txn-destructive-identity", `export async function detach(req) {
  await prisma.paymentMethod.delete({ where: { id: req.body.methodId } });
  await prisma.wallet.update({ where: { id: req.body.methodId }, data: { defaultMethod: null } });
}
`);
    assert.ok(ids.has(MISSING), `expected ${MISSING}, got ${[...ids].join(", ") || "nothing"}`);
});
test("cross-function writes are never grouped into one workflow", async () => {
    const ids = await transactionIds("txn-cross-function", `export async function createOrder(order) {
  await prisma.order.create({ data: { id: order.id } });
}
export async function recordLedger(order) {
  await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
}
`);
    assert.equal(ids.size, 0, `writes in separate functions are separate workflows: ${[...ids].join(", ")}`);
});
test("CORRECT CODE: recognised vendor transaction wrappers stay clean", async () => {
    const cases = [
        [
            "txn-ok-sequelize",
            `export async function transfer(payload) {
  const t = await sequelize.transaction();
  await Account.decrement("balance", { by: payload.amount, where: { id: payload.accountId }, transaction: t });
  await LedgerEntry.create({ accountId: payload.accountId, amount: payload.amount }, { transaction: t });
  await t.commit();
}
`
        ],
        [
            "txn-ok-typeorm",
            `export async function transfer(payload) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();
  await queryRunner.manager.update(Account, { id: payload.accountId }, { balance: payload.balance });
  await queryRunner.manager.insert(LedgerEntry, { accountId: payload.accountId, amount: payload.amount });
  await queryRunner.commitTransaction();
}
`
        ],
        [
            "txn-ok-mongo-session",
            `export async function transfer(payload) {
  const session = client.startSession();
  session.startTransaction();
  await accounts.updateOne({ _id: payload.accountId }, { balance: payload.amount }, { session });
  await ledger.insertOne({ accountId: payload.accountId, amount: payload.amount }, { session });
  await session.commitTransaction();
}
`
        ],
        [
            "txn-ok-drizzle",
            `export async function checkout(order) {
  await db.transaction(async (tx) => {
    await tx.insert(orders).values({ id: order.id });
    await tx.insert(ledgerEntries).values({ orderId: order.id, amount: order.total });
  });
}
`
        ],
        [
            "txn-ok-prisma-array",
            `export async function checkout(order) {
  await prisma.$transaction([
    prisma.order.create({ data: { id: order.id } }),
    prisma.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } })
  ]);
}
`
        ],
        [
            "txn-ok-knex-transacting",
            `export async function transfer(payload) {
  const trx = await knex.transaction();
  await knex("accounts").where({ accountId: payload.accountId }).update({ balance: payload.balance }).transacting(trx);
  await knex("ledger").insert({ accountId: payload.accountId, amount: payload.amount }).transacting(trx);
  await trx.commit();
}
`
        ],
        [
            "txn-ok-delegating-wrapper",
            `async function unitOfWork(work) {
  return prisma.$transaction(work);
}
export async function checkout(order) {
  await unitOfWork(async (tx) => {
    await tx.order.create({ data: { id: order.id } });
    await tx.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
  });
}
`
        ]
    ];
    for (const [name, source] of cases) {
        const ids = await transactionIds(name, source);
        assert.equal(ids.size, 0, `${name} must stay clean, got ${[...ids].join(", ")}`);
    }
});
test("a callback wrapper that hands out no handle proves nothing and stays a failure", async () => {
    const ids = await transactionIds("txn-retry-wrapper", `export async function checkout(order) {
  await retry(async () => {
    await prisma.order.create({ data: { id: order.id } });
    await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: order.total } });
  });
}
`);
    assert.ok(ids.has(MISSING), `a retry helper is not a transaction; got ${[...ids].join(", ") || "nothing"}`);
});
test("severity follows the demonstrated domain and every unresolved finding is NOT_VERIFIED", async () => {
    const financial = await transactionFindings("txn-severity-financial", `export async function checkout(req) {
  const order = await prisma.order.create({ data: { userId: req.user.id, total: req.body.total } });
  await prisma.ledgerEntry.create({ data: { orderId: order.id, amount: req.body.total } });
}
`);
    const confirmed = financial.filter((finding) => finding.id === MISSING);
    assert.ok(confirmed.length > 0, "expected a financial consistency finding");
    assert.ok(confirmed.every((finding) => finding.severity === "CRITICAL"), `a financial amount write is CRITICAL, got ${confirmed.map((entry) => entry.severity).join(", ")}`);
    const inventory = await transactionFindings("txn-severity-inventory", `export async function release(req) {
  await prisma.reservation.delete({ where: { id: req.body.reservationId } });
  await prisma.stockItem.update({ where: { reservationId: req.body.reservationId }, data: { quantity: req.body.quantity } });
}
`);
    const stock = inventory.filter((finding) => finding.id === MISSING);
    assert.ok(stock.length > 0, "expected an inventory consistency finding");
    assert.ok(stock.every((finding) => finding.severity === "HIGH"), `inventory pairs are documented as HIGH, got ${stock.map((entry) => entry.severity).join(", ")}`);
});
test("a row filter naming an amount column does not escalate severity", async () => {
    const findings = await transactionFindings("txn-severity-filter-only", `export async function annotate(req) {
  await prisma.cart.update({ where: { totalId: req.body.totalId }, data: { note: req.body.note } });
  await prisma.cartNote.create({ data: { cartId: req.body.totalId, note: req.body.note } });
}
`);
    const reported = findings.filter((finding) => finding.id === MISSING);
    assert.ok(reported.length > 0, "expected a parent/child finding");
    assert.ok(reported.every((finding) => finding.severity !== "CRITICAL"), `a filter column is not an amount mutation, got ${reported.map((entry) => entry.severity).join(", ")}`);
});
test("every unresolved-boundary finding carries LOW confidence and NOT_VERIFIED status", async () => {
    const findings = await transactionFindings("txn-unresolved-contract", `export async function settle(req) {
  await mysteryUnit(async (handle) => {
    await handle.invoice.update({ where: { id: req.body.id }, data: { status: "PAID" } });
    await handle.receipt.create({ data: { invoiceId: req.body.id, amount: req.body.total } });
  });
}
`);
    const unresolved = findings.filter((finding) => finding.id === UNRESOLVED);
    assert.ok(unresolved.length > 0, "expected an unresolved-boundary finding");
    for (const finding of unresolved) {
        assert.equal(finding.status, "NOT_VERIFIED");
        assert.equal(finding.confidence, "LOW");
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
