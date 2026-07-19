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
test("a sanitizer bound to the tainted value clears only that value", () => {
    const sourceFile = ts.createSourceFile("sanitized.ts", `const id = z.string().uuid().parse(req.params.id);
const other = req.query.other;
`, ts.ScriptTarget.Latest, true);
    const model = buildTaintModel(sourceFile);
    assert.equal(model.isSanitized("id"), true, "the parsed value is sanitized");
    assert.equal(model.isSanitized("other"), false, "an unrelated value is not sanitized");
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
    assert.equal(model.isSanitized("policyName"), false, "naming a string 'owner policy' is not a sanitizer");
});
//# sourceMappingURL=dataflow.test.js.map