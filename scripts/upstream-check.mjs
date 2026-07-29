// Maintainer-only: asks each upstream repository whether a newer stable version exists.
// Makes no change of any kind. A network failure is reported and exits 0, so ordinary Forge
// development, CI, and installation never depend on reaching GitHub.

import { readProviderConfig } from "./lib/upstream.mjs";

const config = await readProviderConfig();
const timeoutMs = Number(process.env.FORGE_UPSTREAM_CHECK_TIMEOUT_MS ?? 10000);
let unreachable = 0;
let behind = 0;

for (const provider of config.providers) {
  const line = `${provider.id.padEnd(22)}`;
  try {
    const releases = await fetchJson(
      `https://api.github.com/repos/${provider.repository}/releases?per_page=10`
    );
    const head = await fetchJson(
      `https://api.github.com/repos/${provider.repository}/commits/HEAD`
    );
    const stable = Array.isArray(releases)
      ? releases.filter((release) => release.prerelease === false && release.draft === false)
      : [];
    const latest = stable[0]?.tag_name ?? null;
    const headSha = typeof head?.sha === "string" ? head.sha : null;

    if (latest !== null && latest !== provider.upstreamTag) {
      behind += 1;
      console.log(
        `${line} newer stable release available: ${latest} (pinned ${provider.upstreamTag ?? "none"})`
      );
    } else if (
      provider.upstreamTag === null &&
      headSha !== null &&
      headSha !== provider.upstreamCommit
    ) {
      behind += 1;
      console.log(`${line} default branch moved: ${headSha} (pinned ${provider.upstreamCommit})`);
    } else {
      console.log(`${line} up to date at ${provider.upstreamTag ?? provider.upstreamCommit}`);
    }
  } catch (error) {
    unreachable += 1;
    console.log(`${line} not checked (${error.message})`);
  }
}

console.log(
  `\n${behind} provider(s) have a newer candidate; ${unreachable} could not be checked.\n` +
    "Nothing was changed. Use `node scripts/upstream-diff.mjs` to review a candidate, then\n" +
    "`node scripts/upstream-update.mjs <provider> <tag-or-sha>` to import it deliberately."
);

async function fetchJson(url) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "fullstack-forge-skill" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
