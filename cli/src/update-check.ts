import { get } from "node:https";
import { VERSION } from "./constants.js";
import { redactToString } from "./redaction.js";

export const RELEASES_API_URL =
  "https://api.github.com/repos/is-bo/fullstack-forge-skill/releases/latest";
const LEGACY_RELEASE_ARCHIVE_ROOT =
  "https://codeload.github.com/is-bo/fullstack-forge-skill/tar.gz/refs/tags";
const RELEASE_DOWNLOAD_ROOT = "https://github.com/is-bo/fullstack-forge-skill/releases/download";
const RELEASE_LOOKUP_TIMEOUT_MS = 10_000;
const RELEASE_LOOKUP_MAX_BYTES = 512 * 1024;
const MODERN_RELEASE_BUNDLE_MINIMUM = "0.2.3";
const PLATFORM_ASSET_IDS = [
  "all",
  "antigravity",
  "claude",
  "codex",
  "cursor",
  "gemini",
  "generic",
  "github",
  "windsurf"
] as const;

type Version = {
  text: string;
  major: number;
  minor: number;
  patch: number;
};

export type UpdateAvailability = {
  status: "PASS" | "WARNING";
  evidence: string;
  latestVersion?: string;
  unavailable?: boolean;
};

export type ReleaseChannelRequest = {
  url: string;
  root: string;
  timeoutMs: number;
  maxBytes: number;
};

export type ReleaseChannelResponse = {
  statusCode: number;
  body: string;
};

export type ReleaseChannelReader = (
  request: ReleaseChannelRequest
) => Promise<ReleaseChannelResponse>;

export type ReleaseChannel = {
  version: string;
  tag: string;
  assetNames: string[];
  packageArtifact?: string;
  sbomArtifact?: string;
};

/**
 * Parses the public GitHub Releases channel. The response is an untrusted network boundary: only
 * immutable, stable releases with the complete expected asset set can become update candidates.
 */
export function parseReleaseChannel(payload: string): ReleaseChannel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new Error("GitHub Release channel did not return valid JSON");
  }
  if (!isRecord(parsed)) throw new Error("GitHub Release channel returned an invalid object");
  if (parsed.draft !== false) throw new Error("GitHub Release channel returned a draft release");
  if (parsed.prerelease !== false) throw new Error("GitHub Release channel returned a prerelease");
  if (parsed.immutable !== true)
    throw new Error("GitHub Release channel returned a release that is not immutable");
  if (
    typeof parsed.published_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(parsed.published_at) ||
    !Number.isFinite(Date.parse(parsed.published_at))
  )
    throw new Error("GitHub Release channel returned an invalid publication timestamp");
  if (typeof parsed.tag_name !== "string" || !parsed.tag_name.startsWith("v"))
    throw new Error("GitHub Release channel returned an invalid stable tag");
  const version = parseVersion(parsed.tag_name.slice(1));
  if (version === undefined || parsed.tag_name !== `v${version.text}`)
    throw new Error("GitHub Release channel returned an invalid stable tag");
  if (!Array.isArray(parsed.assets))
    throw new Error("GitHub Release channel returned an invalid asset list");

  const assetNames = new Set<string>();
  for (const [index, asset] of parsed.assets.entries()) {
    if (
      !isRecord(asset) ||
      typeof asset.name !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u.test(asset.name) ||
      asset.state !== "uploaded" ||
      typeof asset.size !== "number" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      typeof asset.browser_download_url !== "string"
    )
      throw new Error(`GitHub Release channel returned an invalid asset at index ${index}`);
    if (assetNames.has(asset.name))
      throw new Error(`GitHub Release channel returned a duplicate asset at index ${index}`);
    assertReleaseAssetUrl(asset.browser_download_url, parsed.tag_name, asset.name, index);
    assetNames.add(asset.name);
  }

  for (const required of requiredPlatformAssets(version.text))
    if (!assetNames.has(required))
      throw new Error("GitHub Release channel is missing a required release asset");

  const packageArtifact = `fullstack-forge-skill-v${version.text}.tgz`;
  const sbomArtifact = `fullstack-forge-skill-v${version.text}.spdx.json`;
  const modern = compareVersions(version, requiredVersion(MODERN_RELEASE_BUNDLE_MINIMUM)) >= 0;
  if (modern && !assetNames.has(packageArtifact))
    throw new Error("GitHub Release channel is missing the exact npm package artifact");
  if (modern && !assetNames.has(sbomArtifact))
    throw new Error("GitHub Release channel is missing the release SBOM asset");

  return {
    version: version.text,
    tag: parsed.tag_name,
    assetNames: [...assetNames].sort(),
    ...(modern ? { packageArtifact, sbomArtifact } : {})
  };
}

/** Returns the credential-free installation artifact for one immutable published release. */
export function publicReleaseArchive(versionText: string): string {
  const version = parseVersion(versionText);
  if (version === undefined || version.text !== versionText)
    throw new Error(`Release archive version must be stable semantic version: ${versionText}`);
  if (compareVersions(version, requiredVersion(MODERN_RELEASE_BUNDLE_MINIMUM)) < 0)
    return `${LEGACY_RELEASE_ARCHIVE_ROOT}/v${encodeURIComponent(version.text)}`;
  const tag = `v${version.text}`;
  return `${RELEASE_DOWNLOAD_ROOT}/${tag}/fullstack-forge-skill-${tag}.tgz`;
}

export async function checkUpdateAvailability(
  root: string,
  offline: boolean,
  currentVersion = VERSION,
  reader: ReleaseChannelReader = readPublicReleaseChannel
): Promise<UpdateAvailability> {
  if (offline)
    return {
      status: "WARNING",
      evidence: "not checked because --offline forbids the remote release lookup",
      unavailable: true
    };

  const current = parseVersion(currentVersion);
  if (current === undefined)
    return {
      status: "WARNING",
      evidence: `running version '${boundedDiagnostic(currentVersion)}' is not stable semver`,
      unavailable: true
    };

  let response: ReleaseChannelResponse;
  try {
    response = await reader({
      url: RELEASES_API_URL,
      root,
      timeoutMs: RELEASE_LOOKUP_TIMEOUT_MS,
      maxBytes: RELEASE_LOOKUP_MAX_BYTES
    });
  } catch (error) {
    return {
      status: "WARNING",
      evidence: `remote release lookup unavailable (${boundedDiagnostic(errorMessage(error))})`,
      unavailable: true
    };
  }
  if (response.statusCode !== 200)
    return {
      status: "WARNING",
      evidence: `remote release lookup unavailable (HTTP ${response.statusCode})`,
      unavailable: true
    };

  let channel: ReleaseChannel;
  try {
    channel = parseReleaseChannel(response.body);
  } catch (error) {
    return {
      status: "WARNING",
      evidence: `remote release channel invalid (${boundedDiagnostic(errorMessage(error))})`,
      unavailable: true
    };
  }
  const latest = requiredVersion(channel.version);
  if (compareVersions(current, latest) < 0)
    return {
      status: "WARNING",
      evidence: `v${latest.text} is available; v${current.text} is running`,
      latestVersion: latest.text
    };
  if (compareVersions(current, latest) > 0)
    return {
      status: "PASS",
      evidence: `v${current.text} is newer than the latest public release v${latest.text}`,
      latestVersion: latest.text
    };
  return {
    status: "PASS",
    evidence: `v${current.text} is the latest public release`,
    latestVersion: latest.text
  };
}

function requiredPlatformAssets(version: string): string[] {
  const tag = `v${version}`;
  return [
    ...PLATFORM_ASSET_IDS.map((platform) => `fullstack-forge-${platform}-${tag}.zip`),
    "SHA256SUMS.txt",
    "manifest.json"
  ];
}

function assertReleaseAssetUrl(urlText: string, tag: string, name: string, index: number): void {
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error(
      `GitHub Release channel returned an invalid asset download URL at index ${index}`
    );
  }
  const expectedPath = `/is-bo/fullstack-forge-skill/releases/download/${tag}/${name}`;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname !== expectedPath
  )
    throw new Error(
      `GitHub Release channel returned an invalid asset download URL at index ${index}`
    );
}

function readPublicReleaseChannel(request: ReleaseChannelRequest): Promise<ReleaseChannelResponse> {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const resolveOnce = (response: ReleaseChannelResponse): void => {
      if (settled) return;
      settled = true;
      resolvePromise(response);
    };
    const rejectOnce = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const networkRequest = get(
      request.url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `Fullstack-Forge/${VERSION}`,
          "X-GitHub-Api-Version": "2022-11-28"
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > request.maxBytes) {
            response.destroy(new Error("GitHub Release channel response exceeded the size limit"));
            return;
          }
          chunks.push(buffer);
        });
        response.once("error", rejectOnce);
        response.once("end", () =>
          resolveOnce({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8")
          })
        );
      }
    );
    networkRequest.setTimeout(request.timeoutMs, () =>
      networkRequest.destroy(new Error("GitHub Release channel request timed out"))
    );
    networkRequest.once("error", rejectOnce);
  });
}

function parseVersion(value: string): Version | undefined {
  const match = /^((?:0|[1-9]\d*))\.((?:0|[1-9]\d*))\.((?:0|[1-9]\d*))$/u.exec(value);
  if (match === null) return undefined;
  const parts = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isSafeInteger(part))) return undefined;
  const [major, minor, patch] = parts;
  if (major === undefined || minor === undefined || patch === undefined) return undefined;
  return { text: `${major}.${minor}.${patch}`, major, minor, patch };
}

function requiredVersion(value: string): Version {
  const version = parseVersion(value);
  if (version === undefined) throw new Error("Internal release-channel version policy is invalid");
  return version;
}

function compareVersions(left: Version, right: Version): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function boundedDiagnostic(value: string): string {
  const safe = redactToString(value)
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 200);
  return safe.length === 0 ? "no diagnostic output" : safe;
}
