// Intentionally flawed: hostile invoice text controls unrestricted financial and inventory tools.
const answer = await model.run(`Review this invoice:\n${req.body.invoiceText}`, {
  tools: {
    payInvoice: (args) => payments.pay(args),
    adjustStock: (args) => inventory.applyAdjustment(args)
  }
});
