/**
 * Standalone deterministic composition entry for release archives and installed host adapters.
 *
 * This file deliberately calls the same discovery and resolver functions as the npm CLI. The
 * generated archive runtime is a transpiled closure of this entry, not a second implementation.
 */
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compositionEvidenceFor, resolveRuntimeComposition, writeCompositionArtifact } from "./composition-runtime.js";
import { COMPOSITION_TASK_FLAGS } from "./composition.js";
import { MODULE_SLUGS } from "./constants.js";
import { discoverProject } from "./discovery.js";
import { canonicalDirectory } from "./utils.js";
export function isDirectExecution(argumentPath, modulePath = fileURLToPath(import.meta.url), canonicalize = realpathSync) {
    if (argumentPath === undefined)
        return false;
    const resolvedArgument = resolve(argumentPath);
    const resolvedModule = resolve(modulePath);
    try {
        return canonicalize(resolvedArgument) === canonicalize(resolvedModule);
    }
    catch {
        return resolvedArgument === resolvedModule;
    }
}
export async function runCompositionEntry(argv) {
    const parsed = parseArguments(argv);
    const root = await canonicalDirectory(parsed.root);
    const runtimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const profile = await discoverProject(root);
    const compositions = await resolveRuntimeComposition(root, [parsed.module], compositionEvidenceFor(profile, {
        requested: parsed.requested,
        taskFlags: parsed.taskFlags,
        riskSurfaces: parsed.riskSurfaces
    }), runtimeRoot);
    const compositionArtifact = parsed.dryRun
        ? undefined
        : await writeCompositionArtifact(root, compositions);
    const result = {
        compositions,
        ...(compositionArtifact === undefined ? {} : { composition_artifact: compositionArtifact }),
        dry_run: parsed.dryRun
    };
    if (parsed.json)
        console.log(JSON.stringify(result, null, 2));
    else {
        console.log([
            `Resolved ${parsed.module} composition with ${compositions[0]?.selected.length ?? 0} ordered source(s).`,
            ...(compositionArtifact === undefined
                ? ["Dry run: no composition artifact was written."]
                : [`Composition artifact: ${compositionArtifact}`]),
            ...(compositions[0]?.missing ?? []).map((path) => `Missing required content: ${path}`)
        ].join("\n"));
    }
    return compositions.some((composition) => composition.missing.length > 0) ? 2 : 0;
}
function parseArguments(argv) {
    const positionals = [];
    const requested = [];
    const taskFlags = [];
    const riskSurfaces = [];
    let root = process.cwd();
    let json = false;
    let dryRun = false;
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index] ?? "";
        if (value === "--json")
            json = true;
        else if (value === "--dry-run")
            dryRun = true;
        else if (value === "--root" ||
            value === "--cwd" ||
            value === "--request" ||
            value === "--condition" ||
            value === "--risk-surface") {
            const next = argv[index + 1];
            if (next === undefined)
                throw new Error(`Option '${value}' requires a value`);
            index += 1;
            if (value === "--request")
                requested.push(next);
            else if (value === "--condition")
                taskFlags.push(parseTaskFlag(next));
            else if (value === "--risk-surface")
                riskSurfaces.push(parseRiskSurface(next));
            else
                root = next;
        }
        else if (value.startsWith("--request="))
            requested.push(value.slice("--request=".length));
        else if (value.startsWith("--condition="))
            taskFlags.push(parseTaskFlag(value.slice("--condition=".length)));
        else if (value.startsWith("--risk-surface="))
            riskSurfaces.push(parseRiskSurface(value.slice("--risk-surface=".length)));
        else if (value.startsWith("--root="))
            root = value.slice("--root=".length);
        else if (value.startsWith("--cwd="))
            root = value.slice("--cwd=".length);
        else if (value.startsWith("--"))
            throw new Error(`Unknown composition option '${value}'`);
        else
            positionals.push(value);
    }
    const [module, mode, ...extra] = positionals;
    if (module === undefined ||
        !MODULE_SLUGS.includes(module) ||
        ["all", "discover", "ship"].includes(module))
        throw new Error(`Composition requires one concrete Forge module, got '${module ?? ""}'`);
    if (mode !== "compose" || extra.length > 0)
        throw new Error("Usage: composition-entry <module> compose [--request value] [--condition name] [--risk-surface name] [--root path]");
    return {
        module: module,
        root: resolve(root),
        requested: [...new Set(requested.map((value) => value.trim()).filter(Boolean))],
        taskFlags: [...new Set(taskFlags)],
        riskSurfaces: [...new Set(riskSurfaces)],
        json,
        dryRun
    };
}
function parseTaskFlag(value) {
    if (COMPOSITION_TASK_FLAGS.includes(value))
        return value;
    throw new Error(`Unknown composition condition '${value}'. Expected one of: ${COMPOSITION_TASK_FLAGS.join(", ")}.`);
}
function parseRiskSurface(value) {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/u.test(normalized))
        throw new Error(`Invalid composition risk surface '${value}'.`);
    return normalized;
}
if (isDirectExecution(process.argv[1])) {
    runCompositionEntry(process.argv.slice(2))
        .then((exitCode) => {
        process.exitCode = exitCode;
    })
        .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
