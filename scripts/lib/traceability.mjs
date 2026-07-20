import { stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Specification traceability matrix rules.
 *
 * The matrix is the public, independently worded restatement of the authoritative
 * requirements. The private specification is never quoted, reproduced, or referenced from
 * distributable artifacts; only the maintainers' own summaries are published here.
 */
export const ALLOWED_STATUSES = Object.freeze([
  "COMPLIANT",
  "PARTIALLY_COMPLIANT",
  "NON_COMPLIANT",
  "NOT_VERIFIED",
  "NOT_APPLICABLE"
]);

/** `NOT_VERIFIED` must say *why* it cannot be verified here. */
export const VERIFICATION_SCOPES = Object.freeze(["external", "pending-integration"]);

export const ID_PATTERN = /^FF-[A-Z]{2,8}-\d{2}$/u;
export const PLACEHOLDER_PATTERN = /^integration:v\d+\.\d+\.\d+$/u;

const EVIDENCE_FIELDS = ["implementation", "tests", "documentation", "release_verification"];

/**
 * Validates the matrix and returns a list of human-readable errors. An empty list means the
 * matrix is complete, internally consistent, and every referenced repository path exists.
 */
export async function validateTraceabilityMatrix(matrix, root) {
  const errors = [];
  if (matrix?.schema_version !== 1) {
    errors.push("traceability matrix must declare schema_version 1");
    return errors;
  }
  const requirements = matrix.requirements;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    errors.push("traceability matrix must declare a non-empty requirements array");
    return errors;
  }

  const seen = new Set();
  const byArea = new Map();
  for (const requirement of requirements) {
    const id = requirement?.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      errors.push(`requirement id ${JSON.stringify(id)} must match ${String(ID_PATTERN)}`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`duplicate requirement id ${id}`);
      continue;
    }
    seen.add(id);
    const [, area, index] = /^FF-([A-Z]+)-(\d{2})$/u.exec(id);
    byArea.set(area, [...(byArea.get(area) ?? []), Number(index)]);

    if (typeof requirement.summary !== "string" || requirement.summary.trim().length < 20)
      errors.push(`${id}: summary must be an independently written sentence of real substance`);

    if (!ALLOWED_STATUSES.includes(requirement.status))
      errors.push(
        `${id}: status ${JSON.stringify(requirement.status)} is not one of ${ALLOWED_STATUSES.join(", ")}`
      );

    for (const field of [...EVIDENCE_FIELDS, "limitations"])
      if (!Array.isArray(requirement[field] ?? []))
        errors.push(`${id}: ${field} must be an array when present`);

    const limitations = requirement.limitations ?? [];
    const implementation = requirement.implementation ?? [];
    const tests = requirement.tests ?? [];
    const documentation = requirement.documentation ?? [];
    const placeholders = requirement.pending_integration ?? [];

    for (const placeholder of placeholders)
      if (!PLACEHOLDER_PATTERN.test(placeholder))
        errors.push(
          `${id}: integration placeholder ${JSON.stringify(placeholder)} must match ${String(PLACEHOLDER_PATTERN)}`
        );
    if (placeholders.length > 0 && requirement.status === "COMPLIANT")
      errors.push(
        `${id}: work that still depends on an integration placeholder must not be reported as COMPLIANT`
      );
    if (placeholders.length > 0 && limitations.length === 0)
      errors.push(
        `${id}: an integration placeholder requires a limitation explaining what is missing`
      );

    // Every requirement is either implemented or has an explicit, published limitation.
    if (implementation.length === 0 && tests.length === 0 && limitations.length === 0)
      errors.push(
        `${id}: requirements without implementation or test evidence must state a limitation`
      );

    if (requirement.status === "COMPLIANT") {
      if (implementation.length === 0)
        errors.push(`${id}: COMPLIANT requires at least one implementation path`);
      if (tests.length === 0 && documentation.length === 0)
        errors.push(`${id}: COMPLIANT requires at least one test or documentation path`);
    }

    if (requirement.status === "NON_COMPLIANT" && limitations.length === 0)
      errors.push(`${id}: NON_COMPLIANT requires a stated reason in limitations`);

    if (requirement.status === "NOT_APPLICABLE" && limitations.length === 0)
      errors.push(`${id}: NOT_APPLICABLE requires a stated reason in limitations`);

    if (requirement.status === "NOT_VERIFIED") {
      const scope = requirement.verification_scope;
      if (!VERIFICATION_SCOPES.includes(scope))
        errors.push(
          `${id}: NOT_VERIFIED requires verification_scope to be one of ${VERIFICATION_SCOPES.join(", ")} so genuine external limits are distinguished from unfinished local work`
        );
      if (limitations.length === 0)
        errors.push(
          `${id}: NOT_VERIFIED requires a limitation describing what blocks verification`
        );
      if (scope === "pending-integration" && placeholders.length === 0)
        errors.push(
          `${id}: NOT_VERIFIED with scope pending-integration requires at least one integration placeholder`
        );
      if (scope === "external" && placeholders.length > 0)
        errors.push(
          `${id}: externally blocked verification must not be attributed to pending local integration work`
        );
    } else if (requirement.verification_scope !== undefined) {
      errors.push(`${id}: verification_scope applies only to NOT_VERIFIED requirements`);
    }

    for (const field of EVIDENCE_FIELDS)
      for (const path of requirement[field] ?? []) {
        if (typeof path !== "string" || path.length === 0) {
          errors.push(`${id}: ${field} contains an empty path`);
          continue;
        }
        if (PLACEHOLDER_PATTERN.test(path)) {
          errors.push(
            `${id}: integration placeholders belong in pending_integration, not in ${field}`
          );
          continue;
        }
        if (!(await exists(root, path)))
          errors.push(`${id}: ${field} references a path that does not exist: ${path}`);
      }
  }

  // Identifiers are stable and dense: a gap usually means a requirement was silently dropped.
  for (const [area, indexes] of [...byArea.entries()].sort()) {
    const sorted = [...indexes].sort((a, b) => a - b);
    for (let position = 0; position < sorted.length; position += 1)
      if (sorted[position] !== position + 1) {
        errors.push(
          `FF-${area}-* identifiers must be dense and start at 01; found ${sorted.join(", ")}`
        );
        break;
      }
  }

  return errors;
}

async function exists(root, path) {
  try {
    await stat(join(root, ...path.split("/")));
    return true;
  } catch {
    return false;
  }
}

/** Renders the published Markdown view. The JSON file remains the single source of truth. */
export function renderTraceabilityMatrix(matrix) {
  const requirements = [...matrix.requirements].sort((a, b) => a.id.localeCompare(b.id));
  const counts = new Map();
  for (const requirement of requirements)
    counts.set(requirement.status, (counts.get(requirement.status) ?? 0) + 1);
  const summary = ALLOWED_STATUSES.filter((status) => counts.has(status))
    .map((status) => `- **${status}**: ${counts.get(status)}`)
    .join("\n");
  const rows = requirements
    .map((requirement) =>
      [
        `### ${requirement.id}`,
        "",
        requirement.summary,
        "",
        `- **Status**: ${requirement.status}${
          requirement.verification_scope === undefined ? "" : ` (${requirement.verification_scope})`
        }`,
        `- **Implementation**: ${list(requirement.implementation)}`,
        `- **Tests**: ${list(requirement.tests)}`,
        `- **Documentation**: ${list(requirement.documentation)}`,
        `- **Release verification**: ${list(requirement.release_verification)}`,
        `- **Pending integration**: ${plain(requirement.pending_integration)}`,
        `- **Limitations**: ${plain(requirement.limitations)}`
      ].join("\n")
    )
    .join("\n\n");
  return `# Specification traceability matrix

This matrix restates each authoritative requirement in the maintainers' own words and links it
to repository evidence. It is generated from \`config/traceability-matrix.json\`; edit the JSON
and run \`npm run generate:traceability\` rather than editing this file. \`npm run check\`
fails when the two disagree, when a referenced path is missing, or when a status is
unsupported. See [TRACEABILITY.md](TRACEABILITY.md) for the rules and the review procedure.

Summaries here are original wording. No authoritative source text is quoted or reproduced.

## Requirement count

${requirements.length} requirements.

## Status summary

${summary}

## Requirements

${rows}
`;
}

function list(values) {
  const items = values ?? [];
  if (items.length === 0) return "_none_";
  return items.map((value) => `\`${value}\``).join(", ");
}

function plain(values) {
  const items = values ?? [];
  if (items.length === 0) return "_none_";
  return items.length === 1 ? items[0] : items.map((value) => `(${value})`).join(" ");
}
