import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { PACKAGE_ROOT, PLATFORM_ALIASES, PLATFORM_CONFIG, PLATFORMS, VERSION } from "./constants.js";
import { PROJECT_INSTRUCTIONS, extractManagedSection, removeManagedSection, upsertManagedSection } from "./automatic-activation.js";
import { CANONICAL_ROOT_POSIX, CANONICAL_ROOT_SEGMENTS, adapterPointer, extractFrontmatter, isVerbatimHostFile, renderAdapter } from "./managed-layout.js";
import { assertNoSymlinkPath, assertSafeRelative, canonicalDirectory, isInside, readTextIfPresent, resolveInside, sha256, toPosix, utcNow, walkFiles } from "./utils.js";
const MANIFEST_RELATIVE = ".fullstack-forge/install-manifest.json";
const MANIFEST_SCHEMA_VERSION = 2;
/** Bundled canonical managed content. One copy serves every installed host. */
const CANONICAL_SOURCE_ROOT = join(PACKAGE_ROOT, ...CANONICAL_ROOT_SEGMENTS);
/**
 * Managed content that is installed once alongside the canonical skills but is deliberately not
 * host-discoverable: the compiled upstream expertise and the manifests the composition engine
 * reads. These live under `.fullstack-forge/` and outside every host skills root, so no agent host
 * can find or trigger an upstream skill independently of Forge.
 */
const MANAGED_SUPPORT_ROOTS = Object.freeze([
    { source: "upstream", segments: [".fullstack-forge", "upstream"] },
    { source: "manifests", segments: [".fullstack-forge", "manifests"] }
]);
/**
 * Hosts whose skills root must also receive verbatim copies of the Codex agent metadata and its
 * icon. Codex reads `agents/openai.yaml` with ordinary tooling rather than with an agent that can
 * follow a prose pointer, and that file names `./assets/fullstack-forge-icon.png` relative to
 * itself. Every other host consumes only `SKILL.md` and therefore receives adapters alone.
 */
const VERBATIM_PLATFORMS = new Set(["agents", "antigravity"]);
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
    const requested = normalized
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const platforms = requested.map((value) => selectors[value]);
    if (requested.length === 0 || platforms.some((platform) => platform === undefined))
        throw new Error(`Unknown platform selector '${selector}'. Expected a comma-separated subset of claude, codex, antigravity, gemini, cursor, windsurf, github, generic, agents, or all.`);
    return [...new Set(platforms)];
}
/** Reads the bundled canonical tree once per invocation. */
async function readCanonicalSource() {
    const files = await walkFiles(CANONICAL_SOURCE_ROOT, {
        maxFiles: 5_000,
        maxTotalBytes: 256 * 1024 * 1024,
        maxDepth: 64
    });
    const map = new Map();
    for (const path of files) {
        const rel = toPosix(relative(CANONICAL_SOURCE_ROOT, path));
        if (rel.endsWith(".fullstack-forge-generated.json"))
            continue;
        assertSafeRelative(rel);
        map.set(rel, await readFile(path));
    }
    if (map.size === 0)
        throw new Error(`Bundled canonical managed content is missing at ${CANONICAL_SOURCE_ROOT}`);
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
/**
 * Reads one bundled managed-support tree. Missing content is a damaged package rather than an
 * optional extra: without the compiled upstream tree and the manifests, every hybrid and
 * upstream-powered module would resolve to a missing source at runtime.
 */
async function readManagedSupportSource(sourceRoot) {
    const files = await walkFiles(sourceRoot, {
        maxFiles: 20_000,
        maxTotalBytes: 256 * 1024 * 1024,
        maxDepth: 64
    });
    const map = new Map();
    for (const path of files) {
        const rel = toPosix(relative(sourceRoot, path));
        assertSafeRelative(rel);
        // Refuse to install anything a host could discover as a skill.
        if (rel.split("/").pop() === "SKILL.md")
            throw new Error(`Refusing to install a host-discoverable upstream skill file: ${rel}`);
        map.set(rel, await readFile(path));
    }
    if (map.size === 0)
        throw new Error(`Bundled managed content is missing at ${sourceRoot}`);
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
function skillNamesOf(canonical) {
    const names = new Set();
    for (const rel of canonical.keys()) {
        const parts = rel.split("/");
        if (parts.length === 2 && parts[1] === "SKILL.md" && parts[0])
            names.add(parts[0]);
    }
    return [...names].sort();
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
    const canonical = await readCanonicalSource();
    const skills = skillNamesOf(canonical);
    const planned = [];
    const plannedPaths = new Set();
    // 1. The single canonical managed copy, shared by every selected host.
    const canonicalRoot = resolve(root, ...CANONICAL_ROOT_SEGMENTS);
    if (!isInside(root, canonicalRoot))
        throw new Error(`Canonical destination escapes install root: ${canonicalRoot}`);
    await assertNoSymlinkPath(root, canonicalRoot);
    for (const [rel, bytes] of canonical) {
        const target = resolveInside(canonicalRoot, rel);
        await assertNoSymlinkPath(root, target);
        const manifestRelative = toPosix(relative(root, target));
        assertSafeRelative(manifestRelative);
        const write = await planFileWrite({
            root,
            manifestRelative,
            target,
            bytes,
            previous,
            platform: platforms[0],
            kind: "canonical",
            platforms
        });
        planned.push(write);
        plannedPaths.add(manifestRelative);
    }
    // 1b. Compiled upstream expertise and composition manifests. Installed once, never duplicated
    //     per host, and never inside a host skills root.
    for (const support of MANAGED_SUPPORT_ROOTS) {
        const sourceRoot = join(PACKAGE_ROOT, ".fullstack-forge", support.source);
        const files = await readManagedSupportSource(sourceRoot);
        const destinationRoot = resolve(root, ...support.segments);
        if (!isInside(root, destinationRoot))
            throw new Error(`Managed destination escapes install root: ${destinationRoot}`);
        await assertNoSymlinkPath(root, destinationRoot);
        for (const [rel, bytes] of files) {
            const target = resolveInside(destinationRoot, rel);
            await assertNoSymlinkPath(root, target);
            const manifestRelative = toPosix(relative(root, target));
            assertSafeRelative(manifestRelative);
            const write = await planFileWrite({
                root,
                manifestRelative,
                target,
                bytes,
                previous,
                platform: platforms[0],
                kind: "canonical",
                platforms
            });
            planned.push(write);
            plannedPaths.add(manifestRelative);
        }
    }
    // 2. Thin per-host adapters plus the documented verbatim exception.
    for (const platform of platforms) {
        const config = PLATFORM_CONFIG[platform];
        const targetParts = options.global ? config.globalPath : config.projectPath;
        const hostRootPosix = targetParts.join("/");
        const targetRoot = resolve(root, ...targetParts);
        if (!isInside(root, targetRoot))
            throw new Error(`Platform destination escapes install root: ${targetRoot}`);
        await assertNoSymlinkPath(root, targetRoot);
        const hostFiles = new Map();
        for (const skill of skills) {
            const source = canonical.get(`${skill}/SKILL.md`);
            if (source === undefined)
                throw new Error(`Bundled canonical skill is missing: ${skill}`);
            const frontmatter = extractFrontmatter(source.toString("utf8"), `${skill}/SKILL.md`);
            const pointer = adapterPointer(hostRootPosix, skill);
            // A pointer is prose, not a link, but it must still resolve inside the install root.
            const pointerTarget = resolve(targetRoot, skill, ...pointer.split("/"));
            if (!isInside(root, pointerTarget))
                throw new Error(`Adapter pointer escapes the managed root: ${pointer}`);
            if (pointerTarget !== resolveInside(canonicalRoot, `${skill}/SKILL.md`))
                throw new Error(`Adapter pointer does not resolve to canonical content: ${pointer}`);
            hostFiles.set(`${skill}/SKILL.md`, Buffer.from(renderAdapter({ skill, pointer, frontmatter })));
        }
        if (VERBATIM_PLATFORMS.has(platform))
            for (const [rel, bytes] of canonical)
                if (isVerbatimHostFile(rel))
                    hostFiles.set(rel, bytes);
        for (const [rel, bytes] of [...hostFiles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            const target = resolveInside(targetRoot, rel);
            await assertNoSymlinkPath(root, target);
            const manifestRelative = toPosix(relative(root, target));
            assertSafeRelative(manifestRelative);
            planned.push(await planFileWrite({
                root,
                manifestRelative,
                target,
                bytes,
                previous,
                platform,
                kind: "adapter"
            }));
            plannedPaths.add(manifestRelative);
        }
        if (!options.global) {
            const instruction = PROJECT_INSTRUCTIONS[platform];
            if (instruction !== undefined) {
                const target = resolveInside(root, instruction.path.join("/"));
                await assertNoSymlinkPath(root, target);
                const manifestRelative = toPosix(relative(root, target));
                assertSafeRelative(manifestRelative);
                const oldRecord = previous.files[manifestRelative];
                if (oldRecord !== undefined && oldRecord.platform !== platform)
                    throw new Error(`Ownership platform mismatch for ${manifestRelative}`);
                const currentText = await readTextIfPresent(target);
                const current = currentText ?? "";
                const currentFileHash = currentText === undefined ? undefined : sha256(current);
                if (instruction.management === "file") {
                    const bytes = Buffer.from(instruction.content, "utf8");
                    const hash = sha256(bytes);
                    const owned = oldRecord?.owned ?? current.length === 0;
                    if (oldRecord !== undefined && oldRecord.management === "section")
                        throw new Error(`Ownership management mismatch for ${manifestRelative}`);
                    if (oldRecord?.owned &&
                        currentFileHash !== undefined &&
                        currentFileHash !== oldRecord.hash &&
                        currentFileHash !== hash)
                        throw new Error(`Refusing to overwrite a modified owned file: ${manifestRelative}`);
                    if ((!oldRecord || !oldRecord.owned) &&
                        currentFileHash !== undefined &&
                        currentFileHash !== hash)
                        throw new Error(`Refusing to overwrite an unowned file: ${manifestRelative}`);
                    planned.push({
                        action: {
                            action: currentFileHash === undefined
                                ? "create"
                                : currentFileHash === hash
                                    ? "preserve-identical"
                                    : "update",
                            path: manifestRelative,
                            platform,
                            kind: "instructions"
                        },
                        target,
                        bytes,
                        record: { hash, platform, owned, management: "file", kind: "instructions" },
                        ...(currentFileHash === undefined ? {} : { previousHash: currentFileHash })
                    });
                }
                else {
                    const nextSection = extractManagedSection(instruction.content);
                    if (nextSection === undefined)
                        throw new Error("Bundled activation section is missing markers");
                    const existingSection = extractManagedSection(current);
                    const existingSectionHash = existingSection === undefined ? undefined : sha256(existingSection);
                    const nextHash = sha256(nextSection);
                    if (oldRecord !== undefined && oldRecord.management !== "section")
                        throw new Error(`Ownership management mismatch for ${manifestRelative}`);
                    if (oldRecord?.owned &&
                        existingSectionHash !== undefined &&
                        existingSectionHash !== oldRecord.hash &&
                        existingSectionHash !== nextHash)
                        throw new Error(`Refusing to overwrite a modified owned section: ${manifestRelative}`);
                    if ((!oldRecord || !oldRecord.owned) &&
                        existingSectionHash !== undefined &&
                        existingSectionHash !== nextHash)
                        throw new Error(`Refusing to overwrite an unowned section: ${manifestRelative}`);
                    const nextContent = upsertManagedSection(current, nextSection);
                    const owned = oldRecord?.owned ?? existingSection === undefined;
                    planned.push({
                        action: {
                            action: existingSection === undefined
                                ? "create"
                                : existingSectionHash === nextHash
                                    ? "preserve-identical"
                                    : "update",
                            path: manifestRelative,
                            platform,
                            kind: "instructions"
                        },
                        target,
                        bytes: Buffer.from(nextContent, "utf8"),
                        record: {
                            hash: nextHash,
                            platform,
                            owned,
                            management: "section",
                            kind: "instructions"
                        },
                        ...(currentFileHash === undefined ? {} : { previousHash: currentFileHash })
                    });
                }
                plannedPaths.add(manifestRelative);
            }
        }
    }
    // 3. Migration: retire previous-layout files this install no longer owns. Only Forge-owned,
    //    unmodified files are removed; anything the user changed is preserved and reported.
    const selected = new Set(platforms);
    const retirable = [];
    for (const [rel, record] of Object.entries(previous.files).sort(([a], [b]) => a.localeCompare(b))) {
        if (plannedPaths.has(rel))
            continue;
        if (record.kind === "canonical")
            continue;
        if (!selected.has(record.platform))
            continue;
        assertSafeRelative(rel);
        const target = resolveInside(root, rel);
        await assertNoSymlinkPath(root, target);
        const currentHash = await hashIfPresent(target);
        if (currentHash === undefined) {
            // Already retired by an interrupted earlier attempt; just drop the stale record.
            retirable.push({
                action: {
                    action: "remove",
                    path: rel,
                    platform: record.platform,
                    kind: "retired"
                },
                target,
                expectedHash: record.hash
            });
            continue;
        }
        if (!record.owned || currentHash !== record.hash) {
            retirable.push({
                action: {
                    action: "preserve-modified",
                    path: rel,
                    platform: record.platform,
                    kind: "retired"
                },
                target,
                expectedHash: record.hash
            });
            continue;
        }
        retirable.push({
            action: {
                action: "remove",
                path: rel,
                platform: record.platform,
                kind: "retired"
            },
            target,
            expectedHash: record.hash
        });
    }
    if (options.dryRun)
        return [...planned.map((item) => item.action), ...retirable.map((item) => item.action)];
    const next = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        packageVersion: VERSION,
        root,
        installedAt: utcNow(),
        agent_first: true,
        automatic_activation: !options.global,
        files: { ...previous.files }
    };
    // Claim every path that was absent during the complete preflight before creating any managed
    // file. If the process is interrupted after this atomic manifest write, a retry can safely
    // recreate missing owned files instead of mistaking partially installed files for pre-existing
    // unowned content. Existing and update targets retain their prior records until their bytes are
    // safely replaced, so either the old or new hash remains recoverable after a crash.
    const created = planned.filter((item) => item.action.action === "create");
    if (created.length > 0) {
        const prepared = { ...next, files: { ...next.files } };
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
            const finalHash = sha256(item.bytes);
            const unchangedSincePreflight = currentHash === finalHash || currentHash === item.previousHash;
            if (!unchangedSincePreflight)
                throw new Error(`Refusing to overwrite a file changed after preflight: ${item.action.path}`);
            if (currentHash !== finalHash)
                await atomicWrite(root, item.target, item.bytes);
            processedWrites += 1;
            if (options.interruptAfter !== undefined && processedWrites >= options.interruptAfter)
                throw new Error(`Injected installer interruption after ${processedWrites} managed write(s).`);
        }
        next.files[item.action.path] = mergeCanonicalRecord(next.files[item.action.path], item.record);
    }
    await writeManifest(root, next);
    // Retirement runs only after every new file is durably in place, so an interruption leaves both
    // layouts present and usable. The manifest still records anything not yet retired, so a rerun
    // resumes exactly where it stopped.
    if (retirable.length > 0) {
        const prunable = new Set();
        for (const item of retirable) {
            if (item.action.action !== "remove")
                continue;
            await unlink(item.target).catch((error) => {
                if (error.code !== "ENOENT")
                    throw error;
            });
            delete next.files[item.action.path];
            prunable.add(dirname(item.target));
        }
        await writeManifest(root, next);
        for (const directory of [...prunable].sort((a, b) => b.length - a.length))
            await pruneEmptyDirectories(root, directory);
    }
    return [...planned.map((item) => item.action), ...retirable.map((item) => item.action)];
}
async function planFileWrite(input) {
    const { manifestRelative, target, bytes, previous, platform, kind } = input;
    const hash = sha256(bytes);
    const oldRecord = previous.files[manifestRelative];
    const existingHash = await hashIfPresent(target);
    if (oldRecord !== undefined) {
        if (kind !== "canonical" && oldRecord.platform !== platform)
            throw new Error(`Ownership platform mismatch for ${manifestRelative}`);
        if (oldRecord.owned &&
            existingHash !== undefined &&
            existingHash !== oldRecord.hash &&
            existingHash !== hash)
            throw new Error(`Refusing to overwrite a modified owned file: ${manifestRelative}`);
        if (!oldRecord.owned && existingHash !== hash)
            throw new Error(`Refusing to update a pre-existing unowned file: ${manifestRelative}`);
    }
    else if (existingHash !== undefined && existingHash !== hash) {
        throw new Error(`Refusing to overwrite an unowned file: ${manifestRelative}`);
    }
    const owned = oldRecord?.owned ?? existingHash === undefined;
    const action = existingHash === undefined ? "create" : existingHash === hash ? "preserve-identical" : "update";
    const record = { hash, platform, owned, management: "file", kind };
    if (kind === "canonical") {
        const merged = new Set([...(oldRecord?.platforms ?? []), ...(input.platforms ?? [])]);
        record.platforms = [...merged].sort();
        record.platform = record.platforms[0] ?? platform;
    }
    return {
        action: { action, path: manifestRelative, platform: record.platform, kind },
        target,
        bytes,
        record,
        ...(existingHash === undefined ? {} : { previousHash: existingHash })
    };
}
/** Canonical records accumulate the set of hosts that depend on them. */
function mergeCanonicalRecord(existing, next) {
    if (next.kind !== "canonical")
        return next;
    const merged = new Set([...(existing?.platforms ?? []), ...(next.platforms ?? [])]);
    const platforms = [...merged].sort();
    return { ...next, platforms, platform: platforms[0] ?? next.platform };
}
export async function uninstall(rootInput, selector, options) {
    const root = options.global
        ? await canonicalDirectory(options.home ?? homedir())
        : await canonicalDirectory(rootInput);
    const selected = new Set(normalizePlatformsForScope(selector, options.global));
    const manifest = await readManifest(root, true);
    const actions = [];
    const remaining = { ...manifest.files };
    const prunable = new Set();
    for (const [rel, record] of Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))) {
        assertSafeRelative(rel);
        const target = resolveInside(root, rel);
        if (record.kind === "canonical") {
            const owners = record.platforms ?? [record.platform];
            const retained = owners.filter((platform) => !selected.has(platform));
            if (retained.length === owners.length)
                continue;
            if (retained.length > 0) {
                // Another installed host still depends on this canonical file; keep it and record the
                // narrowed owner set instead of orphaning or deleting shared content.
                remaining[rel] = {
                    ...record,
                    platforms: retained,
                    platform: retained[0] ?? record.platform
                };
                continue;
            }
        }
        else if (!selected.has(record.platform))
            continue;
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
        if (record.management === "section") {
            const current = await readFile(target, "utf8");
            let section;
            try {
                section = extractManagedSection(current);
            }
            catch {
                section = undefined;
            }
            if (section === undefined || sha256(section) !== record.hash) {
                actions.push({
                    action: "preserve-modified",
                    path: rel,
                    platform: record.platform,
                    ...(record.kind === undefined ? {} : { kind: record.kind })
                });
                continue;
            }
            actions.push({
                action: "remove",
                path: rel,
                platform: record.platform,
                ...(record.kind === undefined ? {} : { kind: record.kind })
            });
            if (!options.dryRun) {
                const next = removeManagedSection(current);
                if (next.length === 0)
                    await unlink(target);
                else
                    await atomicWrite(root, target, Buffer.from(next, "utf8"));
                delete remaining[rel];
            }
            continue;
        }
        if (currentHash !== record.hash) {
            actions.push({
                action: "preserve-modified",
                path: rel,
                platform: record.platform,
                ...(record.kind === undefined ? {} : { kind: record.kind })
            });
            continue;
        }
        actions.push({
            action: "remove",
            path: rel,
            platform: record.platform,
            ...(record.kind === undefined ? {} : { kind: record.kind })
        });
        if (!options.dryRun) {
            await unlink(target);
            delete remaining[rel];
            prunable.add(dirname(target));
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
            await writeManifest(root, {
                ...manifest,
                schemaVersion: MANIFEST_SCHEMA_VERSION,
                files: remaining,
                installedAt: utcNow(),
                automatic_activation: Object.entries(remaining).some(([rel, record]) => {
                    const instruction = PROJECT_INSTRUCTIONS[record.platform];
                    return instruction !== undefined && instruction.path.join("/") === rel;
                })
            });
        }
        for (const directory of [...prunable].sort((a, b) => b.length - a.length))
            await pruneEmptyDirectories(root, directory);
    }
    return actions;
}
/**
 * Removes managed directories that removal left empty, walking upward until a non-empty directory
 * or the install root is reached. A directory holding any user file is never removed.
 */
async function pruneEmptyDirectories(root, start) {
    let current = start;
    while (isInside(root, current) && current !== root) {
        let entries;
        try {
            entries = await readdir(current);
        }
        catch (error) {
            if (error.code === "ENOENT") {
                current = dirname(current);
                continue;
            }
            return;
        }
        if (entries.length > 0)
            return;
        try {
            await rmdir(current);
        }
        catch {
            return;
        }
        current = dirname(current);
    }
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
/** The canonical managed root, relative to an installation root. */
export function canonicalManagedRoot() {
    return CANONICAL_ROOT_POSIX;
}
async function readManifest(root, required = false) {
    const path = resolveInside(root, MANIFEST_RELATIVE);
    const text = await readTextIfPresent(path);
    if (text === undefined) {
        if (required)
            throw new Error(`No Fullstack Forge ownership manifest at ${path}`);
        return {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            packageVersion: VERSION,
            root,
            installedAt: utcNow(),
            agent_first: true,
            automatic_activation: false,
            files: {}
        };
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error(`Invalid Fullstack Forge ownership manifest at ${path}`);
    }
    if (!isRecord(parsed) ||
        (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) ||
        parsed.root !== root ||
        typeof parsed.packageVersion !== "string" ||
        typeof parsed.installedAt !== "string" ||
        !isRecord(parsed.files) ||
        ("agent_first" in parsed && typeof parsed.agent_first !== "boolean") ||
        ("automatic_activation" in parsed && typeof parsed.automatic_activation !== "boolean")) {
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
            typeof record.owned !== "boolean" ||
            ("management" in record && record.management !== "file" && record.management !== "section") ||
            ("kind" in record &&
                record.kind !== "canonical" &&
                record.kind !== "adapter" &&
                record.kind !== "instructions") ||
            ("platforms" in record &&
                (!Array.isArray(record.platforms) ||
                    record.platforms.length === 0 ||
                    record.platforms.some((value) => !PLATFORMS.includes(value))))) {
            throw new Error(`Invalid ownership record for ${rel}`);
        }
        files[rel] = {
            platform: record.platform,
            hash: record.hash,
            owned: record.owned,
            management: record.management === "section" ? "section" : "file",
            // A schema-1 manifest predates the canonical layout: every record it holds is a
            // previous-layout host file, which is exactly what migration retires.
            ...(typeof record.kind === "string" ? { kind: record.kind } : {}),
            ...(Array.isArray(record.platforms)
                ? { platforms: [...new Set(record.platforms)].sort() }
                : {})
        };
    }
    return {
        schemaVersion: parsed.schemaVersion,
        packageVersion: parsed.packageVersion,
        root,
        installedAt: parsed.installedAt,
        agent_first: parsed.agent_first === true,
        automatic_activation: parsed.automatic_activation === true,
        files
    };
}
export function hashInstalledRecord(content, record) {
    if (record.management !== "section")
        return sha256(content);
    try {
        const section = extractManagedSection(content.toString("utf8"));
        return section === undefined ? undefined : sha256(section);
    }
    catch {
        return undefined;
    }
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