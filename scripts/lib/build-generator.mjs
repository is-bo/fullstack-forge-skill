const COMPLETION_CONTRACT = `A task is complete only when the requested behavior is implemented and every applicable completion condition is satisfied. Follow \`fullstack-forge/references/shared/completion.md\`; conditions outside the affected boundary remain outside a non-audit plan or receive a reasoned \`NOT_APPLICABLE\`, never \`PASS\`.

Never hide failed checks or claim that an operation ran when it did not.`;

export const buildRequiredHeadings = Object.freeze([
  "## Purpose",
  "## Trigger conditions",
  "## Enforcement honesty",
  "## Workflow",
  "## CLI behavior and fallback",
  "## State and evidence",
  "## Non-goals and scope",
  "## Loop prevention and decision rules",
  "## Completion contract"
]);

const middleHeadings = Object.freeze(
  buildRequiredHeadings.slice(1, -1).map((heading) => heading.replace(/^##\s+/u, ""))
);

function isNonEmptyTrimmedString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value === value.trim() &&
    !/[\r\n]/u.test(value)
  );
}

export function validateCommandCatalog(catalog, expectedNames) {
  if (!Array.isArray(catalog)) throw new Error("config/build-commands.json must be an array");
  const names = catalog.map((entry) =>
    typeof entry === "object" && entry !== null ? entry.name : undefined
  );
  if (JSON.stringify(names) !== JSON.stringify(expectedNames))
    throw new Error(
      "config/build-commands.json must contain the authoritative build command set in order"
    );
  for (const [index, entry] of catalog.entries()) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !isNonEmptyTrimmedString(entry.name) ||
      !isNonEmptyTrimmedString(entry.title) ||
      typeof entry.description !== "string" ||
      entry.description.trim().length === 0 ||
      /[\r\n]/u.test(entry.description) ||
      typeof entry.purpose !== "string" ||
      entry.purpose.trim().length === 0 ||
      (entry.frontendRouting !== undefined &&
        (typeof entry.frontendRouting !== "string" || entry.frontendRouting.trim().length === 0))
    )
      throw new Error(`Invalid build command metadata at index ${index}`);
    if (!Array.isArray(entry.sections) || entry.sections.length !== middleHeadings.length)
      throw new Error(
        `Build command ${entry.name} must define exactly ${middleHeadings.length} sections`
      );
    const headings = entry.sections.map((section) =>
      typeof section === "object" && section !== null ? section.heading : undefined
    );
    if (JSON.stringify(headings) !== JSON.stringify(middleHeadings))
      throw new Error(
        `Build command ${entry.name} sections must match the required heading set in order`
      );
    for (const section of entry.sections) {
      if (typeof section.body !== "string" || section.body.trim().length === 0)
        throw new Error(
          `Build command ${entry.name}: section "${section.heading}" has an invalid body`
        );
    }
  }
}

export function renderCommandSkill(entry) {
  const parts = ["## Purpose", "", entry.purpose, ""];
  for (const section of entry.sections) {
    parts.push(`## ${section.heading}`, "", section.body, "");
    if (section.heading === "Workflow" && entry.frontendRouting !== undefined)
      parts.push(entry.frontendRouting, "");
  }
  parts.push("## Completion contract", "", COMPLETION_CONTRACT);
  const body = parts.join("\n");
  return `---
name: ${entry.name}
description: ${entry.description}
---

# ${entry.name}: ${entry.title}

${body}
`;
}

export function validateGuidanceMap(guidance, expectedSlugs) {
  if (typeof guidance !== "object" || guidance === null || Array.isArray(guidance))
    throw new Error("config/build-guidance.json must be an object keyed by module slug");
  const slugSet = new Set(expectedSlugs);
  for (const [slug, entry] of Object.entries(guidance)) {
    if (!slugSet.has(slug))
      throw new Error(
        `config/build-guidance.json has an unknown slug (not an audit module slug): ${slug}`
      );
    if (
      typeof entry !== "object" ||
      entry === null ||
      !isNonEmptyTrimmedString(entry.title) ||
      !Array.isArray(entry.decideBeforeCoding) ||
      entry.decideBeforeCoding.length === 0 ||
      !Array.isArray(entry.evidenceToProduce) ||
      entry.evidenceToProduce.length === 0 ||
      [...entry.decideBeforeCoding, ...entry.evidenceToProduce].some(
        (value) => !isNonEmptyTrimmedString(value)
      )
    )
      throw new Error(`Invalid config/build-guidance.json entry for slug ${slug}`);
  }
}

export function renderBrief(slug, entry) {
  const lines = [
    `# Build brief: ${entry.title}`,
    "",
    "## Decide before coding",
    "",
    ...entry.decideBeforeCoding.map((item) => `- ${item}`),
    "",
    "## Evidence to produce while building",
    "",
    ...entry.evidenceToProduce.map((item) => `- ${item}`)
  ];
  if (lines.length > 60)
    throw new Error(
      `references/build/${slug}.md would exceed the 60-line brief budget (${lines.length} lines)`
    );
  return `${lines.join("\n")}\n`;
}

export function computeGuidanceCoverage(guidance, expectedSlugs) {
  const present = new Set(Object.keys(guidance));
  const missing = expectedSlugs.filter((slug) => !present.has(slug));
  return {
    total: expectedSlugs.length,
    presentCount: present.size,
    missing,
    complete: missing.length === 0
  };
}
