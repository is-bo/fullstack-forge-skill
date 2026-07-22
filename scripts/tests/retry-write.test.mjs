import assert from "node:assert/strict";
import test from "node:test";
import { writeFileWithTransientRetry } from "../lib/retry-write.mjs";

test("Windows transient write failures retry with a bounded delay sequence", async () => {
  const attempts = [];
  const pauses = [];
  await writeFileWithTransientRetry("manifest.json", "value", "utf8", {
    platform: "win32",
    delays: [1, 2, 3],
    write: async () => {
      attempts.push("write");
      if (attempts.length < 3) throw Object.assign(new Error("locked"), { code: "UNKNOWN" });
    },
    pause: async (duration) => {
      pauses.push(duration);
    }
  });
  assert.equal(attempts.length, 3);
  assert.deepEqual(pauses, [1, 2]);
});

test("non-transient and non-Windows write failures are not retried", async () => {
  for (const [platform, code] of [
    ["win32", "ENOENT"],
    ["linux", "EBUSY"]
  ]) {
    let attempts = 0;
    const failure = Object.assign(new Error(`${platform}-${code}`), { code });
    await assert.rejects(
      () =>
        writeFileWithTransientRetry("manifest.json", "value", "utf8", {
          platform,
          delays: [0, 0],
          write: async () => {
            attempts += 1;
            throw failure;
          },
          pause: async () => undefined
        }),
      failure
    );
    assert.equal(attempts, 1);
  }
});

test("a persistent Windows sharing failure is rethrown after the retry budget", async () => {
  let attempts = 0;
  const failure = Object.assign(new Error("still locked"), { code: "EPERM" });
  await assert.rejects(
    () =>
      writeFileWithTransientRetry("manifest.json", "value", "utf8", {
        platform: "win32",
        delays: [0, 0],
        write: async () => {
          attempts += 1;
          throw failure;
        },
        pause: async () => undefined
      }),
    failure
  );
  assert.equal(attempts, 3);
});
