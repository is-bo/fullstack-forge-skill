import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";
import ts from "typescript";

const projectRoot = process.cwd();
const runtimeRoot = join(projectRoot, ".fullstack-forge", "runtime", "cli");

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test("the standalone composition runtime has no external package dependency", () => {
  const manifest = JSON.parse(readFileSync(join(runtimeRoot, "package.json"), "utf8"));
  assert.deepEqual(manifest, { type: "module", private: true });

  const externalImports = [];
  for (const path of filesUnder(join(runtimeRoot, "src")).filter((file) => file.endsWith(".js"))) {
    const source = readFileSync(path, "utf8");
    for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
      if (imported.fileName.startsWith(".") || imported.fileName.startsWith("node:")) continue;
      externalImports.push(
        `${relative(projectRoot, path).split(sep).join("/")}: ${imported.fileName}`
      );
    }
  }

  assert.deepEqual(
    externalImports,
    [],
    "the installed runtime must execute without npm dependencies such as TypeScript"
  );
});
