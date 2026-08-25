import assert from "node:assert/strict";
import test from "node:test";
import { RELEASES_API_URL, checkUpdateAvailability, parseReleaseChannel, publicReleaseArchive } from "../src/update-check.js";
const platformIds = [
    "all",
    "antigravity",
    "claude",
    "codex",
    "cursor",
    "gemini",
    "generic",
    "github",
    "windsurf"
];
function releasePayload(version, overrides = {}) {
    const tag = `v${version}`;
    const names = [
        ...platformIds.map((platform) => `fullstack-forge-${platform}-${tag}.zip`),
        "SHA256SUMS.txt",
        "manifest.json",
        ...(version === "0.2.2"
            ? []
            : [`fullstack-forge-skill-${tag}.tgz`, `fullstack-forge-skill-${tag}.spdx.json`])
    ];
    return {
        tag_name: tag,
        draft: false,
        prerelease: false,
        immutable: true,
        published_at: "2026-08-10T12:00:00Z",
        assets: names.map((name) => ({
            name,
            state: "uploaded",
            size: 1024,
            browser_download_url: `https://github.com/is-bo/fullstack-forge-skill/releases/download/${tag}/${name}`
        })),
        ...overrides
    };
}
function readerFor(payload, statusCode = 200) {
    return () => Promise.resolve({ statusCode, body: JSON.stringify(payload) });
}
test("release-channel parsing accepts immutable legacy and modern published releases", () => {
    assert.equal(parseReleaseChannel(JSON.stringify(releasePayload("0.2.2"))).version, "0.2.2");
    const modern = parseReleaseChannel(JSON.stringify(releasePayload("1.3.0")));
    assert.equal(modern.version, "1.3.0");
    assert.equal(modern.packageArtifact, "fullstack-forge-skill-v1.3.0.tgz");
    assert.equal(modern.sbomArtifact, "fullstack-forge-skill-v1.3.0.spdx.json");
});
test("release-channel parsing rejects drafts, prereleases, and mutable releases", () => {
    assert.throws(() => parseReleaseChannel(JSON.stringify(releasePayload("1.3.0", { draft: true }))), /draft/u);
    assert.throws(() => parseReleaseChannel(JSON.stringify(releasePayload("1.3.0", { prerelease: true }))), /prerelease/u);
    assert.throws(() => parseReleaseChannel(JSON.stringify(releasePayload("1.3.0", { immutable: false }))), /immutable/u);
});
test("release-channel parsing rejects malformed, incomplete, duplicate, and misdirected assets", () => {
    assert.throws(() => parseReleaseChannel("not-json"), /valid JSON/u);
    assert.throws(() => parseReleaseChannel(JSON.stringify(releasePayload("1.3.0", { assets: [] }))), /required release asset/u);
    const duplicate = releasePayload("1.3.0");
    const duplicateAssets = duplicate.assets;
    duplicate.assets = [...duplicateAssets, { ...duplicateAssets[0] }];
    assert.throws(() => parseReleaseChannel(JSON.stringify(duplicate)), /duplicate/u);
    const wrongHost = releasePayload("1.3.0");
    const wrongHostAssets = wrongHost.assets;
    wrongHostAssets[0] = {
        ...wrongHostAssets[0],
        browser_download_url: "https://example.invalid/forged.zip"
    };
    assert.throws(() => parseReleaseChannel(JSON.stringify(wrongHost)), /download URL/u);
    const incomplete = releasePayload("1.3.0");
    incomplete.assets = incomplete.assets.filter((asset) => asset.name !== "fullstack-forge-skill-v1.3.0.spdx.json");
    assert.throws(() => parseReleaseChannel(JSON.stringify(incomplete)), /SBOM/u);
});
test("published release installation uses the exact modern package artifact", () => {
    const modern = new URL(publicReleaseArchive("1.3.0"));
    assert.equal(modern.protocol, "https:");
    assert.equal(modern.hostname, "github.com");
    assert.equal(modern.username, "");
    assert.equal(modern.password, "");
    assert.equal(modern.pathname, "/is-bo/fullstack-forge-skill/releases/download/v1.3.0/fullstack-forge-skill-v1.3.0.tgz");
    const legacy = new URL(publicReleaseArchive("0.2.2"));
    assert.equal(legacy.hostname, "codeload.github.com");
    assert.equal(legacy.pathname, "/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v0.2.2");
    assert.throws(() => publicReleaseArchive("v1.3.0"), /stable semantic version/u);
    assert.throws(() => publicReleaseArchive("main"), /stable semantic version/u);
});
test("update lookup uses the fixed GitHub Releases channel and reports a newer release", async () => {
    const calls = [];
    const result = await checkUpdateAvailability("/project", false, "1.2.0", (request) => {
        calls.push(request);
        return Promise.resolve({ statusCode: 200, body: JSON.stringify(releasePayload("1.3.0")) });
    });
    assert.deepEqual(calls, [
        { url: RELEASES_API_URL, root: "/project", timeoutMs: 10_000, maxBytes: 512 * 1024 }
    ]);
    assert.deepEqual(result, {
        status: "WARNING",
        evidence: "v1.3.0 is available; v1.2.0 is running",
        latestVersion: "1.3.0"
    });
});
test("offline, unavailable, and malformed release checks stay warnings rather than passes", async () => {
    let invoked = false;
    const offline = await checkUpdateAvailability("/project", true, "0.4.0", () => {
        invoked = true;
        return Promise.resolve({ statusCode: 200, body: "{}" });
    });
    assert.equal(invoked, false);
    assert.equal(offline.status, "WARNING");
    assert.equal(offline.unavailable, true);
    const failed = await checkUpdateAvailability("/project", false, "0.4.0", readerFor({ api_key: "FixtureCredentialValue12345678901234567890" }, 503));
    assert.equal(failed.status, "WARNING");
    assert.equal(failed.unavailable, true);
    assert.doesNotMatch(failed.evidence, /FixtureCredentialValue/u);
    const malformed = await checkUpdateAvailability("/project", false, "0.4.0", readerFor(releasePayload("1.3.0", { draft: true })));
    assert.equal(malformed.status, "WARNING");
    assert.equal(malformed.unavailable, true);
    assert.equal(malformed.latestVersion, undefined);
});
test("current and development-ahead versions are distinguished", async () => {
    const reader = readerFor(releasePayload("0.4.0"));
    assert.equal((await checkUpdateAvailability("/project", false, "0.4.0", reader)).status, "PASS");
    assert.match((await checkUpdateAvailability("/project", false, "1.3.0", reader)).evidence, /newer than the latest public release/u);
});
