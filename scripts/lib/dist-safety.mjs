import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSymlinkPath } from "./fs-safety.mjs";

export async function assertDistributionInventory(projectRoot, distRoot, allowedNames) {
  await assertNoSymlinkPath(projectRoot, distRoot);
  let entries;
  try {
    entries = await readdir(distRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(distRoot, entry.name);
    await assertNoSymlinkPath(projectRoot, path);
    const info = await lstat(path);
    if (entry.isSymbolicLink() || info.isSymbolicLink() || !entry.isFile() || !info.isFile())
      throw new Error(`Unexpected non-regular distribution entry ${safeDisplayPath(path)}`);
    if (info.nlink !== 1)
      throw new Error(
        `Hard-linked distribution entry is forbidden (nlink=${info.nlink}): ${safeDisplayPath(path)}`
      );
    if (!allowedNames.has(entry.name))
      throw new Error(
        `Unexpected distribution file not declared by this release: ${safeDisplayPath(path)}`
      );
  }
}

function safeDisplayPath(path) {
  return [...path]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? "?" : character;
    })
    .join("");
}
