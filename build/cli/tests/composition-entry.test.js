import assert from "node:assert/strict";
import test from "node:test";
import { isDirectExecution } from "../src/composition-entry.js";
test("direct execution survives a platform path alias such as macOS /var to /private/var", () => {
    const canonicalize = (path) => path
        .replaceAll("\\", "/")
        .replace(/^.*\/private\/var\//u, "/private/var/")
        .replace(/^.*\/var\//u, "/private/var/");
    assert.equal(isDirectExecution("/var/folders/forge/composition-entry.js", "/private/var/folders/forge/composition-entry.js", canonicalize), true);
});
