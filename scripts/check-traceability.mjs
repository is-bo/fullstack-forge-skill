import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";
import { renderTraceabilityMatrix, validateTraceabilityMatrix } from "./lib/traceability.mjs";

const matrix = JSON.parse(
  await readFile(join(projectRoot, "config", "traceability-matrix.json"), "utf8")
);
const errors = await validateTraceabilityMatrix(matrix, projectRoot);

const documentPath = join(projectRoot, "docs", "TRACEABILITY_MATRIX.md");
let published;
try {
  published = await readFile(documentPath, "utf8");
} catch {
  errors.push("docs/TRACEABILITY_MATRIX.md is missing; run `npm run generate:traceability`.");
}
if (published !== undefined && published !== renderTraceabilityMatrix(matrix))
  errors.push(
    "docs/TRACEABILITY_MATRIX.md is out of sync with config/traceability-matrix.json; run `npm run generate:traceability`."
  );

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const requirements = matrix.requirements;
  const byStatus = {};
  for (const requirement of requirements)
    byStatus[requirement.status] = (byStatus[requirement.status] ?? 0) + 1;
  const pending = requirements.flatMap((requirement) => requirement.pending_integration ?? []);
  console.log(
    JSON.stringify(
      {
        valid: true,
        requirements: requirements.length,
        statuses: byStatus,
        integration_placeholders: [...new Set(pending)].sort(),
        requirements_with_placeholders: requirements.filter(
          (requirement) => (requirement.pending_integration ?? []).length > 0
        ).length
      },
      null,
      2
    )
  );
}
