import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { COMPOSITION_WORKFLOWS, resolveComposition, resolveModuleDependencyClosure } from "./composition.js";
import { PACKAGE_ROOT } from "./constants.js";
import { assertNoSymlinkPath, assertSafeRelative, resolveInside } from "./utils.js";
const PROVEN_CONFIDENCE = new Set(["HIGH", "MEDIUM"]);
const FRONTEND_FRAMEWORKS = new Set([
    "angular",
    "astro",
    "expo",
    "next",
    "nextjs",
    "nuxt",
    "qwik",
    "react",
    "reactnative",
    "remix",
    "solid",
    "solidjs",
    "svelte",
    "sveltekit",
    "vue"
]);
const GREENFIELD_FRONTEND_DEPENDENCIES = new Set(["ui", "ux", "accessibility"]);
const COMPOSITION_ARTIFACT = join(".forge", "composition.json");
const FORGE_CONTRACT_SUBTREE = "references";
const UPSTREAM_RUNTIME_SUBTREE = ".fullstack-forge/upstream";
/**
 * Explicit frontend work in a repository without frontend evidence is greenfield intent, not an
 * automatic applicability claim. Seed only the experience disciplines needed to design that new
 * surface; ordinary dependency expansion remains evidence-gated.
 */
export function explicitGreenfieldDependenciesFor(profile, modules) {
    if (!modules.includes("frontend") || hasProvenFrontendEvidence(profile))
        return new Set();
    return GREENFIELD_FRONTEND_DEPENDENCIES;
}
export function compositionEvidenceFor(profile, input = {}) {
    const capability = new Set((profile.capability_assessments ?? [])
        .filter((assessment) => assessment.status === "PRESENT")
        .map((assessment) => assessment.capability));
    const provenRisks = (profile.risk_evidence ?? []).filter((entry) => PROVEN_CONFIDENCE.has(entry.confidence));
    const riskSurfaces = new Set((input.riskSurfaces ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
    const requestedModules = new Set(input.modules ?? []);
    if (hasProvenFrontendEvidence(profile) ||
        [...requestedModules].some((module) => ["accessibility", "frontend", "ui", "ux"].includes(module)))
        riskSurfaces.add("frontend");
    if (requestedModules.has("api") ||
        capability.has("api") ||
        provenRisks.some((entry) => entry.modules.includes("api")))
        riskSurfaces.add("api");
    if (requestedModules.has("payments") ||
        capability.has("payments") ||
        provenRisks.some((entry) => entry.modules.includes("payments")))
        riskSurfaces.add("payments");
    const flags = {
        ci: profile.ci.some((record) => PROVEN_CONFIDENCE.has(record.confidence)),
        testingApplicable: requestedModules.has("testing") ||
            profile.tests.some((record) => PROVEN_CONFIDENCE.has(record.confidence)),
        gdprRelevant: provenRisks.some((entry) => entry.risk === "personal-or-medical-data")
    };
    for (const flag of input.taskFlags ?? [])
        flags[flag] = true;
    return {
        profile,
        ...(input.workflow === undefined ? {} : { workflow: input.workflow }),
        requested: [...new Set((input.requested ?? []).map((value) => value.trim()).filter(Boolean))],
        riskSurfaces: [...riskSurfaces].sort(),
        flags
    };
}
function hasProvenFrontendEvidence(profile) {
    return ((profile.capability_assessments ?? []).some((assessment) => assessment.capability === "frontend" && assessment.status === "PRESENT") ||
        profile.frameworks.some((record) => PROVEN_CONFIDENCE.has(record.confidence) &&
            FRONTEND_FRAMEWORKS.has(record.name.toLowerCase().replace(/[^a-z0-9]+/gu, ""))));
}
export async function resolveRuntimeComposition(root, modules, evidence, runtimeRootOverride) {
    return (await resolveRuntimeCompositionWithRoot(root, modules, evidence, runtimeRootOverride))
        .compositions;
}
export async function resolveRuntimeCompositionWithRoot(root, modules, evidence, runtimeRootOverride) {
    const { manifest, runtimeRoot } = await loadRuntimeCompositionManifest(root, runtimeRootOverride);
    const runtimePathBySource = new Map();
    for (const declaration of manifest.modules) {
        for (const source of declaration.resolvedSources) {
            assertOwnedRuntimePath(source.runtimePath, UPSTREAM_RUNTIME_SUBTREE, `Composition source ${source.provider}/${source.skill}`);
            const key = sourceKey(source);
            const previous = runtimePathBySource.get(key);
            if (previous !== undefined && previous !== source.runtimePath)
                throw new Error(`Composition manifest maps ${key} to conflicting runtime paths`);
            runtimePathBySource.set(key, source.runtimePath);
        }
    }
    const declaredPaths = [...new Set(runtimePathBySource.values())];
    const availableRuntimePaths = new Set();
    await Promise.all(declaredPaths.map(async (runtimePath) => {
        const absolute = resolveInside(runtimeRoot, runtimePath);
        if (await regularFileExists(runtimeRoot, absolute))
            availableRuntimePaths.add(runtimePath);
    }));
    const results = [];
    for (const module of modules) {
        const result = resolveComposition({
            manifest,
            module,
            evidence,
            availableRuntimePaths,
            runtimePathFor: (source) => {
                const runtimePath = runtimePathBySource.get(sourceKey(source));
                if (runtimePath === undefined)
                    throw new Error(`Composition manifest has no resolved runtime path for ${source.provider}/${source.skill}`);
                return runtimePath;
            }
        });
        const contract = result.selected[0];
        if (contract !== undefined) {
            assertOwnedRuntimePath(contract.runtimePath, FORGE_CONTRACT_SUBTREE, `Forge ${result.workflow} contract for ${module}`);
            const contractPath = `.fullstack-forge/skills/fullstack-forge/${contract.runtimePath}`;
            contract.runtimePath = contractPath;
            // `eager` normally references the same object, but update by identity as well so a future
            // resolver implementation that clones tier views cannot leak an unresolved relative path.
            for (const eager of result.eager ?? [])
                if (eager.tier === "forge-contract")
                    eager.runtimePath = contractPath;
            const absolute = resolveInside(runtimeRoot, contractPath);
            if (!(await regularFileExists(runtimeRoot, absolute)))
                result.missing.unshift(contractPath);
        }
        results.push(result);
    }
    return { runtimeRoot, compositions: results };
}
/**
 * Loads the same installed composition registry as runtime source resolution and returns a pure,
 * cycle-safe dependency closure. Callers can apply applicability policy to `modules` and retain
 * `edges` as the explanation for every dependency considered.
 */
export async function resolveRuntimeModuleDependencyClosure(root, modules, runtimeRootOverride) {
    const { manifest } = await loadRuntimeCompositionManifest(root, runtimeRootOverride);
    return resolveModuleDependencyClosure(manifest, modules);
}
async function loadRuntimeCompositionManifest(root, runtimeRootOverride) {
    const projectManifestPath = resolveInside(root, join(".fullstack-forge", "manifests", "module-composition.json"));
    const installManifestPath = resolveInside(root, join(".fullstack-forge", "install-manifest.json"));
    const projectInstalled = await pathExists(root, installManifestPath);
    const runtimeRoot = runtimeRootOverride ??
        (projectInstalled || (await pathExists(root, projectManifestPath)) ? root : PACKAGE_ROOT);
    const manifestPath = resolveInside(runtimeRoot, join(".fullstack-forge", "manifests", "module-composition.json"));
    await assertNoSymlinkPath(runtimeRoot, manifestPath);
    const manifest = parseRuntimeManifest(JSON.parse(await readFile(manifestPath, "utf8")));
    return { manifest, runtimeRoot };
}
export async function writeCompositionArtifact(root, resolution) {
    const path = resolveInside(root, COMPOSITION_ARTIFACT);
    await assertNoSymlinkPath(root, dirname(path));
    await mkdir(dirname(path), { recursive: true });
    await assertNoSymlinkPath(root, path);
    await writeFile(path, `${JSON.stringify({
        schemaVersion: 2,
        runtime_root: resolution.runtimeRoot,
        compositions: resolution.compositions
    }, null, 2)}\n`, "utf8");
    return path;
}
function sourceKey(source) {
    return `${source.provider}\u0000${source.skill}`;
}
async function pathExists(root, path) {
    await assertNoSymlinkPath(root, path);
    try {
        await access(path);
        return true;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false;
        throw error;
    }
}
/** Existence for composition content is intentionally stricter than `access`: directories and
 * special files are damaged-installation states, not readable Forge source files. Symlinks remain
 * rejected by the shared path guard before the stat follows anything. */
async function regularFileExists(root, path) {
    await assertNoSymlinkPath(root, path);
    try {
        return (await stat(path)).isFile();
    }
    catch {
        return false;
    }
}
function parseRuntimeManifest(value) {
    if (value === null || typeof value !== "object")
        throw new Error("Composition manifest must be an object");
    const candidate = value;
    if (candidate.schemaVersion !== 2 ||
        !Array.isArray(candidate.modules) ||
        candidate.defaultContextBudget === undefined)
        throw new Error("Composition manifest has an unsupported or invalid schema");
    validateWorkflowMap(candidate.workflowContracts, "manifest workflow contract");
    for (const module of candidate.modules) {
        if (typeof module.module !== "string" ||
            typeof module.forgeContract !== "string" ||
            !Array.isArray(module.primary) ||
            !Array.isArray(module.overlays) ||
            !Array.isArray(module.dependsOn) ||
            !module.dependsOn.every((dependency) => typeof dependency === "string") ||
            !Array.isArray(module.resolvedSources))
            throw new Error("Composition manifest contains an invalid module declaration");
        assertOwnedRuntimePath(module.forgeContract, FORGE_CONTRACT_SUBTREE, `Module ${module.module} Forge contract`);
        validateWorkflowMap(module.forgeContracts, `module ${module.module} workflow contract`);
        for (const tier of [module.primary, module.overlays, module.supplemental ?? []]) {
            for (const source of tier)
                validateSourceWorkflowList(source.workflows, source.skill);
        }
        for (const source of module.resolvedSources) {
            if (typeof source.provider !== "string" ||
                typeof source.skill !== "string" ||
                typeof source.runtimePath !== "string")
                throw new Error(`Composition manifest contains an invalid source for ${module.module}`);
            assertOwnedRuntimePath(source.runtimePath, UPSTREAM_RUNTIME_SUBTREE, `Composition source ${source.provider}/${source.skill}`);
        }
    }
    const manifest = candidate;
    // Validate duplicate declarations and every dependency target whenever the runtime registry is
    // opened, even if the caller only resolves provider sources for one unrelated module.
    resolveModuleDependencyClosure(manifest, []);
    return manifest;
}
function validateWorkflowMap(value, label) {
    if (value === undefined)
        return;
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error(`${label} map is invalid`);
    for (const [workflow, path] of Object.entries(value)) {
        if (!COMPOSITION_WORKFLOWS.includes(workflow))
            throw new Error(`${label} map contains unknown workflow '${workflow}'`);
        if (typeof path !== "string" || path.trim().length === 0)
            throw new Error(`${label} path for '${workflow}' is invalid`);
        assertOwnedRuntimePath(path, FORGE_CONTRACT_SUBTREE, `${label} path for '${workflow}'`);
    }
}
/** Runtime manifests may select only generated Forge-owned subtrees. Validate before any `join`
 * or `resolve` can normalize traversal away, and require canonical forward-slash paths so the
 * boundary has identical meaning on every supported host. */
function assertOwnedRuntimePath(path, subtree, label) {
    try {
        assertSafeRelative(path);
    }
    catch {
        throw new Error(`${label} path is unsafe: ${path}`);
    }
    if (path.includes("\\") || !path.startsWith(`${subtree}/`))
        throw new Error(`${label} path must stay inside '${subtree}': ${path}`);
}
function validateSourceWorkflowList(value, skill) {
    if (value === undefined)
        return;
    if (!Array.isArray(value) ||
        value.length === 0 ||
        new Set(value).size !== value.length ||
        !value.every((workflow) => COMPOSITION_WORKFLOWS.includes(workflow)))
        throw new Error(`Composition source '${skill}' declares an invalid workflow list`);
}
