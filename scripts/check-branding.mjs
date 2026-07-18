import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot, sha256 } from "./project.mjs";

const expected = new Map([
  ["fullstack-forge-hero.png", [1600, 900]],
  ["fullstack-forge-social-preview.png", [1280, 640]],
  ["fullstack-forge-icon.png", [512, 512]]
]);
const results = [];
for (const [name, [width, height]] of expected) {
  const bytes = await readFile(join(projectRoot, "docs", "assets", name));
  if (
    bytes.length < 33 ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    bytes.subarray(12, 16).toString("ascii") !== "IHDR"
  )
    throw new Error(`${name} is not a valid PNG header`);
  const actualWidth = bytes.readUInt32BE(16);
  const actualHeight = bytes.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height)
    throw new Error(`${name} is ${actualWidth}x${actualHeight}; expected ${width}x${height}`);
  if (bytes.length > 2 * 1024 * 1024) throw new Error(`${name} exceeds the 2 MiB asset budget`);
  results.push({ name, width, height, bytes: bytes.length });
}
const publicIcon = await readFile(join(projectRoot, "docs", "assets", "fullstack-forge-icon.png"));
const skillIcon = await readFile(
  join(projectRoot, "src", "fullstack-forge", "assets", "fullstack-forge-icon.png")
);
if (sha256(publicIcon) !== sha256(skillIcon))
  throw new Error("Canonical skill icon differs from the public brand icon");
console.log(JSON.stringify({ valid: true, assets: results }, null, 2));
