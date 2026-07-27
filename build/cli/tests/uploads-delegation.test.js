import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";
const MIME = "FF-UPLOAD-MIME-001";
async function uploadFindings(name, source) {
    let findings = [];
    await withTemporaryProject(name, async (root) => {
        await writeFile(join(root, "upload.ts"), source, "utf8");
        findings = (await runAnalyzers("uploads", root)).flatMap((run) => run.findings);
    });
    return findings;
}
test("content-type validation delegated to an imported helper is NOT_VERIFIED, not a failure", async () => {
    const findings = await uploadFindings("upload-delegated-validation", `import { assertAllowedType } from "./type-guard.js";
const upload = multer({ limits: { fileSize: 5_000_000, files: 1 } });
app.post("/files", upload.single("doc"), async (req, res) => {
  await assertAllowedType(req.file.buffer, req.file.mimetype);
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();
});
`);
    const mime = findings.filter((finding) => finding.id === MIME);
    assert.equal(mime.length, 1, "the MIME rule should still report an unresolved boundary");
    assert.equal(mime[0]?.status, "NOT_VERIFIED", "validation delegated outside the file must not be a confident failure");
    assert.match(mime[0].evidence.join(" "), /assertAllowedType/u, "evidence must name the delegate that could not be resolved");
});
test("client MIME trusted with no validation anywhere remains a failure", async () => {
    const findings = await uploadFindings("upload-unvalidated-mime", `const upload = multer({ limits: { fileSize: 5_000_000, files: 1 } });
app.post("/files", upload.single("doc"), async (req, res) => {
  if (req.file.mimetype !== "image/png") return res.status(415).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();
});
`);
    const mime = findings.filter((finding) => finding.id === MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "FAIL", "trusting client MIME with no validation at all is a proven defect");
});
test("in-file signature validation keeps the upload path clean", async () => {
    const findings = await uploadFindings("upload-infile-signature", `import { fileTypeFromBuffer } from "file-type";
const upload = multer({ limits: { fileSize: 5_000_000, files: 1 } });
app.post("/files", upload.single("doc"), async (req, res) => {
  const kind = await fileTypeFromBuffer(req.file.buffer);
  if (!kind || kind.mime !== "image/png") return res.status(415).end();
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();
});
`);
    assert.equal(findings.filter((finding) => finding.id === MIME).length, 0, "proven in-file signature validation must not report");
});
//# sourceMappingURL=uploads-delegation.test.js.map