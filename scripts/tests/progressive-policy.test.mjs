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
    assert.match(content, /fullstack-forge\/references\/shared\/module-contract\.md/u);
    assert.match(content, /fullstack-forge\/references\/shared\/evidence-rules\.md/u);
    assert.match(content, /fullstack-forge\/references\/shared\/completion\.md/u);
    assert.doesNotMatch(content, /Authentication and authorization are verified\./u);
    assert.doesNotMatch(content, /Database behavior is reviewed\./u);
    // Policy that now lives in the shared references must not be re-inlined per module.
    assert.doesNotMatch(content, /not proof of compliance/u, name);
    assert.doesNotMatch(content, /routing checklist, not\s+evidence by itself/u, name);
    assert.doesNotMatch(content, /treat unavailable runtime evidence as/u, name);
  }
});

test("relocated shared policy is stated exactly once, in its owning reference", async () => {
  const evidence = await readFile(
    join(canonicalRoot, "references", "shared", "evidence-rules.md"),
    "utf8"
  );
  for (const owned of [
    "## Statuses",
    "## Standards",
    "## Tools",
    "## Findings",
    "NOT_APPLICABLE",
    "NOT_VERIFIED",
    "BLOCKED",
    "not a claim of compliance",
    "fullstack-forge/references/PROTOCOL.md"
  ])
    assert.ok(evidence.includes(owned), `evidence-rules.md is missing '${owned}'`);

  const contract = await readFile(
    join(canonicalRoot, "references", "shared", "module-contract.md"),
    "utf8"
  );
  assert.match(contract, /fullstack-forge\/references\/shared\/evidence-rules\.md/u);
});

test("required progressive references are reachable from every generated platform bundle", async () => {
  const required = [
    "references/shared/module-contract.md",
    "references/shared/evidence-rules.md",
    "references/shared/completion.md",
    "references/workflows/audit.md",
    "references/workflows/fix.md",
    "references/workflows/verify.md",
    "references/workflows/report.md",
    "references/workflows/build.md",
    "references/workflows/ship.md"
  ];

  // One managed copy carries the references for every host.
  for (const relative of required)
    await access(
      join(projectRoot, ".fullstack-forge", "skills", "fullstack-forge", ...relative.split("/"))
    );

  // Each host reaches them through its adapter, which must name the canonical playbook.
  for (const root of [
    ".agents/skills",
    ".claude/skills",
    ".cursor/skills",
    ".gemini/skills",
    ".github/skills",
    ".windsurf/skills"
  ]) {
    const adapter = join(projectRoot, ...root.split("/"), "fullstack-forge", "SKILL.md");
    await access(adapter);
    const text = await readFile(adapter, "utf8");
    assert.match(text, /\.fullstack-forge\/skills\/fullstack-forge\/SKILL\.md/u, root);
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
