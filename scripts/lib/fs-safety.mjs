import { lstat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export function assertSafeRelativePath(value, label = "path") {
  const parts = value.split(/[\\/]+/u);
  if (
    value.length === 0 ||
    value.includes("\0") ||
    isAbsolute(value) ||
    /^[A-Za-z]:/u.test(value) ||
    /^[\\/]{2}/u.test(value) ||
    parts.some(isUnsafeSegment)
  )
    throw new Error(`Unsafe relative ${label}: ${value}`);
}

export function assertInside(root, candidate, label = "path") {
  const base = resolve(root);
  const target = resolve(candidate);
  const rel = relative(base, target);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return;
  throw new Error(`${label} escapes root: ${candidate}`);
}

export async function assertNoSymlinkPath(root, candidate) {
  assertInside(root, candidate, "Filesystem path");
  const base = resolve(root);
  const target = resolve(candidate);
  const parts = relative(base, target).split(sep).filter(Boolean);
  let current = base;
  for (const part of ["", ...parts]) {
    if (part !== "") current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Refusing symlinked filesystem path: ${current}`);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

export async function assertRegularFile(path, label = "file") {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile())
    throw new Error(`Expected regular ${label}: ${path}`);
  return info;
}

function isUnsafeSegment(part) {
  const stem = part.split(".")[0]?.toUpperCase() ?? "";
  return (
    part === "" ||
    part === "." ||
    part === ".." ||
    part.includes(":") ||
    /[. ]$/u.test(part) ||
    [...part].some((character) => character.charCodeAt(0) < 0x20) ||
    /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem)
  );
}
