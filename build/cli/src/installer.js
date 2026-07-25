import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { PACKAGE_ROOT, PLATFORM_ALIASES, PLATFORM_CONFIG, PLATFORMS, VERSION } from "./constants.js";
import { assertNoSymlinkPath, assertSafeRelative, canonicalDirectory, isInside, readTextIfPresent, resolveInside, sha256, toPosix, utcNow, walkFiles } from "./utils.js";
const MANIFEST_RELATIVE = ".fullstack-forge/install-manifest.json";
export function normalizePlatforms(selector) {
    return normalizePlatformsForScope(selector, false);
}
function normalizePlatformsForScope(selector, global) {
    const normalized = selector.toLowerCase();
    if (normalized === "all")
        return global ? [...PLATFORMS] : PLATFORMS.filter((platform) => platform !== "antigravity");
    const selectors = {
        agents: "agents",
        ...PLATFORM_ALIASES,
        antigravity: global ? "antigravity" : "agents",
        claude: "claude",
        cursor: "cursor",
        gemini: "gemini",
        github: "github",
        copilot: "github",
        windsurf: "windsurf"
    };
    const platform = selectors[normalized];
    if (platform === undefined) {
        throw new Error(`Unknown platform '${selector}'. Expected claude, codex, antigravity, gemini, cursor, windsurf, github, generic, agents, or all.`);
    }
    return [platform];
}
export async function install(rootInput, selector, options) {
    if (options.interruptAfter !== undefined &&
        (!Number.isSafeInteger(options.interruptAfter) || options.interruptAfter < 0))
        throw new Error("Installer interruption point must be a non-negative safe integer.");
    const root = options.global
        ? await canonicalDirectory(options.home ?? homedir())
        : await canonicalDirectory(rootInput);
    const platforms = normalizePlatformsForScope(selector, options.global);
    const previous = await readManifest(root);
    const planned = [];
    for (const platform of platforms) {
        const config = PLATFORM_CONFIG[platform];
        const sourceRoot = join(PACKAGE_ROOT, ...config.sourcePath);
        const targetParts = options.global ? config.globalPath : config.projectPath;
        const targetRoot = resolve(root, ...targetParts);
        if (!isInside(root, targetRoot))
            throw new Error(`Platform destination escapes install root: ${targetRoot}`);
        await assertNoSymlinkPath(root, targetRoot);
        const sourceFiles = (await walkFiles(sourceRoot, {
            maxFiles: 5_000,
            maxTotalBytes: 256 * 1024 * 1024,
            maxDepth: 64
        })).filter((path) => !path.endsWith(".fullstack-forge-generated.json"));
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
                record: { hash, platform, owned },
                ...(existingHash === undefined ? {} : { previousHash: existingHash })
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
    // Claim every path that was absent during the complete preflight before creating any managed
    // file. If the process is interrupted after this atomic manifest write, a retry can safely
    // recreate missing owned files instead of mistaking partially installed files for pre-existing
    // unowned content. Existing and update targets retain their prior records until their bytes are
    // safely replaced, so either the old or new hash remains recoverable after a crash.
    const created = planned.filter((item) => item.action.action === "create");
    if (created.length > 0) {
        const prepared = {
            ...next,
            files: { ...next.files }
        };
        for (const item of created)
            prepared.files[item.action.path] = item.record;
        await writeManifest(root, prepared);
    }
    if (options.interruptAfter === 0)
        throw new Error("Injected installer interruption after ownership preparation.");
    let processedWrites = 0;
    for (const item of planned) {
        if (item.action.action === "create" || item.action.action === "update") {
            const currentHash = await hashIfPresent(item.target);
            const unchangedSincePreflight = currentHash === item.record.hash ||
                (item.action.action === "create"
                    ? currentHash === undefined
                    : currentHash === item.previousHash);
            if (!unchangedSincePreflight)
                throw new Error(`Refusing to overwrite a file changed after preflight: ${item.action.path}`);
            if (currentHash !== item.record.hash)
                await atomicWrite(root, item.target, item.bytes);
            processedWrites += 1;
            if (options.interruptAfter !== undefined && processedWrites >= options.interruptAfter)
                throw new Error(`Injected installer interruption after ${processedWrites} managed write(s).`);
        }
        next.files[item.action.path] = item.record;
    }
    await writeManifest(root, next);
    return planned.map((item) => item.action);
}
export async function uninstall(rootInput, selector, options) {
    const root = options.global
        ? await canonicalDirectory(options.home ?? homedir())
        : await canonicalDirectory(rootInput);
    const selected = new Set(normalizePlatformsForScope(selector, options.global));
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
    await atomicWrite(root, path, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
}
async function atomicWrite(root, target, bytes) {
    const temporary = join(dirname(target), `.fullstack-forge-${randomUUID()}.tmp`);
    await assertNoSymlinkPath(root, target);
    await assertNoSymlinkPath(root, temporary);
    await mkdir(dirname(target), { recursive: true });
    try {
        await writeFile(temporary, bytes, { flag: "wx" });
        await rename(temporary, target);
    }
    catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
}
async function hashIfPresent(path) {
    try {
        return sha256(await readFile(path));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=installer.js.map