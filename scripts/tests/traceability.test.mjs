import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { projectRoot } from "../project.mjs";
import {
  ALLOWED_STATUSES,
  renderTraceabilityMatrix,
  validateTraceabilityMatrix
} from "../lib/traceability.mjs";

const real = JSON.parse(
  await readFile(join(projectRoot, "config", "traceability-matrix.json"), "utf8")
);

function baseRequirement(overrides = {}) {
  return {
    id: "FF-TRC-01",
    summary: "A representative requirement summary written independently for validation tests.",
    implementation: ["package.json"],
    tests: ["scripts/tests/traceability.test.mjs"],
    documentation: ["docs/TRACEABILITY.md"],
    release_verification: [],
    status: "COMPLIANT",
    limitations: [],
    ...overrides
  };
}

function matrixWith(...requirements) {
  return { schema_version: 1, requirements };
}

test("the committed traceability matrix is complete and every path resolves", async () => {
  const errors = await validateTraceabilityMatrix(real, projectRoot);
  assert.deepEqual(errors, []);
  assert.ok(real.requirements.length >= 50);
  for (const requirement of real.requirements)
    assert.ok(ALLOWED_STATUSES.includes(requirement.status), requirement.id);
});

test("the published Markdown matches the generated view", async () => {
  const published = await readFile(join(projectRoot, "docs", "TRACEABILITY_MATRIX.md"), "utf8");
  assert.equal(published, renderTraceabilityMatrix(real));
});

test("the matrix never names or quotes the private specification", async () => {
  const published = await readFile(join(projectRoot, "docs", "TRACEABILITY_MATRIX.md"), "utf8");
  const source = JSON.stringify(real);
  for (const text of [published, source]) {
    assert.ok(!/FULLSTACK_FORGE_SPEC/u.test(text));
    assert.ok(!/\bthe (?:spec|specification) says\b/iu.test(text));
  }
});

test("duplicate requirement identifiers are rejected", async () => {
  const errors = await validateTraceabilityMatrix(
    matrixWith(baseRequirement(), baseRequirement()),
    projectRoot
  );
  assert.ok(errors.some((error) => error.includes("duplicate requirement id FF-TRC-01")));
});

test("malformed identifiers and identifier gaps are rejected", async () => {
  const malformed = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ id: "requirement-1" })),
    projectRoot
  );
  assert.ok(malformed.some((error) => error.includes("must match")));
  const gapped = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ id: "FF-TRC-02" })),
    projectRoot
  );
  assert.ok(gapped.some((error) => error.includes("dense and start at 01")));
});

test("unsupported statuses are rejected", async () => {
  const errors = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ status: "MOSTLY_FINE" })),
    projectRoot
  );
  assert.ok(errors.some((error) => error.includes("is not one of")));
});

test("evidence paths must exist in the repository", async () => {
  const errors = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ implementation: ["cli/src/does-not-exist.ts"] })),
    projectRoot
  );
  assert.ok(errors.some((error) => error.includes("does not exist")));
});

test("COMPLIANT requires non-empty evidence", async () => {
  const noImplementation = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ implementation: [] })),
    projectRoot
  );
  assert.ok(
    noImplementation.some((error) =>
      error.includes("COMPLIANT requires at least one implementation")
    )
  );
  const noProof = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ tests: [], documentation: [] })),
    projectRoot
  );
  assert.ok(noProof.some((error) => error.includes("test or documentation path")));
});

test("a requirement with no implementation and no tests must state a limitation", async () => {
  const errors = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        status: "PARTIALLY_COMPLIANT",
        implementation: [],
        tests: [],
        limitations: []
      })
    ),
    projectRoot
  );
  assert.ok(errors.some((error) => error.includes("must state a limitation")));
});

test("unexplained NON_COMPLIANT and NOT_APPLICABLE entries are rejected", async () => {
  for (const status of ["NON_COMPLIANT", "NOT_APPLICABLE"]) {
    const errors = await validateTraceabilityMatrix(
      matrixWith(baseRequirement({ status, limitations: [] })),
      projectRoot
    );
    assert.ok(
      errors.some((error) => error.includes("requires a stated reason")),
      status
    );
  }
});

test("NOT_VERIFIED must distinguish external limits from unfinished local work", async () => {
  const missingScope = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ status: "NOT_VERIFIED", limitations: ["blocked"] })),
    projectRoot
  );
  assert.ok(missingScope.some((error) => error.includes("verification_scope")));

  const external = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        status: "NOT_VERIFIED",
        verification_scope: "external",
        limitations: ["Hosted setting; not provable from repository contents."]
      })
    ),
    projectRoot
  );
  assert.deepEqual(external, []);

  const externalWithPlaceholder = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        status: "NOT_VERIFIED",
        verification_scope: "external",
        pending_integration: ["integration:v0.1.8"],
        limitations: ["Hosted setting."]
      })
    ),
    projectRoot
  );
  assert.ok(
    externalWithPlaceholder.some((error) =>
      error.includes("must not be attributed to pending local integration work")
    )
  );

  const pendingWithoutPlaceholder = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        status: "NOT_VERIFIED",
        verification_scope: "pending-integration",
        limitations: ["Lands on a parallel branch."]
      })
    ),
    projectRoot
  );
  assert.ok(
    pendingWithoutPlaceholder.some((error) =>
      error.includes("requires at least one integration placeholder")
    )
  );
});

test("verification_scope is meaningless outside NOT_VERIFIED", async () => {
  const errors = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ verification_scope: "external" })),
    projectRoot
  );
  assert.ok(errors.some((error) => error.includes("applies only to NOT_VERIFIED")));
});

test("integration placeholders never make a requirement compliant", async () => {
  const compliant = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        pending_integration: ["integration:v0.1.7"],
        limitations: ["Parallel branch work is not present here."]
      })
    ),
    projectRoot
  );
  assert.ok(compliant.some((error) => error.includes("must not be reported as COMPLIANT")));

  const unexplained = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        status: "PARTIALLY_COMPLIANT",
        pending_integration: ["integration:v0.1.7"],
        limitations: []
      })
    ),
    projectRoot
  );
  assert.ok(unexplained.some((error) => error.includes("requires a limitation explaining")));

  const malformed = await validateTraceabilityMatrix(
    matrixWith(
      baseRequirement({
        status: "PARTIALLY_COMPLIANT",
        pending_integration: ["v0.1.7"],
        limitations: ["Parallel branch work is not present here."]
      })
    ),
    projectRoot
  );
  assert.ok(malformed.some((error) => error.includes("integration placeholder")));
});

test("integration placeholders are rejected inside evidence fields", async () => {
  const errors = await validateTraceabilityMatrix(
    matrixWith(baseRequirement({ implementation: ["integration:v0.1.9"] })),
    projectRoot
  );
  assert.ok(errors.some((error) => error.includes("belong in pending_integration")));
});

test("outstanding integration placeholders are declared, not hidden", () => {
  const pending = real.requirements.flatMap((requirement) => requirement.pending_integration ?? []);
  for (const placeholder of pending)
    assert.match(placeholder, /^integration:v0\.1\.[789]$/u, placeholder);
  for (const requirement of real.requirements)
    if ((requirement.pending_integration ?? []).length > 0)
      assert.notEqual(requirement.status, "COMPLIANT", requirement.id);
});
