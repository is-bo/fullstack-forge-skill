import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { GENERATED_BUILD_RUNTIME_PATHS } from "../lib/package-policy.mjs";
import { loadPackageOwnership } from "../lib/package-ownership.mjs";
import {
  assertCleanReleaseInputs,
  createReleaseBundle,
  createSpdxSbom,
  loadTrustedNpmInputHashes,
  releaseArtifactNames,
  resolveNpmCli,
  validateNpmPackageArchive,
  validateNpmPackReport,
  validateSpdxSbom
} from "../lib/release-bundle.mjs";
import { projectRoot } from "../project.mjs";

const runFile = promisify(execFile);

const version = "1.3.0";
const packageBytes = Buffer.from("exact npm package bytes");
const sourceRevision = "a".repeat(40);
const created = "2026-08-10T12:00:00.000Z";
const ownedPaths = new Set([".fullstack-forge/skills/fullstack-forge/SKILL.md"]);
const packageLock = {
  lockfileVersion: 3,
  packages: {
    "": {
      name: "fullstack-forge-skill",
      version,
      license: "Apache-2.0",
      dependencies: { typescript: "6.0.3" },
      devDependencies: { prettier: "3.9.6" }
    },
    "node_modules/typescript": {
      version: "6.0.3",
      resolved: "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
      integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
      license: "Apache-2.0"
    },
    "node_modules/prettier": {
      version: "3.9.6",
      resolved: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      integrity: `sha512-${Buffer.alloc(64, 2).toString("base64")}`,
      license: "MIT",
      dev: true
    }
  }
};
const registry = {
  schemaVersion: 1,
  providers: [
    {
      id: "example-skills",
      displayName: "Example Skills",
      repository: "example/skills",
      upstreamCommit: "b".repeat(40),
      upstreamTag: "v2.0.0",
      license: "MIT",
      copyright: "Copyright Example",
      runtimeChecksum: "c".repeat(64)
    }
  ]
};

test("release artifact names are stable and version-bound", () => {
  assert.deepEqual(releaseArtifactNames(version), {
    package: "fullstack-forge-skill-v1.3.0.tgz",
    sbom: "fullstack-forge-skill-v1.3.0.spdx.json"
  });
  assert.throws(() => releaseArtifactNames("latest"), /semantic version/u);
});

test("package execution ignores an environment-controlled npm executable", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "fullstack-forge-fake-npm-"));
  const previous = process.env.npm_execpath;
  try {
    const fake = join(temporary, "npm-cli.js");
    await writeFile(fake, "process.exit(99);\n", "utf8");
    process.env.npm_execpath = fake;
    const resolved = await resolveNpmCli();
    assert.notEqual(resolved, fake);
    assert.match(resolved, /(?:[\\/]node_modules[\\/]npm[\\/]bin[\\/]npm-cli\.js)$/iu);
  } finally {
    if (previous === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previous;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("SPDX generation is deterministic and inventories runtime and vendored components", () => {
  const input = { version, packageBytes, packageLock, registry, sourceRevision, created };
  const first = createSpdxSbom(input);
  const second = createSpdxSbom(input);
  assert.equal(first.equals(second), true);
  const document = JSON.parse(first.toString("utf8"));
  assert.equal(document.spdxVersion, "SPDX-2.3");
  assert.equal(document.packages.length, 3);
  assert.ok(document.packages.some((pkg) => pkg.name === "typescript"));
  const providerPackage = document.packages.find((pkg) => pkg.name === "Example Skills");
  assert.ok(providerPackage);
  assert.equal(providerPackage.downloadLocation, "NOASSERTION");
  assert.deepEqual(providerPackage.checksums, [
    { algorithm: "SHA256", checksumValue: registry.providers[0].runtimeChecksum }
  ]);
  assert.match(providerPackage.sourceInfo, new RegExp(registry.providers[0].upstreamCommit, "u"));
  assert.match(providerPackage.sourceInfo, /packaged runtime content tree/iu);
  assert.equal(
    document.packages.some((pkg) => pkg.name === "prettier"),
    false
  );
  assert.ok(document.relationships.some((entry) => entry.relationshipType === "DEPENDS_ON"));
  assert.ok(document.relationships.some((entry) => entry.relationshipType === "CONTAINS"));
  assert.doesNotThrow(() => validateSpdxSbom(first, input));
  assert.throws(
    () => validateSpdxSbom(first, { ...input, packageBytes: Buffer.from("changed") }),
    /package checksum/u
  );
});

test("SPDX generation rejects malformed lock and provenance records", () => {
  assert.throws(
    () =>
      createSpdxSbom({
        version,
        packageBytes,
        packageLock: { ...packageLock, lockfileVersion: 2 },
        registry,
        sourceRevision,
        created
      }),
    /lockfileVersion 3/u
  );
  assert.throws(
    () =>
      createSpdxSbom({
        version,
        packageBytes,
        packageLock,
        registry: { schemaVersion: 1, providers: [{ ...registry.providers[0], license: "" }] },
        sourceRevision,
        created
      }),
    /provider/u
  );
  const queryLock = JSON.parse(JSON.stringify(packageLock));
  queryLock.packages["node_modules/typescript"].resolved =
    "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz?token=secret";
  assert.throws(
    () =>
      createSpdxSbom({
        version,
        packageBytes,
        packageLock: queryLock,
        registry,
        sourceRevision,
        created
      }),
    /untrusted source URL/u
  );
});

test("npm pack reports must describe the exact complete package artifact", () => {
  const files = [
    { path: "package.json", data: Buffer.from("{}\n") },
    { path: "build/cli/src/index.js", data: Buffer.from("#!/usr/bin/env node\n"), mode: 0o755 },
    {
      path: ".fullstack-forge/skills/fullstack-forge/SKILL.md",
      data: Buffer.from("# Forge\n")
    },
    { path: "LICENSE", data: Buffer.from("fixture license\n") }
  ];
  const bytes = createNpmTgz(files);
  const report = createNpmReport(bytes, files);
  assert.doesNotThrow(() => validateNpmPackReport([report], version, bytes, ownedPaths));
  assert.throws(
    () =>
      validateNpmPackReport(
        [report],
        version,
        bytes,
        new Set([...ownedPaths, "skills/forge/SKILL.md"])
      ),
    /missing generated owned path skills\/forge\/SKILL\.md/u
  );
  const forbiddenArchiveFiles = [...files, { path: "evals/case.json", data: Buffer.from("{}\n") }];
  const forbiddenBytes = createNpmTgz(forbiddenArchiveFiles);
  assert.throws(
    () =>
      validateNpmPackReport(
        [createNpmReport(forbiddenBytes, forbiddenArchiveFiles)],
        version,
        forbiddenBytes,
        ownedPaths
      ),
    /npm package path/iu
  );
  for (const path of [
    "scripts/private-inputs.json",
    "docs/fullstack-forge-private-spec.md",
    "scripts/credentials.json",
    "scripts/customer-spec.md",
    "research/acme-clone/README.md",
    "scripts/audit-report.json",
    "docs/internal-roadmap.md"
  ]) {
    const privateArchiveFiles = [...files, { path, data: Buffer.from("private\n") }];
    const privateBytes = createNpmTgz(privateArchiveFiles);
    assert.throws(
      () =>
        validateNpmPackReport(
          [createNpmReport(privateBytes, privateArchiveFiles)],
          version,
          privateBytes,
          ownedPaths
        ),
      /package path/iu,
      path
    );
  }
  assert.throws(
    () =>
      validateNpmPackReport([{ ...report, size: bytes.length - 1 }], version, bytes, ownedPaths),
    /byte count/u
  );
  assert.throws(
    () =>
      validateNpmPackReport(
        [
          {
            ...report,
            files: report.files.map((file, index) =>
              index === 0 ? { ...file, size: file.size + 1 } : file
            )
          }
        ],
        version,
        bytes,
        ownedPaths
      ),
    /size differs from package archive/u
  );
});

test("forged npm reports cannot bless truncated gzip bytes", () => {
  const files = [
    { path: "package.json", data: Buffer.from("{}\n") },
    { path: "build/cli/src/index.js", data: Buffer.from("#!/usr/bin/env node\n"), mode: 0o755 },
    {
      path: ".fullstack-forge/skills/fullstack-forge/SKILL.md",
      data: Buffer.from("# Forge\n")
    },
    { path: "LICENSE", data: Buffer.from("fixture license\n") }
  ];
  const truncated = Buffer.from([0x1f, 0x8b]);
  const forged = createNpmReport(truncated, files);
  assert.throws(
    () => validateNpmPackReport([forged], version, truncated, ownedPaths),
    /truncated gzip header/u
  );
});

test("npm tar validation rejects links, devices, unsafe paths, and duplicates", () => {
  const base = [
    { path: "package.json", data: Buffer.from("{}\n") },
    { path: "build/cli/src/index.js", data: Buffer.from("cli\n") },
    {
      path: ".fullstack-forge/skills/fullstack-forge/SKILL.md",
      data: Buffer.from("# Forge\n")
    },
    { path: "LICENSE", data: Buffer.from("license\n") }
  ];
  for (const type of ["1", "2", "3", "4", "6"])
    assert.throws(
      () =>
        validateNpmPackageArchive(
          createNpmTgz([...base, { path: "linked", data: Buffer.alloc(0), type }]),
          version,
          ownedPaths
        ),
      /non-regular entry type/u,
      type
    );
  assert.throws(
    () =>
      validateNpmPackageArchive(
        createNpmTgz([...base, { path: "../escape", data: Buffer.from("bad\n") }]),
        version,
        ownedPaths
      ),
    /Unsafe relative npm package path/u
  );
  assert.throws(
    () => validateNpmPackageArchive(createNpmTgz([...base, base[0]]), version, ownedPaths),
    /duplicate path package\.json/u
  );
});

test("trusted hashes bind non-owned common package bytes", () => {
  const files = [
    { path: "package.json", data: Buffer.from("{}\n") },
    { path: "build/cli/src/index.js", data: Buffer.from("cli\n") },
    {
      path: ".fullstack-forge/skills/fullstack-forge/SKILL.md",
      data: Buffer.from("# Forge\n")
    },
    { path: "LICENSE", data: Buffer.from("license\n") },
    { path: "README.md", data: Buffer.from("modified after packaging\n") }
  ];
  const trustedHashes = new Map([
    ["README.md", createHash("sha256").update("trusted source bytes\n").digest("hex")]
  ]);
  assert.throws(
    () =>
      validateNpmPackageArchive(createNpmTgz(files), version, ownedPaths, undefined, trustedHashes),
    /modified bytes for README\.md/u
  );
});

test(
  "the real npm pack artifact has an exact byte-derived inventory",
  { timeout: 120_000 },
  async () => {
    const currentVersion = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8")
    ).version;
    const ownership = await loadPackageOwnership(projectRoot);
    const trustedHashes = await loadTrustedNpmInputHashes(projectRoot, currentVersion, ownership);
    assert.equal(
      trustedHashes.get("README.md"),
      createHash("sha256")
        .update(await readFile(join(projectRoot, "README.md")))
        .digest("hex")
    );
    const bundle = await createReleaseBundle({ projectRoot, version: currentVersion });
    const archive = validateNpmPackageArchive(
      bundle.packageBytes,
      currentVersion,
      ownership.paths,
      GENERATED_BUILD_RUNTIME_PATHS,
      trustedHashes
    );
    assert.equal(archive.entryCount, bundle.packageReport.entryCount);
    assert.equal(archive.unpackedBytes, bundle.packageReport.unpackedBytes);
    assert.equal(archive.inventorySha256, bundle.packageReport.inventorySha256);
    assert.ok(archive.files.some((file) => file.path === "package.json"));
    assert.ok(archive.files.some((file) => file.path === "build/cli/src/index.js"));
  }
);

test("release verification can opt into a clean tracked and untracked source boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-release-clean-"));
  try {
    await runFile("git", ["init", "-q"], { cwd: root, windowsHide: true });
    await runFile("git", ["config", "user.email", "release-test@example.invalid"], {
      cwd: root,
      windowsHide: true
    });
    await runFile("git", ["config", "user.name", "Release Test"], {
      cwd: root,
      windowsHide: true
    });
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "README.md"), "# clean\n");
    await writeFile(join(root, "docs", "release.md"), "# release\n");
    await runFile("git", ["add", "."], { cwd: root, windowsHide: true });
    await runFile("git", ["commit", "-qm", "fixture"], { cwd: root, windowsHide: true });
    assert.deepEqual(await assertCleanReleaseInputs(root), { clean: true });

    await writeFile(join(root, "docs", "release.md"), "# changed\n");
    await assert.rejects(
      assertCleanReleaseInputs(root),
      /Release package inputs are dirty or untracked.*docs\/release\.md/u
    );
    await runFile("git", ["checkout", "--", "docs/release.md"], {
      cwd: root,
      windowsHide: true
    });
    await writeFile(join(root, "docs", "untracked.md"), "# untracked\n");
    await assert.rejects(
      assertCleanReleaseInputs(root),
      /Release package inputs are dirty or untracked.*docs\/untracked\.md/u
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

function createNpmReport(bytes, files) {
  return {
    id: `fullstack-forge-skill@${version}`,
    name: "fullstack-forge-skill",
    version,
    size: bytes.length,
    unpackedSize: files.reduce((total, file) => total + file.data.length, 0),
    shasum: createHash("sha1").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    filename: `fullstack-forge-skill-${version}.tgz`,
    entryCount: files.length,
    files: files.map((file) => ({
      path: file.path,
      size: file.data.length,
      mode: file.mode ?? 0o644
    }))
  };
}

function createNpmTgz(files) {
  const parts = [];
  for (const file of files) {
    const archivePath = `package/${file.path}`;
    const name = Buffer.from(archivePath, "utf8");
    if (name.length > 100) throw new Error(`Fixture tar path is too long: ${archivePath}`);
    const header = Buffer.alloc(512);
    name.copy(header, 0);
    writeTarOctal(header, 100, 8, file.mode ?? 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, file.data.length);
    writeTarOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = (file.type ?? "0").charCodeAt(0);
    if (file.linkName !== undefined) Buffer.from(file.linkName, "utf8").copy(header, 157, 0, 100);
    Buffer.from("ustar\0", "ascii").copy(header, 257);
    Buffer.from("00", "ascii").copy(header, 263);
    writeTarOctal(header, 329, 8, 0);
    writeTarOctal(header, 337, 8, 0);
    let checksum = 0;
    for (const byte of header) checksum += byte;
    writeTarOctal(header, 148, 8, checksum);
    const padding = Buffer.alloc((512 - (file.data.length % 512)) % 512);
    parts.push(header, file.data, padding);
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts), { level: 9 });
}

function writeTarOctal(buffer, offset, length, value) {
  const encoded = `${value.toString(8).padStart(length - 2, "0")} \0`;
  buffer.write(encoded, offset, length, "ascii");
}
