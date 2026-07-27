import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { validateArchiveBytes } from "../lib/archive-validation.mjs";
import { createDeterministicZip } from "../lib/zip.mjs";

const VERSION = "0.2.0";
const legacyOwner = "the" + "thunderbolt";

test("archive validation resolves packaged relative Markdown links", () => {
  const archive = createDeterministicZip([
    { path: "README.md", data: Buffer.from("[Get started](docs/GETTING_STARTED.md)\n") },
    { path: "docs/GETTING_STARTED.md", data: Buffer.from("# Get started\n") }
  ]);

  assert.doesNotThrow(() => validateArchiveBytes(archive, "fixture.zip", VERSION));
});

test("archive validation reports missing Markdown destinations and old-owner public links", () => {
  const brokenLink = createDeterministicZip([
    { path: "README.md", data: Buffer.from("[Missing](docs/REPOSITORY_INVENTORY.md)\n") }
  ]);
  assert.throws(
    () => validateArchiveBytes(brokenLink, "fixture.zip", VERSION),
    /README\.md links to missing packaged destination docs\/REPOSITORY_INVENTORY\.md/u
  );

  const oldOwnerLink = createDeterministicZip([
    {
      path: "NOTICE",
      data: Buffer.from(`[Legacy](https://github.com/${legacyOwner}/fullstack-forge-skill)\n`)
    }
  ]);
  assert.throws(
    () => validateArchiveBytes(oldOwnerLink, "fixture.zip", VERSION),
    /NOTICE contains an old-owner public link/u
  );
});

test("archive validation refuses duplicate ZIP entries", () => {
  const duplicate = createDeterministicZip([
    { path: "README.md", data: Buffer.from("first\n") },
    { path: "README.md", data: Buffer.from("second\n") }
  ]);
  assert.throws(() => validateArchiveBytes(duplicate, "fixture.zip", VERSION), /duplicate entry/u);
});

test("archive validation rejects relative Markdown links that escape the archive", () => {
  const traversal = createDeterministicZip([
    { path: "docs/GETTING_STARTED.md", data: Buffer.from("[Escape](../../outside.md)\n") }
  ]);

  assert.throws(
    () => validateArchiveBytes(traversal, "fixture.zip", VERSION),
    /GETTING_STARTED\.md link escapes the archive/u
  );
});
