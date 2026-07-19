import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

const FORBIDDEN_MANIFESTS = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "composer.json",
  "composer.lock",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "requirements.txt",
  "pipfile",
  "pipfile.lock",
  "gemfile",
  "gemfile.lock"
]);
const ALLOWED_SENTINEL_FIELDS = new Set([
  "name",
  "private",
  "dependencies",
  "devDependencies",
  "optionalDependencies"
]);

export async function inspectFixtureManifests(fixturesRoot) {
  const errors = [];
  const manifests = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const info = await lstat(path);
      const display = relative(fixturesRoot, path).replaceAll("\\", "/");
      if (info.isSymbolicLink()) {
        errors.push(`${display}: fixture assets must not be symbolic links`);
        continue;
      }
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (FORBIDDEN_MANIFESTS.has(entry.name.toLowerCase())) {
        errors.push(
          `${display}: installable manifests and lockfiles are forbidden under fixtures/`
        );
        continue;
      }
      if (entry.name !== "package.json.fixture") continue;
      manifests.push(display);
      let manifest;
      try {
        manifest = JSON.parse(await readFile(path, "utf8"));
      } catch {
        errors.push(`${display}: fixture manifest is not valid JSON`);
        continue;
      }
      if (
        typeof manifest !== "object" ||
        manifest === null ||
        Array.isArray(manifest) ||
        manifest.private !== true ||
        typeof manifest.name !== "string" ||
        !manifest.name.startsWith("fixture-")
      ) {
        errors.push(`${display}: manifest must be private and use a fixture-* name`);
        continue;
      }
      if ("scripts" in manifest || "packageManager" in manifest)
        errors.push(
          `${display}: executable scripts and package-manager declarations are forbidden`
        );
      const unexpected = Object.keys(manifest).filter(
        (field) => !ALLOWED_SENTINEL_FIELDS.has(field)
      );
      if (unexpected.length > 0)
        errors.push(`${display}: unsupported sentinel fields: ${unexpected.sort().join(", ")}`);
      for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
        const dependencies = manifest[group];
        if (dependencies === undefined) continue;
        if (
          typeof dependencies !== "object" ||
          dependencies === null ||
          Array.isArray(dependencies)
        ) {
          errors.push(`${display}: ${group} must be an object`);
          continue;
        }
        for (const [name, version] of Object.entries(dependencies))
          if (version !== "0.0.0-fixture")
            errors.push(
              `${display}: ${name} must retain the noninstallable 0.0.0-fixture sentinel`
            );
      }
    }
  };
  await visit(fixturesRoot);
  if (basename(fixturesRoot).toLowerCase() !== "fixtures")
    errors.push("fixture validation must target a directory named fixtures");
  return { manifests: manifests.sort(), errors: errors.sort() };
}
