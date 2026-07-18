import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { analyzeChangedScope } from "../src/scope.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

test("changed scope excludes an unrelated application and includes dirty working-tree files", async () => {
  await withGitProject("scope-isolation", async (root) => {
    await writeFile(
      join(root, "apps", "one", "route.ts"),
      `${routeSource}\nexport const changed = true;\n`,
      "utf8"
    );
    await writeFile(
      join(root, "apps", "one", "untracked.ts"),
      "export const local = true;\n",
      "utf8"
    );
    const profile = await discoverProject(root);
    const scope = await analyzeChangedScope(root, profile, "main");
    assert.ok(scope.files.has("apps/one/route.ts"));
    assert.ok(scope.files.has("apps/one/untracked.ts"));
    assert.ok(![...scope.files].some((path) => path.startsWith("apps/two/")));
    assert.ok(
      scope.evidence.affected_applications.some((application) => application.name === "@repo/one")
    );
    assert.ok(
      scope.evidence.excluded_applications.some((application) => application.name === "@repo/two")
    );
    assert.ok(scope.evidence.changed_files.some((file) => file.status === "untracked"));
  });
});

test("changed shared authorization includes dependent routes", async () => {
  await withGitProject("scope-auth", async (root) => {
    await writeFile(
      join(root, "packages", "auth", "index.ts"),
      "export function requireAuth() { return { userId: 'changed' }; }\n",
      "utf8"
    );
    const scope = await analyzeChangedScope(root, await discoverProject(root), "main");
    const route = scope.evidence.included_files.find((file) => file.path === "apps/one/route.ts");
    assert.ok(route);
    assert.ok(
      route.reasons.some(
        (reason) => reason.includes("depends on affected file") || reason.includes("policy changed")
      )
    );
    assert.ok(scope.modules.has("authorization"));
  });
});

test("changed database schema includes migrations, queries, dependent application, and tests", async () => {
  await withGitProject("scope-schema", async (root) => {
    await writeFile(
      join(root, "packages", "db", "schema.prisma"),
      "model Invoice { id String @id tenantId String total Int }\n",
      "utf8"
    );
    const scope = await analyzeChangedScope(root, await discoverProject(root), "main");
    for (const path of [
      "packages/db/migrations/001.sql",
      "packages/db/queries.ts",
      "packages/db/queries.test.ts",
      "apps/one/route.ts"
    ]) {
      assert.ok(scope.files.has(path), `expected ${path}`);
    }
    assert.ok(scope.modules.has("database"));
    assert.ok(scope.modules.has("queries"));
  });
});

test("renames and deletions are recorded without unsafe path expansion", async () => {
  await withGitProject("scope-rename", async (root) => {
    await git(root, ["mv", "apps/one/old.ts", "apps/one/new.ts"]);
    await git(root, ["rm", "apps/one/delete.ts"]);
    const scope = await analyzeChangedScope(root, await discoverProject(root), "main");
    const renamed = scope.evidence.changed_files.find((file) => file.path === "apps/one/new.ts");
    assert.equal(renamed?.status, "renamed");
    assert.equal(renamed.previous_path, "apps/one/old.ts");
    assert.equal(
      scope.evidence.changed_files.find((file) => file.path === "apps/one/delete.ts")?.status,
      "deleted"
    );
    assert.ok(scope.files.has("apps/one/delete.ts"));
    assert.ok(scope.files.has("apps/one/old.ts"));
    assert.ok(
      scope.evidence.affected_applications.some((application) => application.name === "@repo/one")
    );
  });
});

test("nonexistent and unsafe Git bases are rejected clearly", async () => {
  await withGitProject("scope-base", async (root) => {
    const profile = await discoverProject(root);
    await assert.rejects(analyzeChangedScope(root, profile, "missing-branch"), /does not resolve/u);
    await assert.rejects(
      analyzeChangedScope(root, profile, "--upload-pack=evil"),
      /Unsafe Git base/u
    );
  });
});

const routeSource = `import { requireAuth } from "../../packages/auth/index";
import { listInvoices } from "../../packages/db/queries";
export async function route() {
  const session = requireAuth();
  return listInvoices(session.userId);
}
`;

async function withGitProject(
  prefix: string,
  callback: (root: string) => Promise<void>
): Promise<void> {
  await withTemporaryProject(prefix, async (root) => {
    for (const directory of ["apps/one", "apps/two", "packages/auth", "packages/db/migrations"]) {
      await mkdir(join(root, ...directory.split("/")), { recursive: true });
    }
    await writeJson(join(root, "package.json"), {
      name: "scope-monorepo",
      private: true,
      workspaces: ["apps/*", "packages/*"]
    });
    await writeJson(join(root, "apps", "one", "package.json"), {
      name: "@repo/one",
      private: true,
      dependencies: {
        "@repo/auth": "workspace:*",
        "@repo/db": "workspace:*",
        express: "0.0.0-fixture"
      }
    });
    await writeJson(join(root, "apps", "two", "package.json"), {
      name: "@repo/two",
      private: true,
      dependencies: { react: "0.0.0-fixture" }
    });
    await writeJson(join(root, "packages", "auth", "package.json"), {
      name: "@repo/auth",
      private: true
    });
    await writeJson(join(root, "packages", "db", "package.json"), {
      name: "@repo/db",
      private: true,
      dependencies: { "@prisma/client": "0.0.0-fixture" }
    });
    await writeFile(join(root, "apps", "one", "route.ts"), routeSource, "utf8");
    await writeFile(join(root, "apps", "one", "old.ts"), "export const old = true;\n", "utf8");
    await writeFile(
      join(root, "apps", "one", "delete.ts"),
      "export const remove = true;\n",
      "utf8"
    );
    await writeFile(
      join(root, "apps", "two", "page.tsx"),
      "export const Page = () => <main>Two</main>;\n",
      "utf8"
    );
    await writeFile(
      join(root, "packages", "auth", "index.ts"),
      "export function requireAuth() { return { userId: 'one' }; }\n",
      "utf8"
    );
    await writeFile(
      join(root, "packages", "db", "schema.prisma"),
      "model Invoice { id String @id tenantId String }\n",
      "utf8"
    );
    await writeFile(
      join(root, "packages", "db", "queries.ts"),
      "export const listInvoices = (userId: string) => db.invoice.findMany({ where: { userId }, take: 20 });\n",
      "utf8"
    );
    await writeFile(
      join(root, "packages", "db", "queries.test.ts"),
      "test('queries', () => {});\n",
      "utf8"
    );
    await writeFile(
      join(root, "packages", "db", "migrations", "001.sql"),
      "CREATE TABLE invoice (id text primary key);\n",
      "utf8"
    );
    await git(root, ["init", "-b", "main"]);
    await git(root, ["config", "user.email", "forge-tests@example.invalid"]);
    await git(root, ["config", "user.name", "Fullstack Forge Tests"]);
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "test: baseline"]);
    await callback(root);
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function git(root: string, args: string[]): Promise<void> {
  const result = await runFile("git", args, root, 60_000);
  assert.equal(result.exitCode, 0, `${args.join(" ")}: ${result.stderr}`);
}
