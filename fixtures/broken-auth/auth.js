// Intentionally flawed: predictable session and insecure cookie settings.
app.post("/login", (req, res) =>
  res.cookie("session", req.body.email, { httpOnly: false, secure: false })
);
