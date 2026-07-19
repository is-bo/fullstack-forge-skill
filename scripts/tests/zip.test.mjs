import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { crc32, createDeterministicZip } from "../lib/zip.mjs";

test("deterministic ZIPs encode Unix file attributes as unsigned values", () => {
  const entries = [{ path: "skill/SKILL.md", data: Buffer.from("evidence\n") }];
  const first = createDeterministicZip(entries);
  const second = createDeterministicZip(entries);

  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.notEqual(first.indexOf(Buffer.from("PK\x01\x02", "binary")), -1);
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  for (const path of ["", "/absolute", "../escape", "a//b"])
    assert.throws(
      () => createDeterministicZip([{ path, data: Buffer.alloc(0) }]),
      /Unsafe ZIP entry/u
    );
});
