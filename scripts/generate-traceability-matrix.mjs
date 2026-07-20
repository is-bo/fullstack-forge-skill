import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";
import { renderTraceabilityMatrix, validateTraceabilityMatrix } from "./lib/traceability.mjs";

const matrix = JSON.parse(
  await readFile(join(projectRoot, "config", "traceability-matrix.json"), "utf8")
);
const errors = await validateTraceabilityMatrix(matrix, projectRoot);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const target = join(projectRoot, "docs", "TRACEABILITY_MATRIX.md");
  await writeFile(target, renderTraceabilityMatrix(matrix), "utf8");
  console.log(
    JSON.stringify(
      { generated: "docs/TRACEABILITY_MATRIX.md", requirements: matrix.requirements.length },
      null,
      2
    )
  );
}
