/**
 * Composition engine: decides which upstream expertise applies to a Forge module for one
 * repository and one request.
 *
 * Forge owns applicability. Upstream skills carry specialist procedure but no routing authority:
 * they are selected here, from proven repository evidence or an explicit user request, and never
 * by announcing themselves to the agent host. Three rules hold without exception.
 *
 *   1. The Forge contract is always first in the load order.
 *   2. A provider source loads only when its activation condition is satisfied by evidence.
 *   3. The context budget is enforced, and anything dropped is reported rather than hidden.
 */
/** Intent controls which progressive procedure and provider sources are admissible. */
export const COMPOSITION_WORKFLOWS = ["build", "audit", "fix", "verify", "ship"];
/**
 * Validates and resolves the Forge-module dependency graph.
 *
 * Validation covers the complete manifest, not only the requested subgraph. A damaged registry
 * must fail closed even when the bad declaration is not reachable from this particular request.
 * Traversal is queue-based and marks a module when it is enqueued, so cycles terminate and diamond
 * dependencies appear only once in `modules` while all distinct explanatory edges remain visible.
 */
export function resolveModuleDependencyClosure(manifest, requestedModules) {
    const declarations = new Map();
    for (const declaration of manifest.modules) {
        const module = declaration.module.trim();
        if (module.length === 0)
            throw new Error("Composition manifest contains an empty module name");
        if (declarations.has(module))
            throw new Error(`Composition manifest declares module '${module}' more than once`);
        declarations.set(module, declaration);
    }
    for (const declaration of declarations.values()) {
        for (const dependency of declaration.dependsOn) {
            if (!declarations.has(dependency))
                throw new Error(`Composition manifest module '${declaration.module}' depends on unknown module '${dependency}'`);
        }
    }
    const roots = [];
    const seen = new Set();
    for (const requested of requestedModules) {
        if (!declarations.has(requested))
            throw new Error(`Unknown Forge module: ${requested}`);
        if (seen.has(requested))
            continue;
        seen.add(requested);
        roots.push(requested);
    }
    const modules = [...roots];
    const queue = [...roots];
    const edges = [];
    const seenEdges = new Set();
    for (let index = 0; index < queue.length; index += 1) {
        const parent = queue[index];
        if (parent === undefined)
            continue;
        const declaration = declarations.get(parent);
        if (declaration === undefined)
            throw new Error(`Composition manifest lost module '${parent}' during dependency traversal`);
        for (const dependency of declaration.dependsOn) {
            const edgeKey = `${parent}\u0000${dependency}`;
            if (!seenEdges.has(edgeKey)) {
                seenEdges.add(edgeKey);
                edges.push({
                    parent,
                    dependency,
                    reason: `Module '${parent}' declares '${dependency}' as a dependency.`
                });
            }
            if (seen.has(dependency))
                continue;
            seen.add(dependency);
            modules.push(dependency);
            queue.push(dependency);
        }
    }
    return { roots, modules, edges };
}
export const COMPOSITION_TASK_FLAGS = [
    "ci",
    "retrieval",
    "migration",
    "threatModelling",
    "gdprRelevant",
    "testingApplicable",
    "missingEssentialRequirements",
    "divergentExploration",
    "incidentInvestigation"
];
const PROFILE_DIMENSIONS = {
    languages: (profile) => profile.languages,
    frameworks: (profile) => profile.frameworks,
    databases: (profile) => [...profile.databases, ...profile.orms],
    hosting: (profile) => [...profile.hosting, ...profile.deployment],
    integrations: (profile) => profile.integrations,
    observability: (profile) => profile.observability,
    paymentProviders: (profile) => profile.payment_providers,
    aiProviders: (profile) => profile.ai_providers
};
const ACTIVATION_STRENGTH = Object.freeze({
    always: 1,
    condition: 2,
    repository: 3,
    highConfidenceRepository: 3,
    providerRepository: 3,
    highConfidenceProviderRepository: 4,
    explicit: 5,
    exactSourceRequest: 6
});
const PROVIDER_PROFILE_DIMENSIONS = new Set([
    "hosting",
    "integrations",
    "observability",
    "paymentProviders",
    "aiProviders"
]);
const CONFIDENCE_RANK = Object.freeze({
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3
});
/**
 * Activation conditions come from the generated registry, so an unknown key is a registry error,
 * not an opt-in signal. Keep the allowlist here instead of relying on TypeScript's static shape:
 * runtime JSON can contain keys the compiler never saw, including keys nested under `not`.
 */
const ACTIVATION_CONDITION_KEYS = new Set([
    "always",
    ...Object.keys(PROFILE_DIMENSIONS),
    "requested",
    "riskSurfaces",
    ...COMPOSITION_TASK_FLAGS,
    "minimumConfidence",
    "allOf",
    "anyOf",
    "not"
]);
const ACTIVATION_ARRAY_KEYS = new Set([
    ...Object.keys(PROFILE_DIMENSIONS),
    "requested",
    "riskSurfaces"
]);
/**
 * Validates the recursive activation shape before evaluating it. This is deliberately a boolean
 * fail-closed check: returning `undefined` for an invalid child must not be mistaken for a valid
 * non-match by a parent `not` clause. In particular, `{ not: { typo: ... } }` must suppress the
 * source rather than turning a registry typo into a neutral positive match.
 */
function hasInvalidActivationShape(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return true;
    const record = value;
    if (Object.keys(record).some((key) => !ACTIVATION_CONDITION_KEYS.has(key)))
        return true;
    if ([...ACTIVATION_ARRAY_KEYS].some((key) => {
        const candidate = record[key];
        return (candidate !== undefined &&
            (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== "string")));
    }))
        return true;
    if (record.always !== undefined && typeof record.always !== "boolean")
        return true;
    if (COMPOSITION_TASK_FLAGS.some((flag) => record[flag] !== undefined && typeof record[flag] !== "boolean"))
        return true;
    if (record.minimumConfidence !== undefined &&
        (typeof record.minimumConfidence !== "string" ||
            !Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, record.minimumConfidence)))
        return true;
    for (const key of ["allOf", "anyOf"]) {
        const candidate = record[key];
        if (candidate !== undefined &&
            (!Array.isArray(candidate) || candidate.some(hasInvalidActivationShape)))
            return true;
    }
    if (record.not !== undefined && hasInvalidActivationShape(record.not))
        return true;
    return false;
}
/**
 * Evaluates one activation condition. Returns the reason it matched, or `undefined` when the
 * condition is not satisfied. A source with no positive satisfiable key never activates: absence
 * of evidence suppresses provider guidance rather than defaulting it on. `not` is an exclusion
 * filter only; it cannot establish applicability by itself.
 */
export function evaluateActivation(when, evidence) {
    return evaluateActivationMatch(when, evidence)?.reason;
}
function evaluateActivationMatch(when, evidence) {
    if (hasInvalidActivationShape(when))
        return undefined;
    const result = evaluateActivationMatchUnchecked(when, evidence);
    // A neutral match is useful as an exclusion filter inside an allOf/anyOf expression, but it
    // is not positive applicability evidence when the whole source consists only of `not`.
    return result?.neutral === true ? undefined : result;
}
function evaluateActivationMatchUnchecked(when, evidence) {
    if (when.not !== undefined && evaluateActivationMatchUnchecked(when.not, evidence) !== undefined)
        return undefined;
    const compound = [];
    if (when.allOf !== undefined) {
        if (when.allOf.length === 0)
            return undefined;
        const matches = when.allOf.map((condition) => evaluateActivationMatchUnchecked(condition, evidence));
        if (matches.some((match) => match === undefined))
            return undefined;
        const proven = matches;
        const ranked = proven.filter((match) => !match.neutral);
        const nonExplicit = ranked.filter((match) => !match.explicit);
        compound.push({
            reason: `all conditions matched: ${proven.map((match) => match.reason).join("; ")}`,
            strength: ranked.length === 0
                ? ACTIVATION_STRENGTH.condition
                : Math.max(...(nonExplicit.length > 0 ? nonExplicit : ranked).map((match) => match.strength)),
            explicit: ranked.length > 0 && ranked.every((match) => match.explicit),
            neutral: ranked.length === 0
        });
    }
    if (when.anyOf !== undefined) {
        if (when.anyOf.length === 0)
            return undefined;
        const matches = when.anyOf
            .map((condition) => evaluateActivationMatchUnchecked(condition, evidence))
            .filter((match) => match !== undefined)
            .sort(compareActivationMatches);
        const strongest = matches[0];
        if (strongest === undefined)
            return undefined;
        compound.push({
            reason: `alternative matched: ${strongest.reason}`,
            strength: strongest.strength,
            explicit: strongest.explicit,
            neutral: strongest.neutral
        });
    }
    const atomic = [];
    if (when.always === true)
        atomic.push({
            reason: "always applicable within this module",
            strength: ACTIVATION_STRENGTH.always,
            explicit: false,
            neutral: false
        });
    const requested = (evidence.requested ?? []).map(normalize);
    if (when.requested !== undefined) {
        const hit = when.requested.find((value) => requested.includes(normalize(value)));
        if (hit !== undefined)
            atomic.push({
                reason: `explicitly requested: ${hit}`,
                strength: ACTIVATION_STRENGTH.explicit,
                explicit: true,
                neutral: false
            });
    }
    if (when.riskSurfaces !== undefined) {
        const surfaces = (evidence.riskSurfaces ?? []).map(normalize);
        const hit = when.riskSurfaces.find((value) => surfaces.includes(normalize(value)));
        if (hit !== undefined)
            atomic.push({
                reason: `proven risk surface: ${hit}`,
                strength: ACTIVATION_STRENGTH.condition,
                explicit: false,
                neutral: false
            });
    }
    for (const dimension of Object.keys(PROFILE_DIMENSIONS)) {
        const wanted = when[dimension];
        if (wanted === undefined || evidence.profile === undefined)
            continue;
        const records = PROFILE_DIMENSIONS[dimension](evidence.profile);
        const hit = matchRecords(records, wanted, when.minimumConfidence ?? "MEDIUM");
        if (hit !== undefined)
            atomic.push({
                reason: `repository evidence (${dimension}): ${hit.reason}`,
                strength: PROVIDER_PROFILE_DIMENSIONS.has(dimension)
                    ? hit.confidence === "HIGH"
                        ? ACTIVATION_STRENGTH.highConfidenceProviderRepository
                        : ACTIVATION_STRENGTH.providerRepository
                    : hit.confidence === "HIGH"
                        ? ACTIVATION_STRENGTH.highConfidenceRepository
                        : ACTIVATION_STRENGTH.repository,
                explicit: false,
                neutral: false
            });
    }
    for (const flag of COMPOSITION_TASK_FLAGS) {
        if (when[flag] !== true)
            continue;
        if (evidence.flags?.[flag] === true)
            atomic.push({
                reason: `task condition: ${flag}`,
                strength: ACTIVATION_STRENGTH.condition,
                explicit: false,
                neutral: false
            });
    }
    const hasAtomicClause = when.always !== undefined ||
        when.requested !== undefined ||
        when.riskSurfaces !== undefined ||
        Object.keys(PROFILE_DIMENSIONS).some((dimension) => when[dimension] !== undefined) ||
        COMPOSITION_TASK_FLAGS.some((flag) => when[flag] !== undefined);
    if (hasAtomicClause && atomic.length === 0)
        return undefined;
    const positives = [...compound, ...atomic];
    if (positives.length === 0) {
        if (when.not === undefined)
            return undefined;
        return {
            reason: "exclusion condition did not match",
            strength: ACTIVATION_STRENGTH.condition,
            explicit: false,
            neutral: true
        };
    }
    return positives.sort(compareActivationMatches)[0];
}
function compareActivationMatches(left, right) {
    if (left.neutral !== right.neutral)
        return left.neutral ? 1 : -1;
    return right.strength - left.strength;
}
/**
 * Provider activation uses structured detection names and types only. Discovery evidence strings
 * are provenance (often file paths), not technology identifiers: searching them made `expo`
 * activate on `apps/exporter/package.json`. Exact normalized values or whole alphanumeric tokens
 * match after punctuation and spacing normalization; raw substrings and partial token matches never
 * do.
 */
function matchRecords(records, wanted, minimumConfidence) {
    const targets = wanted.map((value) => ({
        normalized: normalize(value),
        canonical: tokenize(value).join("")
    }));
    for (const record of records) {
        if (CONFIDENCE_RANK[record.confidence] < CONFIDENCE_RANK[minimumConfidence])
            continue;
        const values = [record.name, record.type].map((value) => ({
            normalized: normalize(value),
            canonical: tokenize(value).join("")
        }));
        for (const target of targets) {
            if (values.some((value) => value.normalized === target.normalized ||
                (target.canonical.length > 0 && value.canonical === target.canonical)))
                return {
                    reason: `${record.name} (${record.confidence} confidence)`,
                    confidence: record.confidence
                };
        }
    }
    return undefined;
}
function normalize(value) {
    return value.trim().toLowerCase();
}
function tokenize(value) {
    return normalize(value)
        .split(/[^a-z0-9]+/u)
        .filter(Boolean);
}
/**
 * Resolves one module's composition. Deterministic: the same manifest and evidence always produce
 * the same ordered result, so generated reports and tests are stable.
 */
export function resolveComposition(options) {
    const { manifest, module, evidence, runtimePathFor, availableRuntimePaths } = options;
    const declaration = manifest.modules.find((entry) => entry.module === module);
    if (declaration === undefined)
        throw new Error(`Unknown Forge module: ${module}`);
    const workflow = options.workflow ?? evidence.workflow ?? "build";
    assertCompositionWorkflow(workflow);
    const budget = declaration.contextBudget ?? manifest.defaultContextBudget;
    const contractPath = forgeContractPath(manifest, declaration, workflow);
    const selected = [
        {
            tier: "forge-contract",
            provider: "fullstack-forge",
            skill: declaration.module,
            runtimePath: contractPath,
            reason: workflow === "build"
                ? "Forge module contract always loads first and is never overridden"
                : `Forge ${workflow} contract always loads first; build-only guidance is excluded`
        }
    ];
    const suppressed = [];
    const missing = [];
    const tiers = [
        { tier: "primary", sources: declaration.primary, limit: budget.maxPrimarySkills },
        { tier: "overlay", sources: declaration.overlays, limit: budget.maxOverlays },
        { tier: "supplemental", sources: declaration.supplemental ?? [], limit: budget.maxSupplemental }
    ];
    for (const { tier, sources, limit } of tiers) {
        let admitted = 0;
        const evaluated = sources.map((source) => {
            const exactRequest = exactSourceRequest(source, evidence.requested ?? []);
            return {
                source,
                match: hasInvalidActivationShape(source.when)
                    ? undefined
                    : exactRequest === undefined
                        ? evaluateActivationMatch(source.when, evidence)
                        : {
                            reason: `explicitly requested exact source: ${exactRequest}`,
                            strength: ACTIVATION_STRENGTH.exactSourceRequest,
                            explicit: true,
                            neutral: false
                        }
            };
        });
        for (const { source, match } of orderSources(evaluated)) {
            if (!sourceAllowedForWorkflow(source, tier, workflow)) {
                suppressed.push({
                    tier,
                    provider: source.provider,
                    skill: source.skill,
                    reason: `source is not declared for the ${workflow} workflow`
                });
                continue;
            }
            if (match === undefined) {
                suppressed.push({
                    tier,
                    provider: source.provider,
                    skill: source.skill,
                    reason: "no activation evidence"
                });
                continue;
            }
            if (admitted >= limit) {
                suppressed.push({
                    tier,
                    provider: source.provider,
                    skill: source.skill,
                    reason: match.explicit
                        ? `context budget conflict: explicitly requested source exceeded max ${limit} ${tier}; activation was ${match.reason}`
                        : `context budget reached (max ${limit} ${tier}); activation was ${match.reason}`
                });
                continue;
            }
            const runtimePath = runtimePathFor(source);
            if (availableRuntimePaths !== undefined && !availableRuntimePaths.has(runtimePath)) {
                // Never silently degrade: a manifest entry with no installed content is a damaged
                // installation, and the caller must report NOT_VERIFIED rather than a clean result.
                missing.push(runtimePath);
                suppressed.push({
                    tier,
                    provider: source.provider,
                    skill: source.skill,
                    reason: "declared upstream content is missing from this installation"
                });
                continue;
            }
            admitted += 1;
            selected.push({
                tier,
                provider: source.provider,
                skill: source.skill,
                runtimePath,
                reason: match.reason
            });
        }
    }
    const eager = selected.filter((source) => source.tier === "forge-contract" || source.tier === "primary");
    const deferred = selected.filter((source) => source.tier === "overlay" || source.tier === "supplemental");
    return {
        module: declaration.module,
        workflow,
        mode: declaration.mode,
        outputClassification: declaration.outputClassification,
        selected,
        eager,
        deferred,
        suppressed,
        budget,
        conflicts: declaration.conflicts,
        forgeAuthority: declaration.forgeAuthority,
        missing
    };
}
function assertCompositionWorkflow(value) {
    if (!COMPOSITION_WORKFLOWS.includes(value))
        throw new Error(`Unknown composition workflow '${value}'. Expected one of: ${COMPOSITION_WORKFLOWS.join(", ")}.`);
}
function forgeContractPath(manifest, declaration, workflow) {
    if (workflow === "build")
        return declaration.forgeContract;
    const modulePath = declaration.forgeContracts?.[workflow];
    if (modulePath !== undefined)
        return modulePath;
    const genericPath = manifest.workflowContracts?.[workflow];
    if (genericPath !== undefined)
        return genericPath;
    // Older manifests have no workflow map. The canonical installation always carries these
    // references, and selecting them keeps non-build runs free of build briefs.
    return `references/workflows/${workflow}.md`;
}
function sourceAllowedForWorkflow(source, tier, workflow) {
    if (source.workflows !== undefined)
        return source.workflows.includes(workflow);
    // Existing primary entries are implementation/build procedures. Keep overlays and
    // supplementals available to formal inspection and release workflows unless narrowed.
    return tier !== "primary" || workflow === "build";
}
function exactSourceRequest(source, requested) {
    const accepted = new Set([
        normalize(source.skill),
        normalize(`${source.provider}/${source.skill}`)
    ]);
    return requested.find((value) => accepted.has(normalize(value)));
}
/**
 * Declared `sequence` first (the requirements module runs interview → refine → spec → plan in that
 * order when activation authority is tied), then declared priority. Provider and skill names are
 * only the final deterministic tie-breaker, so object-key iteration never affects selection.
 */
function orderSources(sources) {
    return [...sources].sort((a, b) => {
        const left = a.source.sequence ?? Number.MAX_SAFE_INTEGER;
        const right = b.source.sequence ?? Number.MAX_SAFE_INTEGER;
        if (left !== right)
            return left - right;
        const activation = compareActivationMatches(a.match ?? { reason: "", strength: 0, explicit: false, neutral: false }, b.match ?? { reason: "", strength: 0, explicit: false, neutral: false });
        if (activation !== 0)
            return activation;
        const priority = (b.source.priority ?? 0) - (a.source.priority ?? 0);
        if (priority !== 0)
            return priority;
        return (a.source.provider.localeCompare(b.source.provider) ||
            a.source.skill.localeCompare(b.source.skill));
    });
}
/**
 * Fixed conflict precedence. Lower number wins. Implemented as data so a test can assert the whole
 * order and so a report can explain exactly why one instruction beat another.
 */
export const PRECEDENCE = Object.freeze([
    "system-and-user-instructions",
    "explicit-task-requirements",
    "repository-architecture-and-conventions",
    "security-privacy-integrity-legal",
    "forge-evidence-and-ship-contracts",
    "forge-cross-module-coordination",
    "primary-upstream-workflow",
    "conditional-provider-overlay",
    "optional-style-preference"
]);
export function precedenceRank(level) {
    return PRECEDENCE.indexOf(level);
}
/**
 * Resolves a conflict between two competing instructions. Returns the winner. Ties are impossible
 * between different levels; at the same level the caller must resolve it explicitly, so this
 * returns `undefined` rather than guessing.
 */
export function resolveConflict(left, right) {
    const a = precedenceRank(left);
    const b = precedenceRank(right);
    if (a === b)
        return undefined;
    return a < b ? left : right;
}
