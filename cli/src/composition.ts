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

import type { ProfileRecord, ProjectProfile } from "./types.js";

export type CompositionMode = "forge-native" | "hybrid" | "upstream-powered";

export type OutputClassification =
  "finding" | "finding-or-advisory" | "advisory" | "profile" | "specification" | "report" | "gate";

/**
 * Activation evidence. Every key except `always` names a dimension of the discovered project
 * profile or an explicit request; a condition holds when any listed value matches any dimension.
 * An unknown key can never activate a source, so a typo suppresses rather than over-activates.
 */
export type ActivationCondition = {
  always?: boolean;
  frameworks?: string[];
  databases?: string[];
  hosting?: string[];
  integrations?: string[];
  observability?: string[];
  paymentProviders?: string[];
  aiProviders?: string[];
  riskSurfaces?: string[];
  requested?: string[];
  ci?: boolean;
  retrieval?: boolean;
  migration?: boolean;
  threatModelling?: boolean;
  gdprRelevant?: boolean;
  testingApplicable?: boolean;
  missingEssentialRequirements?: boolean;
  divergentExploration?: boolean;
  incidentInvestigation?: boolean;
};

export type CompositionSource = {
  provider: string;
  skill: string;
  path: string;
  role?: string;
  sequence?: number;
  sections?: string[];
  commands?: string[];
  when: ActivationCondition;
};

export type ContextBudget = {
  maxPrimarySkills: number;
  maxOverlays: number;
  maxSupplemental: number;
};

export type ModuleComposition = {
  module: string;
  mode: CompositionMode;
  designation: string;
  forgeContract: string;
  primary: CompositionSource[];
  overlays: CompositionSource[];
  supplemental?: CompositionSource[];
  conflicts: { with: string; rule: string }[];
  dependsOn: string[];
  outputClassification: OutputClassification;
  contextBudget?: ContextBudget;
  forgeAuthority: string[];
};

export type CompositionManifest = {
  schemaVersion: number;
  defaultContextBudget: ContextBudget;
  modules: ModuleComposition[];
};

export type SelectionTier = "forge-contract" | "primary" | "overlay" | "supplemental";

export type SelectedSource = {
  tier: SelectionTier;
  provider: string;
  skill: string;
  runtimePath: string;
  reason: string;
};

export type SuppressedSource = {
  tier: SelectionTier;
  provider: string;
  skill: string;
  reason: string;
};

export type CompositionResult = {
  module: string;
  mode: CompositionMode;
  outputClassification: OutputClassification;
  /** Ordered load list. Index 0 is always the Forge contract. */
  selected: SelectedSource[];
  suppressed: SuppressedSource[];
  budget: ContextBudget;
  conflicts: { with: string; rule: string }[];
  forgeAuthority: string[];
  /** Provider content the manifest requires but the installation does not contain. */
  missing: string[];
};

/** Evidence the engine matches conditions against. Built from discovery plus the request. */
export type CompositionEvidence = {
  profile?: ProjectProfile;
  /** Providers or technologies the user asked for by name. */
  requested?: string[];
  /** Risk surfaces Forge proved for this task, e.g. `frontend`, `api`, `payments`. */
  riskSurfaces?: string[];
  /** Task-shaped facts that are not repository detections. */
  flags?: Partial<
    Record<
      | "ci"
      | "retrieval"
      | "migration"
      | "threatModelling"
      | "gdprRelevant"
      | "testingApplicable"
      | "missingEssentialRequirements"
      | "divergentExploration"
      | "incidentInvestigation",
      boolean
    >
  >;
};

const PROFILE_DIMENSIONS = {
  frameworks: (profile: ProjectProfile) => profile.frameworks,
  databases: (profile: ProjectProfile) => [...profile.databases, ...profile.orms],
  hosting: (profile: ProjectProfile) => [...profile.hosting, ...profile.deployment],
  integrations: (profile: ProjectProfile) => profile.integrations,
  observability: (profile: ProjectProfile) => profile.observability,
  paymentProviders: (profile: ProjectProfile) => profile.payment_providers,
  aiProviders: (profile: ProjectProfile) => profile.ai_providers
} as const;

type ProfileDimension = keyof typeof PROFILE_DIMENSIONS;

const BOOLEAN_FLAGS = [
  "ci",
  "retrieval",
  "migration",
  "threatModelling",
  "gdprRelevant",
  "testingApplicable",
  "missingEssentialRequirements",
  "divergentExploration",
  "incidentInvestigation"
] as const;

/**
 * Evaluates one activation condition. Returns the reason it matched, or `undefined` when the
 * condition is not satisfied. A source with no satisfiable key never activates: absence of
 * evidence suppresses provider guidance rather than defaulting it on.
 */
export function evaluateActivation(
  when: ActivationCondition,
  evidence: CompositionEvidence
): string | undefined {
  if (when.always === true) return "always applicable within this module";

  const requested = (evidence.requested ?? []).map(normalize);
  if (when.requested !== undefined) {
    const hit = when.requested.find((value) => requested.includes(normalize(value)));
    if (hit !== undefined) return `explicitly requested: ${hit}`;
  }

  if (when.riskSurfaces !== undefined) {
    const surfaces = (evidence.riskSurfaces ?? []).map(normalize);
    const hit = when.riskSurfaces.find((value) => surfaces.includes(normalize(value)));
    if (hit !== undefined) return `proven risk surface: ${hit}`;
  }

  for (const dimension of Object.keys(PROFILE_DIMENSIONS) as ProfileDimension[]) {
    const wanted = when[dimension];
    if (wanted === undefined || evidence.profile === undefined) continue;
    const records = PROFILE_DIMENSIONS[dimension](evidence.profile);
    const hit = matchRecords(records, wanted);
    if (hit !== undefined) return `repository evidence (${dimension}): ${hit}`;
  }

  for (const flag of BOOLEAN_FLAGS) {
    if (when[flag] !== true) continue;
    if (evidence.flags?.[flag] === true) return `task condition: ${flag}`;
  }

  return undefined;
}

/**
 * A dependency name alone is weak evidence, so matching runs against the detection's name, type,
 * and recorded evidence strings, and a detection whose confidence is `low` does not activate a
 * provider overlay on its own.
 */
function matchRecords(records: ProfileRecord[], wanted: string[]): string | undefined {
  const targets = wanted.map(normalize);
  for (const record of records) {
    if (record.confidence === "LOW") continue;
    const haystack = [record.name, record.type, ...record.evidence].map(normalize);
    for (const target of targets) {
      if (haystack.some((value) => value === target || value.includes(target)))
        return `${record.name} (${record.confidence} confidence)`;
    }
  }
  return undefined;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export type ResolveOptions = {
  manifest: CompositionManifest;
  module: string;
  evidence: CompositionEvidence;
  /** Runtime paths the installation actually contains, for damaged-installation detection. */
  availableRuntimePaths?: ReadonlySet<string>;
  /** Resolves a manifest source to its compiled runtime path. */
  runtimePathFor: (source: CompositionSource) => string;
};

/**
 * Resolves one module's composition. Deterministic: the same manifest and evidence always produce
 * the same ordered result, so generated reports and tests are stable.
 */
export function resolveComposition(options: ResolveOptions): CompositionResult {
  const { manifest, module, evidence, runtimePathFor, availableRuntimePaths } = options;
  const declaration = manifest.modules.find((entry) => entry.module === module);
  if (declaration === undefined) throw new Error(`Unknown Forge module: ${module}`);

  const budget = declaration.contextBudget ?? manifest.defaultContextBudget;
  const selected: SelectedSource[] = [
    {
      tier: "forge-contract",
      provider: "fullstack-forge",
      skill: declaration.module,
      runtimePath: declaration.forgeContract,
      reason: "Forge module contract always loads first and is never overridden"
    }
  ];
  const suppressed: SuppressedSource[] = [];
  const missing: string[] = [];

  const tiers: { tier: SelectionTier; sources: CompositionSource[]; limit: number }[] = [
    { tier: "primary", sources: declaration.primary, limit: budget.maxPrimarySkills },
    { tier: "overlay", sources: declaration.overlays, limit: budget.maxOverlays },
    { tier: "supplemental", sources: declaration.supplemental ?? [], limit: budget.maxSupplemental }
  ];

  for (const { tier, sources, limit } of tiers) {
    let admitted = 0;
    for (const source of orderSources(sources)) {
      const reason = evaluateActivation(source.when, evidence);
      if (reason === undefined) {
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
          reason: `context budget reached (max ${limit} ${tier})`
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
      selected.push({ tier, provider: source.provider, skill: source.skill, runtimePath, reason });
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

/**
 * Declared `sequence` first (the requirements module runs interview → refine → spec → plan in that
 * order), then provider and skill name, so ordering never depends on object key iteration.
 */
function orderSources(sources: CompositionSource[]): CompositionSource[] {
  return [...sources].sort((a, b) => {
    const left = a.sequence ?? Number.MAX_SAFE_INTEGER;
    const right = b.sequence ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    return a.provider.localeCompare(b.provider) || a.skill.localeCompare(b.skill);
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
] as const);

export type PrecedenceLevel = (typeof PRECEDENCE)[number];

export function precedenceRank(level: PrecedenceLevel): number {
  return PRECEDENCE.indexOf(level);
}

/**
 * Resolves a conflict between two competing instructions. Returns the winner. Ties are impossible
 * between different levels; at the same level the caller must resolve it explicitly, so this
 * returns `undefined` rather than guessing.
 */
export function resolveConflict(
  left: PrecedenceLevel,
  right: PrecedenceLevel
): PrecedenceLevel | undefined {
  const a = precedenceRank(left);
  const b = precedenceRank(right);
  if (a === b) return undefined;
  return a < b ? left : right;
}
