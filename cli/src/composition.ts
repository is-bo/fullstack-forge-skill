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

import type { Confidence, ProfileRecord, ProjectProfile } from "./types.js";

export type CompositionMode = "forge-native" | "hybrid" | "upstream-powered";

/** Intent controls which progressive procedure and provider sources are admissible. */
export const COMPOSITION_WORKFLOWS = ["build", "audit", "fix", "verify", "ship"] as const;
export type CompositionWorkflow = (typeof COMPOSITION_WORKFLOWS)[number];

export type OutputClassification =
  "finding" | "finding-or-advisory" | "advisory" | "profile" | "specification" | "report" | "gate";

/**
 * Activation evidence. Every key except `always` names a dimension of the discovered project
 * profile or an explicit request; a condition holds when any listed value matches any dimension.
 * An unknown key can never activate a source, so a typo suppresses rather than over-activates.
 */
export type ActivationCondition = {
  always?: boolean;
  languages?: string[];
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
  /** Minimum confidence for profile-record matches in this condition. Defaults to MEDIUM. */
  minimumConfidence?: Confidence;
  /** Every nested condition must match. The strongest proven positive authority sets its rank. */
  allOf?: ActivationCondition[];
  /** At least one nested condition must match. The strongest matching branch wins. */
  anyOf?: ActivationCondition[];
  /** This nested condition must not match. It never increases activation strength. */
  not?: ActivationCondition;
};

export type CompositionSource = {
  provider: string;
  skill: string;
  path: string;
  role?: string;
  sequence?: number;
  sections?: string[];
  commands?: string[];
  /** Higher values win only after sequence and activation strength are equal. */
  priority?: number;
  /** Workflows in which this source may be selected; omission keeps the legacy tier policy. */
  workflows?: CompositionWorkflow[];
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
  /** Optional per-workflow Forge contract paths; build falls back to `forgeContract`. */
  forgeContracts?: Partial<Record<CompositionWorkflow, string>>;
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
  /** Generic workflow references used when a module has no per-workflow override. */
  workflowContracts?: Partial<Record<CompositionWorkflow, string>>;
  modules: ModuleComposition[];
};

/** One canonical dependency declaration retained for selection provenance. */
export type ModuleDependencyEdge = {
  /** Module whose declaration introduced this dependency. */
  parent: string;
  /** Module the parent requires. */
  dependency: string;
  /** Stable human-readable explanation suitable for module-decision evidence. */
  reason: string;
};

/**
 * Deterministic dependency closure for one or more explicitly selected roots.
 *
 * `modules` is breadth-first: de-duplicated roots first, then dependencies in each parent's
 * canonical declaration order. `edges` retains every reachable parent/dependency relationship,
 * including diamond joins and the edge that closes a cycle, so callers can explain why a module
 * was considered without attempting graph traversal themselves.
 */
export type ModuleDependencyClosure = {
  roots: string[];
  modules: string[];
  edges: ModuleDependencyEdge[];
};

/**
 * Validates and resolves the Forge-module dependency graph.
 *
 * Validation covers the complete manifest, not only the requested subgraph. A damaged registry
 * must fail closed even when the bad declaration is not reachable from this particular request.
 * Traversal is queue-based and marks a module when it is enqueued, so cycles terminate and diamond
 * dependencies appear only once in `modules` while all distinct explanatory edges remain visible.
 */
export function resolveModuleDependencyClosure(
  manifest: CompositionManifest,
  requestedModules: readonly string[]
): ModuleDependencyClosure {
  const declarations = new Map<string, ModuleComposition>();
  for (const declaration of manifest.modules) {
    const module = declaration.module.trim();
    if (module.length === 0) throw new Error("Composition manifest contains an empty module name");
    if (declarations.has(module))
      throw new Error(`Composition manifest declares module '${module}' more than once`);
    declarations.set(module, declaration);
  }

  for (const declaration of declarations.values()) {
    for (const dependency of declaration.dependsOn) {
      if (!declarations.has(dependency))
        throw new Error(
          `Composition manifest module '${declaration.module}' depends on unknown module '${dependency}'`
        );
    }
  }

  const roots: string[] = [];
  const seen = new Set<string>();
  for (const requested of requestedModules) {
    if (!declarations.has(requested)) throw new Error(`Unknown Forge module: ${requested}`);
    if (seen.has(requested)) continue;
    seen.add(requested);
    roots.push(requested);
  }

  const modules = [...roots];
  const queue = [...roots];
  const edges: ModuleDependencyEdge[] = [];
  const seenEdges = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const parent = queue[index];
    if (parent === undefined) continue;
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
      if (seen.has(dependency)) continue;
      seen.add(dependency);
      modules.push(dependency);
      queue.push(dependency);
    }
  }

  return { roots, modules, edges };
}

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
  workflow?: CompositionWorkflow;
  mode: CompositionMode;
  outputClassification: OutputClassification;
  /** Ordered load list. Index 0 is always the Forge contract. */
  selected: SelectedSource[];
  /** Sources to read when entering the module: Forge contract plus primary procedure. */
  eager?: SelectedSource[];
  /** Selected sources available on demand after the task reaches their concern. */
  deferred?: SelectedSource[];
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
  /** Explicit task intent. Undefined preserves the historical build composition. */
  workflow?: CompositionWorkflow;
  /** Providers or technologies the user asked for by name. */
  requested?: string[];
  /** Risk surfaces Forge proved for this task, e.g. `frontend`, `api`, `payments`. */
  riskSurfaces?: string[];
  /** Task-shaped facts that are not repository detections. */
  flags?: Partial<Record<CompositionTaskFlag, boolean>>;
};

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
] as const;

export type CompositionTaskFlag = (typeof COMPOSITION_TASK_FLAGS)[number];

const PROFILE_DIMENSIONS = {
  languages: (profile: ProjectProfile) => profile.languages,
  frameworks: (profile: ProjectProfile) => profile.frameworks,
  databases: (profile: ProjectProfile) => [...profile.databases, ...profile.orms],
  hosting: (profile: ProjectProfile) => [...profile.hosting, ...profile.deployment],
  integrations: (profile: ProjectProfile) => profile.integrations,
  observability: (profile: ProjectProfile) => profile.observability,
  paymentProviders: (profile: ProjectProfile) => profile.payment_providers,
  aiProviders: (profile: ProjectProfile) => profile.ai_providers
} as const;

type ProfileDimension = keyof typeof PROFILE_DIMENSIONS;

type ActivationMatch = {
  reason: string;
  /**
   * Higher is stronger. Compound `allOf` expressions retain their strongest proven repository
   * authority, but an explicit request for only one branch cannot promote the whole conjunction.
   */
  strength: number;
  /** True only when the source was selected by a direct user request. */
  explicit: boolean;
  /** Exclusion clauses filter positive evidence without changing its activation strength. */
  neutral: boolean;
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

const PROVIDER_PROFILE_DIMENSIONS = new Set<ProfileDimension>([
  "hosting",
  "integrations",
  "observability",
  "paymentProviders",
  "aiProviders"
]);

const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
});

/**
 * Activation conditions come from the generated registry, so an unknown key is a registry error,
 * not an opt-in signal. Keep the allowlist here instead of relying on TypeScript's static shape:
 * runtime JSON can contain keys the compiler never saw, including keys nested under `not`.
 */
const ACTIVATION_CONDITION_KEYS = new Set<string>([
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

const ACTIVATION_ARRAY_KEYS = new Set<string>([
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
function hasInvalidActivationShape(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return true;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ACTIVATION_CONDITION_KEYS.has(key))) return true;

  if (
    [...ACTIVATION_ARRAY_KEYS].some((key) => {
      const candidate = record[key];
      return (
        candidate !== undefined &&
        (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== "string"))
      );
    })
  )
    return true;

  if (record.always !== undefined && typeof record.always !== "boolean") return true;
  if (
    COMPOSITION_TASK_FLAGS.some(
      (flag) => record[flag] !== undefined && typeof record[flag] !== "boolean"
    )
  )
    return true;
  if (
    record.minimumConfidence !== undefined &&
    (typeof record.minimumConfidence !== "string" ||
      !Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, record.minimumConfidence))
  )
    return true;

  for (const key of ["allOf", "anyOf"] as const) {
    const candidate = record[key];
    if (
      candidate !== undefined &&
      (!Array.isArray(candidate) || candidate.some(hasInvalidActivationShape))
    )
      return true;
  }
  if (record.not !== undefined && hasInvalidActivationShape(record.not)) return true;
  return false;
}

/**
 * Evaluates one activation condition. Returns the reason it matched, or `undefined` when the
 * condition is not satisfied. A source with no positive satisfiable key never activates: absence
 * of evidence suppresses provider guidance rather than defaulting it on. `not` is an exclusion
 * filter only; it cannot establish applicability by itself.
 */
export function evaluateActivation(
  when: ActivationCondition,
  evidence: CompositionEvidence
): string | undefined {
  return evaluateActivationMatch(when, evidence)?.reason;
}

function evaluateActivationMatch(
  when: ActivationCondition,
  evidence: CompositionEvidence
): ActivationMatch | undefined {
  if (hasInvalidActivationShape(when)) return undefined;
  const result = evaluateActivationMatchUnchecked(when, evidence);
  // A neutral match is useful as an exclusion filter inside an allOf/anyOf expression, but it
  // is not positive applicability evidence when the whole source consists only of `not`.
  return result?.neutral === true ? undefined : result;
}

function evaluateActivationMatchUnchecked(
  when: ActivationCondition,
  evidence: CompositionEvidence
): ActivationMatch | undefined {
  if (when.not !== undefined && evaluateActivationMatchUnchecked(when.not, evidence) !== undefined)
    return undefined;

  const compound: ActivationMatch[] = [];
  if (when.allOf !== undefined) {
    if (when.allOf.length === 0) return undefined;
    const matches = when.allOf.map((condition) =>
      evaluateActivationMatchUnchecked(condition, evidence)
    );
    if (matches.some((match) => match === undefined)) return undefined;
    const proven = matches as ActivationMatch[];
    const ranked = proven.filter((match) => !match.neutral);
    const nonExplicit = ranked.filter((match) => !match.explicit);
    compound.push({
      reason: `all conditions matched: ${proven.map((match) => match.reason).join("; ")}`,
      strength:
        ranked.length === 0
          ? ACTIVATION_STRENGTH.condition
          : Math.max(
              ...(nonExplicit.length > 0 ? nonExplicit : ranked).map((match) => match.strength)
            ),
      explicit: ranked.length > 0 && ranked.every((match) => match.explicit),
      neutral: ranked.length === 0
    });
  }
  if (when.anyOf !== undefined) {
    if (when.anyOf.length === 0) return undefined;
    const matches = when.anyOf
      .map((condition) => evaluateActivationMatchUnchecked(condition, evidence))
      .filter((match): match is ActivationMatch => match !== undefined)
      .sort(compareActivationMatches);
    const strongest = matches[0];
    if (strongest === undefined) return undefined;
    compound.push({
      reason: `alternative matched: ${strongest.reason}`,
      strength: strongest.strength,
      explicit: strongest.explicit,
      neutral: strongest.neutral
    });
  }

  const atomic: ActivationMatch[] = [];
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

  for (const dimension of Object.keys(PROFILE_DIMENSIONS) as ProfileDimension[]) {
    const wanted = when[dimension];
    if (wanted === undefined || evidence.profile === undefined) continue;
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
    if (when[flag] !== true) continue;
    if (evidence.flags?.[flag] === true)
      atomic.push({
        reason: `task condition: ${flag}`,
        strength: ACTIVATION_STRENGTH.condition,
        explicit: false,
        neutral: false
      });
  }

  const hasAtomicClause =
    when.always !== undefined ||
    when.requested !== undefined ||
    when.riskSurfaces !== undefined ||
    (Object.keys(PROFILE_DIMENSIONS) as ProfileDimension[]).some(
      (dimension) => when[dimension] !== undefined
    ) ||
    COMPOSITION_TASK_FLAGS.some((flag) => when[flag] !== undefined);
  if (hasAtomicClause && atomic.length === 0) return undefined;

  const positives = [...compound, ...atomic];
  if (positives.length === 0) {
    if (when.not === undefined) return undefined;
    return {
      reason: "exclusion condition did not match",
      strength: ACTIVATION_STRENGTH.condition,
      explicit: false,
      neutral: true
    };
  }
  return positives.sort(compareActivationMatches)[0];
}

function compareActivationMatches(left: ActivationMatch, right: ActivationMatch): number {
  if (left.neutral !== right.neutral) return left.neutral ? 1 : -1;
  return right.strength - left.strength;
}

/**
 * Provider activation uses structured detection names and types only. Discovery evidence strings
 * are provenance (often file paths), not technology identifiers: searching them made `expo`
 * activate on `apps/exporter/package.json`. Exact normalized values or whole alphanumeric tokens
 * match after punctuation and spacing normalization; raw substrings and partial token matches never
 * do.
 */
function matchRecords(
  records: ProfileRecord[],
  wanted: string[],
  minimumConfidence: Confidence
): { reason: string; confidence: Confidence } | undefined {
  const targets = wanted.map((value) => ({
    normalized: normalize(value),
    canonical: tokenize(value).join("")
  }));
  for (const record of records) {
    if (CONFIDENCE_RANK[record.confidence] < CONFIDENCE_RANK[minimumConfidence]) continue;
    const values = [record.name, record.type].map((value) => ({
      normalized: normalize(value),
      canonical: tokenize(value).join("")
    }));
    for (const target of targets) {
      if (
        values.some(
          (value) =>
            value.normalized === target.normalized ||
            (target.canonical.length > 0 && value.canonical === target.canonical)
        )
      )
        return {
          reason: `${record.name} (${record.confidence} confidence)`,
          confidence: record.confidence
        };
    }
  }
  return undefined;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

export type ResolveOptions = {
  manifest: CompositionManifest;
  module: string;
  evidence: CompositionEvidence;
  /** Overrides `evidence.workflow`; omitted means the legacy build composition. */
  workflow?: CompositionWorkflow;
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

  const workflow = options.workflow ?? evidence.workflow ?? "build";
  assertCompositionWorkflow(workflow);

  const budget = declaration.contextBudget ?? manifest.defaultContextBudget;
  const contractPath = forgeContractPath(manifest, declaration, workflow);
  const selected: SelectedSource[] = [
    {
      tier: "forge-contract",
      provider: "fullstack-forge",
      skill: declaration.module,
      runtimePath: contractPath,
      reason:
        workflow === "build"
          ? "Forge module contract always loads first and is never overridden"
          : `Forge ${workflow} contract always loads first; build-only guidance is excluded`
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

  const eager = selected.filter(
    (source) => source.tier === "forge-contract" || source.tier === "primary"
  );
  const deferred = selected.filter(
    (source) => source.tier === "overlay" || source.tier === "supplemental"
  );
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

function assertCompositionWorkflow(value: string): asserts value is CompositionWorkflow {
  if (!(COMPOSITION_WORKFLOWS as readonly string[]).includes(value))
    throw new Error(
      `Unknown composition workflow '${value}'. Expected one of: ${COMPOSITION_WORKFLOWS.join(", ")}.`
    );
}

function forgeContractPath(
  manifest: CompositionManifest,
  declaration: ModuleComposition,
  workflow: CompositionWorkflow
): string {
  if (workflow === "build") return declaration.forgeContract;
  const modulePath = declaration.forgeContracts?.[workflow];
  if (modulePath !== undefined) return modulePath;
  const genericPath = manifest.workflowContracts?.[workflow];
  if (genericPath !== undefined) return genericPath;
  // Older manifests have no workflow map. The canonical installation always carries these
  // references, and selecting them keeps non-build runs free of build briefs.
  return `references/workflows/${workflow}.md`;
}

function sourceAllowedForWorkflow(
  source: CompositionSource,
  tier: SelectionTier,
  workflow: CompositionWorkflow
): boolean {
  if (source.workflows !== undefined) return source.workflows.includes(workflow);
  // Existing primary entries are implementation/build procedures. Keep overlays and
  // supplementals available to formal inspection and release workflows unless narrowed.
  return tier !== "primary" || workflow === "build";
}

function exactSourceRequest(
  source: Pick<CompositionSource, "provider" | "skill">,
  requested: string[]
): string | undefined {
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
function orderSources<T extends { source: CompositionSource; match: ActivationMatch | undefined }>(
  sources: T[]
): T[] {
  return [...sources].sort((a, b) => {
    const left = a.source.sequence ?? Number.MAX_SAFE_INTEGER;
    const right = b.source.sequence ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    const activation = compareActivationMatches(
      a.match ?? { reason: "", strength: 0, explicit: false, neutral: false },
      b.match ?? { reason: "", strength: 0, explicit: false, neutral: false }
    );
    if (activation !== 0) return activation;
    const priority = (b.source.priority ?? 0) - (a.source.priority ?? 0);
    if (priority !== 0) return priority;
    return (
      a.source.provider.localeCompare(b.source.provider) ||
      a.source.skill.localeCompare(b.source.skill)
    );
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
