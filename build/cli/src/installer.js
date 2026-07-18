import { homedir } from "node:os";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { PACKAGE_ROOT, PLATFORM_CONFIG, PLATFORMS, VERSION } from "./constants.js";
import { assertNoSymlinkPath, assertSafeRelative, canonicalDirectory, isInside, readTextIfPresent, resolveInside, sha256, toPosix, utcNow, walkFiles } from "./utils.js";
const MANIFEST_RELATIVE = ".fullstack-forge/install-manifest.json";
export function normalizePlatforms(selector) {
    const normalized = selector.toLowerCase();
    if (normalized === "all")
        return [...PLATFORMS];
    const aliases = {
        agents: "agents",
        antigravity: "agents",
        generic: "agents",
        codex: "agents",
        claude: "claude",
        cursor: "cursor",
        gemini: "gemini",
        github: "github",
        copilot: "github",
        windsurf: "windsurf"
    };
    const platform = aliases[normalized];
    if (platform === undefined) {
        throw new Error(`Unknown platform '${selector}'. Expected claude, codex, antigravity, gemini, cursor, windsurf, github, generic, agents, or all.`);
    }
    return [platform];
}
export async function install(rootInput, selector, options) {
    const root = options.global
        ? await canonicalDirectory(homedir())
        : await canonicalDirectory(rootInput);
    const platforms = normalizePlatforms(selector);
    const previous = await readManifest(root);
    const planned = [];
    for (const platform of platforms) {
        const config = PLATFORM_CONFIG[platform];
        const sourceRoot = join(PACKAGE_ROOT, ...config.projectPath);
        const targetParts = options.global ? config.globalPath : config.projectPath;
        const targetRoot = resolve(root, ...targetParts);
        if (!isInside(root, targetRoot))
            throw new Error(`Platform destination escapes install root: ${targetRoot}`);
        await assertNoSymlinkPath(root, targetRoot);
        const sourceFiles = (await walkFiles(sourceRoot)).filter((path) => !path.endsWith(".fullstack-forge-generated.json"));
        if (sourceFiles.length === 0)
            throw new Error(`Bundled platform assets are missing for ${platform}`);
        for (const source of sourceFiles) {
            const sourceRelative = toPosix(relative(sourceRoot, source));
            assertSafeRelative(sourceRelative);
            const target = resolveInside(targetRoot, sourceRelative);
            await assertNoSymlinkPath(root, target);
            const manifestRelative = toPosix(relative(root, target));
            assertSafeRelative(manifestRelative);
            const bytes = await readFile(source);
            const hash = sha256(bytes);
            const oldRecord = previous.files[manifestRelative];
            let existingHash;
            try {
                existingHash = sha256(await readFile(target));
            }
            catch (error) {
                if (error.code !== "ENOENT")
                    throw error;
            }
            if (oldRecord !== undefined) {
                if (oldRecord.platform !== platform)
                    throw new Error(`Ownership platform mismatch for ${manifestRelative}`);
                if (oldRecord.owned &&
                    existingHash !== undefined &&
                    existingHash !== oldRecord.hash &&
                    existingHash !== hash) {
                    throw new Error(`Refusing to overwrite a modified owned file: ${manifestRelative}`);
                }
                if (!oldRecord.owned && existingHash !== hash) {
                    throw new Error(`Refusing to update a pre-existing unowned file: ${manifestRelative}`);
                }
            }
            else if (existingHash !== undefined && existingHash !== hash) {
                throw new Error(`Refusing to overwrite an unowned file: ${manifestRelative}`);
            }
            const owned = oldRecord?.owned ?? existingHash === undefined;
            const action = existingHash === undefined
                ? "create"
                : existingHash === hash
                    ? "preserve-identical"
                    : "update";
            planned.push({
                action: { action, path: manifestRelative, platform },
                source,
                target,
                bytes,
                record: { hash, platform, owned }
            });
        }
    }
    if (options.dryRun)
        return planned.map((item) => item.action);
    const next = {
        schemaVersion: 1,
        packageVersion: VERSION,
        root,
        installedAt: utcNow(),
        files: { ...previous.files }
    };
    for (const item of planned) {
        if (item.action.action === "create" || item.action.action === "update") {
            await mkdir(dirname(item.target), { recursive: true });
            await writeFile(item.target, item.bytes);
        }
        next.files[item.action.path] = item.record;
    }
    await writeManifest(root, next);
    return planned.map((item) => item.action);
}
export async function uninstall(rootInput, selector, options) {
    const root = options.global
        ? await canonicalDirectory(homedir())
        : await canonicalDirectory(rootInput);
    const selected = new Set(normalizePlatforms(selector));
    const manifest = await readManifest(root, true);
    const actions = [];
    const remaining = { ...manifest.files };
    for (const [rel, record] of Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))) {
        if (!selected.has(record.platform))
            continue;
        assertSafeRelative(rel);
        const target = resolveInside(root, rel);
        await assertNoSymlinkPath(root, target);
        let currentHash;
        try {
            currentHash = sha256(await readFile(target));
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
        if (!record.owned || currentHash === undefined) {
            delete remaining[rel];
            continue;
        }
        if (currentHash !== record.hash) {
            actions.push({
                action: "preserve-modified",
                path: rel,
                platform: record.platform
            });
            continue;
        }
        actions.push({ action: "remove", path: rel, platform: record.platform });
        if (!options.dryRun) {
            await unlink(target);
            delete remaining[rel];
        }
    }
    if (!options.dryRun) {
        if (Object.keys(remaining).length === 0) {
            try {
                await unlink(resolveInside(root, MANIFEST_RELATIVE));
            }
            catch (error) {
                if (error.code !== "ENOENT")
                    throw error;
            }
        }
        else {
            await writeManifest(root, { ...manifest, files: remaining, installedAt: utcNow() });
        }
    }
    return actions;
}
export async function readInstallManifest(rootInput) {
    const root = await canonicalDirectory(rootInput);
    try {
        return await readManifest(root, true);
    }
    catch (error) {
        if (error.message.includes("No Fullstack Forge ownership manifest"))
            return undefined;
        throw error;
    }
}
async function readManifest(root, required = false) {
    const path = resolveInside(root, MANIFEST_RELATIVE);
    const text = await readTextIfPresent(path);
    if (text === undefined) {
        if (required)
            throw new Error(`No Fullstack Forge ownership manifest at ${path}`);
        return { schemaVersion: 1, packageVersion: VERSION, root, installedAt: utcNow(), files: {} };
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error(`Invalid Fullstack Forge ownership manifest at ${path}`);
    }
    if (!isRecord(parsed) ||
        parsed.schemaVersion !== 1 ||
        parsed.root !== root ||
        typeof parsed.packageVersion !== "string" ||
        typeof parsed.installedAt !== "string" ||
        !isRecord(parsed.files)) {
        throw new Error(`Unsafe or unsupported ownership manifest at ${path}`);
    }
    const files = {};
    for (const [rel, record] of Object.entries(parsed.files)) {
        assertSafeRelative(rel);
        if (!isRecord(record) ||
            typeof record.platform !== "string" ||
            !PLATFORMS.includes(record.platform) ||
            typeof record.hash !== "string" ||
            !/^[a-f0-9]{64}$/u.test(record.hash) ||
            typeof record.owned !== "boolean") {
            throw new Error(`Invalid ownership record for ${rel}`);
        }
        files[rel] = { platform: record.platform, hash: record.hash, owned: record.owned };
    }
    return {
        schemaVersion: 1,
        packageVersion: parsed.packageVersion,
        root,
        installedAt: parsed.installedAt,
        files
    };
}
async function writeManifest(root, manifest) {
    const path = resolveInside(root, MANIFEST_RELATIVE);
    await assertNoSymlinkPath(root, path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=installer.js.map