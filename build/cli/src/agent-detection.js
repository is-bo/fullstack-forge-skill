import { constants } from "node:fs";
import { access, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";
import { PLATFORM_CONFIG } from "./constants.js";
import { canonicalDirectory, resolveInside } from "./utils.js";
const AGENT_SIGNALS = [
    {
        selector: "codex",
        platform: "agents",
        projectMarkers: [".agents"],
        userMarkers: [".codex", ".agents"],
        executableHints: ["codex"]
    },
    {
        selector: "claude",
        platform: "claude",
        projectMarkers: [".claude"],
        userMarkers: [".claude"],
        executableHints: ["claude"]
    },
    {
        selector: "cursor",
        platform: "cursor",
        projectMarkers: [".cursor"],
        userMarkers: [".cursor"],
        executableHints: ["cursor"]
    },
    {
        selector: "gemini",
        platform: "gemini",
        projectMarkers: [".gemini"],
        userMarkers: [".gemini"],
        executableHints: ["gemini"]
    },
    {
        selector: "antigravity",
        platform: "antigravity",
        projectMarkers: [],
        userMarkers: [".gemini/config"],
        executableHints: ["antigravity"]
    },
    {
        selector: "github",
        platform: "github",
        projectMarkers: [".github/copilot-instructions.md", ".github/instructions"],
        userMarkers: [".copilot"],
        executableHints: []
    },
    {
        selector: "windsurf",
        platform: "windsurf",
        projectMarkers: [".windsurf"],
        userMarkers: [".codeium/windsurf"],
        executableHints: ["windsurf"]
    }
];
/**
 * Recommends selectors from finite, read-only configuration markers.
 *
 * A marker proves only that compatible configuration exists; it does not prove that an agent
 * application is installed, running, or able to render the skill. The installer therefore keeps
 * `all` as its compatibility default and presents these results as recommendations.
 */
export async function detectAgentRecommendations(projectRootInput, userRootInput = homedir(), pathInput = process.env.PATH ?? "") {
    const projectRoot = await canonicalDirectory(projectRootInput);
    const userRoot = await canonicalDirectory(userRootInput);
    const executableHints = await detectExecutableHints(pathInput);
    const recommendations = [];
    for (const signal of AGENT_SIGNALS) {
        const evidence = [];
        for (const marker of signal.projectMarkers)
            if (await markerExists(projectRoot, marker))
                evidence.push(`project:${marker}`);
        for (const marker of signal.userMarkers)
            if ((projectRoot !== userRoot || !signal.projectMarkers.includes(marker)) &&
                (await markerExists(userRoot, marker)))
                evidence.push(`user:${marker}`);
        for (const executable of signal.executableHints)
            if (executableHints.has(executable))
                evidence.push(`path:${executable}`);
        if (evidence.length === 0)
            continue;
        recommendations.push({
            selector: signal.selector,
            platform: signal.platform,
            label: PLATFORM_CONFIG[signal.platform].label,
            evidence
        });
    }
    return recommendations;
}
async function detectExecutableHints(pathInput) {
    const found = new Set();
    const requested = new Set(AGENT_SIGNALS.flatMap((signal) => signal.executableHints));
    const suffixes = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
    const directories = pathInput
        .split(delimiter)
        .map((entry) => entry.trim().replace(/^"(.*)"$/u, "$1"))
        .filter((entry) => entry.length > 0 && isAbsolute(entry));
    for (const executable of requested) {
        for (const directory of directories) {
            if (await any(suffixes.map(async (suffix) => {
                const candidate = join(directory, `${executable}${suffix}`);
                try {
                    const info = await lstat(candidate);
                    if (!info.isFile() && !info.isSymbolicLink())
                        return false;
                    await access(candidate, constants.X_OK);
                    return true;
                }
                catch {
                    return false;
                }
            }))) {
                found.add(executable);
                break;
            }
        }
    }
    return found;
}
async function any(values) {
    return (await Promise.all(values)).some(Boolean);
}
async function markerExists(root, relative) {
    const path = resolveInside(root, relative);
    try {
        return !(await lstat(path)).isSymbolicLink();
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false;
        throw error;
    }
}
//# sourceMappingURL=agent-detection.js.map