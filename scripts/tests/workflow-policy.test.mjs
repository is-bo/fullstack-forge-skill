import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateWorkflowPolicies } from "../lib/workflow-policy.mjs";
import { projectRoot } from "../project.mjs";

test("repository workflows satisfy immutable action and release policy", async () => {
  const workflows = Object.fromEntries(
    await Promise.all(
      ["ci.yml", "codeql.yml", "release.yml"].map(async (name) => [
        name,
        await readFile(join(projectRoot, ".github", "workflows", name), "utf8")
      ])
    )
  );
  assert.deepEqual(validateWorkflowPolicies(workflows), []);
  assert.match(
    workflows["ci.yml"],
    /timeout-minutes:\s*(?:3[0-9]|[4-9][0-9]|[1-9][0-9]{2,})/u,
    "the supported Windows/Node 20 matrix must have enough time to complete every release gate"
  );
  assert.match(workflows["ci.yml"], /node: "20\.19\.0"/u);
  assert.match(workflows["ci.yml"], /node: "22\.13\.0"/u);
  for (const workflow of [workflows["ci.yml"], workflows["release.yml"]]) {
    assert.match(workflow, /node scripts\/smoke-install\.mjs --package "\$candidate"/u);
    assert.match(workflow, /node scripts\/upgrade-install\.mjs v0\.1\.0 --package "\$candidate"/u);
    assert.match(workflow, /node scripts\/upgrade-install\.mjs v0\.2\.2 --package "\$candidate"/u);
  }
  assert.match(workflows["release.yml"], /verify-required-workflows\.mjs/u);
  assert.match(workflows["release.yml"], /--required-path CI=\.github\/workflows\/ci\.yml/u);
  assert.match(
    workflows["release.yml"],
    /--required-path CodeQL=\.github\/workflows\/codeql\.yml/u
  );
  assert.match(
    workflows["release.yml"],
    /node scripts\/package-platforms\.mjs --require-clean-inputs/u
  );
  assert.doesNotMatch(workflows["release.yml"], /package:platforms -- --require-clean-inputs/u);
  assert.match(workflows["release.yml"], /repos\/\$\{GITHUB_REPOSITORY\}\/immutable-releases/u);
  const immutableCheck = workflows["release.yml"].indexOf(
    "repos/${GITHUB_REPOSITORY}/immutable-releases"
  );
  const candidateProvenance = workflows["release.yml"].indexOf(
    "- name: Verify candidate provenance before creating a release"
  );
  const draft = workflows["release.yml"].indexOf('gh release create "$GITHUB_REF_NAME"');
  const finalEvidenceProvenance = workflows["release.yml"].indexOf(
    "- name: Verify final evidence provenance before publication"
  );
  const finalEvidenceUpload = workflows["release.yml"].indexOf(
    'gh release upload "$GITHUB_REF_NAME" release-evidence/*'
  );
  const completeDraftVerification = workflows["release.yml"].indexOf(
    "- name: Download and byte-verify the complete draft before publication"
  );
  const finalDraftDownload = workflows["release.yml"].indexOf(
    'gh release download "$GITHUB_REF_NAME" --dir "$downloaded"'
  );
  const finalDraftInventory = workflows["release.yml"].indexOf(
    '"${verification_root}/downloaded.inventory"'
  );
  const finalDraftByteComparison = workflows["release.yml"].indexOf(
    'cmp --silent "$expected_asset" "$downloaded_asset"'
  );
  const exactDraftRecheck = workflows["release.yml"].indexOf(
    "- name: Recheck the exact immutable draft before the one-way publish transition"
  );
  const publish = workflows["release.yml"].indexOf(
    'gh release edit "$GITHUB_REF_NAME" --draft=false'
  );
  assert.ok(
    immutableCheck >= 0 && immutableCheck < draft,
    "release immutability must be proven before even a mutable draft is created"
  );
  const candidateProvenanceBlock = workflows["release.yml"].slice(candidateProvenance, draft);
  assert.ok(candidateProvenance >= 0 && candidateProvenance < draft);
  assert.match(candidateProvenanceBlock, /for asset in dist\/\*/u);
  assert.match(candidateProvenanceBlock, /gh attestation verify "\$asset"/u);
  assert.doesNotMatch(candidateProvenanceBlock, /release-evidence\/\*/u);

  const finalEvidenceProvenanceBlock = workflows["release.yml"].slice(
    finalEvidenceProvenance,
    finalEvidenceUpload
  );
  assert.ok(
    finalEvidenceProvenance > draft && finalEvidenceProvenance < finalEvidenceUpload,
    "final-evidence provenance must be independently verified before upload"
  );
  assert.match(finalEvidenceProvenanceBlock, /for asset in release-evidence\/\*/u);
  assert.match(finalEvidenceProvenanceBlock, /gh attestation verify "\$asset"/u);
  assert.doesNotMatch(finalEvidenceProvenanceBlock, /for asset in dist\/\*/u);
  assert.equal(
    [...workflows["release.yml"].matchAll(/gh attestation verify "\$asset"/gu)].length,
    2,
    "candidate and final evidence require distinct provenance-verification blocks"
  );

  assert.ok(
    finalEvidenceUpload < completeDraftVerification &&
      completeDraftVerification < finalDraftDownload &&
      finalDraftDownload < finalDraftInventory &&
      finalDraftInventory < finalDraftByteComparison &&
      finalDraftByteComparison < exactDraftRecheck &&
      exactDraftRecheck < publish,
    "the uploaded complete draft must pass fresh-download inventory and byte verification before publication"
  );
  const completeDraftVerificationBlock = workflows["release.yml"].slice(
    completeDraftVerification,
    exactDraftRecheck
  );
  assert.match(
    completeDraftVerificationBlock,
    /mktemp -d "\$\{RUNNER_TEMP\}\/fullstack-forge-draft\.XXXXXX"/u
  );
  assert.match(completeDraftVerificationBlock, /for asset in dist\/\* release-evidence\/\*/u);
  assert.match(completeDraftVerificationBlock, /expected\.inventory/u);
  assert.match(completeDraftVerificationBlock, /downloaded\.inventory/u);
  assert.match(
    completeDraftVerificationBlock,
    /cmp --silent "\$expected_asset" "\$downloaded_asset"/u
  );
  assert.ok(publish > 0, "release workflow must have one explicit publication transition");
  for (const prerequisite of [
    'test "$remote_commit" = "$TAG_COMMIT"',
    "test \"$state\" = $'true\\tfalse'"
  ])
    assert.ok(
      workflows["release.yml"].indexOf(prerequisite) < publish,
      `${prerequisite} must run before publication`
    );
  assert.equal(
    [...workflows["release.yml"].matchAll(/gh release edit .*--draft=false/gu)].length,
    1,
    "release publication must remain a one-way single transition"
  );
  assert.match(workflows["release.yml"], /dist\/\*/u);
});

test("workflow policy rejects mutable actions and clobbering", () => {
  const errors = validateWorkflowPolicies({
    "ci.yml": "on: pull_request_target\nsteps:\n  - uses: actions/checkout@v7\n",
    "release.yml": "gh release upload --clobber\n",
    "codeql.yml": ""
  });
  assert.ok(errors.some((error) => error.includes("pull_request_target")));
  assert.ok(errors.some((error) => error.includes("full commit SHA")));
  assert.ok(errors.some((error) => error.includes("clobbering")));
  assert.ok(errors.some((error) => error.includes("canonical post-publication release URL")));
});
