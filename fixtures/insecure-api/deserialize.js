// Intentionally insecure, non-runnable evaluation fixture.
const serialize = require("node-serialize");
app.post("/state/import", (req, res) => {
  const state = serialize.unserialize(req.body.snapshot);
  res.json(state);
});
