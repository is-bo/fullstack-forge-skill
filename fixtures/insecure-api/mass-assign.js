// Intentionally insecure, non-runnable evaluation fixture.
app.put("/profile", async (req, res) => {
  const updated = await db.user.update({ where: { id: req.session.userId }, data: req.body });
  res.json(updated);
});
