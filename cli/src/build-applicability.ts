import { classifyEvidencePath } from "./discovery-evidence.js";
import type { ModuleSlug } from "./constants.js";
import { capabilityStatusFor } from "./scope.js";
import type { Confidence, ProjectProfile } from "./types.js";

/** The Build-only applicability result. It deliberately does not change frame or plan selections. */
export type BuildApplicabilityStatus = "REQUIRED" | "SUGGESTED" | "EXCLUDED" | "UNRESOLVED";

export type BuildDisciplineDecision = {
  discipline: string;
  status: BuildApplicabilityStatus;
  confidence: Confidence;
  evidence: string[];
  exclusion_reason?: string;
};

export type BuildApplicabilityInput = {
  profile: ProjectProfile;
  changed_paths?: readonly string[];
  touched_paths?: readonly string[];
  summary?: string;
  risk_inputs?: readonly string[];
};

export type BuildApplicabilityResult = {
  decisions: BuildDisciplineDecision[];
  required: string[];
  suggested: string[];
  unresolved: string[];
  excluded: string[];
};

type Rule = {
  discipline: ModuleSlug;
  patterns: readonly RegExp[];
  required_with: readonly string[];
};

const RULES: readonly Rule[] = [
  rule("auth", [/\bauth(?:entication)?\b/iu, /\blog(?:in|out)\b/iu, /\bsession\b/iu], ["security"]),
  rule(
    "authorization",
    [/\bauthori[sz]ation\b/iu, /\b(?:rbac|permission|policy|ownership)\b/iu],
    ["security"]
  ),
  rule(
    "tenancy",
    [/\btenant(?:s|[-_ ]?(?:id|scope))?\b/iu, /\borganization[-_ ]?id\b/iu],
    ["security", "privacy"]
  ),
  rule(
    "uploads",
    [/\bupload(?:s|ing)?\b/iu, /\bmulter\b/iu, /\bfile[-_ ]?input\b/iu],
    ["storage", "security"]
  ),
  rule(
    "payments",
    [/\b(?:payment|billing|stripe|webhook|invoice)\b/iu],
    ["integrations", "security", "reliability"]
  ),
  rule("database", [/\b(?:migration|schema|prisma|sequelize|typeorm|sql)\b/iu], ["deployment"]),
  rule("queries", [/\b(?:query|search|pagination|repository|n\+1)\b/iu], ["performance"]),
  rule("cache", [/\b(?:cache|redis|memcached|invalidation)\b/iu], ["privacy"]),
  rule("jobs", [/\b(?:job|queue|worker|cron|schedule)\b/iu], ["reliability", "observability"]),
  rule("ai", [/\b(?:ai|llm|openai|embedding|prompt|model)\b/iu], ["security", "privacy"]),
  rule(
    "ui",
    [/\b(?:ui|dashboard|screen|component|dialog|form|route)\b/iu],
    ["ux", "accessibility", "frontend"]
  ),
  rule(
    "deployment",
    [/\b(?:deploy(?:ment)?|docker|terraform|kubernetes|ci|workflow)\b/iu],
    ["infrastructure"]
  )
];

const UI_EXTENSIONS = /\.(?:[cm]?[jt]sx?|vue|svelte)$/iu;
const UI_PATH = /(?:^|\/)(?:app|pages|routes|views|components|screens)(?:\/|$)/iu;
const DEPLOYMENT_PATH =
  /(?:^|\/)(?:\.github\/workflows|infra(?:structure)?|deploy(?:ment)?|k8s|helm)(?:\/|$)|(?:^|\/)(?:dockerfile|docker-compose[^/]*)$/iu;

/**
 * Derives Build-mode discipline obligations from classified discovery evidence and implementation
 * changes. Documentation, tests, fixtures, examples, and generated output never activate a rule.
 */
export function deriveBuildApplicability(input: BuildApplicabilityInput): BuildApplicabilityResult {
  const evidencePaths = [
    ...new Set([...(input.changed_paths ?? []), ...(input.touched_paths ?? [])])
  ]
    .map((path) => path.replace(/\\/gu, "/").replace(/^\.\//u, ""))
    .sort((a, b) => a.localeCompare(b));
  const activatingPaths = evidencePaths.filter((path) => {
    const classification = classifyEvidencePath(path);
    return ["implementation", "route", "schema", "manifest", "configuration"].includes(
      classification.evidence_class
    );
  });
  const ignoredPaths = evidencePaths.filter((path) => !activatingPaths.includes(path));
  const text = [input.summary ?? "", ...(input.risk_inputs ?? [])].join("\n");
  const decisions = new Map<string, BuildDisciplineDecision>();

  const require = (discipline: string, confidence: Confidence, evidence: string[]): void => {
    const prior = decisions.get(discipline);
    if (prior?.status === "REQUIRED") {
      prior.evidence.push(...evidence);
      if (confidenceRank(confidence) > confidenceRank(prior.confidence))
        prior.confidence = confidence;
      return;
    }
    decisions.set(discipline, { discipline, status: "REQUIRED", confidence, evidence });
  };
  const suggest = (discipline: string, evidence: string[]): void => {
    if (decisions.has(discipline)) return;
    decisions.set(discipline, { discipline, status: "SUGGESTED", confidence: "LOW", evidence });
  };

  for (const current of RULES) {
    const matchingPaths = activatingPaths.filter((path) =>
      current.patterns.some((pattern) => pattern.test(path))
    );
    const textMatch = current.patterns.some((pattern) => pattern.test(text));
    const capability = capabilityFor(current.discipline, input.profile);
    if (matchingPaths.length > 0 || capability.status === "PRESENT") {
      require(current.discipline, capability.status === "PRESENT" ? "HIGH" : "MEDIUM", [
        ...matchingPaths.map(
          (path) => `Changed executable path '${path}' matched the ${current.discipline} rule.`
        ),
        ...capability.evidence
      ]);
      for (const implied of current.required_with)
        require(implied, "MEDIUM", [
          `${current.discipline} requires the coupled '${implied}' discipline.`
        ]);
    } else if (textMatch) {
      decisions.set(current.discipline, {
        discipline: current.discipline,
        status: "UNRESOLVED",
        confidence: "LOW",
        evidence: [
          `Feature summary or risk input mentions ${current.discipline}.`,
          ...capability.evidence
        ]
      });
    } else if (capability.status === "ABSENT") {
      decisions.set(current.discipline, {
        discipline: current.discipline,
        status: "EXCLUDED",
        confidence: "HIGH",
        evidence: capability.evidence,
        exclusion_reason: `Discovery directly proved the ${current.discipline} capability absent.`
      });
    }
  }

  const uiPaths = activatingPaths.filter((path) => UI_EXTENSIONS.test(path) && UI_PATH.test(path));
  if (uiPaths.length > 0) {
    for (const discipline of ["ui", "ux", "accessibility", "frontend"])
      require(discipline, "HIGH", uiPaths.map(
        (path) => `Changed UI path '${path}' requires ${discipline}.`
      ));
  }
  const deploymentPaths = activatingPaths.filter((path) => DEPLOYMENT_PATH.test(path));
  if (deploymentPaths.length > 0) {
    for (const discipline of ["deployment", "infrastructure"])
      require(discipline, "HIGH", deploymentPaths.map(
        (path) => `Changed deployment path '${path}' requires ${discipline}.`
      ));
  }
  if (ignoredPaths.length > 0)
    suggest(
      "code",
      ignoredPaths.map((path) => `Ignored non-activating path '${path}' for capability inference.`)
    );

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

function rule(
  discipline: ModuleSlug,
  patterns: readonly RegExp[],
  requiredWith: readonly string[]
): Rule {
  return { discipline, patterns, required_with: requiredWith };
}

function capabilityFor(
  discipline: ModuleSlug,
  profile: ProjectProfile
): { status: "PRESENT" | "ABSENT" | "UNKNOWN"; evidence: string[] } {
  const status = capabilityStatusFor(discipline, profile);
  return status;
}

function confidenceRank(confidence: Confidence): number {
  return confidence === "HIGH" ? 3 : confidence === "MEDIUM" ? 2 : 1;
}
