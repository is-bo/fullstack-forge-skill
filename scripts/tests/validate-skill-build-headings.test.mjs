import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildRequiredHeadings, renderCommandSkill } from "../lib/build-generator.mjs";
import { collectSkillErrors } from "../lib/skill-validation.mjs";
import { projectRoot } from "../project.mjs";

const sampleEntry = {
  name: "forge-sample",
  title: "Sample",
  description: "Sample build command for testing.",
  purpose: "Purpose paragraph.",
  sections: buildRequiredHeadings
    .slice(1, -1)
    .map((heading) => heading.replace(/^##\s+/u, ""))
    .map((heading) => ({ heading, body: `Body for ${heading}.` }))
};

test("collectSkillErrors passes a well-formed build command skill against buildRequiredHeadings", () => {
  const content = renderCommandSkill(sampleEntry);
  const errors = collectSkillErrors("forge-sample/SKILL.md", content, {
    expectedName: "forge-sample",
    command: true,
    criteria: [],
    headings: buildRequiredHeadings
  });
  assert.deepEqual(errors, []);
});

test("collectSkillErrors reports every missing build heading, not just the first", () => {
  const content = renderCommandSkill(sampleEntry)
    .replace("## Workflow", "## Renamed workflow section")
    .replace("## State and evidence", "## Renamed state section");
  const errors = collectSkillErrors("forge-sample/SKILL.md", content, {
    expectedName: "forge-sample",
    command: true,
    criteria: [],
    headings: buildRequiredHeadings
  });
  assert.ok(
    errors.some((error) => error.includes("missing ## Workflow")),
    errors.join("\n")
  );
  assert.ok(
    errors.some((error) => error.includes("missing ## State and evidence")),
    errors.join("\n")
  );
  // Untouched headings must not be falsely reported.
  assert.ok(!errors.some((error) => error.includes("missing ## Purpose")));
});

test("collectSkillErrors rejects a mismatched frontmatter name", () => {
  const content = renderCommandSkill(sampleEntry);
  const errors = collectSkillErrors("forge-sample/SKILL.md", content, {
    expectedName: "forge-other-name",
    command: true,
    criteria: [],
    headings: buildRequiredHeadings
  });
  assert.ok(errors.some((error) => error.includes("expected name forge-other-name")));
});

test("collectSkillErrors requires the completion contract trailer sentence verbatim", () => {
  const content = renderCommandSkill(sampleEntry).replace(
    "Never hide failed checks or claim that an operation ran when it did not.",
    "Hiding failed checks is fine."
  );
  const errors = collectSkillErrors("forge-sample/SKILL.md", content, {
    expectedName: "forge-sample",
    command: true,
    criteria: [],
    headings: buildRequiredHeadings
  });
  assert.ok(errors.some((error) => error.includes("missing completion contract")));
});

test("the real generated forge-new and forge-feature skills pass collectSkillErrors with zero errors", async () => {
  for (const name of ["forge-new", "forge-feature"]) {
    const path = join(projectRoot, "src", "fullstack-forge", "commands", name, "SKILL.md");
    const content = await readFile(path, "utf8");
    const errors = collectSkillErrors(path, content, {
      expectedName: name,
      command: true,
      criteria: [],
      headings: buildRequiredHeadings
    });
    assert.deepEqual(errors, [], `${name}: ${errors.join("\n")}`);
  }
});
