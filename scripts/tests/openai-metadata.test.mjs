import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { platformTargets, projectRoot } from "../project.mjs";

const forgeRoot = join(projectRoot, "src", "fullstack-forge", "commands", "forge");
const forgeMetadataPath = join(forgeRoot, "agents", "openai.yaml");
const expertMetadataPath = join(projectRoot, "src", "fullstack-forge", "agents", "openai.yaml");

test("Forge and the canonical skill advertise automatic agent-first use", async () => {
  const forgeMetadata = await readFile(forgeMetadataPath, "utf8");
  const expertMetadata = await readFile(expertMetadataPath, "utf8");
  const forgePrompt = quotedField(forgeMetadata, "default_prompt");
  const forgeDescription = quotedField(forgeMetadata, "short_description");

  assert.equal(quotedField(forgeMetadata, "display_name"), "Forge");
  assert.equal(forgeDescription, "Automatic Build · Fix · Verify · Ship guidance");
  assert.ok(forgeDescription.length >= 25 && forgeDescription.length <= 64);
  for (const action of ["build", "continue", "audit", "fix", "verify", "ship", "status", "help"])
    assert.match(forgePrompt, new RegExp(`\\b${action}\\b`, "iu"));
  assert.match(forgePrompt, /automatically.*proportional agent-first workflow/iu);

  assert.equal(
    quotedField(expertMetadata, "display_name"),
    "Fullstack Forge — Agent-first Engineering"
  );
  assert.equal(
    quotedField(expertMetadata, "short_description"),
    "Automatic production engineering for app changes"
  );
  assert.match(quotedField(expertMetadata, "default_prompt"), /\$fullstack-forge.*automatically/iu);

  for (const metadata of [forgeMetadata, expertMetadata]) {
    assert.deepEqual(topLevelKeys(metadata), ["interface"]);
    assert.deepEqual(interfaceKeys(metadata), [
      "display_name",
      "short_description",
      "icon_small",
      "icon_large",
      "brand_color",
      "default_prompt"
    ]);
  }
});

test("Forge no-action and plain-language instructions preserve evidence and approval boundaries", async () => {
  const skill = await readFile(join(forgeRoot, "SKILL.md"), "utf8");
  for (const item of [
    "1. Build something",
    "2. Continue unfinished work",
    "3. Audit changed work",
    "4. Audit the whole project",
    "5. Fix — preview safe fixes",
    "6. Fix — apply safe fixes",
    "7. Verify findings",
    "8. Ship — check release readiness",
    "9. Status — show project status",
    "10. Help"
  ])
    assert.ok(skill.includes(item), item);
  for (const phrase of [
    "build a login system",
    "continue my last feature",
    "audit this project",
    "audit the authentication",
    "check security and uploads",
    "preview fixes",
    "apply safe fixes",
    "verify the fixes",
    "is this ready to ship",
    "show me the status",
    "show help",
    "audit database and queries"
  ])
    assert.ok(skill.includes(phrase), phrase);
  assert.match(skill, /do not default to an audit/iu);
  assert.match(skill, /do not.*run a check.*create Build or Audit state/iu);
  assert.match(skill, /missing tool as success/iu);
  assert.match(skill, /If the CLI is unavailable.*exact install or doctor command/isu);
  assert.match(skill, /keep every outcome NOT_VERIFIED/iu);
  assert.match(skill, /project scripts without authorization/iu);
  assert.match(skill, /apply only when the user requests the safe application step/iu);
  assert.doesNotMatch(skill, /default to `--safe`|default to `--allow-run`/iu);
});

test("Forge Codex metadata and icon reach every host through the canonical layout", async () => {
  const canonicalMetadata = await readFile(forgeMetadataPath);
  const canonicalIcon = await readFile(
    join(projectRoot, "src", "fullstack-forge", "assets", "fullstack-forge-icon.png")
  );
  const routerIcon = await readFile(join(forgeRoot, "assets", "fullstack-forge-icon.png"));
  assert.deepEqual(routerIcon, canonicalIcon);

  // One managed copy backs every host, so the canonical root must carry the real bytes.
  const canonicalSkillRoot = join(projectRoot, ".fullstack-forge", "skills", "forge");
  assert.deepEqual(
    await readFile(join(canonicalSkillRoot, "agents", "openai.yaml")),
    canonicalMetadata,
    "canonical"
  );

  for (const platform of platformTargets) {
    const generatedRoot = join(projectRoot, ...platform.path.split("/"), "forge");
    // Codex reads openai.yaml with ordinary tooling rather than by following a prose pointer, so
    // the generic Agent Skills root and package-local Codex plugin root carry the documented
    // verbatim exception. Every other host is adapters only and must not re-duplicate those bytes.
    if (platform.id === "agents" || platform.id === "codex-plugin") {
      assert.deepEqual(
        await readFile(join(generatedRoot, "agents", "openai.yaml")),
        canonicalMetadata,
        platform.id
      );
      assert.deepEqual(
        await readFile(join(generatedRoot, "assets", "fullstack-forge-icon.png")),
        canonicalIcon,
        platform.id
      );
    } else {
      assert.equal(
        existsSync(join(generatedRoot, "agents", "openai.yaml")),
        false,
        `${platform.id} must not duplicate canonical agents/`
      );
      assert.equal(
        existsSync(join(generatedRoot, "assets", "fullstack-forge-icon.png")),
        false,
        `${platform.id} must not duplicate canonical assets/`
      );
    }
    // Discovery still depends on a real SKILL.md per skill in every host root.
    for (const compatibleSkill of [
      "fullstack-forge",
      "forge-security",
      "forge-ui",
      "forge-database",
      "forge-feature",
      "forge-new"
    ])
      await readFile(join(projectRoot, ...platform.path.split("/"), compatibleSkill, "SKILL.md"));
  }
});

function quotedField(yaml, field) {
  const match = new RegExp(`${field}:\\s*(?:\\r?\\n\\s*)?"([^"]+)"`, "u").exec(yaml);
  assert.notEqual(match, null, `missing quoted ${field}`);
  return match[1];
}

function topLevelKeys(yaml) {
  return yaml
    .split(/\r?\n/u)
    .filter((line) => /^[a-z_][a-z0-9_]*:/u.test(line))
    .map((line) => line.slice(0, line.indexOf(":")));
}

function interfaceKeys(yaml) {
  return yaml
    .split(/\r?\n/u)
    .map((line) => /^ {2}([a-z_][a-z0-9_]*):/u.exec(line)?.[1])
    .filter(Boolean);
}
