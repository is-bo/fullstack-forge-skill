import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
async function auditCoverage(root, section, files, dependencies = {}) {
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "adapter-project", private: true, dependencies }), "utf8");
    for (const [name, content] of Object.entries(files))
        await writeFile(join(root, name), content, "utf8");
    const audit = await runFile(process.execPath, [cli, section, "audit", "--root", root, "--json"], root);
    assert.ok([0, 1, 2].includes(audit.exitCode), audit.stderr);
    const parsed = JSON.parse(audit.stdout);
    const report = await runFile(process.execPath, [cli, section, "report", "--root", root], root);
    return { coverage: parsed.report.analyzer_coverage, markdown: report.stdout };
}
test("CLI reports framework-specific Python authorization adapters", async (t) => {
    for (const [framework, source, adapter] of [
        [
            "FastAPI",
            "from fastapi import FastAPI\napp = FastAPI()\n",
            "fastapi-authorization-boundaries"
        ],
        ["Django", "from django.http import HttpResponse\n", "django-authorization-boundaries"]
    ]) {
        await t.test(framework, async () => {
            await withTemporaryProject("adapter-" + framework, async (root) => {
                const result = await auditCoverage(root, "authorization", { "app.py": source });
                const coverage = result.coverage.find((entry) => entry.language === "Python" && entry.framework === framework);
                assert.ok(coverage);
                assert.equal(coverage.status, "NOT_VERIFIED");
                assert.equal(coverage.coverage, "none");
                assert.equal(coverage.required_adapter, adapter);
                assert.match(result.markdown, new RegExp("framework=" + framework, "u"));
                assert.match(result.markdown, new RegExp("required adapter=" + adapter, "u"));
            });
        });
    }
});
test("CLI names Go, Rust, and JVM security adapter gaps", async (t) => {
    for (const [language, filename, source, adapter] of [
        ["Go", "main.go", "package main\nfunc main() {}\n", "go-security-boundaries"],
        ["Rust", "main.rs", "fn main() {}\n", "rust-security-boundaries"],
        ["Java/Kotlin", "Main.kt", "fun main() {}\n", "jvm-security-boundaries"]
    ]) {
        await t.test(language, async () => {
            await withTemporaryProject("adapter-" + language, async (root) => {
                const result = await auditCoverage(root, "security", { [filename]: source });
                const coverage = result.coverage.find((entry) => entry.language === language);
                assert.ok(coverage);
                assert.equal(coverage.coverage, "none");
                assert.equal(coverage.required_adapter, adapter);
            });
        });
    }
});
test("mixed JavaScript and Python coverage remains independently structured", async () => {
    await withTemporaryProject("adapter-mixed", async (root) => {
        const result = await auditCoverage(root, "security", {
            "server.ts": "export const handler = () => true;\n",
            "worker.py": "def handler():\n    return True\n"
        });
        const javascript = result.coverage.find((entry) => entry.language === "JavaScript/TypeScript");
        const python = result.coverage.find((entry) => entry.language === "Python");
        assert.ok(javascript);
        assert.ok(python);
        assert.equal(javascript.coverage, "executable");
        assert.equal(javascript.status, "PASS");
        assert.equal(python.framework, "unknown");
        assert.equal(python.coverage, "none");
        assert.equal(python.required_adapter, "python-security-boundaries");
    });
});
test("unknown Python framework is not defaulted to FastAPI", async () => {
    await withTemporaryProject("adapter-python-unknown", async (root) => {
        const result = await auditCoverage(root, "authorization", {
            "app.py": "def load_record(record_id):\n    return record_id\n"
        });
        const python = result.coverage.find((entry) => entry.language === "Python");
        assert.ok(python);
        assert.equal(python.framework, "unknown");
        assert.equal(python.required_adapter, "python-authorization-boundaries");
    });
});
test("JavaScript/TypeScript authorization coverage is explicitly partial", async () => {
    await withTemporaryProject("adapter-js-partial", async (root) => {
        const result = await auditCoverage(root, "authorization", { "app.ts": "export const app = express();\n" }, { express: "0.0.0-fixture" });
        const javascript = result.coverage.find((entry) => entry.language === "JavaScript/TypeScript");
        assert.ok(javascript);
        // A dependency name alone does not prove that this file is an Express boundary. Framework
        // attribution is reserved for concrete source imports/route shapes; this fixture therefore
        // remains the generic JavaScript/TypeScript adapter path.
        assert.equal(javascript.framework, "any");
        assert.equal(javascript.coverage, "partial");
        assert.equal(javascript.status, "NOT_VERIFIED");
        assert.equal(javascript.required_adapter, "js-ts-framework-authorization-boundaries");
        assert.ok(javascript.unsupported_shapes.length > 0);
    });
});
