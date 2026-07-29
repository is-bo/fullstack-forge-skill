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
 * Evaluates one activation condition. Returns the reason it matched, or `undefined` when the
 * condition is not satisfied. A source with no satisfiable key never activates: absence of
 * evidence suppresses provider guidance rather than defaulting it on.
 */
export function evaluateActivation(when, evidence) {
    return evaluateActivationMatch(when, evidence)?.reason;
}
function evaluateActivationMatch(when, evidence) {
    if (when.not !== undefined && evaluateActivationMatch(when.not, evidence) !== undefined)
        return undefined;
    const compound = [];
    if (when.allOf !== undefined) {
        if (when.allOf.length === 0)
            return undefined;
        const matches = when.allOf.map((condition) => evaluateActivationMatch(condition, evidence));
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
            .map((condition) => evaluateActivationMatch(condition, evidence))
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
    const budget = declaration.contextBudget ?? manifest.defaultContextBudget;
    const selected = [
        {
            tier: "forge-contract",
            provider: "fullstack-forge",
            skill: declaration.module,
            runtimePath: declaration.forgeContract,
            reason: "Forge module contract always loads first and is never overridden"
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
                match: exactRequest === undefined
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
    return {
        module: declaration.module,
        mode: declaration.mode,
        outputClassification: declaration.outputClassification,
        selected,
        suppressed,
        budget,
        conflicts: declaration.conflicts,
        forgeAuthority: declaration.forgeAuthority,
        missing
    };
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
