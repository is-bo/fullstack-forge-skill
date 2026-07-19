// Intentionally insecure, non-runnable evaluation fixture.
app.get("/users/export", async (req, res) => {
  const rows = await db.query("SELECT name, email FROM users");
  const csv = rows.map((row) => [row.name, row.email].join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});
