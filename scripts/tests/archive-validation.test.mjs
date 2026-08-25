import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateArchiveBytes } from "../lib/archive-validation.mjs";
import { serializeGeneratedOwnership } from "../lib/generated-ownership.mjs";
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

test("archive validation requires exact safe general-purpose ZIP flags", () => {
  for (const flags of [0x0801, 0x0808, 0x1800]) {
    const archive = createDeterministicZip([
      { path: "README.md", data: Buffer.from("# Fixture\n") }
    ]);
    const centralOffset = archive.readUInt32LE(archive.length - 22 + 16);
    archive.writeUInt16LE(flags, 6);
    archive.writeUInt16LE(flags, centralOffset + 8);

    assert.throws(
      () => validateArchiveBytes(archive, "fixture.zip", VERSION),
      /unsupported general-purpose flags/u
    );
  }
});

test("archive validation rejects local and central flag mismatches", () => {
  const archive = createDeterministicZip([{ path: "README.md", data: Buffer.from("# Fixture\n") }]);
  archive.writeUInt16LE(0x0801, 6);

  assert.throws(
    () => validateArchiveBytes(archive, "fixture.zip", VERSION),
    /local general-purpose flags differ or are unsupported/u
  );
});

test("archive validation rejects non-regular Unix file types", () => {
  const archive = createDeterministicZip([{ path: "README.md", data: Buffer.from("# Fixture\n") }]);
  const centralOffset = archive.readUInt32LE(archive.length - 22 + 16);
  archive.writeUInt32LE(0o010644 * 2 ** 16, centralOffset + 38);

  assert.throws(() => validateArchiveBytes(archive, "fixture.zip", VERSION), /not a regular file/u);
});

test("archive validation requires exact deterministic regular-file attributes", () => {
  for (const external of [0o104755 * 2 ** 16, 0o100644 * 2 ** 16 + 0x10]) {
    const archive = createDeterministicZip([
      { path: "README.md", data: Buffer.from("# Fixture\n") }
    ]);
    const centralOffset = archive.readUInt32LE(archive.length - 22 + 16);
    archive.writeUInt32LE(external, centralOffset + 38);

    assert.throws(
      () => validateArchiveBytes(archive, "fixture.zip", VERSION),
      /unsupported regular-file attributes/u
    );
  }
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

test("archive validation binds managed roots to their exact ownership manifests", () => {
  const owned = Buffer.from("# Skill\n");
  const marker = Buffer.from(
    serializeGeneratedOwnership(
      "agents",
      new Map([["forge/SKILL.md", createHash("sha256").update(owned).digest("hex")]])
    )
  );
  const valid = createDeterministicZip([
    { path: ".agents/skills/.fullstack-forge-generated.json", data: marker },
    { path: ".agents/skills/forge/SKILL.md", data: owned }
  ]);
  assert.doesNotThrow(() => validateArchiveBytes(valid, "fixture.zip", VERSION));

  const unowned = createDeterministicZip([
    { path: ".agents/skills/.fullstack-forge-generated.json", data: marker },
    { path: ".agents/skills/forge/SKILL.md", data: owned },
    { path: ".agents/skills/client-notes.md", data: Buffer.from("benign-looking extra\n") }
  ]);
  assert.throws(
    () => validateArchiveBytes(unowned, "fixture.zip", VERSION),
    /contains unowned file client-notes\.md/u
  );

  const modified = createDeterministicZip([
    { path: ".agents/skills/.fullstack-forge-generated.json", data: marker },
    { path: ".agents/skills/forge/SKILL.md", data: Buffer.from("changed\n") }
  ]);
  assert.throws(
    () => validateArchiveBytes(modified, "fixture.zip", VERSION),
    /modified owned file forge\/SKILL\.md/u
  );
});
