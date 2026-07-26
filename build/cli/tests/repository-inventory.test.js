import assert from "node:assert/strict";
import { mkdir, open, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { inventoryRepository, parseInspectionBudget, validateExclusionPattern } from "../src/repository-inventory.js";
import { runFile, workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
const CLI = join(process.cwd(), "build", "cli", "src", "index.js");
test("generated-output-heavy repositories do not spend the text budget or activate capabilities", async () => {
    await withTemporaryProject("inventory-generated", async (root) => {
        await writeFile(join(root, "package.json"), '{"name":"small-app"}', "utf8");
        await writeFile(join(root, "app.ts"), "export const ready = true;", "utf8");
        await mkdir(join(root, "src", "build"), { recursive: true });
        await writeFile(join(root, "src", "build", "domain.ts"), "export const domain = true;", "utf8");
        for (const directory of [".next", "dist", "build", "out", ".turbo", "coverage"]) {
            await mkdir(join(root, directory), { recursive: true });
            await sparseFile(join(root, directory, "generated.js"), 24 * 1024 * 1024);
        }
        const profile = await discoverProject(root);
        assert.ok(profile.inventory);
        assert.equal(profile.inventory.status, "COMPLETE");
        assert.ok(profile.inventory.generated_paths_excluded >= 6);
        assert.ok(profile.inventory.bytes_read < 1024);
        assert.equal(profile.capabilities.payments, undefined);
        const inventory = await inventoryRepository(root);
        assert.equal(inventory.entries.find((entry) => entry.path === "src/build/domain.ts")?.status, "INSPECTED");
    });
});
test("Python environments and bytecode remain outside application evidence", async () => {
    await withTemporaryProject("inventory-python", async (root) => {
        await writeFile(join(root, "app.py"), "from flask import Flask\napp = Flask(__name__)\n", "utf8");
        for (const directory of [".venv", "venv", "__pycache__"]) {
            await mkdir(join(root, directory), { recursive: true });
            await sparseFile(join(root, directory, "dependency.pyc"), 48 * 1024 * 1024);
        }
        const profile = await discoverProject(root);
        assert.ok(profile.inventory);
        assert.equal(profile.inventory.status, "COMPLETE");
        assert.ok(profile.detections.some((detection) => detection.name === "Python"));
        assert.ok(profile.inventory.default_paths_excluded + profile.inventory.generated_paths_excluded >= 3);
    });
});
test("many small binaries do not consume the relevant-text budget", async () => {
    await withTemporaryProject("inventory-binary", async (root) => {
        await writeFile(join(root, "app.ts"), "export const inspected = true;", "utf8");
        await mkdir(join(root, "media"));
        for (let index = 0; index < 200; index += 1) {
            await writeFile(join(root, "media", `${index}.png`), Buffer.alloc(4096, index % 255));
        }
        const inventory = await inventoryRepository(root, { inspectionBudgetBytes: 64 });
        assert.equal(inventory.diagnostics.status, "COMPLETE");
        assert.equal(inventory.diagnostics.binary_files_skipped, 200);
        assert.equal(inventory.diagnostics.bytes_read, Buffer.byteLength("export const inspected = true;"));
        assert.equal(inventory.entries.find((entry) => entry.path === "app.ts")?.status, "INSPECTED");
    });
});
test("runtime data is excluded visibly without loading private content", async () => {
    await withTemporaryProject("inventory-runtime", async (root) => {
        await writeFile(join(root, "app.ts"), "export const app = true;", "utf8");
        for (const directory of ["uploads", "attachments", "backups", "logs"]) {
            await mkdir(join(root, directory));
            await writeFile(join(root, directory, "private.sqlite"), "must-not-appear", "utf8");
        }
        const inventory = await inventoryRepository(root);
        assert.equal(inventory.diagnostics.status, "COMPLETE");
        assert.equal(inventory.diagnostics.default_paths_excluded, 4);
        assert.ok(inventory.diagnostics.excluded_paths.every((entry) => !JSON.stringify(entry).includes("must-not-appear")));
        assert.equal(inventory.entries.some((entry) => entry.path.includes("private.sqlite")), false);
    });
});
test("genuinely large relevant text retains evidence and returns structured partial diagnostics", async () => {
    await withTemporaryProject("inventory-partial", async (root) => {
        await mkdir(join(root, "apps", "web"), { recursive: true });
        await writeFile(join(root, "apps", "web", "a.ts"), "a".repeat(48), "utf8");
        await writeFile(join(root, "apps", "web", "b.ts"), "b".repeat(48), "utf8");
        const inventory = await inventoryRepository(root, {
            inspectionBudgetBytes: 64,
            maxFileBytes: 64
        });
        assert.equal(inventory.diagnostics.status, "PARTIAL");
        assert.equal(inventory.diagnostics.reason, "inspection-budget-exhausted");
        assert.equal(inventory.diagnostics.files_inspected, 1);
        assert.equal(inventory.diagnostics.files_skipped, 1);
        assert.equal(inventory.diagnostics.bytes_read, 48);
        assert.equal(inventory.entries[0]?.content, "a".repeat(48));
        assert.equal(inventory.entries[1]?.reason, "inspection-budget-exhausted");
        assert.equal(inventory.diagnostics.largest_contributing_directories[0]?.path, "apps/web");
    });
});
test(".forgeignore supports reviewed patterns and makes required exclusions partial", async () => {
    await withTemporaryProject("inventory-forgeignore", async (root) => {
        await mkdir(join(root, "private data"));
        await mkdir(join(root, "unicode-λ"));
        await mkdir(join(root, "generated", "nested"), { recursive: true });
        await writeFile(join(root, "app.ts"), "export const app = true;", "utf8");
        await writeFile(join(root, "private data", "secret.ts"), "private", "utf8");
        await writeFile(join(root, "unicode-λ", "secret.ts"), "private", "utf8");
        await writeFile(join(root, "generated", "nested", "secret.ts"), "private", "utf8");
        await writeFile(join(root, ".forgeignore"), "# reviewed local paths\n\nprivate data\nunicode-λ\ngenerated/*\n", "utf8");
        const inventory = await inventoryRepository(root);
        assert.equal(inventory.diagnostics.status, "PARTIAL");
        assert.equal(inventory.diagnostics.reason, "user-exclusions-affect-required-evidence");
        assert.equal(inventory.diagnostics.user_paths_excluded, 3);
        assert.deepEqual(inventory.diagnostics.forgeignore_patterns, [
            "generated/*",
            "private data",
            "unicode-λ"
        ]);
        assert.ok(inventory.entries.some((entry) => entry.path === "app.ts"));
    });
});
test("exclusion and budget input validation rejects escape and ambiguous values", () => {
    assert.equal(validateExclusionPattern("storage\\local"), "storage/local");
    for (const value of ["../escape", "C:\\absolute", "/absolute", "\\\\server\\share", "a/../b"]) {
        assert.throws(() => validateExclusionPattern(value), /cannot escape the root/u);
    }
    assert.equal(parseInspectionBudget("2MiB"), 2 * 1024 * 1024);
    assert.equal(parseInspectionBudget("4 KiB"), 4096);
    for (const value of ["0", "-1", "1MB", "513MiB", "1.5MiB"]) {
        assert.throws(() => parseInspectionBudget(value), /inspection budget|requires a positive/u);
    }
});
test("CLI exclusions are repeatable, visible in JSON, and fail closed for Audit, Verify, and Ship", async () => {
    await withTemporaryProject("inventory-cli", async (root) => {
        await writeFile(join(root, "package.json"), '{"name":"cli-inventory"}', "utf8");
        await writeFile(join(root, "app.ts"), "export const app = true;", "utf8");
        await mkdir(join(root, "private"));
        await writeFile(join(root, "private", "auth.ts"), "export const password = 'value';", "utf8");
        const common = [
            "--root",
            root,
            "--exclude",
            "private",
            "--exclude=private",
            "--inspection-budget",
            "1MiB",
            "--json"
        ];
        const audit = await runFile(process.execPath, [CLI, "all", "audit", ...common], root, 30_000);
        assert.equal(audit.exitCode, 2, audit.stderr);
        const auditJson = JSON.parse(audit.stdout);
        assert.equal(auditJson.report.profile.inventory.status, "PARTIAL");
        assert.deepEqual(auditJson.report.profile.inventory.cli_exclusions, ["private"]);
        assert.equal(auditJson.report.environment.inspection_budget_bytes, 1024 * 1024);
        assert.deepEqual(auditJson.report.environment.inventory_exclusions, ["private"]);
        assert.ok(auditJson.report.findings.some((finding) => finding.id === "FF-INVENTORY-001" && finding.status === "NOT_VERIFIED"));
        const verify = await runFile(process.execPath, [CLI, "all", "verify", ...common], root, 30_000);
        assert.equal(verify.exitCode, 2, verify.stderr);
        const verifyJson = JSON.parse(verify.stdout);
        assert.ok(verifyJson.report.findings.some((finding) => finding.id === "FF-INVENTORY-001" && finding.status === "NOT_VERIFIED"));
        const ship = await runFile(process.execPath, [CLI, "ship", ...common], root, 30_000);
        assert.equal(ship.exitCode, 2, ship.stderr);
        const shipJson = JSON.parse(ship.stdout);
        assert.ok(shipJson.findings.some((finding) => finding.id === "FF-INVENTORY-001" && finding.status === "NOT_VERIFIED"));
    });
});
test("Git-aware inventory respects ignores while retaining tracked generated paths and Unicode", async () => {
    await withTemporaryProject("inventory-git", async (root) => {
        await git(root, ["init"]);
        await git(root, ["config", "user.email", "forge@example.test"]);
        await git(root, ["config", "user.name", "Forge Test"]);
        await mkdir(join(root, "dist"));
        await mkdir(join(root, "nested"));
        await writeFile(join(root, ".gitignore"), "ignored/\n", "utf8");
        await writeFile(join(root, "dist", "tracked source.ts"), "export const tracked = true;", "utf8");
        await writeFile(join(root, "nested", "λ file.ts"), "export const unicode = true;", "utf8");
        await mkdir(join(root, "ignored"));
        await sparseFile(join(root, "ignored", "huge.bin"), 140 * 1024 * 1024);
        await git(root, ["add", "."]);
        await git(root, ["commit", "-m", "fixture"]);
        await writeFile(join(root, "nested", "untracked.ts"), "export const extra = true;", "utf8");
        const inventory = await inventoryRepository(root);
        assert.equal(inventory.diagnostics.source, "git");
        assert.equal(inventory.diagnostics.status, "COMPLETE");
        assert.equal(inventory.entries.some((entry) => entry.path.startsWith("ignored/")), false);
        assert.equal(inventory.entries.find((entry) => entry.path === "dist/tracked source.ts")?.reason, "tracked-generated-path-neutralized");
        assert.equal(inventory.entries.find((entry) => entry.path === "nested/λ file.ts")?.status, "INSPECTED");
        assert.equal(inventory.entries.find((entry) => entry.path === "nested/untracked.ts")?.origin, "untracked");
        const nested = await inventoryRepository(join(root, "nested"));
        assert.ok(nested.entries.every((entry) => !entry.path.startsWith("../")));
        assert.ok(nested.entries.some((entry) => entry.path === "λ file.ts"));
    });
});
test("working-tree revisions are deterministic and explicitly partial for skipped dirty binaries", async () => {
    await withTemporaryProject("inventory-revision", async (root) => {
        await git(root, ["init"]);
        await git(root, ["config", "user.email", "forge@example.test"]);
        await git(root, ["config", "user.name", "Forge Test"]);
        await writeFile(join(root, ".gitignore"), "ignored/\n", "utf8");
        await writeFile(join(root, "app.ts"), "export const value = 1;", "utf8");
        await git(root, ["add", "."]);
        await git(root, ["commit", "-m", "fixture"]);
        const clean = await workingTreeRevision(root);
        await mkdir(join(root, "ignored"));
        await sparseFile(join(root, "ignored", "huge.bin"), 140 * 1024 * 1024);
        assert.equal(await workingTreeRevision(root), clean);
        await sparseFile(join(root, "large-untracked.bin"), 140 * 1024 * 1024);
        const binaryRevision = await workingTreeRevision(root);
        assert.match(binaryRevision, /:dirty-partial:/u);
        assert.equal(await workingTreeRevision(root), binaryRevision);
        await unlink(join(root, "large-untracked.bin"));
        await writeFile(join(root, "app.ts"), "export const value = 2;", "utf8");
        const textRevision = await workingTreeRevision(root);
        assert.match(textRevision, /:dirty:/u);
        assert.doesNotMatch(textRevision, /dirty-partial/u);
        try {
            await symlink(join(root, "app.ts"), join(root, "linked.ts"), "file");
            assert.match(await workingTreeRevision(root), /:dirty-partial:/u);
        }
        catch (error) {
            if (process.platform !== "win32")
                throw error;
        }
    });
});
async function sparseFile(path, bytes) {
    const handle = await open(path, "w");
    try {
        await handle.truncate(bytes);
    }
    finally {
        await handle.close();
    }
}
async function git(root, args) {
    const result = await runFile("git", args, root, 30_000);
    assert.equal(result.exitCode, 0, `${args.join(" ")}\n${result.stderr}`);
}
//# sourceMappingURL=repository-inventory.test.js.map