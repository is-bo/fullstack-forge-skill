import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { ACTIVATION_THRESHOLD, ACTIVATION_WEIGHTS, EVIDENCE_CLASSES, activationWeightFor, assessProjectCapabilities, classifyEvidencePath, isWeakContext, workspaceForPath } from "../src/discovery-evidence.js";
import { discoverProject } from "../src/discovery.js";
import { decideModules } from "../src/scope.js";
import { withTemporaryProject } from "./helpers.js";
async function writeProject(root, files) {
    for (const [relative, content] of Object.entries(files)) {
        const absolute = join(root, ...relative.split("/"));
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, content, "utf8");
    }
}
function find(assessments, capability, workspace = ".") {
    const match = assessments.find((item) => item.capability === capability && item.workspace === workspace);
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
    for (const neutral of ["documentation", "test", "fixture", "generated"])
        assert.equal(ACTIVATION_WEIGHTS[neutral], 0);
    // Active behavior reaches the threshold; dependency declarations alone never do.
    for (const activating of ["implementation", "route", "schema"])
        assert.equal(ACTIVATION_WEIGHTS[activating], ACTIVATION_THRESHOLD);
    assert.equal(ACTIVATION_WEIGHTS.manifest, 0);
    assert.ok(ACTIVATION_WEIGHTS.configuration < ACTIVATION_THRESHOLD);
    assert.ok(ACTIVATION_WEIGHTS.configuration > 0);
});
test("paths are classified by the role the file plays, not by the words it contains", () => {
    const cases = [
        ["package.json", "manifest"],
        ["packages/api/package.json", "manifest"],
        ["src/services/billing.ts", "implementation"],
        ["app/api/session/route.ts", "route"],
        ["src/routes/admin.ts", "route"],
        ["pages/api/webhook.ts", "route"],
        ["project/urls.py", "route"],
        ["prisma/schema.prisma", "schema"],
        ["db/migrations/0001_init.sql", "schema"],
        ["docker-compose.yml", "configuration"],
        ["infra/main.tf", "configuration"],
        ["public/robots.txt", "configuration"],
        ["ops/telemetry.yaml", "configuration"],
        ["src/main.cpp", "implementation"],
        ["cli/tests/upload.test.ts", "test"],
        ["tests/tenant.ts", "test"],
        ["fixtures/bad-upload/upload.js", "fixture"],
        ["src/__mocks__/stripe.ts", "fixture"],
        ["README.md", "documentation"],
        ["docs/SECURITY_MODEL.md", "documentation"],
        ["examples/checkout/pay.ts", "example"],
        [".claude/skills/forge-payments/SKILL.md", "generated"],
        [".fullstack-forge/skills/forge-payments/SKILL.md", "generated"],
        ["src/fullstack-forge/commands/forge-ai/COMMAND.md", "generated"],
        ["third_party/agent-skills/provider/content/SKILL.md", "generated"],
        ["build/cli/src/discovery.js", "generated"],
        ["cli/src/types.d.ts", "generated"],
        ["LICENSE", "unknown"]
    ];
    for (const [path, expected] of cases)
        assert.equal(classifyEvidencePath(path).evidence_class, expected, path);
    // Every classification explains itself.
    for (const [path] of cases)
        assert.ok(classifyEvidencePath(path).reason.length > 0, path);
});
test("real JSX structure proves frontend use when a dependency declaration alone cannot", async () => {
    await withTemporaryProject("discovery-jsx-frontend", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "jsx-app", dependencies: { react: "19.0.0" } })}\n`,
            "Link.tsx": 'export const Link = () => <a href="https://example.com" target="_blank">Docs</a>;\n'
        });
        const profile = await discoverProject(root);
        const frontend = find(profile.capability_assessments ?? [], "frontend");
        assert.equal(frontend.status, "PRESENT");
        const decision = decideModules({ candidates: ["frontend"], profile, explicit: false })[0];
        assert.equal(decision?.selection_status, "SELECTED");
    });
});
test("a manifest inside fixture or generated material is not manifest evidence", () => {
    assert.equal(classifyEvidencePath("fixtures/insecure-api/package.json").evidence_class, "fixture");
    assert.equal(classifyEvidencePath(".agents/skills/forge-all/package.json").evidence_class, "generated");
});
test("workspace attribution prefers the most specific declared root", () => {
    const roots = ["packages/api", "packages/api/internal", "packages/web"];
    assert.equal(workspaceForPath("packages/api/src/index.ts", roots), "packages/api");
    assert.equal(workspaceForPath("packages/api/internal/db.ts", roots), "packages/api/internal");
    assert.equal(workspaceForPath("tools/build.ts", roots), ".");
});
test("inline and multiline comments, strings, templates, and regex literals are weak context", () => {
    const source = [
        "const one = 1; // stripe.checkout is planned",
        "/* multiline",
        "stripe.checkout is still only planned",
        "*/",
        "const template = `multiline",
        "stripe.checkout example`;",
        'const label = "stripe.checkout"; stripe.checkout.sessions.create();',
        "const detector = /stripe\\.checkout\\.sessions/u;",
        "stripe.checkout.sessions.create();"
    ].join("\n");
    const first = source.indexOf("stripe.checkout");
    const block = source.indexOf("stripe.checkout", first + 1);
    const template = source.indexOf("stripe.checkout", block + 1);
    const string = source.indexOf("stripe.checkout", template + 1);
    const sameLineCall = source.indexOf("stripe.checkout", string + 1);
    assert.equal(isWeakContext(source, first, "implementation"), true);
    assert.equal(isWeakContext(source, block, "implementation"), true);
    assert.equal(isWeakContext(source, template, "implementation"), true);
    assert.equal(isWeakContext(source, string, "implementation"), true);
    assert.equal(isWeakContext(source, sameLineCall, "implementation"), false);
    assert.equal(isWeakContext(source, source.indexOf("stripe\\.checkout"), "implementation"), true);
    assert.equal(isWeakContext(source, source.lastIndexOf("stripe.checkout"), "implementation"), false);
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
        assert.deepEqual([...new Set(assessment.evidence.map((item) => item.evidence_class))], ["documentation"]);
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
        assert.deepEqual([...new Set(assessment.evidence.map((item) => item.evidence_class))], ["test"]);
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
        assert.equal(assessment.score, 0);
        assert.equal(assessment.evidence[0]?.evidence_class, "example");
        assert.ok(assessment.reasons.some((reason) => reason.includes("Example applications")));
    });
});
test("a real authentication dependency and route activate the capability", async () => {
    await withTemporaryProject("evidence-real-auth", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "app", dependencies: { "next-auth": "0.0.0-fixture" } })}\n`,
            "app/api/session/route.ts": "export async function GET() { const session = await getServerSession(); return Response.json(session); }\n"
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
test("a concrete authentication wrapper declaration is not suppressed as a whole line", async () => {
    await withTemporaryProject("evidence-auth-wrapper", async (root) => {
        await writeProject(root, {
            "src/auth.ts": "export function requireAuth() { return sessionMiddleware; }\n"
        });
        const assessment = find(await assessProjectCapabilities(root), "authentication");
        assert.equal(assessment.status, "PRESENT");
        assert.equal(assessment.evidence[0]?.activation_weight, ACTIVATION_THRESHOLD);
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
            ".claude/skills/forge-payments/SKILL.md": "Inspect `stripe.checkout.sessions.create()` calls.\n",
            "src/fullstack-forge/commands/forge-ai/COMMAND.md": "Inspect `openai.chat.completions.create()` usage.\n"
        });
        const assessments = await assessProjectCapabilities(root);
        for (const capability of ["payments", "ai"]) {
            const assessment = find(assessments, capability);
            assert.equal(assessment.status, "UNKNOWN");
            assert.equal(assessment.score, 0);
            assert.deepEqual([...new Set(assessment.evidence.map((item) => item.evidence_class))], ["generated"]);
        }
    });
});
test("configuration-only evidence stays below the activation threshold", async () => {
    await withTemporaryProject("evidence-configuration-only", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "app" })}\n`,
            "docker-compose.yml": "services:\n  api:\n    environment:\n      REDIS_URL: redis://cache:6379\n"
        });
        const assessment = find(await assessProjectCapabilities(root), "cache");
        assert.equal(assessment.status, "UNKNOWN");
        assert.equal(assessment.evidence[0]?.evidence_class, "configuration");
        assert.ok(assessment.score > 0 && assessment.score < ACTIVATION_THRESHOLD);
    });
});
test("concrete deployment, Terraform, robots, and sitemap shapes activate only in active trees", async () => {
    await withTemporaryProject("evidence-concrete-file-shapes", async (root) => {
        await writeProject(root, {
            Dockerfile: "FROM node:24-alpine\n",
            "infra/main.tf": 'resource "aws_s3_bucket" "assets" {}\n',
            "public/robots.txt": "User-agent: *\nDisallow:\n",
            "public/sitemap.xml": "<urlset></urlset>\n",
            "docs/Dockerfile": "FROM scratch\n",
            "examples/legacy/main.tf": 'resource "example" "demo" {}\n',
            "fixtures/site/robots.txt": "User-agent: *\n",
            "tests/Dockerfile": "FROM scratch\n",
            "skills/site/sitemap.xml": "<urlset></urlset>\n"
        });
        const assessments = await assessProjectCapabilities(root);
        for (const capability of ["deployment", "infrastructure", "public-web"]) {
            const assessment = find(assessments, capability);
            assert.equal(assessment.status, "PRESENT", capability);
            assert.ok(assessment.evidence.some((item) => item.activation_weight >= ACTIVATION_THRESHOLD), capability);
        }
        const deployment = find(assessments, "deployment");
        assert.equal(deployment.evidence.find((item) => item.path === "docs/Dockerfile")?.activation_weight, 0);
        assert.equal(deployment.evidence.find((item) => item.path === "tests/Dockerfile")?.activation_weight, 0);
        const infrastructure = find(assessments, "infrastructure");
        assert.equal(infrastructure.evidence.find((item) => item.path === "examples/legacy/main.tf")
            ?.activation_weight, 0);
        const publicWeb = find(assessments, "public-web");
        assert.equal(publicWeb.evidence.find((item) => item.path === "fixtures/site/robots.txt")
            ?.activation_weight, 0);
        assert.equal(publicWeb.evidence.find((item) => item.path === "skills/site/sitemap.xml")?.activation_weight, 0);
    });
});
test("an unused Stripe dependency remains UNKNOWN and does not auto-select payments", async () => {
    await withTemporaryProject("evidence-unused-stripe", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "app", dependencies: { stripe: "0.0.0-fixture" } })}\n`,
            "src/index.ts": "export const ready = true;\n"
        });
        const profile = await discoverProject(root);
        const payments = find(profile.capability_assessments ?? [], "payments");
        assert.equal(payments.status, "UNKNOWN");
        assert.equal(payments.score, 0);
        assert.deepEqual([...new Set(payments.evidence.map((item) => item.evidence_class))], ["manifest"]);
        const decision = decideModules({
            candidates: ["payments"],
            profile,
            explicit: false
        })[0];
        assert.ok(decision);
        assert.notEqual(decision.selection_status, "SELECTED");
        assert.ok(!(profile.risk_evidence ?? []).some((item) => item.modules.includes("payments")));
    });
});
test("an undeclared archived package cannot aggregate React capability or framework evidence", async () => {
    await withTemporaryProject("evidence-undeclared-archive", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "active-root" })}\n`,
            "src/index.ts": "export const ready = true;\n",
            "archive/old-ui/package.json": `${JSON.stringify({
                name: "old-ui",
                dependencies: { react: "0.0.0-fixture" }
            })}\n`,
            "archive/old-ui/src/App.tsx": "ReactDOM.createRoot(document.body).render(<main>Archived</main>);\n"
        });
        const directAssessments = await assessProjectCapabilities(root);
        assert.equal(find(directAssessments, "frontend").status, "ABSENT");
        assert.ok(!directAssessments.some((item) => item.workspace === "archive/old-ui"));
        const profile = await discoverProject(root);
        const frontend = find(profile.capability_assessments ?? [], "frontend");
        assert.equal(frontend.status, "ABSENT");
        assert.equal((profile.capability_assessments ?? []).some((item) => item.workspace === "archive/old-ui"), false);
        assert.equal(profile.frameworks.length, 0);
        assert.ok(!profile.applications.some((application) => application.root === "archive/old-ui"));
        assert.ok(profile.workspaces.some((workspace) => workspace.root === "archive/old-ui" && workspace.type === "nested-package"));
        const decision = decideModules({
            candidates: ["frontend"],
            profile,
            explicit: false
        })[0];
        assert.ok(decision);
        assert.notEqual(decision.selection_status, "SELECTED");
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
        assert.equal(assessment.score, 0);
    });
});
test("comments containing capability keywords are weak evidence only", async () => {
    await withTemporaryProject("evidence-comment-keywords", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "app" })}\n`,
            "src/plan.ts": "// One day we will call stripe.checkout.sessions.create here.\nexport const plan = 1;\n"
        });
        const assessment = find(await assessProjectCapabilities(root), "payments");
        assert.equal(assessment.status, "UNKNOWN");
        const [evidence] = assessment.evidence;
        assert.ok(evidence);
        assert.equal(evidence.evidence_class, "implementation");
        assert.equal(evidence.activation_weight, 0);
        assert.equal(evidence.confidence, "MEDIUM");
        assert.match(evidence.reason, /comment.*passive string/u);
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
        assert.equal(assessment.evidence[0]?.activation_weight, 0);
    });
});
test("many weak implementation files can never accumulate into production capability proof", async () => {
    await withTemporaryProject("evidence-many-weak-files", async (root) => {
        const files = {
            "package.json": `${JSON.stringify({ name: "app" })}\n`
        };
        for (let index = 0; index < 12; index += 1)
            files[`src/plans/plan-${index}.ts`] =
                `export const planned${index} = "stripe.checkout.sessions.create";\n`;
        await writeProject(root, files);
        const assessment = find(await assessProjectCapabilities(root), "payments");
        assert.equal(assessment.status, "UNKNOWN");
        assert.equal(assessment.score, 0);
        assert.equal(assessment.evidence.length, 12);
    });
});
test("a detector implementation cannot activate itself or generated and vendored expertise", async () => {
    await withTemporaryProject("evidence-self-referential-tool", async (root) => {
        await writeProject(root, {
            "package.json": `${JSON.stringify({ name: "scanner" })}\n`,
            "cli/src/scanner.ts": `
export const paymentRule = /stripe\\.(?:checkout|paymentIntents|webhooks)/u;
export const aiRule = /openai\\.(?:chat|responses)|anthropic\\.messages/u;
export const routeRule = /router\\.(?:post|delete)\\s*\\(/u;
export const personalDataRule = /email|medicalRecord|nationalId/u;
`,
            ".agents/skills/forge-payments/SKILL.md": "Call stripe.checkout.sessions.create and inspect payment webhooks.\n",
            "third_party/agent-skills/react/package.json": `${JSON.stringify({
                name: "vendored-react-skill",
                dependencies: { react: "1.0.0", stripe: "1.0.0" }
            })}\n`,
            "examples/web/package.json": `${JSON.stringify({
                name: "demo",
                dependencies: { react: "1.0.0" }
            })}\n`
        });
        const profile = await discoverProject(root);
        for (const capability of ["frontend", "payments", "ai", "personal-data", "api"]) {
            const assessment = find(profile.capability_assessments ?? [], capability);
            assert.notEqual(assessment.status, "PRESENT", capability);
        }
        assert.equal(profile.frameworks.length, 0);
        assert.equal(profile.risk_evidence?.length, 0);
        const decisions = decideModules({
            candidates: ["frontend", "payments", "ai", "privacy", "api"],
            profile,
            explicit: false
        });
        assert.ok(decisions.every((decision) => decision.selection_status !== "SELECTED"));
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
test("zero control evidence remains UNKNOWN while zero surface evidence may be ABSENT", async () => {
    await withTemporaryProject("control-kind-zero", async (root) => {
        await writeProject(root, { "site.html": "<main>Static documentation</main>" });
        const assessments = await assessProjectCapabilities(root);
        const authorization = find(assessments, "authorization");
        const uploads = find(assessments, "uploads");
        assert.equal(authorization.kind, "control");
        assert.equal(authorization.status, "UNKNOWN");
        assert.equal(uploads.kind, "surface");
        assert.equal(uploads.status, "ABSENT");
    });
});
test("bounded risk discovery activates concerns from behavior even when controls are missing", async () => {
    await withTemporaryProject("risk-destructive-route", async (root) => {
        await writeProject(root, {
            "routes/patients.ts": `router.delete("/admin/patients/:id", async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});`,
            "unused.ts": "export function accessGuard() { return (_req, _res, next) => next(); }"
        });
        const profile = await discoverProject(root);
        const modules = new Set((profile.risk_evidence ?? []).flatMap((evidence) => evidence.modules));
        assert.ok(modules.has("authorization"));
        assert.ok(modules.has("security"));
        assert.ok(modules.has("observability"));
        const authorization = decideModules({
            candidates: ["authorization"],
            profile,
            explicit: false
        })[0];
        assert.ok(authorization);
        assert.equal(authorization.risk_status, "PRESENT");
        assert.equal(authorization.control_status, "UNKNOWN");
        assert.equal(authorization.applicability_status, "APPLICABLE");
        assert.equal(authorization.selection_status, "SELECTED");
    });
});
test("a real session boundary auto-selects authentication", async () => {
    await withTemporaryProject("risk-session-boundary", async (root) => {
        await writeProject(root, {
            "routes/account.ts": `router.get("/account", async (req, res) => {
  const session = await getServerSession(req);
  res.json({ userId: session.user.id });
});`
        });
        const profile = await discoverProject(root);
        const identity = (profile.risk_evidence ?? []).find((item) => item.risk === "identity-or-session-boundary");
        assert.ok(identity);
        assert.ok(identity.modules.includes("auth"));
        const decision = decideModules({ candidates: ["auth"], profile, explicit: false })[0];
        assert.ok(decision);
        assert.equal(decision.risk_status, "PRESENT");
        assert.equal(decision.selection_status, "SELECTED");
    });
});
test("generic signature, money, and worker identifiers do not create risk boundaries", async () => {
    await withTemporaryProject("risk-generic-identifiers", async (root) => {
        await writeProject(root, {
            "src/labels.ts": `export const signature = "rounded";
export const headerName = "x-signature";
export const amount = 3;
export const currency = "USD";
export const worker = "employee";
export const scheduledReport = false;
`
        });
        const profile = await discoverProject(root);
        const risks = new Set((profile.risk_evidence ?? []).map((item) => item.risk));
        assert.ok(!risks.has("webhook-or-callback"));
        assert.ok(!risks.has("financial-behaviour"));
        assert.ok(!risks.has("background-execution"));
    });
});
test("risk and route scans skip a leading commented route and continue to a real route", async () => {
    await withTemporaryProject("risk-comment-then-route", async (root) => {
        await writeProject(root, {
            "routes/health.ts": `/* Example only:
router.delete("/admin/users/:id", handler);
*/
router.get("/health", handler);
`
        });
        const profile = await discoverProject(root);
        assert.deepEqual(profile.routes.map((route) => route.name), ["GET /health"]);
        const risks = profile.risk_evidence ?? [];
        assert.ok(risks.some((item) => item.risk === "request-boundary" && item.line === 4));
        assert.ok(!risks.some((item) => item.risk === "destructive-or-administrative-route"));
        assert.equal(find(profile.capability_assessments ?? [], "api").status, "PRESENT");
    });
});
test("active C and C++ source proves runtime without implying an API", async () => {
    await withTemporaryProject("runtime-cpp-not-api", async (root) => {
        await writeProject(root, {
            "src/main.cpp": "int main() { return 0; }\n",
            "src/helper.c": "int helper(void) { return 1; }\n"
        });
        const profile = await discoverProject(root);
        assert.ok(profile.capabilities.runtime);
        assert.equal(find(profile.capability_assessments ?? [], "runtime").status, "PRESENT");
        assert.equal(find(profile.capability_assessments ?? [], "api").status, "ABSENT");
        assert.equal(profile.routes.length, 0);
    });
});
test("risk signatures cover payment webhooks, uploads, and tenant background jobs", async () => {
    await withTemporaryProject("risk-signature-matrix", async (root) => {
        await writeProject(root, {
            "webhook.ts": 'app.post("/webhooks/payment", async (req) => refundPayment(req.body.amount));',
            "upload.ts": 'app.post("/patients/documents", upload.single("file"), handler);',
            "jobs/reminders.ts": "export const reminderJob = defineJob(async (clinicId) => db.patient.findMany({ where: { clinicId } }));"
        });
        const profile = await discoverProject(root);
        const modules = new Set((profile.risk_evidence ?? []).flatMap((evidence) => evidence.modules));
        for (const module of [
            "integrations",
            "payments",
            "uploads",
            "storage",
            "authorization",
            "privacy",
            "jobs",
            "reliability",
            "tenancy"
        ])
            assert.ok(modules.has(module), module);
    });
});
test("a static site has no authorization risk surface in the bounded scope", async () => {
    await withTemporaryProject("risk-static-site", async (root) => {
        await writeProject(root, {
            "index.html": "<main><h1>Documentation</h1></main>",
            "styles.css": "main { max-width: 60rem; }"
        });
        const profile = await discoverProject(root);
        assert.ok(!(profile.risk_evidence ?? []).some((item) => item.modules.includes("authorization")));
    });
});
test("Prisma relationships and authenticated context infer a domain tenant key", async () => {
    await withTemporaryProject("tenancy-structural-inference", async (root) => {
        await writeProject(root, {
            "prisma/schema.prisma": `model Patient {
  id String @id
  clinicId String
}
model Appointment {
  id String @id
  clinicId String
}`,
            "routes/patients.ts": "export const list = (req) => prisma.patient.findMany({ where: { clinicId: req.session.user.clinicId } });"
        });
        const profile = await discoverProject(root);
        const tenancy = profile.tenancy;
        assert.ok(tenancy);
        assert.equal(tenancy.status, "PRESENT");
        assert.equal(tenancy.key, "clinicId");
        assert.equal(tenancy.confidence, "HIGH");
    });
});
test("ambiguous ownership keys remain UNKNOWN and entity IDs are not guessed", async () => {
    await withTemporaryProject("tenancy-ambiguous-inference", async (root) => {
        await writeProject(root, {
            "prisma/schema.prisma": `model Record {
  id String @id
  clinicId String
  accountId String
  userId String
}`
        });
        const profile = await discoverProject(root);
        const tenancy = profile.tenancy;
        assert.ok(tenancy);
        assert.equal(tenancy.status, "UNKNOWN");
        assert.deepEqual(tenancy.candidates, ["accountId", "clinicId"]);
        assert.ok(!tenancy.candidates.includes("userId"));
    });
});
