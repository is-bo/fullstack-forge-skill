// Intentionally flawed: parsed body is trusted without signature, event uniqueness, or replay safety.
app.post("/webhooks/stripe", async (req, res) => {
  await chargeInvoice(req.body.invoice);
  await grantEntitlement(req.body.customer, req.body.plan);
  await sendReceipt(req.body.customer);
  res.sendStatus(200);
});
