import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  ACTIVATION_THRESHOLD,
  ACTIVATION_WEIGHTS,
  EVIDENCE_CLASSES,
  activationWeightFor,
  assessProjectCapabilities,
  classifyEvidencePath,
  isWeakContext,
  workspaceForPath
} from "../src/discovery-evidence.js";
import type { CapabilityAssessment } from "../src/discovery-evidence.js";
import { discoverProject } from "../src/discovery.js";
import { withTemporaryProject } from "./helpers.js";

async function writeProject(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const absolute = join(root, ...relative.split("/"));
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
}

function find(
  assessments: CapabilityAssessment[],
  capability: string,
  workspace = "."
): CapabilityAssessment {
  const match = assessments.find(
    (item) => item.capability === capability && item.workspace === workspace
  );
  assert.ok(match, `expected an assessment for ${capability} in ${workspace}`);
  return match;
}

test("every evidence class carries a declared activation weight", () => {
  for (const evidenceClass of EVIDENCE_CLASSES) {
    const weight = activationWeightFor(evidenceClass);
    assert.equal(typeof weight, "number");
    assert.ok(weight >= 0 && weight <= ACTIVATION_THRESHOLD);
  }
  // Non-production material can never activate a capability on its own.
  for (const neutral of ["documentation", "test", "fixture", "generated"] as const)
    assert.equal(ACTIVATION_WEIGHTS[neutral], 0);
  // Production-bearing material reaches the activation threshold on its own.
  for (const activating of ["manifest", "implementation", "route", "schema"] as const)
    assert.equal(ACTIVATION_WEIGHTS[activating], ACTIVATION_THRESHOLD);
  assert.ok(ACTIVATION_WEIGHTS.configuration < ACTIVATION_THRESHOLD);
  assert.ok(ACTIVATION_WEIGHTS.configuration > 0);
});

test("paths are classified by the role the file plays, not by the words it contains", () => {
  const cases: Array<[string, string]> = [
    ["package.json", "manifest"],
    ["packages/api/package.json", "manifest"],
    ["src/services/billing.ts", "implementation"],
    ["app/api/session/route.ts", "route"],
    ["src/routes/admin.ts", "route"],
    ["pages/api/webhook.ts", "route"],
    ["prisma/schema.prisma", "schema"],
    ["db/migrations/0001_init.sql", "schema"],
    ["docker-compose.yml", "configuration"],
    ["ops/telemetry.yaml", "configuration"],
    ["cli/tests/upload.test.ts", "test"],
    ["tests/tenant.ts", "test"],
    ["fixtures/bad-upload/upload.js", "fixture"],
    ["src/__mocks__/stripe.ts", "fixture"],
    ["README.md", "documentation"],
    ["docs/SECURITY_MODEL.md", "documentation"],
    ["examples/checkout/pay.ts", "example"],
    [".claude/skills/forge-payments/SKILL.md", "generated"],
    ["src/fullstack-forge/commands/forge-ai/COMMAND.md", "generated"],
    ["build/cli/src/discovery.js", "generated"],
    ["cli/src/types.d.ts", "generated"],
    ["LICENSE", "unknown"]
  ];
  for (const [path, expected] of cases)
    assert.equal(classifyEvidencePath(path).evidence_class, expected, path);
  // Every classification explains itself.
  for (const [path] of cases) assert.ok(classifyEvidencePath(path).reason.length > 0, path);
});

test("a manifest inside fixture or generated material is not manifest evidence", () => {
  assert.equal(
    classifyEvidencePath("fixtures/insecure-api/package.json").evidence_class,
    "fixture"
  );
  assert.equal(
    classifyEvidencePath(".agents/skills/forge-all/package.json").evidence_class,
    "generated"
  );
});

test("workspace attribution prefers the most specific declared root", () => {
  const roots = ["packages/api", "packages/api/internal", "packages/web"];
  assert.equal(workspaceForPath("packages/api/src/index.ts", roots), "packages/api");
  assert.equal(workspaceForPath("packages/api/internal/db.ts", roots), "packages/api/internal");
  assert.equal(workspaceForPath("tools/build.ts", roots), ".");
});

test("comments and passive string literals are recognised as weak context", () => {
  const source = [
    "// stripe.checkout is planned",
    'const label = "stripe.checkout";',
    "stripe.checkout.sessions.create();"
  ].join("\n");
  assert.equal(isWeakContext(source, source.indexOf("stripe.checkout"), "implementation"), true);
  assert.equal(
    isWeakContext(source, source.indexOf('"stripe.checkout"') + 1, "implementation"),
    true
  );
  assert.equal(
    isWeakContext(source, source.lastIndexOf("stripe.checkout"), "implementation"),
    false
  );
  // JSON dependency names are legitimately string literals and are never downgraded.
  assert.equal(isWeakContext('{"stripe": "^1"}', 2, "manifest"), false);
});

test("README-only authentication text does not activate the authentication capability", async () => {
  await withTemporaryProject("evidence-readme-auth", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "docs-only" })}\n`,
      "README.md": "Call `getServerSession(req)` to read the session.\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "authentication");
    assert.equal(assessment.status, "UNKNOWN");
    assert.equal(assessment.score, 0);
    assert.deepEqual(
      [...new Set(assessment.evidence.map((item) => item.evidence_class))],
      ["documentation"]
    );
    assert.ok(assessment.reasons.some((reason) => reason.includes("documentation")));
  });
});

test("test-only tenant terminology does not prove a production tenant boundary", async () => {
  await withTemporaryProject("evidence-test-tenancy", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "tested-app" })}\n`,
      "tests/tenant.test.ts": "it('scopes by tenantId', () => { const tenantId = 't1'; });\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "tenancy");
    assert.equal(assessment.status, "UNKNOWN");
    assert.equal(assessment.score, 0);
    assert.deepEqual(
      [...new Set(assessment.evidence.map((item) => item.evidence_class))],
      ["test"]
    );
  });
});

test("fixture-only upload code does not activate the upload capability", async () => {
  await withTemporaryProject("evidence-fixture-upload", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "fixture-host" })}\n`,
      "fixtures/bad-upload/upload.js": "const upload = multer({ dest: '/tmp' });\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "uploads");
    assert.equal(assessment.status, "UNKNOWN");
    assert.equal(assessment.score, 0);
    assert.equal(assessment.evidence[0]?.evidence_class, "fixture");
  });
});

test("example-only payment code stays separated from active applications", async () => {
  await withTemporaryProject("evidence-example-payments", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "example-host" })}\n`,
      "examples/checkout/pay.ts": "await stripe.checkout.sessions.create({});\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "payments");
    assert.equal(assessment.status, "UNKNOWN");
    assert.ok(assessment.score > 0 && assessment.score < ACTIVATION_THRESHOLD);
    assert.equal(assessment.evidence[0]?.evidence_class, "example");
    assert.ok(assessment.reasons.some((reason) => reason.includes("Example applications")));
  });
});

test("a real authentication dependency and route activate the capability", async () => {
  await withTemporaryProject("evidence-real-auth", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app", dependencies: { "next-auth": "0.0.0-fixture" } })}\n`,
      "app/api/session/route.ts":
        "export async function GET() { const session = await getServerSession(); return Response.json(session); }\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "authentication");
    assert.equal(assessment.status, "PRESENT");
    assert.ok(assessment.score >= ACTIVATION_THRESHOLD);
    const classes = new Set(assessment.evidence.map((item) => item.evidence_class));
    assert.ok(classes.has("manifest"));
    assert.ok(classes.has("route"));
    assert.ok(assessment.evidence.every((item) => typeof item.line === "number"));
  });
});

test("real upload middleware in application source activates the capability", async () => {
  await withTemporaryProject("evidence-real-upload", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app", dependencies: { multer: "0.0.0-fixture" } })}\n`,
      "src/upload.ts": "const upload = multer({ storage });\nexport default upload;\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "uploads");
    assert.equal(assessment.status, "PRESENT");
    const classes = new Set(assessment.evidence.map((item) => item.evidence_class));
    assert.ok(classes.has("implementation"));
  });
});

test("a real database schema activates the database capability", async () => {
  await withTemporaryProject("evidence-real-schema", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app" })}\n`,
      "prisma/schema.prisma": "model User {\n  id String @id\n}\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "database");
    assert.equal(assessment.status, "PRESENT");
    assert.equal(assessment.evidence[0]?.evidence_class, "schema");
  });
});

test("generated Forge and platform copies never activate an audited-project capability", async () => {
  await withTemporaryProject("evidence-generated-skills", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "host" })}\n`,
      ".claude/skills/forge-payments/SKILL.md":
        "Inspect `stripe.checkout.sessions.create()` calls.\n",
      "src/fullstack-forge/commands/forge-ai/COMMAND.md":
        "Inspect `openai.chat.completions.create()` usage.\n"
    });
    const assessments = await assessProjectCapabilities(root);
    for (const capability of ["payments", "ai"]) {
      const assessment = find(assessments, capability);
      assert.equal(assessment.status, "UNKNOWN");
      assert.equal(assessment.score, 0);
      assert.deepEqual(
        [...new Set(assessment.evidence.map((item) => item.evidence_class))],
        ["generated"]
      );
    }
  });
});

test("configuration-only evidence stays below the activation threshold", async () => {
  await withTemporaryProject("evidence-configuration-only", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app" })}\n`,
      "docker-compose.yml":
        "services:\n  api:\n    environment:\n      REDIS_URL: redis://cache:6379\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "cache");
    assert.equal(assessment.status, "UNKNOWN");
    assert.equal(assessment.evidence[0]?.evidence_class, "configuration");
    assert.ok(assessment.score > 0 && assessment.score < ACTIVATION_THRESHOLD);
  });
});

test("many weak signals accumulate to UNKNOWN rather than to PRESENT", async () => {
  await withTemporaryProject("evidence-weak-accumulation", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app" })}\n`,
      "README.md": "Use `stripe.checkout` for billing.\n",
      "docs/BILLING.md": "The `stripe.webhooks` handler is documented here.\n",
      "tests/pay.test.ts": "it('charges', () => { stripe.paymentIntents.create({}); });\n",
      "fixtures/pay/webhook.js": "stripe.webhooks.constructEvent(body, sig, secret);\n",
      "examples/pay/demo.ts": "stripe.checkout.sessions.create({});\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "payments");
    assert.equal(assessment.status, "UNKNOWN");
    assert.ok(assessment.evidence.length >= 5);
    assert.ok(assessment.score < ACTIVATION_THRESHOLD);
  });
});

test("comments containing capability keywords are weak evidence only", async () => {
  await withTemporaryProject("evidence-comment-keywords", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app" })}\n`,
      "src/plan.ts":
        "// One day we will call stripe.checkout.sessions.create here.\nexport const plan = 1;\n"
    });
    const assessment = find(await assessProjectCapabilities(root), "payments");
    assert.equal(assessment.status, "UNKNOWN");
    const [evidence] = assessment.evidence;
    assert.ok(evidence);
    assert.equal(evidence.evidence_class, "implementation");
    assert.ok(evidence.activation_weight < ACTIVATION_THRESHOLD);
    assert.equal(evidence.confidence, "MEDIUM");
    assert.ok(evidence.reason.includes("comment or passive string literal"));
  });
});

test("passive string literals containing capability keywords are weak evidence only", async () => {
  await withTemporaryProject("evidence-string-keywords", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app" })}\n`,
      "src/labels.ts": 'export const label = "openai.chat.completions.create";\n'
    });
    const assessment = find(await assessProjectCapabilities(root), "ai");
    assert.equal(assessment.status, "UNKNOWN");
    assert.ok((assessment.evidence[0]?.activation_weight ?? 1) < ACTIVATION_THRESHOLD);
  });
});

test("monorepo workspaces are assessed independently and never leak evidence", async () => {
  await withTemporaryProject("evidence-monorepo", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "root", workspaces: ["packages/*"] })}\n`,
      "packages/api/package.json": `${JSON.stringify({ name: "api", dependencies: { stripe: "0.0.0-fixture" } })}\n`,
      "packages/api/src/billing.ts": "await stripe.checkout.sessions.create({});\n",
      "packages/web/package.json": `${JSON.stringify({ name: "web", dependencies: { react: "0.0.0-fixture" } })}\n`,
      "packages/web/src/App.tsx": "export const App = () => null;\n"
    });
    const assessments = await assessProjectCapabilities(root);
    const api = find(assessments, "payments", "packages/api");
    const web = find(assessments, "payments", "packages/web");
    const repositoryRoot = find(assessments, "payments", ".");
    assert.equal(api.status, "PRESENT");
    assert.equal(web.status, "ABSENT");
    assert.equal(repositoryRoot.status, "ABSENT");
    assert.ok(api.evidence.every((item) => item.path.startsWith("packages/api/")));
    assert.equal(web.evidence.length, 0);
  });
});

test("capability assessment is deterministic across repeated scans", async () => {
  await withTemporaryProject("evidence-deterministic", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app", dependencies: { multer: "0.0.0-fixture", stripe: "0.0.0-fixture" } })}\n`,
      "src/upload.ts": "const upload = multer({ storage });\n",
      "src/billing.ts": "await stripe.checkout.sessions.create({});\n",
      "README.md": "Uploads and payments are documented here: multer, stripe.checkout.\n"
    });
    const first = await assessProjectCapabilities(root);
    const second = await assessProjectCapabilities(root);
    assert.deepEqual(first, second);
  });
});

test("the project profile publishes classified evidence in its JSON output", async () => {
  await withTemporaryProject("evidence-profile-json", async (root) => {
    await writeProject(root, {
      "package.json": `${JSON.stringify({ name: "app", dependencies: { multer: "0.0.0-fixture" } })}\n`,
      "src/upload.ts": "const upload = multer({ storage });\n"
    });
    const profile = await discoverProject(root);
    const assessments = profile.capability_assessments ?? [];
    assert.ok(assessments.length > 0);
    const serialized = JSON.stringify(profile);
    assert.ok(serialized.includes('"evidence_class"'));
    assert.ok(serialized.includes('"activation_weight"'));
    assert.ok(serialized.includes('"workspace"'));
    const uploads = find(assessments, "uploads");
    assert.equal(uploads.status, "PRESENT");
    // Existing language and framework discovery must not regress.
    assert.ok(profile.languages.some((language) => language.name === "TypeScript"));
    assert.ok(profile.capabilities.runtime);
    for (const assessment of assessments)
      assert.ok(["PRESENT", "ABSENT", "UNKNOWN"].includes(assessment.status));
  });
});
