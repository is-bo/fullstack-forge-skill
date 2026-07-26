import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = join(fileURLToPath(new URL("../..", import.meta.url)));
const canonicalRoot = join(projectRoot, "src", "fullstack-forge");

test("canonical skill is a concise progressive router", async () => {
  const main = await readFile(join(canonicalRoot, "SKILL.md"), "utf8");
  const meaningfulLines = main.split(/\r?\n/u).filter((line) => line.trim().length > 0).length;
  assert.ok(
    meaningfulLines >= 100 && meaningfulLines <= 160,
    `expected 100-160 meaningful lines, found ${meaningfulLines}`
  );
  for (const name of ["audit", "fix", "verify", "report", "build", "ship"]) {
    const relative = `references/workflows/${name}.md`;
    assert.match(main, new RegExp(relative.replaceAll("/", "\\/"), "u"));
    await access(join(canonicalRoot, ...relative.split("/")));
  }
  assert.match(main, /Normal feature work never\s+needs Ship guidance/iu);
  assert.match(
    main,
    /small\s+change does not load full Audit, Fix, Report, Build, or Ship procedures/iu
  );
  assert.doesNotMatch(main, /one-to-one[\s\S]*SHA-256|typed envelope[\s\S]*artifact hashes/iu);
});

test("explicit workflows route to their required progressive protocols", async () => {
  const router = await readFile(join(canonicalRoot, "commands", "forge", "SKILL.md"), "utf8");
  for (const relative of [
    "references/workflows/build.md",
    "references/workflows/audit.md",
    "references/PROTOCOL.md",
    "references/SAFE_FIX_POLICY.md",
    "references/workflows/fix.md",
    "references/workflows/verify.md",
    "references/workflows/ship.md"
  ])
    assert.ok(
      router.includes(`fullstack-forge/${relative}`),
      `missing explicit route to ${relative}`
    );
});

test("specialists share evidence, safe-fix, verification, and completion owners", async () => {
  const commandRoot = join(canonicalRoot, "commands");
  const entries = await readdir(commandRoot, { withFileTypes: true });
  const specialistNames = entries
    .filter((entry) => entry.isDirectory() && /^forge-(?!new$|feature$)/u.test(entry.name))
    .map((entry) => entry.name);
  assert.equal(specialistNames.length, 42);
  for (const name of specialistNames) {
    const content = await readFile(join(commandRoot, name, "SKILL.md"), "utf8");
    assert.match(content, /fullstack-forge\/references\/PROTOCOL\.md/u);
    assert.match(content, /fullstack-forge\/references\/SAFE_FIX_POLICY\.md/u);
    assert.match(content, /fullstack-forge\/references\/workflows\/verify\.md/u);
    assert.match(content, /fullstack-forge\/references\/shared\/completion\.md/u);
    assert.doesNotMatch(content, /Authentication and authorization are verified\./u);
    assert.doesNotMatch(content, /Database behavior is reviewed\./u);
  }
});

test("required progressive references exist in every generated platform bundle", async () => {
  for (const root of [
    ".agents/skills",
    ".claude/skills",
    ".cursor/skills",
    ".gemini/skills",
    ".github/skills",
    ".windsurf/skills"
  ]) {
    for (const relative of [
      "references/shared/completion.md",
      "references/workflows/audit.md",
      "references/workflows/fix.md",
      "references/workflows/verify.md",
      "references/workflows/report.md",
      "references/workflows/build.md",
      "references/workflows/ship.md"
    ])
      await access(
        join(projectRoot, ...root.split("/"), "fullstack-forge", ...relative.split("/"))
      );
  }
});

test("public docs distinguish host skill forms from the executable CLI", async () => {
  const readme = await readFile(join(projectRoot, "README.md"), "utf8");
  const platforms = await readFile(join(projectRoot, "docs", "PLATFORM_SUPPORT.md"), "utf8");
  assert.match(readme, /\$forge audit cache/u);
  assert.match(readme, /\/forge audit cache/u);
  assert.match(readme, /npx forge audit cache/u);
  for (const host of [
    "Codex",
    "Antigravity",
    "Claude Code",
    "Gemini CLI",
    "Cursor",
    "Windsurf",
    "GitHub Copilot"
  ])
    assert.match(platforms, new RegExp(host, "u"));
  assert.match(platforms, /live host UI[\s\S]*NOT_VERIFIED/iu);
});
