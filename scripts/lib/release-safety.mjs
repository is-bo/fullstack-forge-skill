import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

export function assertUniqueAssetNames(paths) {
  const names = new Map();
  for (const path of paths) {
    const name = basename(path);
    const previous = names.get(name);
    if (previous !== undefined)
      throw new Error(`Duplicate release asset name '${name}' from '${previous}' and '${path}'.`);
    names.set(name, path);
  }
  return [...names.keys()].sort();
}

export function assertReleasePreconditions({ tag, expectedSha, tagSha, releaseState, version }) {
  if (!/^v\d+\.\d+\.\d+$/u.test(tag)) throw new Error(`Invalid immutable release tag '${tag}'.`);
  if (version !== undefined && tag !== `v${version}`)
    throw new Error(`Release tag ${tag} does not match package version ${version}.`);
  if (!/^[a-f0-9]{40}$/u.test(expectedSha) || !/^[a-f0-9]{40}$/u.test(tagSha))
    throw new Error("Release preflight requires full 40-character commit SHAs.");
  if (tagSha !== expectedSha)
    throw new Error(`Tag ${tag} resolves to ${tagSha}, expected workflow commit ${expectedSha}.`);
  if (releaseState === "draft" || releaseState === "published")
    throw new Error(
      `Release ${tag} already exists as a ${releaseState}; refusing to modify, duplicate, or replace its assets.`
    );
  if (releaseState !== "missing")
    throw new Error(`Release ${tag} absence was not proven; refusing publication.`);
}

export function classifyReleaseState(response, tag) {
  const releases =
    Array.isArray(response) && response.every((page) => Array.isArray(page))
      ? response.flat()
      : response;
  if (!Array.isArray(releases))
    throw new Error("GitHub release listing was not a JSON array; release absence is unproven.");
  for (const release of releases) {
    if (
      release === null ||
      typeof release !== "object" ||
      typeof release.tag_name !== "string" ||
      typeof release.draft !== "boolean"
    )
      throw new Error(
        "GitHub release listing contained an invalid record; release absence is unproven."
      );
  }
  const match = releases.find((release) => release.tag_name === tag);
  return match === undefined ? "missing" : match.draft ? "draft" : "published";
}

export function classifyAttestationState(response, subjectDigest) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(subjectDigest))
    throw new Error(`Invalid attestation subject digest '${subjectDigest}'.`);
  if (response === null || typeof response !== "object" || !Array.isArray(response.attestations))
    throw new Error("GitHub attestation response was invalid; attestation absence is unproven.");
  for (const attestation of response.attestations) {
    if (
      attestation === null ||
      typeof attestation !== "object" ||
      (attestation.subject_digest !== undefined &&
        typeof attestation.subject_digest !== "string") ||
      attestation.bundle === null ||
      typeof attestation.bundle !== "object"
    )
      throw new Error(
        "GitHub attestation response contained an invalid record; attestation absence is unproven."
      );
  }
  return response.attestations.some(
    (attestation) =>
      attestation.subject_digest === undefined || attestation.subject_digest === subjectDigest
  )
    ? "existing"
    : "missing";
}

export function classifyAttestationLookupFailure(error, repositoryVisibility) {
  let response;
  try {
    response =
      typeof error?.stdout === "string" && error.stdout.length > 0
        ? JSON.parse(error.stdout)
        : undefined;
  } catch {
    response = undefined;
  }
  if (
    repositoryVisibility === "public" &&
    error?.code === 1 &&
    response !== null &&
    typeof response === "object" &&
    response.message === "Not Found" &&
    String(response.status) === "404" &&
    typeof response.documentation_url === "string" &&
    response.documentation_url.startsWith("https://docs.github.com/rest/repos/attestations")
  )
    return "missing";
  throw new Error("GitHub attestation lookup failed; attestation absence is unproven.", {
    cause: error
  });
}

export function assertNoExistingAttestations(results) {
  if (!Array.isArray(results) || results.length === 0)
    throw new Error("No candidate attestation states were proved; refusing publication.");
  for (const result of results) {
    if (
      result === null ||
      typeof result !== "object" ||
      typeof result.asset !== "string" ||
      typeof result.subjectDigest !== "string"
    )
      throw new Error("Candidate attestation state was malformed; absence is unproven.");
    if (result.state === "existing")
      throw new Error(
        `${result.asset} already has an attestation for ${result.subjectDigest}; refusing a duplicate or partial release retry.`
      );
    if (result.state !== "missing")
      throw new Error(`${result.asset} attestation absence is unproven; refusing publication.`);
  }
}

export function validateTaggedReleaseDocuments({ tag, notes, verification }) {
  const errors = [];
  if (!notes.includes(tag)) errors.push(`release notes do not name ${tag}`);
  if (!verification.includes(tag)) errors.push(`verification record does not name ${tag}`);
  if (!/^Verification stage:\s*CANDIDATE_LOCAL\s*$/mu.test(verification))
    errors.push("verification stage must be CANDIDATE_LOCAL");
  if (!/^Local validation status:\s*PASS\s*$/mu.test(verification))
    errors.push("tagged verification must record complete local validation as PASS");
  if (!/^Remote publication status:\s*PENDING\s*$/mu.test(verification))
    errors.push("remote publication status must be PENDING in tagged source");
  if (/^Remote publication status:\s*(?:PASS|COMPLETE|COMPLETED)\s*$/imu.test(verification))
    errors.push("tagged source claims future remote publication completed");
  if (
    /^\s*[-*]\s*\[x\].*\b(?:CI|release|publish(?:ed|ing)?|provenance|immutable)\b/imu.test(
      verification
    )
  )
    errors.push("tagged source marks a future remote step complete");
  if (/final post-release verification(?: is|:) (?:complete|passed|published)/iu.test(notes))
    errors.push("release notes claim the post-release record already exists");
  if (!/pending/iu.test(verification))
    errors.push("verification record has no pending remote steps");
  if (errors.length > 0)
    throw new Error(`Unsafe tagged release documentation:\n${errors.join("\n")}`);
}

export async function verifyPublishedAssets(localDirectory, publishedDirectory) {
  const checksumPath = join(publishedDirectory, "SHA256SUMS.txt");
  const checksumText = await readFile(checksumPath, "utf8");
  const checksums = parseChecksums(checksumText);
  const publishedFiles = (await readdir(publishedDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const publishedNames = publishedFiles.filter((name) => name.endsWith(".zip"));
  assertUniqueAssetNames(publishedNames);
  if (publishedNames.length === 0) throw new Error("No published ZIP assets were downloaded.");
  const expectedFiles = [...publishedNames, "SHA256SUMS.txt", "manifest.json"].sort();
  if (JSON.stringify(publishedFiles) !== JSON.stringify(expectedFiles))
    throw new Error(
      `Draft release asset set differs from the candidate: expected ${expectedFiles.join(", ")}; received ${publishedFiles.join(", ")}.`
    );
  for (const name of publishedNames) {
    const expected = checksums.get(name);
    if (expected === undefined) throw new Error(`Published checksum list omits ${name}.`);
    const published = await readFile(join(publishedDirectory, name));
    const local = await readFile(join(localDirectory, name));
    const publishedHash = digest(published);
    if (publishedHash !== expected) throw new Error(`Published digest mismatch for ${name}.`);
    if (!published.equals(local))
      throw new Error(`Published bytes differ from local candidate: ${name}.`);
  }
  const localChecksums = await readFile(join(localDirectory, "SHA256SUMS.txt"));
  const publishedChecksums = await readFile(checksumPath);
  if (!publishedChecksums.equals(localChecksums))
    throw new Error("Published SHA256SUMS.txt differs from the locally validated candidate.");
  const localManifest = await readFile(join(localDirectory, "manifest.json"));
  const publishedManifest = await readFile(join(publishedDirectory, "manifest.json"));
  if (!publishedManifest.equals(localManifest))
    throw new Error("Published manifest.json differs from the locally validated candidate.");
  return {
    archives: publishedNames.sort(),
    checksums: Object.fromEntries([...checksums.entries()].sort())
  };
}

export function parseChecksums(text) {
  const values = new Map();
  for (const line of text.trim().split(/\r?\n/u)) {
    const match = /^([a-f0-9]{64}) {2}([^/\\]+)$/u.exec(line);
    if (match === null) throw new Error(`Invalid checksum line: ${line}`);
    const [, hash, name] = match;
    if (values.has(name)) throw new Error(`Duplicate checksum entry: ${name}`);
    values.set(name, hash);
  }
  return values;
}

export function renderFinalVerification({ tag, commit, runUrl, releaseUrl, assets, generatedAt }) {
  const assetLines = assets.archives
    .map((name) => `- \`${name}\`: \`${assets.checksums[name]}\``)
    .join("\n");
  return `# Fullstack Forge ${tag} final release evidence asset

Verification stage: FINAL_DRAFT_EVIDENCE
Remote publication status: PENDING_ATOMIC_PUBLISH
Generated: ${generatedAt}
Tag: ${tag}
Commit: ${commit}
Workflow run: ${runUrl}
Release: ${releaseUrl}

This document was generated by the tag-triggered release workflow after the draft release assets
were uploaded, downloaded into a clean directory, compared byte-for-byte, checksum-verified, and
clean-room inspected. It was not present in the tagged source.

## Verified release assets

${assetLines}

## Completed evidence

- Tagged source checks, tests, coverage enforcement, dependency audit, packaging, smoke install,
  and offline install completed in the linked workflow.
- The remote draft contained no pre-existing release and no asset name was duplicated or replaced.
- Downloaded release archives matched the locally validated candidates byte-for-byte.
- SHA256SUMS.txt matched the downloaded archives.
- The Codex archive was extracted into an empty directory and its canonical skill was readable.
- Build-provenance attestations were requested for archives and this final evidence bundle.
- All assets and this record were attached to the draft before the one-way immutable publish step.

After this asset is attached, the workflow publishes the draft exactly once. GitHub release
immutability and release-attestation verification are then checked by the remaining workflow
steps. Their authoritative result is the workflow conclusion and immutable release attestation;
this asset does not claim those future steps already passed and did not exist in the original tag.
`;
}

export function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
