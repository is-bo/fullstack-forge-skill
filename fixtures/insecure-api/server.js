// Intentionally insecure, non-runnable evaluation fixture.
const API_TOKEN = "fixture_token_1234567890";
app.get("/users/:id", async (req, res) => {
  const rows = await db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
  res.send(rows);
});
app.post("/users/search", async (req, res) => {
  const rows = await db.users.find({ $where: req.body.filter });
  res.send(rows);
});
app.get("/diagnostics", (req, res) => {
  childProcess.exec(`ping ${req.query.host}`, (_error, stdout) => res.send(stdout));
});
