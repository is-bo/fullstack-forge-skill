// Intentionally insecure, non-runnable evaluation fixture.
const requireRole = (role) => (req, res, next) => next();
app.get("/orders/:orderId", requireRole("user"), async (req, res) => {
  const order = await db.orders.findById(req.params.orderId);
  res.json(order);
});
