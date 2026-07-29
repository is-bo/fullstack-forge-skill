import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";
const MIME = "FF-UPLOAD-MIME-001";
const EXTENSION = "FF-UPLOAD-EXTENSION-001";
const PUBLIC = "FF-UPLOAD-PUBLIC-001";
const FILENAME = "FF-UPLOAD-FILENAME-001";
const DIRECT_VERIFY = "FF-UPLOAD-DIRECT-VERIFY-001";
const UNSUPPORTED = "FF-UPLOAD-FLOW-NOT-VERIFIED-001";
async function writeSources(root, sources) {
    for (const [path, source] of Object.entries(sources)) {
        const target = join(root, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, source, "utf8");
    }
}
async function uploadFindings(name, sources) {
    let findings = [];
    await withTemporaryProject(name, async (root) => {
        await writeSources(root, sources);
        findings = (await runAnalyzers("uploads", root)).flatMap((run) => run.findings);
    });
    return findings;
}
function withId(findings, id) {
    return findings.filter((finding) => finding.id === id);
}
/** Every hardened fixture below also exercises the parser options and the release ordering. */
const MULTER_OPTIONS = `const upload = multer({ limits: { fileSize: 5_000_000, files: 1 } });`;
const SIGNATURE_VALIDATOR = `import { fileTypeFromBuffer } from "file-type";

export async function assertAllowedType(buffer, declared) {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || detected.mime !== declared) throw new Error("content type mismatch");
}
`;
function multerRoute(body, imports = "") {
    return `${imports}${MULTER_OPTIONS}
app.post("/files", upload.single("doc"), async (req, res) => {
${body}
});
`;
}
/* -------------------------------------------------------------------------- */
/* Delegated validation: resolved helpers                                     */
/* -------------------------------------------------------------------------- */
test("a resolved imported signature validator keeps the upload path clean", async () => {
    const findings = await uploadFindings("upload-resolved-validator", {
        "upload.ts": multerRoute(`  await assertAllowedType(req.file.buffer, req.file.mimetype);
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { assertAllowedType } from "./type-guard.js";\n`),
        "type-guard.ts": SIGNATURE_VALIDATOR
    });
    assert.deepEqual(findings, [], "a validator whose body inspects the bytes is a proven control");
});
test("a validator reached through a renamed export is resolved", async () => {
    const findings = await uploadFindings("upload-renamed-export", {
        "upload.ts": multerRoute(`  await assertAllowedType(req.file.buffer, req.file.mimetype);
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { assertAllowedType } from "./type-guard.js";\n`),
        "type-guard.ts": `import { fileTypeFromBuffer } from "file-type";

async function checkSignature(buffer, declared) {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || detected.mime !== declared) throw new Error("content type mismatch");
}

export { checkSignature as assertAllowedType };
`
    });
    assert.deepEqual(withId(findings, MIME), []);
});
test("a validator reached through a barrel is resolved", async () => {
    const findings = await uploadFindings("upload-barrel-export", {
        "upload.ts": multerRoute(`  await assertAllowedType(req.file.buffer, req.file.mimetype);
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { assertAllowedType } from "./guards/index.js";\n`),
        "guards/index.ts": `export * from "./type-guard.js";\n`,
        "guards/type-guard.ts": SIGNATURE_VALIDATOR
    });
    assert.deepEqual(withId(findings, MIME), []);
});
test("a validator returning a verdict that is checked before acceptance is clean", async () => {
    const findings = await uploadFindings("upload-checked-verdict", {
        "upload.ts": multerRoute(`  const allowed = await detectAllowedType(req.file.buffer, req.file.mimetype);
  if (!allowed) return res.status(415).end();
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { detectAllowedType } from "./type-guard.js";\n`),
        "type-guard.ts": `import { fileTypeFromBuffer } from "file-type";

export async function detectAllowedType(buffer, declared) {
  const detected = await fileTypeFromBuffer(buffer);
  return detected !== undefined && detected.mime === declared;
}
`
    });
    assert.deepEqual(withId(findings, MIME), []);
});
/* -------------------------------------------------------------------------- */
/* Delegated validation: unresolved helpers                                   */
/* -------------------------------------------------------------------------- */
test("an unresolved helper controlling acceptance is NOT_VERIFIED, never a failure", async () => {
    const findings = await uploadFindings("upload-unresolved-gate", {
        "upload.ts": multerRoute(`  if (!(await isAllowedType(req.file.buffer, req.file.mimetype)))
    return res.status(415).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { isAllowedType } from "@acme/upload-policy";\n`)
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "NOT_VERIFIED");
    assert.match(mime[0].evidence.join(" "), /isAllowedType/u);
});
test("content validation behind a dynamic import is NOT_VERIFIED, not a pass", async () => {
    const findings = await uploadFindings("upload-dynamic-import", {
        // The module is present in the corpus on purpose: a resolver that followed the specifier
        // rather than the binding would report this hardened-looking path as clean.
        "upload.ts": multerRoute(`  const { assertAllowedType } = await import("./type-guard.js");
  await assertAllowedType(req.file.buffer, req.file.mimetype);
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`),
        "type-guard.ts": SIGNATURE_VALIDATOR
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "NOT_VERIFIED");
});
/* -------------------------------------------------------------------------- */
/* Delegated validation: helpers that are effects, not decisions               */
/* -------------------------------------------------------------------------- */
const EFFECT_CASES = [
    [
        "storage",
        `import { storeUpload } from "@acme/storage";\n`,
        `  await storeUpload(req.file.originalname, req.file.buffer);`
    ],
    ["logger", `import { logUpload } from "@acme/telemetry";\n`, `  logUpload(req.file);`],
    [
        "image transformer",
        `import { resizeImage } from "@acme/images";\n`,
        `  const thumbnail = await resizeImage(req.file.buffer, 128);
  await privateBucket.put(randomUUID(), thumbnail, { acl: "private" });`
    ],
    [
        "queue publisher",
        `import { publishToQueue } from "@acme/queue";\n`,
        `  await publishToQueue({ buffer: req.file.buffer, name: req.file.originalname });`
    ]
];
test("an imported effect that merely receives the payload never downgrades the failure", async () => {
    for (const [label, imports, body] of EFFECT_CASES) {
        const findings = await uploadFindings(`upload-effect-${label.replace(/\s+/gu, "-")}`, {
            "upload.ts": multerRoute(`  if (req.file.mimetype !== "image/png") return res.status(415).end();
${body}
  res.end();`, imports)
        });
        const mime = withId(findings, MIME);
        assert.equal(mime.length, 1, label);
        assert.equal(mime[0]?.status, "FAIL", `${label} must not make missing validation unresolved`);
    }
});
test("an imported function used elsewhere in the file does not reach the acceptance decision", async () => {
    const findings = await uploadFindings("upload-unrelated-import", {
        "upload.ts": `import { formatBytes } from "@acme/format";
${MULTER_OPTIONS}
app.post("/files", upload.single("doc"), async (req, res) => {
  if (req.file.mimetype !== "image/png") return res.status(415).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();
});

export function describeUpload(file) {
  return formatBytes(file.size);
}
`
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "FAIL");
});
test("a resolved helper that does not inspect the bytes leaves the failure standing", async () => {
    const findings = await uploadFindings("upload-inert-helper", {
        "upload.ts": multerRoute(`  if (req.file.mimetype !== "image/png") return res.status(415).end();
  await recordUpload(req.file.buffer, req.file.mimetype);
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { recordUpload } from "./audit.js";\n`),
        // A maximally reassuring name over a body that validates nothing.
        "audit.ts": `export async function recordUpload(buffer, declared) {
  await auditLog.append({ size: buffer.length, declared });
}
`
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "FAIL", "a body that was read and validates nothing is proof");
});
/* -------------------------------------------------------------------------- */
/* Ordering and determinism                                                   */
/* -------------------------------------------------------------------------- */
test("validation that runs only after public release does not clear the finding", async () => {
    const findings = await uploadFindings("upload-late-validation", {
        "upload.ts": multerRoute(`  await publicBucket.put(req.file.originalname, req.file.buffer, { acl: "public-read" });
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || detected.mime !== req.file.mimetype) return res.status(415).end();
  res.end();`)
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "FAIL", "validation after release has protected nothing");
    assert.equal(withId(findings, PUBLIC).length, 1);
    assert.equal(withId(findings, FILENAME).length, 1);
});
test("finding identity is stable across repeated runs", async () => {
    await withTemporaryProject("upload-determinism", async (root) => {
        await writeSources(root, {
            "upload.ts": multerRoute(`  if (!req.file.originalname.endsWith(".png")) return res.status(400).end();
  if (req.file.mimetype !== "image/png") return res.status(415).end();
  await save(\`public/\${req.file.originalname}\`, req.file.buffer);
  res.end();`)
        });
        const identify = async () => (await runAnalyzers("uploads", root))
            .flatMap((run) => run.findings)
            .map((finding) => `${finding.id}|${finding.instance_id}|${finding.status}`)
            .sort();
        const first = await identify();
        assert.ok(first.length >= 3, "the fixture must actually produce findings to compare");
        assert.deepEqual(await identify(), first);
        assert.deepEqual(await identify(), first);
    });
});
/* -------------------------------------------------------------------------- */
/* Adversarial matrix: one vulnerable and one correct case per upload family   */
/* -------------------------------------------------------------------------- */
const HARDENED_TAIL = `    const detected = await fileTypeFromBuffer(bytes);
    if (!detected || detected.mime !== "image/png") return res.status(415).end();
    const verdict = await scanner.scan(bytes);
    if (verdict.status !== "clean") return res.status(422).end();
    await privateBucket.put(randomUUID(), bytes, { acl: "private" });
    res.end();`;
const MATRIX = [
    {
        family: "multer",
        expected: MIME,
        vulnerable: {
            "route.ts": `app.post("/files", upload.single("doc"), async (req, res) => {
  if (req.file.mimetype !== "image/png") return res.status(415).end();
  await save(\`public/\${req.file.originalname}\`, req.file.buffer);
  res.end();
});
`
        },
        correct: {
            "route.ts": multerRoute(`  const bytes = req.file.buffer;
${HARDENED_TAIL}`)
        }
    },
    {
        family: "busboy",
        expected: MIME,
        vulnerable: {
            "route.ts": `app.post("/files", (req, res) => {
  const bb = busboy({ headers: req.headers });
  bb.on("file", (name, stream, info) => {
    if (info.mimeType !== "image/png") return;
    save(\`public/\${info.filename}\`, stream);
  });
  req.pipe(bb);
});
`
        },
        correct: {
            "route.ts": `app.post("/files", (req, res) => {
  const bb = busboy({ headers: req.headers, limits: { fileSize: 5_000_000, files: 1 } });
  bb.on("file", async (name, stream, info) => {
    const bytes = await collect(stream);
${HARDENED_TAIL}
  });
  req.pipe(bb);
});
`
        }
    },
    {
        family: "formidable",
        expected: EXTENSION,
        vulnerable: {
            "route.ts": `app.post("/files", (req, res) => {
  const form = formidable({ uploadDir: "./public/uploads", keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    const doc = files.doc[0];
    if (!doc.originalFilename.endsWith(".png")) return res.status(400).end();
    await save(\`public/\${doc.originalFilename}\`, doc.filepath);
    res.end();
  });
});
`
        },
        correct: {
            "route.ts": `app.post("/files", (req, res) => {
  const form = formidable({ maxFiles: 1, maxFileSize: 5_000_000 });
  form.parse(req, async (err, fields, files) => {
    const bytes = await readFile(files.doc[0].filepath);
${HARDENED_TAIL}
  });
});
`
        }
    },
    {
        family: "next-formdata",
        expected: MIME,
        vulnerable: {
            "route.ts": `export async function POST(request) {
  const form = await request.formData();
  const doc = form.get("doc");
  if (doc.type !== "image/png") return new Response("no", { status: 415 });
  await put(\`public/\${doc.name}\`, doc, { access: "public" });
  return new Response("ok");
}
`
        },
        correct: {
            "route.ts": `const maxFileSize = 5_000_000;

export async function POST(request) {
  const form = await request.formData();
  const doc = form.get("doc");
  if (doc.size > maxFileSize) return new Response("too large", { status: 413 });
  const bytes = Buffer.from(await doc.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== "image/png") return new Response("no", { status: 415 });
  const verdict = await scanner.scan(bytes);
  if (verdict.status !== "clean") return new Response("blocked", { status: 422 });
  await privateBucket.put(randomUUID(), bytes, { acl: "private" });
  return new Response("ok");
}
`
        }
    },
    {
        family: "raw-multipart",
        expected: EXTENSION,
        vulnerable: {
            "route.ts": `app.post("/files", async (req, res) => {
  if (!req.headers["content-type"].includes("multipart/form-data"))
    return res.status(415).end();
  const raw = await getRawBody(req);
  const part = parsePart(raw);
  if (!part.filename.endsWith(".png")) return res.status(400).end();
  await save(\`public/\${part.filename}\`, part.data);
  res.end();
});
`
        },
        correct: {
            "route.ts": `const maxBytes = 5_000_000;

app.post("/files", async (req, res) => {
  if (!req.headers["content-type"].includes("multipart/form-data"))
    return res.status(415).end();
  const raw = await getRawBody(req, { limit: maxBytes });
  const bytes = parsePart(raw).data;
${HARDENED_TAIL}
});
`
        }
    },
    {
        family: "presigned-s3",
        expected: PUBLIC,
        vulnerable: {
            "route.ts": `import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

app.post("/uploads/sign", async (req, res) => {
  const command = new PutObjectCommand({
    Bucket: "assets",
    Key: \`public/\${req.body.filename}\`,
    ContentType: req.body.contentType,
    ACL: "public-read"
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 900 });
  res.json({ url });
});
`
        },
        correct: {
            "route.ts": `import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function sign(req, res) {
  const command = new PutObjectCommand({
    Bucket: "quarantine",
    Key: \`quarantine/\${randomUUID()}\`,
    ACL: "private",
    ContentLength: 5_000_000
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 900 });
  res.json({ url });
}

export async function confirm(req, res) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: "quarantine", Key: req.body.id }));
  const verdict = await scanner.scan(head);
  if (verdict.status !== "clean") return res.status(422).end();
  res.end();
}
`
        }
    },
    {
        family: "presigned-gcs",
        expected: PUBLIC,
        vulnerable: {
            "route.ts": `app.post("/uploads/sign", async (req, res) => {
  const object = bucket.file(\`public/\${req.body.filename}\`);
  const [url] = await object.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 900_000,
    contentType: req.body.contentType
  });
  await object.makePublic();
  res.json({ url });
});
`
        },
        correct: {
            "route.ts": `export async function sign(req, res) {
  const object = bucket.file(\`quarantine/\${randomUUID()}\`);
  const [url] = await object.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 900_000
  });
  res.json({ url });
}

export async function confirm(req, res) {
  const [metadata] = await bucket.file(req.body.id).getMetadata();
  const verdict = await scanner.scan(metadata);
  if (verdict.status !== "clean") return res.status(422).end();
  res.end();
}
`
        }
    },
    {
        family: "object-storage",
        expected: MIME,
        vulnerable: {
            "route.ts": `export async function handler(req, res) {
  if (req.body.contentType !== "image/png") return res.status(415).end();
  await s3.putObject({
    Bucket: "assets",
    Key: req.body.filename,
    Body: Buffer.from(req.body.fileData, "base64"),
    ACL: "public-read"
  });
  res.end();
}
`
        },
        correct: {
            "route.ts": `export async function handler(req, res) {
  const bytes = Buffer.from(req.body.fileData, "base64");
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== "image/png") return res.status(415).end();
  const verdict = await scanner.scan(bytes);
  if (verdict.status !== "clean") return res.status(422).end();
  await s3.putObject({
    Bucket: "quarantine",
    Key: randomUUID(),
    Body: bytes,
    ACL: "private"
  });
  res.end();
}
`
        }
    }
];
test("every supported upload family reports its vulnerable case", async () => {
    for (const entry of MATRIX) {
        const findings = await uploadFindings(`upload-vulnerable-${entry.family}`, entry.vulnerable);
        const matched = withId(findings, entry.expected);
        assert.equal(matched.length, 1, `${entry.family} should report ${entry.expected}`);
        assert.equal(matched[0]?.status, "FAIL", entry.family);
    }
});
test("every supported upload family leaves its correct case clean", async () => {
    for (const entry of MATRIX) {
        const findings = await uploadFindings(`upload-correct-${entry.family}`, entry.correct);
        assert.deepEqual(findings.map((finding) => `${finding.id}:${finding.status}`), [], `${entry.family} correct-code fixture must not produce a false positive`);
    }
});
test("a presigned grant with no server-side verification is NOT_VERIFIED", async () => {
    const findings = await uploadFindings("upload-presigned-unverified", {
        "route.ts": `import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function sign(req, res) {
  const command = new PutObjectCommand({ Bucket: "quarantine", Key: randomUUID(), ACL: "private" });
  res.json({ url: await getSignedUrl(s3, command, { expiresIn: 900 }) });
}
`
    });
    const direct = withId(findings, DIRECT_VERIFY);
    assert.equal(direct.length, 1);
    assert.equal(direct[0]?.status, "NOT_VERIFIED", "a verifier elsewhere is not disproven");
});
test("an unsupported multipart parser is reported as unsupported, not as clean", async () => {
    const findings = await uploadFindings("upload-unsupported-parser", {
        "route.ts": `import multiparty from "multiparty";

export function handler(req, res) {
  const form = new multiparty.Form();
  form.parse(req, (err, fields, files) => {
    save(files.doc[0].originalFilename, files.doc[0].path);
    res.end();
  });
}
`
    });
    const unsupported = withId(findings, UNSUPPORTED);
    assert.equal(unsupported.length, 1);
    assert.equal(unsupported[0]?.status, "NOT_VERIFIED");
    assert.match(unsupported[0].evidence.join(" "), /multiparty/u);
});
/* -------------------------------------------------------------------------- */
/* Folded in from the original delegation regression suite                     */
/* -------------------------------------------------------------------------- */
test("content-type validation delegated to an unopenable helper is NOT_VERIFIED", async () => {
    const findings = await uploadFindings("upload-delegated-validation", {
        "upload.ts": multerRoute(`  await assertAllowedType(req.file.buffer, req.file.mimetype);
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { assertAllowedType } from "./type-guard.js";\n`)
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1, "the MIME rule should still report an unresolved boundary");
    assert.equal(mime[0]?.status, "NOT_VERIFIED");
    assert.match(mime[0].evidence.join(" "), /assertAllowedType/u);
});
test("client MIME trusted with no validation anywhere remains a failure", async () => {
    const findings = await uploadFindings("upload-unvalidated-mime", {
        "upload.ts": multerRoute(`  if (req.file.mimetype !== "image/png") return res.status(415).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`)
    });
    const mime = withId(findings, MIME);
    assert.equal(mime.length, 1);
    assert.equal(mime[0]?.status, "FAIL");
});
test("in-file signature validation keeps the upload path clean", async () => {
    const findings = await uploadFindings("upload-infile-signature", {
        "upload.ts": multerRoute(`  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || detected.mime !== "image/png") return res.status(415).end();
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`, `import { fileTypeFromBuffer } from "file-type";\n`)
    });
    assert.deepEqual(withId(findings, MIME), []);
});
test("a raw magic-byte comparison counts as decoded-content validation", async () => {
    const findings = await uploadFindings("upload-magic-bytes", {
        "upload.ts": multerRoute(`  const signature = req.file.buffer.readUInt32BE(0);
  if (signature !== 0x89504e47) return res.status(415).end();
  if (req.file.mimetype !== "image/png") return res.status(415).end();
  const verdict = await scanner.scan(req.file.buffer);
  if (verdict.status !== "clean") return res.status(422).end();
  await privateBucket.put(randomUUID(), req.file.buffer, { acl: "private" });
  res.end();`)
    });
    assert.deepEqual(withId(findings, MIME), []);
});
