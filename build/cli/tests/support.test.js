import assert from "node:assert/strict";
import test from "node:test";
import { ANALYZER_SUPPORT, describeMissingAdapter, findSupport, missingAdapters } from "../src/support.js";
test("a language with no analyzer reports the specific missing adapter", () => {
    const missing = missingAdapters("authorization", ["Python"]);
    assert.equal(missing.length, 1);
    assert.deepEqual(missing[0], {
        module: "authorization",
        language: "Python",
        framework: "FastAPI",
        required_adapter: "fastapi-authorization-boundaries"
    });
});
test("missing-adapter evidence names module, language, framework, and adapter", () => {
    const [missing] = missingAdapters("authorization", ["Python"]);
    assert.ok(missing !== undefined);
    const rendered = describeMissingAdapter(missing);
    assert.match(rendered, /^NOT_VERIFIED/u, "a coverage gap is never PASS");
    assert.match(rendered, /module=authorization/u);
    assert.match(rendered, /language=Python/u);
    assert.match(rendered, /framework=FastAPI/u);
    assert.match(rendered, /required adapter=fastapi-authorization-boundaries/u);
});
test("an unregistered language still yields a named adapter requirement", () => {
    const [missing] = missingAdapters("security", ["Elixir"]);
    assert.ok(missing !== undefined);
    assert.equal(missing.language, "Elixir");
    assert.equal(missing.required_adapter, "elixir-security-boundaries");
});
test("executable coverage reports no missing adapter", () => {
    assert.deepEqual(missingAdapters("security", ["JavaScript/TypeScript"]), []);
});
test("partial coverage is not reported as executable", () => {
    const support = findSupport("tenancy", "JavaScript/TypeScript");
    assert.ok(support !== undefined, "tenancy support must be registered");
    assert.equal(support.coverage, "partial");
    assert.ok(support.unsupported_shapes.length > 0, "partial coverage must state what it cannot see");
});
test("every non-executable registry entry names the adapter that would close the gap", () => {
    for (const entry of ANALYZER_SUPPORT)
        if (entry.coverage !== "executable")
            assert.ok(entry.required_adapter !== undefined && entry.required_adapter.length > 0, `${entry.module}/${entry.language} must name its required adapter`);
});
test("every executable registry entry documents its unsupported shapes", () => {
    for (const entry of ANALYZER_SUPPORT)
        if (entry.coverage === "executable")
            assert.ok(entry.unsupported_shapes.length > 0, `${entry.module}/${entry.language} must not imply whole-program soundness`);
});
//# sourceMappingURL=support.test.js.map