// Intentionally flawed: tenantId comes from the request and is not checked against the session.
app.get("/tenant/:tenantId/invoices", (req, res) =>
  db.invoice.findMany({ where: { tenantId: req.params.tenantId } })
);
