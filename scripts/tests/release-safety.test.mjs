import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertNoExistingAttestations,
  assertReleasePreconditions,
  assertUniqueAssetNames,
  classifyAttestationLookupFailure,
  classifyAttestationState,
  classifyReleaseState,
  digest,
  renderFinalVerification,
  validateTaggedReleaseDocuments,
  verifyPublishedAssets
} from "../lib/release-safety.mjs";

test("release preflight rejects an existing release and a moved tag", () => {
  const sha = "a".repeat(40);
  assert.throws(
    () =>
      assertReleasePreconditions({
        tag: "v1.2.3",
        expectedSha: sha,
        tagSha: sha,
        releaseState: "draft"
      }),
    /already exists/u
  );
  assert.throws(
    () =>
      assertReleasePreconditions({
        tag: "v1.2.3",
        expectedSha: sha,
        tagSha: "b".repeat(40),
        releaseState: "missing"
      }),
    /resolves to/u
  );
});

test("release listing classification sees drafts and published releases across pages", () => {
  assert.equal(
    classifyReleaseState(
      [[{ tag_name: "v1.0.0", draft: false }], [{ tag_name: "v1.2.3", draft: true }]],
      "v1.2.3"
    ),
    "draft"
  );
  assert.equal(classifyReleaseState([{ tag_name: "v1.2.3", draft: false }], "v1.2.3"), "published");
  assert.equal(classifyReleaseState([], "v1.2.3"), "missing");
  assert.throws(() => classifyReleaseState([{ tag_name: "v1.2.3" }], "v1.2.3"), /invalid/u);
  assert.equal(
    classifyReleaseState(
      [{ tag_name: "v1.2.3", draft: true, assets: [{ name: "partial.zip" }] }],
      "v1.2.3"
    ),
    "draft"
  );
});

test("duplicate asset basenames are rejected before upload", () => {
  assert.throws(() => assertUniqueAssetNames(["one/a.zip", "two/a.zip"]), /Duplicate/u);
  assert.deepEqual(assertUniqueAssetNames(["one/a.zip", "two/b.zip"]), ["a.zip", "b.zip"]);
});

test("release retry refuses an existing attestation for any candidate digest", () => {
  const subjectDigest = `sha256:${"a".repeat(64)}`;
  assert.equal(classifyAttestationState({ attestations: [] }, subjectDigest), "missing");
  assert.equal(
    classifyAttestationState(
      { attestations: [{ subject_digest: subjectDigest, bundle: { mediaType: "test" } }] },
      subjectDigest
    ),
    "existing"
  );
  assert.throws(
    () => classifyAttestationState({ attestations: "not-an-array" }, subjectDigest),
    /unproven/u
  );
  assert.doesNotThrow(() =>
    assertNoExistingAttestations([{ asset: "fresh.zip", subjectDigest, state: "missing" }])
  );
  assert.throws(
    () =>
      assertNoExistingAttestations([
        { asset: "already-attested.zip", subjectDigest, state: "existing" }
      ]),
    /already has an attestation/u
  );
  assert.equal(digest(Buffer.from("candidate")), digest(Buffer.from("candidate")));
});

test("a public repository's exact attestation 404 proves that digest is absent", () => {
  const missing = Object.assign(new Error("gh api failed"), {
    code: 1,
    stdout: JSON.stringify({
      message: "Not Found",
      documentation_url: "https://docs.github.com/rest/repos/attestations#list-attestations",
      status: "404"
    }),
    stderr: "gh: Not Found (HTTP 404)\n"
  });
  assert.equal(classifyAttestationLookupFailure(missing, "public"), "missing");
  assert.throws(() => classifyAttestationLookupFailure(missing, "private"), /absence is unproven/u);
  assert.throws(
    () =>
      classifyAttestationLookupFailure(
        Object.assign(new Error("network failure"), { code: 1, stdout: "", stderr: "timeout" }),
        "public"
      ),
    /absence is unproven/u
  );
});

test("tagged verification must keep remote publication pending", () => {
  const safe = {
    tag: "v1.2.3",
    notes: "# v1.2.3\nFinal remote verification is pending.\n",
    verification:
      "# v1.2.3\nVerification stage: CANDIDATE_LOCAL\nLocal validation status: PASS\nRemote publication status: PENDING\n\n## Required local evidence\n\n- [x] release packaging completed\n- [x] exact-artifact installation passed\n\n## Required remote evidence\n\n- [ ] CI pending\n- [ ] release publication pending\n"
  };
  assert.doesNotThrow(() => validateTaggedReleaseDocuments(safe));
  assert.doesNotThrow(() =>
    validateTaggedReleaseDocuments({
      ...safe,
      verification: safe.verification.replace(
        "- [x] release packaging completed",
        "- [x] release packaging completed\n- [x] explicit-request behavior passed"
      )
    })
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        ...safe,
        verification: safe.verification.replace(
          "Local validation status: PASS",
          "Local validation status: PENDING"
        )
      }),
    /local validation/u
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        ...safe,
        verification: safe.verification.replace("PENDING", "COMPLETE")
      }),
    /future remote|must be PENDING/u
  );
});

test("tagged local PASS requires complete local evidence without pending contradictions", () => {
  const safe = {
    tag: "v1.2.3",
    notes: "# v1.2.3\nFinal remote verification is pending.\n",
    verification:
      "# v1.2.3\nVerification stage: CANDIDATE_LOCAL\nLocal validation status: PASS\nRemote publication status: PENDING\n\n## Required local evidence\n\n- [x] local gates passed\n- [x] package installation passed\n\n## Required remote evidence\n\n- [ ] CI pending\n"
  };
  assert.doesNotThrow(() =>
    validateTaggedReleaseDocuments({
      ...safe,
      verification: `${safe.verification}\n## Current limitations\n\n- Local candidate validation passed, while remote publication remains PENDING.\n`
    })
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        ...safe,
        verification: safe.verification.replace(
          "- [x] local gates passed",
          "- [ ] local gates pending"
        )
      }),
    /every local checklist item/u
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        ...safe,
        verification: `${safe.verification}\n## Current limitations\n\n- Local candidate validation is\n  PENDING the final gate.\n`
      }),
    /contradicts PENDING local-validation prose/u
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        ...safe,
        verification: safe.verification
          .replace("## Required local evidence", "## Local evidence mentioned in prose")
          .replace("## Required remote evidence", "## Remote evidence mentioned in prose")
      }),
    /must contain one ## Required local evidence section/u
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        ...safe,
        verification: safe.verification.replace(
          "Local validation status: PASS",
          "Local validation status: PASS\nLocal validation status: PENDING"
        )
      }),
    /record complete local validation as PASS/u
  );
});

test("tagged remote evidence rejects every checked row regardless of keyword formatting", () => {
  const verification =
    "# v1.2.3\nVerification stage: CANDIDATE_LOCAL\nLocal validation status: PASS\nRemote publication status: PENDING\n\n## Required local evidence\n\n- [x] local gates passed\n\n## Required remote evidence\n\n- [x] C**I**, re**lease**, pub**lishing**, prove**nance**, and immut**able** checks complete\n- [ ] later remote step pending\n";
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        tag: "v1.2.3",
        notes: "# v1.2.3\nFinal remote verification is pending.\n",
        verification
      }),
    /future remote checklist item complete/u
  );
  assert.throws(
    () =>
      validateTaggedReleaseDocuments({
        tag: "v1.2.3",
        notes: "# v1.2.3\nFinal remote verification is pending.\n",
        verification: verification.replace("- [x] C**I**", "> - [x] C**I**")
      }),
    /future remote checklist item complete/u
  );
});

test("published asset verification rejects changed bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-release-assets-"));
  const local = join(root, "local");
  const published = join(root, "published");
  try {
    await mkdir(local);
    await mkdir(published);
    const bytes = Buffer.from("candidate");
    const hash = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    const names = ["artifact.zip", "artifact.tgz", "artifact.spdx.json"];
    const sums = names.map((name) => `${hash}  ${name}`).join("\n") + "\n";
    const manifest = `${JSON.stringify({ artifacts: Object.fromEntries(names.map((name) => [name, { sha256: hash }])) })}\n`;
    for (const name of names) await writeFile(join(local, name), bytes);
    await writeFile(join(local, "SHA256SUMS.txt"), sums);
    await writeFile(join(local, "manifest.json"), manifest);
    for (const name of names) await writeFile(join(published, name), bytes);
    await writeFile(join(published, "SHA256SUMS.txt"), sums);
    await writeFile(join(published, "manifest.json"), manifest);
    assert.equal((await verifyPublishedAssets(local, published)).payloads.length, 3);
    await writeFile(join(published, "artifact.zip"), "changed");
    await assert.rejects(() => verifyPublishedAssets(local, published), /digest mismatch/u);
    await writeFile(join(published, "artifact.zip"), bytes);
    await writeFile(join(published, "manifest.json"), "changed");
    await assert.rejects(() => verifyPublishedAssets(local, published), /manifest\.json/u);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("final verification states that it was generated after the tag", () => {
  const document = renderFinalVerification({
    tag: "v1.2.3",
    commit: "a".repeat(40),
    runUrl: "https://github.test/run/1",
    releaseUrl: "https://github.test/releases/v1.2.3",
    assets: { payloads: ["a.zip"], checksums: { "a.zip": "b".repeat(64) } },
    generatedAt: "2026-01-01T00:00:00.000Z"
  });
  assert.match(document, /FINAL_DRAFT_EVIDENCE/u);
  assert.match(document, /PENDING_ATOMIC_PUBLISH/u);
  assert.match(document, /was not present in the tagged source/u);
});
