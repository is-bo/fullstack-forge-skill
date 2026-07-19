import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertReleasePreconditions,
  assertUniqueAssetNames,
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
        releaseState: "exists"
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

test("duplicate asset basenames are rejected before upload", () => {
  assert.throws(() => assertUniqueAssetNames(["one/a.zip", "two/a.zip"]), /Duplicate/u);
  assert.deepEqual(assertUniqueAssetNames(["one/a.zip", "two/b.zip"]), ["a.zip", "b.zip"]);
});

test("tagged verification must keep remote publication pending", () => {
  const safe = {
    tag: "v1.2.3",
    notes: "# v1.2.3\nFinal remote verification is pending.\n",
    verification:
      "# v1.2.3\nVerification stage: TAGGED_LOCAL\nLocal validation status: PASS\nRemote publication status: PENDING\n\n- [ ] CI pending\n"
  };
  assert.doesNotThrow(() => validateTaggedReleaseDocuments(safe));
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

test("published asset verification rejects changed bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-release-assets-"));
  const local = join(root, "local");
  const published = join(root, "published");
  try {
    await mkdir(local);
    await mkdir(published);
    const bytes = Buffer.from("candidate");
    const hash = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    const sums = `${hash}  artifact.zip\n`;
    const manifest = `${JSON.stringify({ archives: { "artifact.zip": { sha256: hash } } })}\n`;
    await writeFile(join(local, "artifact.zip"), bytes);
    await writeFile(join(local, "SHA256SUMS.txt"), sums);
    await writeFile(join(local, "manifest.json"), manifest);
    await writeFile(join(published, "artifact.zip"), bytes);
    await writeFile(join(published, "SHA256SUMS.txt"), sums);
    await writeFile(join(published, "manifest.json"), manifest);
    assert.equal((await verifyPublishedAssets(local, published)).archives.length, 1);
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
    assets: { archives: ["a.zip"], checksums: { "a.zip": "b".repeat(64) } },
    generatedAt: "2026-01-01T00:00:00.000Z"
  });
  assert.match(document, /FINAL_DRAFT_EVIDENCE/u);
  assert.match(document, /PENDING_ATOMIC_PUBLISH/u);
  assert.match(document, /was not present in the tagged source/u);
});
