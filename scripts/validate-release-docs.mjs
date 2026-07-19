import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateTaggedReleaseDocuments } from "./lib/release-safety.mjs";
import { projectRoot } from "./project.mjs";

const version = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).version;
const tag = `v${version}`;
const notesPath = join(projectRoot, "docs", `RELEASE_NOTES_${tag}.md`);
const verificationPath = join(projectRoot, "docs", `RELEASE_VERIFICATION_${tag}.md`);
const [notes, verification] = await Promise.all([
  readFile(notesPath, "utf8"),
  readFile(verificationPath, "utf8")
]);
validateTaggedReleaseDocuments({ tag, notes, verification });
console.log(
  `Validated honest tagged release documents for ${tag}; remote publication remains PENDING.`
);
