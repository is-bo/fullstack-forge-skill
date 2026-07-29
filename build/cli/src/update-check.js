import { VERSION } from "./constants.js";
import { redactToString } from "./redaction.js";
import { runFile } from "./utils.js";
export const UPSTREAM_GIT_URL = "https://github.com/is-bo/fullstack-forge-skill.git";
const RELEASE_ARCHIVE_ROOT = "https://codeload.github.com/is-bo/fullstack-forge-skill/tar.gz/refs/tags";
/** Parses only stable, canonical vMAJOR.MINOR.PATCH refs from untrusted `git ls-remote` output. */
export function parseReleaseTags(output) {
    const versions = new Map();
    for (const line of output.split(/\r?\n/u)) {
        const match = /^[a-f0-9]{40,64}\s+refs\/tags\/v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/u.exec(line.trim());
        if (match?.[1] === undefined)
            continue;
        const parsed = parseVersion(match[1]);
        if (parsed !== undefined)
            versions.set(parsed.text, parsed);
    }
    return [...versions.values()].sort(compareVersions).map((version) => version.text);
}
/** Returns the public, immutable source archive for a stable released version. */
export function publicReleaseArchive(version) {
    if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(version))
        throw new Error(`Release archive version must be stable semantic version: ${version}`);
    return `${RELEASE_ARCHIVE_ROOT}/v${encodeURIComponent(version)}`;
}
export async function checkUpdateAvailability(root, offline, currentVersion = VERSION, runner = runFile) {
    if (offline)
        return {
            status: "WARNING",
            evidence: "not checked because --offline forbids the remote tag lookup",
            unavailable: true
        };
    const result = await runner("git", ["ls-remote", "--tags", "--refs", UPSTREAM_GIT_URL, "refs/tags/v*"], root, 10_000);
    if (result.exitCode !== 0)
        return {
            status: "WARNING",
            evidence: `remote tag lookup unavailable (${boundedDiagnostic(result.stderr || result.stdout)})`,
            unavailable: true
        };
    const tags = parseReleaseTags(result.stdout);
    const current = parseVersion(currentVersion);
    const latestText = tags.at(-1);
    const latest = latestText === undefined ? undefined : parseVersion(latestText);
    if (current === undefined || latest === undefined)
        return {
            status: "WARNING",
            evidence: current === undefined
                ? `running version '${boundedDiagnostic(currentVersion)}' is not stable semver`
                : "the upstream response contained no stable release tags",
            unavailable: true
        };
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
function parseVersion(value) {
    const match = /^((?:0|[1-9]\d*))\.((?:0|[1-9]\d*))\.((?:0|[1-9]\d*))$/u.exec(value);
    if (match === null)
        return undefined;
    const parts = match.slice(1).map((part) => Number.parseInt(part, 10));
    if (parts.some((part) => !Number.isSafeInteger(part)))
        return undefined;
    const [major, minor, patch] = parts;
    if (major === undefined || minor === undefined || patch === undefined)
        return undefined;
    return { text: `${major}.${minor}.${patch}`, major, minor, patch };
}
function compareVersions(left, right) {
    return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}
function boundedDiagnostic(value) {
    const safe = redactToString(value)
        .replace(/\p{Cc}+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 200);
    return safe.length === 0 ? "no diagnostic output" : safe;
}
