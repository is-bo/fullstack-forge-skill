import { copyFile, cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

export async function withTemporaryProject<T>(
  prefix: string,
  callback: (root: string) => Promise<T>
): Promise<T> {
  const safePrefix = `fullstack-forge-test-${prefix.replace(/[^a-z0-9-]/giu, "-")}-`;
  const canonicalTemp = await realpath(tmpdir());
  const root = await realpath(await mkdtemp(join(canonicalTemp, safePrefix)));
  validate(root, safePrefix, canonicalTemp);
  try {
    return await callback(root);
  } finally {
    validate(root, safePrefix, canonicalTemp);
    await rm(root, { recursive: true });
  }
}

/**
 * Copies a scanner fixture into a disposable directory and materializes its non-installable
 * package.json.fixture only there. Repository fixtures never remain dependency roots.
 */
export async function copyFixture(source: string, target: string): Promise<void> {
  await cp(source, target, { recursive: true });
  await copyFile(join(target, "package.json.fixture"), join(target, "package.json"));
}

function validate(path: string, prefix: string, canonicalTemp: string): void {
  const resolved = resolve(path);
  const temp = resolve(canonicalTemp);
  const separator = process.platform === "win32" ? "\\" : "/";
  if (!resolved.startsWith(`${temp}${separator}`) || !basename(resolved).startsWith(prefix)) {
    throw new Error(`Refusing to remove unexpected test path: ${resolved}`);
  }
}
