// Intentionally approval-bound: object authorization and upload policy cannot be invented.
app.get("/documents/:id", async (req, res) => {
  const document = await db.document.findUnique({ where: { id: req.params.id } });
  res.send(document);
});

app.post("/documents", upload.any(), async (req, res) => {
  await saveDocuments(req.files);
  res.sendStatus(201);
});
