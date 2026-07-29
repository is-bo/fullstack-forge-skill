import { classifyEvidencePath } from "./discovery-evidence.js";
import { routeFrontendRequest } from "./frontend-routing.js";
import { capabilityStatusFor } from "./scope.js";
const RULES = [
    rule("auth", [/\bauth(?:entication)?\b/iu, /\blog(?:in|out)\b/iu, /\bsession\b/iu], ["security"]),
    rule("authorization", [/\bauthori[sz]ation\b/iu, /\b(?:rbac|permission|policy|ownership)\b/iu], ["security"]),
    rule("tenancy", [/\btenant(?:s|[-_ ]?(?:id|scope))?\b/iu, /\borganization[-_ ]?id\b/iu], ["security", "privacy"]),
    rule("uploads", [/\bupload(?:s|ing)?\b/iu, /\bmulter\b/iu, /\bfile[-_ ]?input\b/iu], ["storage", "security"]),
    rule("payments", [/\b(?:payment|billing|stripe|webhook|invoice)\b/iu], ["integrations", "security", "reliability"]),
    rule("database", [/\b(?:migration|schema|prisma|sequelize|typeorm|sql)\b/iu], ["deployment"]),
    rule("queries", [/\b(?:query|search|pagination|repository|n\+1)\b/iu], ["performance"]),
    rule("cache", [/\b(?:cache|redis|memcached|invalidation)\b/iu], ["privacy"]),
    rule("jobs", [/\b(?:job|queue|worker|cron|schedule)\b/iu], ["reliability", "observability"]),
    rule("ai", [/\b(?:ai|llm|openai|embedding|prompt|model)\b/iu], ["security", "privacy"]),
    rule("security", [/\b(?:trust[-_ ]?boundary|injection|credential|secret|token|crypto|encrypt|ssrf)\b/iu], ["testing"]),
    rule("privacy", [/\b(?:pii|personal[-_ ]?data|email|phone|address|consent|retention|gdpr)\b/iu], ["security"]),
    rule("ui", [/\b(?:ui|dashboard|screen|component|dialog|form|route)\b/iu], ["ux", "accessibility", "frontend"]),
    rule("deployment", [/\b(?:deploy(?:ment)?|docker|terraform|kubernetes|ci|workflow)\b/iu], ["infrastructure"])
];
const UI_EXTENSIONS = /\.(?:[cm]?[jt]sx?|vue|svelte)$/iu;
const UI_PATH = /(?:^|\/)(?:app|pages|routes|views|components|screens)(?:\/|$)/iu;
const DEPLOYMENT_PATH = /(?:^|\/)(?:\.github\/workflows|infra(?:structure)?|deploy(?:ment)?|k8s|helm)(?:\/|$)|(?:^|\/)(?:dockerfile|docker-compose[^/]*)$/iu;
const ROUTE_PATH = /(?:^|\/)(?:routes|controllers|handlers)(?:\/|$)|(?:^|\/)pages\/api(?:\/|$)|(?:^|\/)app\/.*\/route\.[cm]?[jt]sx?$/iu;
const SCHEMA_PATH = /(?:^|\/)(?:migrations?|schema|prisma)(?:\/|\.|$)|\.(?:sql|prisma)$/iu;
const QUERY_PATH = /(?:^|\/)(?:queries|repositories|search)(?:\/|$)/iu;
const CACHE_PATH = /(?:^|\/)(?:cache|redis)(?:\/|\.|$)/iu;
/**
 * Derives Build-mode discipline obligations from classified discovery evidence and implementation
 * changes. Documentation, tests, fixtures, examples, and generated output never activate a rule.
 */
export function deriveBuildApplicability(input) {
    const evidencePaths = [
        ...new Set([...(input.changed_paths ?? []), ...(input.touched_paths ?? [])])
    ]
        .map((path) => path.replace(/\\/gu, "/").replace(/^\.\//u, ""))
        .sort((a, b) => a.localeCompare(b));
    const activatingPaths = evidencePaths.filter((path) => {
        const classification = classifyEvidencePath(path);
        return ["implementation", "route", "schema", "manifest", "configuration"].includes(classification.evidence_class);
    });
    const ignoredPaths = evidencePaths.filter((path) => !activatingPaths.includes(path));
    const text = [input.summary ?? "", ...(input.risk_inputs ?? [])].join("\n");
    const decisions = new Map();
    const require = (discipline, confidence, evidence) => {
        const prior = decisions.get(discipline);
        if (prior?.status === "REQUIRED") {
            prior.evidence.push(...evidence);
            if (confidenceRank(confidence) > confidenceRank(prior.confidence))
                prior.confidence = confidence;
            return;
        }
        decisions.set(discipline, { discipline, status: "REQUIRED", confidence, evidence });
    };
    const suggest = (discipline, evidence) => {
        if (decisions.has(discipline))
            return;
        decisions.set(discipline, { discipline, status: "SUGGESTED", confidence: "LOW", evidence });
    };
    if (activatingPaths.length > 0) {
        require("code", "HIGH", activatingPaths
            .slice(0, 12)
            .map((path) => `Changed executable input '${path}'.`));
        require("testing", "HIGH", ["Changed executable inputs require changed-behavior proof."]);
    }
    if (input.risk_baseline === "high")
        require("security", "HIGH", ["The recorded project or feature risk baseline is high."]);
    const interfaceRoute = routeFrontendRequest(text);
    if (interfaceRoute.active) {
        for (const discipline of interfaceRoute.modules)
            require(discipline, "MEDIUM", [
                `The requested interface work selected '${discipline}': ${interfaceRoute.reasons.join(" ")}`
            ]);
    }
    for (const current of RULES) {
        const matchingPaths = activatingPaths.filter((path) => current.patterns.some((pattern) => pattern.test(path)));
        const textMatch = current.patterns.some((pattern) => pattern.test(text));
        const capability = capabilityFor(current.discipline, input.profile);
        if (matchingPaths.length > 0 || capability.status === "PRESENT") {
            require(current.discipline, capability.status === "PRESENT" ? "HIGH" : "MEDIUM", [
                ...matchingPaths.map((path) => `Changed executable path '${path}' matched the ${current.discipline} rule.`),
                ...capability.evidence
            ]);
            for (const implied of current.required_with)
                require(implied, "MEDIUM", [
                    `${current.discipline} requires the coupled '${implied}' discipline.`
                ]);
        }
        else if (textMatch) {
            decisions.set(current.discipline, {
                discipline: current.discipline,
                status: "UNRESOLVED",
                confidence: "LOW",
                evidence: [
                    `Feature summary or risk input mentions ${current.discipline}.`,
                    ...capability.evidence
                ]
            });
        }
        else if (capability.status === "ABSENT") {
            decisions.set(current.discipline, {
                discipline: current.discipline,
                status: "EXCLUDED",
                confidence: "HIGH",
                evidence: capability.evidence,
                exclusion_reason: `No matching ${current.discipline} risk surface was observed; it is absent only from the bounded scanned scope.`
            });
        }
    }
    const uiPaths = activatingPaths.filter((path) => UI_EXTENSIONS.test(path) && UI_PATH.test(path));
    if (uiPaths.length > 0) {
        for (const discipline of ["ui", "ux", "accessibility", "frontend"])
            require(discipline, "HIGH", uiPaths.map((path) => `Changed UI path '${path}' requires ${discipline}.`));
    }
    const deploymentPaths = activatingPaths.filter((path) => DEPLOYMENT_PATH.test(path));
    if (deploymentPaths.length > 0) {
        for (const discipline of ["deployment", "infrastructure"])
            require(discipline, "HIGH", deploymentPaths.map((path) => `Changed deployment path '${path}' requires ${discipline}.`));
    }
    const routePaths = activatingPaths.filter((path) => ROUTE_PATH.test(path));
    if (routePaths.length > 0) {
        require("api", "MEDIUM", routePaths.map((path) => `Changed route or handler '${path}' requires boundary review.`));
        require("security", "MEDIUM", ["Changed routes cross an application trust boundary."]);
    }
    const schemaPaths = activatingPaths.filter((path) => SCHEMA_PATH.test(path));
    if (schemaPaths.length > 0) {
        require("database", "HIGH", schemaPaths.map((path) => `Changed schema or migration '${path}' requires database review.`));
        require("deployment", "HIGH", ["Schema changes require migration and rollout evidence."]);
    }
    const queryPaths = activatingPaths.filter((path) => QUERY_PATH.test(path));
    if (queryPaths.length > 0) {
        require("queries", "HIGH", queryPaths.map((path) => `Changed query surface '${path}' requires query evidence.`));
        require("performance", "MEDIUM", ["Query changes require bounded performance evidence."]);
    }
    const cachePaths = activatingPaths.filter((path) => CACHE_PATH.test(path));
    if (cachePaths.length > 0) {
        require("cache", "HIGH", cachePaths.map((path) => `Changed cache surface '${path}' requires cache evidence.`));
        require("privacy", "MEDIUM", ["Cache keys and values require privacy review."]);
        if (input.profile.tenant_boundaries.length > 0)
            require("tenancy", "HIGH", [
                "Tenant capability plus cache changes require tenant-safe keys."
            ]);
    }
    if (ignoredPaths.length > 0)
        suggest("code", ignoredPaths.map((path) => `Ignored non-activating path '${path}' for capability inference.`));
    const ordered = [...decisions.values()].sort((a, b) => a.discipline.localeCompare(b.discipline));
    return {
        decisions: ordered,
        required: ordered
            .filter((entry) => entry.status === "REQUIRED")
            .map((entry) => entry.discipline),
        suggested: ordered
            .filter((entry) => entry.status === "SUGGESTED")
            .map((entry) => entry.discipline),
        unresolved: ordered
            .filter((entry) => entry.status === "UNRESOLVED")
            .map((entry) => entry.discipline),
        excluded: ordered
            .filter((entry) => entry.status === "EXCLUDED")
            .map((entry) => entry.discipline)
    };
}
function rule(discipline, patterns, requiredWith) {
    return { discipline, patterns, required_with: requiredWith };
}
function capabilityFor(discipline, profile) {
    const status = capabilityStatusFor(discipline, profile);
    return status;
}
function confidenceRank(confidence) {
    return confidence === "HIGH" ? 3 : confidence === "MEDIUM" ? 2 : 1;
}
