// Intentionally insecure, non-runnable evaluation fixture.
app.get("/preview", async (req, res) => {
  const upstream = await fetch(req.query.url);
  res.send(await upstream.text());
});
