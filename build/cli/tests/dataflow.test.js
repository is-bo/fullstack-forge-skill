import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { buildTaintModel } from "../src/dataflow.js";
import ts from "typescript";
import { withTemporaryProject } from "./helpers.js";
/**
 * Each fixture encodes a flow the previous text-regex detector could not see, or a false
 * "already validated" signal it wrongly trusted.
 */
async function securityIds(name, file, source) {
    let ids = new Set();
    await withTemporaryProject(name, async (root) => {
        await writeFile(join(root, file), source, "utf8");
        const runs = await runAnalyzers("security", root);
        ids = new Set(runs.flatMap((run) => run.findings).map((finding) => finding.id));
    });
    return ids;
}
async function securityFindings(name, source) {
    let findings = [];
    await withTemporaryProject(name, async (root) => {
        await writeFile(join(root, "case.ts"), source, "utf8");
        findings = (await runAnalyzers("security", root)).flatMap((run) => run.findings);
    });
    return findings;
}
test("alias propagation reaches an interpolated SQL sink", async () => {
    const ids = await securityIds("flow-alias-sql", "users.ts", `export async function loadUser(req, db) {
  const id = req.params.id;
  const query = \`SELECT * FROM users WHERE id = \${id}\`;
  return db.query(query);
}
`);
    assert.ok(ids.has("FF-SEC-SQL-001"), "a request value aliased through a local const and a template literal must still reach the SQL sink");
});
test("multi-step assignment propagation reaches a shell sink", async () => {
    const ids = await securityIds("flow-alias-shell", "run.ts", `import { exec } from "node:child_process";
export function run(req) {
  let command;
  command = req.body.command;
  exec(command);
}
`);
    assert.ok(ids.has("FF-SEC-SHELL-001"));
});
test("destructured request input reaches a server-side HTTP client sink", async () => {
    const ids = await securityIds("flow-destructured-ssrf", "proxy.ts", `export async function proxy(req) {
  const { target } = req.query;
  return fetch(target);
}
`);
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("same-file function-parameter propagation reaches a SQL sink", async () => {
    const ids = await securityIds("flow-parameter", "repo.ts", `export function loadUser(id, db) {
  return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}
export function handler(req, db) {
  return loadUser(req.params.id, db);
}
`);
    assert.ok(ids.has("FF-SEC-SQL-001"));
});
test("unrelated validation does not suppress a proven injection finding", async () => {
    const ids = await securityIds("flow-unrelated-validation", "handler.ts", `function validateUnrelatedConfiguration() { return true; }
export async function handler(req, db) {
  validateUnrelatedConfiguration();
  return db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);
}
`);
    assert.ok(ids.has("FF-SEC-SQL-001"), "the SQL defect itself must remain reported");
    assert.ok(ids.has("FF-SEC-VALIDATION-001"), "an unrelated validate* call must not count as validating this value");
});
test("validation stays attached to the exact value without erasing taint", () => {
    const sourceFile = ts.createSourceFile("sanitized.ts", `const id = z.string().uuid().parse(req.params.id);
const other = req.query.other;
`, ts.ScriptTarget.Latest, true);
    const model = buildTaintModel(sourceFile);
    const id = sourceFile.statements[0];
    const other = sourceFile.statements[1];
    assert.ok(id !== undefined && other !== undefined);
    assert.ok(ts.isVariableStatement(id) && ts.isVariableStatement(other));
    const idName = id.declarationList.declarations[0]?.name;
    const otherName = other.declarationList.declarations[0]?.name;
    assert.ok(idName !== undefined && ts.isIdentifier(idName));
    assert.ok(otherName !== undefined && ts.isIdentifier(otherName));
    assert.ok(model.resolve(idName) !== undefined, "schema parsing must preserve taint provenance");
    assert.equal(model.hasProtection(idName, "validated"), true);
    assert.equal(model.hasProtection(otherName, "validated"), false);
    assert.ok(model.tainted.has("other"), "the unrelated value remains tainted");
});
test("taint evidence records the propagation path from source to sink", () => {
    const sourceFile = ts.createSourceFile("trace.ts", "const id = req.params.id;\nconst query = `SELECT ${id}`;\n", ts.ScriptTarget.Latest, true);
    const model = buildTaintModel(sourceFile);
    const origin = model.tainted.get("query");
    assert.ok(origin !== undefined, "the derived query must be tainted");
    assert.equal(origin.source, "req.params.id");
    assert.ok(origin.steps.some((step) => step.includes("template literal")), `expected a template-literal propagation step, got ${JSON.stringify(origin.steps)}`);
});
test("an unrelated authorization word does not prove an authorization predicate", () => {
    const sourceFile = ts.createSourceFile("authz.ts", `const policyName = "owner policy";
const record = prisma.record.findUnique({ where: { id: req.params.id } });
`, ts.ScriptTarget.Latest, true);
    const model = buildTaintModel(sourceFile);
    const policy = sourceFile.statements[0];
    assert.ok(policy !== undefined);
    assert.ok(ts.isVariableStatement(policy));
    const policyName = policy.declarationList.declarations[0]?.name;
    assert.ok(policyName !== undefined && ts.isIdentifier(policyName));
    assert.deepEqual(model.protections(policyName), [], "a policy string is not protection evidence");
});
test("Array.prototype.find is not treated as a database query sink", async () => {
    const ids = await securityIds("sink-array-find", "registry.ts", `const DEFINITIONS = [];
export function locate(finding) {
  const definition = DEFINITIONS.find((candidate) => candidate.matches(finding));
  const action = finding.plan?.actions.find((candidate) => candidate.type === "analyzer");
  return [definition, action];
}
`);
    assert.ok(!ids.has("FF-QUERY-N1-001"), "searching an in-memory array must not be reported as an N+1 database query");
    assert.ok(!ids.has("FF-TENANT-SCOPE-001"), "an array search has no tenant scope to enforce");
});
test("a genuine ORM query on a database receiver is still detected", async () => {
    const ids = await securityIds("sink-orm-find", "orders.ts", `export async function list(req, db) {
  return db.orders.find({ id: req.params.id });
}
`);
    assert.ok(ids.size > 0, "narrowing ambiguous receivers must not blind the analyzer to real ORM calls");
});
test("Object.assign is not treated as a model write sink", async () => {
    const ids = await securityIds("sink-object-assign", "merge.ts", `export function merge(req, target) {
  return Object.assign(target, req.body);
}
`);
    assert.ok(!ids.has("FF-SEC-MASS-ASSIGN-001"), "Object.assign onto a local object is not a persistence boundary");
});
test("Zod string parsing does not suppress SQL interpolation", async () => {
    const ids = await securityIds("typed-zod-sql", "users.ts", `export async function load(req, db) {
  const id = z.string().parse(req.params.id);
  return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}`);
    assert.ok(ids.has("FF-SEC-SQL-001"));
});
test("UUID validation does not suppress SQL interpolation", async () => {
    const ids = await securityIds("typed-uuid-sql", "users.ts", `export async function load(req, db) {
  const id = validateUuid(req.params.id);
  return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}`);
    assert.ok(ids.has("FF-SEC-SQL-001"));
});
test("URL-component encoding does not make shell execution safe", async () => {
    const ids = await securityIds("typed-url-shell", "run.ts", `import { exec } from "node:child_process";
export function run(req) {
  const command = encodeURIComponent(req.body.command);
  exec(command);
}`);
    assert.ok(ids.has("FF-SEC-SHELL-001"));
});
test("HTML escaping does not make SQL interpolation safe", async () => {
    const ids = await securityIds("typed-html-sql", "users.ts", `export async function load(req, db) {
  const id = escapeHtml(req.params.id);
  return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}`);
    assert.ok(ids.has("FF-SEC-SQL-001"));
});
test("driver parameter binding resolves the SQL structural finding", async () => {
    const ids = await securityIds("typed-parameter-sql", "users.ts", `export async function load(req, db) {
  return db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
}`);
    assert.ok(!ids.has("FF-SEC-SQL-001"));
});
test("a fixed executable with a validated argument array is shell-separated", async () => {
    const ids = await securityIds("typed-shell-array", "run.ts", `import { spawn } from "node:child_process";
export function run(req) {
  const ref = z.string().regex(/^[a-z0-9-]+$/).parse(req.query.ref);
  return spawn("git", ["show", ref], { shell: false });
}`);
    assert.ok(!ids.has("FF-SEC-SHELL-001"));
});
test("SSRF allowlisting is bound to the actual destination", async () => {
    const protectedIds = await securityIds("typed-ssrf-target", "proxy.ts", `const ALLOWED_DESTINATIONS = { docs: "https://docs.example.test/" };
export function proxy(req) {
  const destination = ALLOWED_DESTINATIONS[req.query.destination];
  return fetch(destination, { redirect: "manual" });
}`);
    assert.ok(!protectedIds.has("FF-SEC-SSRF-001"));
    const unrelatedIds = await securityIds("typed-ssrf-unrelated", "proxy.ts", `const ALLOWED_DESTINATIONS = { docs: "https://docs.example.test/" };
export function proxy(req) {
  const unrelated = ALLOWED_DESTINATIONS.docs;
  return fetch(req.query.destination);
}`);
    assert.ok(unrelatedIds.has("FF-SEC-SSRF-001"));
    const redirectIds = await securityIds("typed-ssrf-redirect", "proxy.ts", `const ALLOWED_DESTINATIONS = { docs: "https://docs.example.test/" };
export function proxy(req) {
  const destination = ALLOWED_DESTINATIONS[req.query.destination];
  return fetch(destination);
}`);
    assert.ok(redirectIds.has("FF-SEC-SSRF-001"));
});
test("a raw reassignment invalidates an earlier destination protection", async () => {
    const ids = await securityIds("typed-ssrf-reassignment", "proxy.ts", `const ALLOWED_DESTINATIONS = { docs: "https://docs.example.test/" };
export function proxy(req) {
  let destination = ALLOWED_DESTINATIONS[req.query.destination];
  destination = req.query.override;
  return fetch(destination);
}`);
    assert.ok(ids.has("FF-SEC-SSRF-001"));
});
test("validation of one value does not protect another value", async () => {
    const ids = await securityIds("typed-unrelated-value", "users.ts", `export async function load(req, db) {
  const safe = z.string().parse(req.query.safe);
  void safe;
  return db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);
}`);
    assert.ok(ids.has("FF-SEC-SQL-001"));
    assert.ok(ids.has("FF-SEC-VALIDATION-001"));
});
test("taint and typed validation survive aliases", async () => {
    const ids = await securityIds("typed-alias-after-validation", "users.ts", `export async function load(req, db) {
  const validated = z.string().parse(req.params.id);
  const alias = validated;
  return db.query(\`SELECT * FROM users WHERE id = \${alias}\`);
}`);
    assert.ok(ids.has("FF-SEC-SQL-001"));
});
test("shadowed variables do not inherit unrelated taint or protection", async () => {
    const findings = await securityFindings("typed-shadowing", `const id = z.string().parse(req.params.id);
export function outer(db) {
  function inner() {
    const id = "server-owned";
    return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
  }
  void inner;
  return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}`);
    assert.equal(findings.filter((finding) => finding.id === "FF-SEC-SQL-001").length, 1, "only the outer request-controlled binding is vulnerable");
});
//# sourceMappingURL=dataflow.test.js.map