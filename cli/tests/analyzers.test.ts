import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { withTemporaryProject } from "./helpers.js";

test("security analyzer traces redirect, credential, sensitive logging, and validation boundaries", async () => {
  await withTemporaryProject("analyzer-security", async (root) => {
    await writeFile(
      join(root, "server.ts"),
      `const PAYMENT_API_SECRET = "prod_secret_1234567890";
app.get("/redirect", (req, res) => {
  console.log(req.body.password);
  res.redirect(req.query.next);
});
`,
      "utf8"
    );
    const ids = await findingIds(root, "security");
    for (const id of ["FF-SEC-CREDENTIAL-001", "FF-SEC-LOG-001", "FF-SEC-REDIRECT-001"])
      assert.ok(ids.has(id), id);
  });
});

test("tenancy analyzer detects unscoped background and export queries", async () => {
  await withTemporaryProject("analyzer-tenant-job", async (root) => {
    await writeFile(
      join(root, "export-job.ts"),
      "export async function exportJob() { return db.invoice.findMany({ where: {} }); }\n",
      "utf8"
    );
    assert.ok((await findingIds(root, "tenancy")).has("FF-TENANT-BACKGROUND-001"));
  });
});

test("an ordinary exported handler is not a background-job signal", async () => {
  await withTemporaryProject("analyzer-exported-handler", async (root) => {
    await writeFile(
      join(root, "api.ts"),
      "export async function listInvoices() { return db.invoice.findMany({ where: {} }); }\n",
      "utf8"
    );
    assert.ok(!(await findingIds(root, "tenancy")).has("FF-TENANT-BACKGROUND-001"));
  });
});

test("upload analyzer detects missing scan, original filename paths, and absent limits", async () => {
  await withTemporaryProject("analyzer-upload", async (root) => {
    await writeFile(
      join(root, "upload.ts"),
      `app.post("/upload", upload.any(), async (req, res) => {
  const file = req.files[0];
  await save(\`quarantine/\${file.originalname}\`, file.buffer);
  res.sendStatus(201);
});
`,
      "utf8"
    );
    const ids = await findingIds(root, "uploads");
    for (const id of [
      "FF-UPLOAD-ANY-001",
      "FF-UPLOAD-SCAN-001",
      "FF-UPLOAD-FILENAME-001",
      "FF-UPLOAD-LIMITS-001"
    ])
      assert.ok(ids.has(id), id);
  });
});

test("boundary analyzers do not treat hostile regression snippets as production behavior", async () => {
  await withTemporaryProject("analyzer-test-boundary", async (root) => {
    await mkdir(join(root, "tests"));
    await writeFile(
      join(root, "tests", "upload.test.ts"),
      `const PAYMENT_API_SECRET = "fixture_secret_1234567890";
app.post("/upload", upload.any(), async (req, res) => {
  await save(req.files[0].originalname, req.files[0].buffer);
  res.sendStatus(201);
});
`,
      "utf8"
    );
    assert.deepEqual(await findingIds(root, "security"), new Set());
    assert.deepEqual(await findingIds(root, "uploads"), new Set());
  });
});

test("boundary analyzers do not treat vulnerable fixtures as production behavior", async () => {
  await withTemporaryProject("analyzer-fixture-boundary", async (root) => {
    await mkdir(join(root, "fixtures"));
    await writeFile(
      join(root, "fixtures", "upload.ts"),
      `app.post("/upload", upload.any(), async (req, res) => {
  await publicBucket.put(req.files[0].originalname, req.files[0].buffer);
  res.sendStatus(201);
});
`,
      "utf8"
    );
    assert.deepEqual(await findingIds(root, "security"), new Set());
    assert.deepEqual(await findingIds(root, "uploads"), new Set());
  });
});

test("query analyzer detects pagination without deterministic ordering", async () => {
  await withTemporaryProject("analyzer-order", async (root) => {
    await writeFile(
      join(root, "query.ts"),
      "export const page = prisma.invoice.findMany({ take: 20, cursor: { id } });\n",
      "utf8"
    );
    assert.ok((await findingIds(root, "queries")).has("FF-QUERY-ORDER-001"));
  });
});

test("cache analyzer preserves confirmed unscoped literal failures", async () => {
  const findings = await cacheFindings(
    "cache-literal",
    `export async function load(userId: string, tenantId: string) {
  await redis.get("dashboard");
  await redis.set("dashboard", value);
}`
  );
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-USER-001"));
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-TENANT-001"));
  assert.ok(findings.every((finding) => finding.status === "FAIL"));
});

test("cache analyzer resolves immutable locals, aliases, objects, destructuring, and wrappers", async () => {
  const safeSources = [
    `const key = \`dashboard:tenant:\${tenantId}:user:\${userId}\`;
await redis.get(key);`,
    `const tenantKey = \`tenant:\${tenantId}\`;
const userKey = \`\${tenantKey}:user:\${userId}\`;
const key = \`\${userKey}:dashboard\`;
await redis.get(key);`,
    `const keys = { dashboard: \`tenant:\${tenantId}:user:\${userId}:dashboard\` };
await redis.get(keys.dashboard);`,
    `const keys = { ["dashboard"]: \`tenant:\${tenantId}:user:\${userId}:dashboard\` };
await redis.get(keys["dashboard"]);`,
    `const keys = { dashboard: \`tenant:\${tenantId}:user:\${userId}:dashboard\` };
const { dashboard } = keys;
await redis.get(dashboard);`,
    `const prefix = "dashboard:tenant:" + tenantId;
const key = (prefix + ":user:" + userId) as string;
await redis.get((key));`
  ];
  for (const [index, body] of safeSources.entries()) {
    const findings = await cacheFindings(
      `cache-safe-${index}`,
      `export async function load(userId: string, tenantId: string) { ${body} }`
    );
    assert.deepEqual(findings, [], `safe shape ${index}`);
  }
});

test("cache analyzer keeps tenant and user scope findings independent", async () => {
  const missingUser = await cacheFindings(
    "cache-missing-user",
    `export async function load(userId: string, tenantId: string) {
  const key = \`dashboard:tenant:\${tenantId}\`;
  await redis.get(key);
}`
  );
  assert.ok(missingUser.some((finding) => finding.id === "FF-CACHE-USER-001"));
  assert.ok(!missingUser.some((finding) => finding.id === "FF-CACHE-TENANT-001"));

  const missingTenant = await cacheFindings(
    "cache-missing-tenant",
    `export async function load(userId: string, tenantId: string) {
  const key = \`dashboard:user:\${userId}\`;
  await redis.get(key);
}`
  );
  assert.ok(missingTenant.some((finding) => finding.id === "FF-CACHE-TENANT-001"));
  assert.ok(!missingTenant.some((finding) => finding.id === "FF-CACHE-USER-001"));
});

test("cache analyzer follows straight-line mutable reassignment without trusting the initializer", async () => {
  const findings = await cacheFindings(
    "cache-reassigned",
    `export async function load(userId: string, tenantId: string) {
  let key = \`tenant:\${tenantId}:user:\${userId}\`;
  key = "dashboard";
  await redis.get(key);
}`
  );
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-USER-001"));
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-TENANT-001"));
  assert.ok(!findings.some((finding) => finding.id === "FF-CACHE-KEY-NOT-VERIFIED-001"));
});

test("cache analyzer reports unknown helpers and dynamic keys as NOT_VERIFIED", async () => {
  for (const [name, body] of [
    ["helper", "const key = buildCacheKey(tenantId, userId);"],
    ["cross-function", "const key = getDashboardKey();"],
    [
      "computed-property",
      `const property = requestKey();
const keys = { dashboard: \`tenant:\${tenantId}:user:\${userId}\` };
const key = keys[property];`
    ],
    [
      "object-mutation",
      `const keys = { dashboard: \`tenant:\${tenantId}:user:\${userId}\` };
keys.dashboard = "dashboard";
const key = keys.dashboard;`
    ],
    [
      "conditional-reassignment",
      `let key = \`tenant:\${tenantId}:user:\${userId}\`;
if (flag) key = "dashboard";`
    ]
  ] as const) {
    const findings = await cacheFindings(
      `cache-unresolved-${name}`,
      `export async function load(userId: string, tenantId: string) {
  ${body}
  await redis.get(key);
}`
    );
    assert.equal(findings.length, 1, name);
    const finding = findings[0];
    assert.ok(finding !== undefined);
    assert.equal(finding.id, "FF-CACHE-KEY-NOT-VERIFIED-001", name);
    assert.equal(finding.status, "NOT_VERIFIED", name);
    assert.equal(finding.severity, "MEDIUM", name);
    assert.match(finding.evidence.join(" "), /not a confirmed cross-user or cross-tenant leak/iu);
  }
});

test("cache analyzer stays bounded across cycles, deep aliases, large files, and shadowed names", async () => {
  const deepAliases = Array.from(
    { length: 24 },
    (_, index) => `const key${index + 1} = key${index};`
  ).join("\n");
  const filler = Array.from(
    { length: 2500 },
    (_, index) => `const filler${index} = ${index};`
  ).join("\n");
  const findings = await cacheFindings(
    "cache-bounded",
    `export async function load(userId: string, tenantId: string) {
  ${filler}
  let cycleA: string;
  let cycleB: string;
  cycleA = cycleB;
  cycleB = cycleA;
  await redis.get(cycleA);
  const key0 = \`tenant:\${tenantId}:user:\${userId}\`;
  ${deepAliases}
  await redis.get(key24);
  const key = "dashboard";
  {
    const key = \`tenant:\${tenantId}:user:\${userId}\`;
    await redis.get(key);
  }
  await redis.get(key);
}`
  );
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-KEY-NOT-VERIFIED-001"));
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-USER-001"));
  assert.ok(findings.some((finding) => finding.id === "FF-CACHE-TENANT-001"));
});

test("payment analyzer detects parsed-payload verification and client-controlled amounts", async () => {
  await withTemporaryProject("analyzer-payment", async (root) => {
    await writeFile(
      join(root, "payments.ts"),
      `app.post("/webhooks/stripe", async (req, res) => {
  stripe.webhooks.constructEvent(req.body, req.headers.signature, secret);
  await chargeInvoice(req.body.invoice);
  res.sendStatus(200);
});
export const pay = (req) => stripe.paymentIntents.create({ amount: req.body.amount });
`,
      "utf8"
    );
    const ids = await findingIds(root, "payments");
    assert.ok(ids.has("FF-PAY-WEBHOOK-RAW-001"));
    assert.ok(ids.has("FF-PAY-AMOUNT-001"));
    assert.ok(ids.has("FF-PAY-IDEMPOTENCY-001"));
  });
});

test("SQL sink analysis distinguishes SQL structure from bound values", async () => {
  const cases = [
    {
      name: "unsafe-template",
      source:
        "export const run = (req) => pool.query(`SELECT * FROM users WHERE name = '${req.query.term}'`);",
      expected: "FAIL"
    },
    {
      name: "safe-positional",
      source:
        'export const run = (req) => pool.query("SELECT * FROM users WHERE name = $1", [req.query.term]);',
      expected: "CLEAN"
    },
    {
      name: "safe-ilike-template-value",
      source:
        'export const run = (req) => pool.query("SELECT * FROM users WHERE name ILIKE $1", [`%${req.query.term}%`]);',
      expected: "CLEAN"
    },
    {
      name: "safe-client",
      source:
        'export const run = (req) => client.query("SELECT * FROM users WHERE name = $1", [req.query.term]);',
      expected: "CLEAN"
    },
    {
      name: "safe-execute",
      source:
        'export const run = (req) => db.execute("SELECT * FROM users WHERE name = ?", [req.query.term]);',
      expected: "CLEAN"
    },
    {
      name: "safe-prisma-tag",
      source:
        "export const run = (req) => prisma.$queryRaw`SELECT * FROM users WHERE name = ${req.query.term}`;",
      expected: "CLEAN"
    },
    {
      name: "unsafe-prisma-raw",
      source:
        "export const run = (req) => prisma.$queryRawUnsafe(`SELECT * FROM users WHERE name = '${req.query.term}'`);",
      expected: "FAIL"
    },
    {
      name: "unknown-wrapper",
      source:
        "export const run = (req) => customDb.search('SELECT * FROM users WHERE name = ?', [req.query.term]);",
      expected: "NOT_VERIFIED"
    }
  ] as const;
  for (const fixture of cases) {
    const findings = await analyzerFindings(`sql-${fixture.name}`, fixture.source, "security");
    const sql = findings.filter((finding) => finding.id.startsWith("FF-SEC-SQL"));
    const validation = findings.filter((finding) => finding.id === "FF-SEC-VALIDATION-001");
    if (fixture.expected === "CLEAN") {
      assert.deepEqual(sql, [], fixture.name);
      assert.deepEqual(validation, [], fixture.name);
    } else if (fixture.expected === "FAIL") {
      assert.ok(
        sql.some((finding) => finding.id === "FF-SEC-SQL-001" && finding.status === "FAIL"),
        fixture.name
      );
    } else {
      assert.ok(
        sql.some(
          (finding) =>
            finding.id === "FF-SEC-SQL-NOT-VERIFIED-001" && finding.status === "NOT_VERIFIED"
        ),
        fixture.name
      );
    }
  }
});

test("tenant scope maps raw SQL placeholders to authenticated tenant context", async () => {
  const safe = await analyzerFindings(
    "tenant-safe-raw",
    `export async function load(req) {
  return pool.query("SELECT id FROM patients WHERE clinicId = $1", [req.session.user.clinicId]);
}`,
    "tenancy"
  );
  assert.ok(!safe.some((finding) => finding.id.startsWith("FF-TENANT-SCOPE")));

  const unsafe = await analyzerFindings(
    "tenant-unsafe-raw",
    `export async function load(req, clinicId) {
  return pool.query("SELECT id FROM patients WHERE id = $1", [req.params.id]);
}`,
    "tenancy"
  );
  assert.ok(unsafe.some((finding) => finding.id === "FF-TENANT-SCOPE-001"));

  const unresolved = await analyzerFindings(
    "tenant-unresolved-raw",
    `export async function load(req) {
  const clinicId = resolveClinic(req);
  return pool.query("SELECT id FROM patients WHERE clinicId = $1", [clinicId]);
}`,
    "tenancy"
  );
  assert.ok(
    unresolved.some(
      (finding) =>
        finding.id === "FF-TENANT-SCOPE-NOT-VERIFIED-001" && finding.status === "NOT_VERIFIED"
    )
  );
  assert.ok(!unresolved.some((finding) => finding.id === "FF-TENANT-SCOPE-001"));
});

test("common domain tenant keys preserve raw SQL scope outcomes", async () => {
  for (const key of [
    "tenantId",
    "clinicId",
    "cabinetId",
    "practiceId",
    "hospitalId",
    "accountId",
    "merchantId",
    "schoolId",
    "workspaceId"
  ]) {
    const findings = await analyzerFindings(
      `tenant-key-${key}`,
      `export async function load(req) {
  return pool.query("SELECT id FROM records WHERE ${key} = $1", [req.session.user.${key}]);
}`,
      "tenancy"
    );
    assert.ok(!findings.some((finding) => finding.id.startsWith("FF-TENANT-SCOPE")), key);
  }
});

test("sensitive Express routes require resolvable authorization", async () => {
  const unprotected = await analyzerFindings(
    "authz-route-unprotected",
    `router.delete("/admin/patients/:id", async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});`,
    "authorization"
  );
  assert.ok(unprotected.some((finding) => finding.id === "FF-AUTHZ-ROUTE-001"));

  const protectedRoute = await analyzerFindings(
    "authz-route-protected",
    `router.delete("/admin/patients/:id", requireRole("admin"), async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});`,
    "authorization"
  );
  assert.ok(!protectedRoute.some((finding) => finding.id === "FF-AUTHZ-ROUTE-001"));

  const publicRoute = await analyzerFindings(
    "authz-route-public",
    'router.get("/health", (_req, res) => res.sendStatus(200));',
    "authorization"
  );
  assert.deepEqual(publicRoute, []);

  const unresolved = await analyzerFindings(
    "authz-route-unresolved",
    `router.use(globalGuard);
router.delete("/admin/patients/:id", deletePatient);`,
    "authorization"
  );
  assert.ok(
    unresolved.some(
      (finding) => finding.id === "FF-AUTHZ-NOT-VERIFIED-001" && finding.status === "NOT_VERIFIED"
    )
  );
});

test("accessibility analyzer covers image alternatives and keyboard semantics", async () => {
  const unsafe = await analyzerFindings(
    "a11y-structural-unsafe",
    `export const Card = () => <><img src="doctor.png" /><div onClick={open}>Open</div></>;`,
    "accessibility",
    "view.tsx"
  );
  assert.ok(unsafe.some((finding) => finding.id === "FF-A11Y-ALT-001"));
  assert.ok(unsafe.some((finding) => finding.id === "FF-A11Y-INTERACTION-001"));

  for (const [name, source] of [
    ["meaningful", 'export const View = () => <img src="doctor.png" alt="Doctor profile" />;'],
    ["decorative", 'export const View = () => <img src="line.png" alt="" />;'],
    ["presentation", 'export const View = () => <img src="line.png" role="presentation" />;'],
    ["button", "export const View = () => <button onClick={open}>Open</button>;"],
    [
      "complete-custom",
      'export const View = () => <div role="button" tabIndex={0} onClick={open} onKeyDown={key}>Open</div>;'
    ]
  ] as const) {
    assert.deepEqual(
      await analyzerFindings(`a11y-${name}`, source, "accessibility", "view.tsx"),
      [],
      name
    );
  }
});

test("every upload rule fires and a supported hardened flow stays clean", async () => {
  const cases = [
    ["any", "FF-UPLOAD-ANY-001", "app.post('/upload', upload.any(), handler);"],
    [
      "extension",
      "FF-UPLOAD-EXTENSION-001",
      "app.post('/upload', upload.single('file'), (req) => req.file.originalname.endsWith('.pdf'));"
    ],
    [
      "mime",
      "FF-UPLOAD-MIME-001",
      "app.post('/upload', upload.single('file'), (req) => req.file.mimetype === 'application/pdf');"
    ],
    [
      "public",
      "FF-UPLOAD-PUBLIC-001",
      "app.post('/upload', upload.single('file'), async (req) => { await save('public/' + req.file.filename, req.file.buffer); await scanner.scan(req.file.buffer); });"
    ],
    ["scan", "FF-UPLOAD-SCAN-001", "app.post('/upload', upload.single('file'), handler);"],
    [
      "scan-error",
      "FF-UPLOAD-SCAN-ERROR-001",
      "app.post('/upload', upload.single('file'), async (req, res) => { try { await scanner.scan(req.file.buffer); } catch {} res.send({ url: release(req.file) }); });"
    ],
    [
      "filename",
      "FF-UPLOAD-FILENAME-001",
      "app.post('/upload', upload.single('file'), async (req) => save(req.file.originalname, req.file.buffer));"
    ],
    ["limits", "FF-UPLOAD-LIMITS-001", "app.post('/upload', upload.single('file'), handler);"]
  ] as const;
  for (const [name, id, source] of cases) {
    const findings = await analyzerFindings(`upload-${name}`, source, "uploads");
    assert.ok(
      findings.some((finding) => finding.id === id),
      name
    );
  }

  const hardened = await analyzerFindings(
    "upload-hardened",
    `const upload = multer({ limits: { fileSize: maxBytes, files: 1 } });
app.post('/upload', requireRole('member'), upload.single('file'), async (req) => {
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (detected?.mime !== 'application/pdf') throw new Error('invalid signature');
  const scan = await scanner.scan(req.file.buffer);
  if (!scan.clean) throw new Error('quarantine');
  await privateBucket.put(randomUUID(), req.file.buffer);
});`,
    "uploads"
  );
  assert.deepEqual(hardened, []);
});

async function findingIds(root: string, section: string): Promise<Set<string>> {
  const findings = (await runAnalyzers(section, root)).flatMap((run) => run.findings);
  assert.ok(findings.every((finding) => finding.location[0]?.line !== undefined));
  assert.ok(findings.every((finding) => finding.trace && finding.trace.length > 0));
  return new Set(findings.map((finding) => finding.id));
}

async function analyzerFindings(name: string, source: string, section: string, file = "route.ts") {
  let findings: Awaited<ReturnType<typeof runAnalyzers>>[number]["findings"] = [];
  await withTemporaryProject(name, async (root) => {
    await writeFile(join(root, file), source, "utf8");
    findings = (await runAnalyzers(section, root)).flatMap((run) => run.findings);
  });
  return findings;
}

async function cacheFindings(name: string, source: string) {
  let findings: Awaited<ReturnType<typeof runAnalyzers>>[number]["findings"] = [];
  await withTemporaryProject(name, async (root) => {
    await writeFile(join(root, "cache.ts"), source, "utf8");
    findings = (await runAnalyzers("cache", root)).flatMap((run) => run.findings);
  });
  return findings;
}

async function authorizationIds(name: string, source: string): Promise<Set<string>> {
  let ids = new Set<string>();
  await withTemporaryProject(name, async (root) => {
    await writeFile(join(root, "route.ts"), source, "utf8");
    ids = await findingIds(root, "authorization");
  });
  return ids;
}

test("authorization ignores unrelated policy strings and unused imports", async () => {
  for (const [name, prelude] of [
    ["policy-string", 'const policyName = "owner policy";'],
    ["unused-import", 'import { canAccess } from "./policy.js";']
  ]) {
    const ids = await authorizationIds(
      `authz-${name}`,
      `${prelude}
export function load(req) {
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
    );
    assert.ok(ids.has("FF-AUTHZ-OBJECT-001"), name);
  }
});

test("authorization after release or for another object does not protect the lookup", async () => {
  const after = await authorizationIds(
    "authz-after-release",
    `export async function load(req, res) {
  const record = await prisma.record.findUnique({ where: { id: req.params.id } });
  res.json(record);
  await authorize(req.user, req.params.id);
}`
  );
  assert.ok(after.has("FF-AUTHZ-OBJECT-001"));

  const different = await authorizationIds(
    "authz-different-object",
    `export async function load(req) {
  await authorize(req.user, req.params.otherId);
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(different.has("FF-AUTHZ-OBJECT-001"));
});

test("authorization accepts a connected owner predicate and dominating policy guard", async () => {
  const owner = await authorizationIds(
    "authz-owner-predicate",
    `export function load(req) {
  return prisma.record.findUnique({
    where: { id: req.params.id, ownerId: req.user.id }
  });
}`
  );
  assert.ok(!owner.has("FF-AUTHZ-OBJECT-001"));

  const guard = await authorizationIds(
    "authz-dominating-guard",
    `export async function load(req) {
  if (!(await canAccess(req.user, req.params.id))) throw new Error("forbidden");
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(!guard.has("FF-AUTHZ-OBJECT-001"));
});

test("authorization requires both subject and object connection", async () => {
  const missingSubject = await authorizationIds(
    "authz-no-subject",
    `export async function load(req) {
  if (!(await canAccess(req.params.id))) throw new Error("forbidden");
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(missingSubject.has("FF-AUTHZ-OBJECT-001"));

  const crossTenant = await authorizationIds(
    "authz-cross-tenant",
    `export function load(req) {
  return prisma.record.findUnique({
    where: { id: req.params.id, tenantId: req.params.tenantId }
  });
}`
  );
  assert.ok(crossTenant.has("FF-AUTHZ-OBJECT-001"));
});

test("conditional or non-dominating authorization calls do not protect a lookup", async () => {
  const conditionalCall = await authorizationIds(
    "authz-conditional-call",
    `export async function load(req) {
  if (req.query.check) await authorize(req.user, req.params.id);
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(conditionalCall.has("FF-AUTHZ-OBJECT-001"));

  const conditionalExit = await authorizationIds(
    "authz-conditional-exit",
    `export async function load(req) {
  if (!(await canAccess(req.user, req.params.id))) {
    if (req.query.soft) return null;
  }
  return prisma.record.findUnique({ where: { id: req.params.id } });
}`
  );
  assert.ok(conditionalExit.has("FF-AUTHZ-OBJECT-001"));
});

test("subject-shaped output fields are not query authorization predicates", async () => {
  const ids = await authorizationIds(
    "authz-output-owner",
    `export function load(req) {
  return prisma.record.findUnique({
    where: { id: req.params.id },
    select: { id: true, ownerId: req.user.id }
  });
}`
  );
  assert.ok(ids.has("FF-AUTHZ-OBJECT-001"));
});
