// Intentionally flawed: extension/MIME trust, public quarantine, fail-open scanning, no archive limits.
app.post("/upload", upload.any(), async (req, res) => {
  const file = req.files[0];
  if (!file.originalname.endsWith(".zip") || file.mimetype !== "application/zip")
    return res.status(400).end();
  const publicPath = `public/uploads/${file.originalname}`;
  await save(publicPath, file.buffer);
  try {
    await scanner.scan(publicPath);
  } catch {
    // Scanner failure is intentionally ignored.
  }
  await extractZip(publicPath);
  res.send({ url: `/${publicPath}` });
});
