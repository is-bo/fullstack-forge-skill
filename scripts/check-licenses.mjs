import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CONTENT_DIRNAME,
  providerDirectory,
  readProviderConfig,
  readProviderRecord
} from "./lib/upstream.mjs";
import { projectRoot } from "./project.mjs";

const allowed = new Set([
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT"
]);
const lock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
const rejected = [];
let dependencies = 0;
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (path === "") continue;
  dependencies += 1;
  if (typeof entry.license !== "string" || !allowed.has(entry.license))
    rejected.push({ path, license: entry.license ?? "MISSING" });
}
if (lock.packages?.[""]?.license !== "Apache-2.0")
  rejected.push({ path: "<root>", license: lock.packages?.[""]?.license ?? "MISSING" });

const providers = (await readProviderConfig()).providers;
const runtimeRegistry = JSON.parse(
  await readFile(
    join(projectRoot, ".fullstack-forge", "manifests", "upstream-registry.json"),
    "utf8"
  )
);
for (const provider of providers) {
  const directory = providerDirectory(provider.id);
  const record = await readProviderRecord(provider.id);
  const license = await requiredText(join(directory, "LICENSE"), `${provider.id} LICENSE`);
  const notice = await requiredText(join(directory, "NOTICE"), `${provider.id} NOTICE`);
  const source = await requiredText(join(directory, "SOURCE.md"), `${provider.id} SOURCE.md`);
  if (record.license !== provider.license)
    rejected.push({
      path: `${provider.id}/UPSTREAM.json`,
      license: `${record.license} (expected ${provider.license})`
    });
  if (record.copyright !== provider.copyright)
    rejected.push({
      path: `${provider.id}/UPSTREAM.json`,
      license: `copyright '${record.copyright}' does not match '${provider.copyright}'`
    });
  if (
    JSON.stringify(record.copyrightEvidence) !== JSON.stringify(provider.copyrightEvidence) ||
    JSON.stringify(record.noticeEvidence) !== JSON.stringify([...provider.noticeEvidence].sort())
  )
    rejected.push({
      path: `${provider.id}/UPSTREAM.json`,
      license: "attribution evidence does not match the reviewed provider declaration"
    });
  const licenseMarker =
    provider.license === "MIT"
      ? /\bMIT (?:License|PERMISSION NOTICE)\b[\s\S]*\bPermission is hereby granted\b/iu
      : /\bApache License\b[\s\S]*\bVersion 2\.0\b/iu;
  if (!licenseMarker.test(license))
    rejected.push({
      path: `${provider.id}/LICENSE`,
      license: `does not contain the declared ${provider.license} terms`
    });
  for (const [name, text] of [
    ["NOTICE", notice],
    ["SOURCE.md", source]
  ]) {
    const expected = provider.copyright ?? "No explicit upstream copyright notice was published";
    if (!text.includes(expected))
      rejected.push({
        path: `${provider.id}/${name}`,
        license: `missing expected attribution statement '${expected}'`
      });
  }

  const [evidencePath] = provider.licenseEvidence.split("#");
  if (evidencePath !== undefined) {
    const evidence = await requiredText(
      join(directory, CONTENT_DIRNAME, ...evidencePath.split("/")),
      `${provider.id} licence evidence`
    );
    if (provider.licenseEvidence.includes("#")) {
      if (
        !new RegExp(
          `^#{1,6}\\s*Licen[cs]e\\s*$[\\s\\S]{0,400}\\b${provider.license.replaceAll(".", "\\.")}\\b`,
          "imu"
        ).test(evidence)
      )
        rejected.push({
          path: `${provider.id}/${provider.licenseEvidence}`,
          license: `README evidence does not declare ${provider.license}`
        });
    } else {
      const generated = await readFile(join(directory, "LICENSE"));
      const authoritative = await readFile(
        join(directory, CONTENT_DIRNAME, ...evidencePath.split("/"))
      );
      if (!generated.equals(authoritative))
        rejected.push({
          path: `${provider.id}/LICENSE`,
          license: `does not match authoritative selected ${evidencePath} bytes`
        });
    }
  }
  if (provider.copyrightEvidence !== null) {
    const evidence = await requiredText(
      join(directory, CONTENT_DIRNAME, ...provider.copyrightEvidence.path.split("/")),
      `${provider.id} copyright evidence`
    );
    if (!evidence.includes(provider.copyrightEvidence.text))
      rejected.push({
        path: `${provider.id}/${provider.copyrightEvidence.path}`,
        license: `attribution '${provider.copyright}' is absent from authoritative source evidence`
      });
  }
  for (const noticePath of provider.noticeEvidence) {
    const runtimeNotice = runtimeRegistry.providers
      .find((entry) => entry.id === provider.id)
      ?.runtimeNotices?.find((entry) => entry.sourcePath === noticePath);
    if (runtimeNotice === undefined) {
      rejected.push({
        path: `${provider.id}/${noticePath}`,
        license: "runtime registry has no verbatim NOTICE mapping"
      });
      continue;
    }
    const authoritative = await readFile(
      join(directory, CONTENT_DIRNAME, ...noticePath.split("/"))
    );
    const shipped = await readFile(
      join(
        projectRoot,
        ".fullstack-forge",
        "upstream",
        provider.id,
        ...runtimeNotice.runtimePath.split("/")
      )
    );
    if (!shipped.equals(authoritative))
      rejected.push({
        path: `${provider.id}/${runtimeNotice.runtimePath}`,
        license: "shipped NOTICE bytes differ from authoritative selected source"
      });
    const digest = createHash("sha256").update(shipped).digest("hex");
    if (digest !== runtimeNotice.sha256)
      rejected.push({
        path: `${provider.id}/${runtimeNotice.runtimePath}`,
        license: "runtime NOTICE checksum differs from the registry"
      });
  }
}
if (rejected.length > 0) {
  console.error(JSON.stringify({ valid: false, rejected }, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        valid: true,
        dependencies,
        vendored_providers: providers.length,
        allowed_licenses: [...allowed].sort()
      },
      null,
      2
    )
  );
}

async function requiredText(path, label) {
  try {
    const text = await readFile(path, "utf8");
    if (text.trim().length === 0) throw new Error("empty file");
    return text;
  } catch (error) {
    rejected.push({ path: label, license: `MISSING (${error.message})` });
    return "";
  }
}
