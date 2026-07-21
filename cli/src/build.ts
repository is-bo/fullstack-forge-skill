import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { BUILD_SUB_VERBS } from "./constants.js";
import { migrateBuildState } from "./build-migration.js";
import { runAnalyzers } from "./analyzers.js";
import { deriveBuildApplicability, type BuildApplicabilityResult } from "./build-applicability.js";
import { evaluateBuildGates, planBuildGates, type BuildGatePlan } from "./build-gates.js";
import { detectProjectCommands, discoverProject } from "./discovery.js";
import {
  BUILD_PRODUCER_EXPIRY_MS,
  BUILD_PRODUCER_REGISTRY,
  BUILD_PRODUCER_VERSION,
  BUILD_UNAVAILABLE_PRODUCER,
  executeBuildProducer,
  type BuildProducerObservation
} from "./build-producers.js";
import {
  BUILD_RUNTIME_STATES,
  casesFromRenderedCapture,
  deriveBuildRuntimeEvidence,
  planBuildRuntime,
  type BuildRuntimePlan,
  type BuildRuntimeState,
  type DesignDirectionResult,
  type RenderedRuntimeCapture,
  type RuntimeStateCapture
} from "./build-runtime.js";
import {
  createBuildEvidenceEnvelope,
  type BuildEvidenceClaim,
  type EvidenceCommand,
  type EvidenceRuntimeContext
} from "./evidence-envelope.js";
import { inspectRenderedUi } from "./rendered-ui.js";
import { analyzeChangedScope } from "./scope.js";
import { isForgePackageRoot } from "./tools.js";
import { redactError, redactToString } from "./redaction.js";
import type { CliOptions, CommandDefinition, ProjectProfile } from "./types.js";
import {
  canonicalDirectory,
  resolveInside,
  runFile,
  sha256,
  toPosix,
  utcNow,
  walkFiles,
  workingTreeRevision
} from "./utils.js";
import {
  BUILD_TIERS,
  REPAIR_CAP,
  SECURITY_DISCIPLINES,
  TERMINAL_PHASES,
  appendSelectionEvent,
  assertValidSlug,
  listFeatures,
  loadFeature,
  loadProject,
  newFeature,
  newProject,
  reverifyEvidenceHashes,
  saveFeature,
  saveProject,
  upsertFeatureIndex,
  writeArtifact,
  type BuildFeature,
  type BuildTier,
  type CriterionEvidence,
  type EvidenceFile
} from "./build-state.js";

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".vue",
  ".svelte"
]);
const WORKTREE_EXCLUDE = new Set([
  ".git",
  ".forge",
  ".fullstack-forge",
  ".next",
  ".nuxt",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor"
]);
const MAX_SCOPE_FILES = 2000;

type BuildOptions = {
  cwd: string;
  json: boolean;
  dryRun: boolean;
  global: boolean;
  offline: boolean;
  allowRun: boolean;
  force: boolean;
  migrationResume: boolean;
  migrationRollback: boolean;
  tier?: BuildTier;
  summary?: string;
  reason?: string;
  criterion?: string;
  base?: string;
  name?: string;
  scale?: string;
  designRef?: string;
  actor?: string;
  riskCategory?: "advisory" | "operational";
  url?: string;
  role?: string;
  designDirection?: string;
  evidenceDir?: string;
  disciplines: string[];
  inputs: string[];
  touch: string[];
  stack: string[];
  nonGoals: string[];
  decisions: string[];
  assumptions: string[];
  usersRoles: string[];
  workflows: string[];
  invariants: string[];
  sensitiveData: string[];
  trustBoundaries: string[];
  outcomes: string[];
  constraints: string[];
  projectAssumptions: string[];
  unresolvedDecisions: string[];
  backlog: string[];
  runtimeCases: string[];
  positionals: string[];
};

/**
 * Build-mode entry point.
 *
 * `cli.ts` delegates here before any module-slug parsing when the first token is a build verb, so
 * every existing audit command behaves exactly as before. Build has its own flag surface (tiers,
 * summaries, disciplines) and parses its own argv rather than widening the audit option type.
 */
export async function runBuild(argv: string[]): Promise<number> {
  const options = parseBuildArgs(argv);
  const verb = options.positionals[0];
  const root = await canonicalDirectory(options.cwd);
  if (verb === "new") return buildNew(root, options);
  if (verb === "resume") return buildResume(root, options);
  if (verb === "feature") return featureDispatch(root, options);
  if (verb === "migrate") return buildMigrate(root, options);
  throw new Error(`Unknown build verb '${verb ?? ""}'. Expected new, feature, resume, or migrate.`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseBuildArgs(argv: string[]): BuildOptions {
  const options: BuildOptions = {
    cwd: process.cwd(),
    json: false,
    dryRun: false,
    global: false,
    offline: false,
    allowRun: false,
    force: false,
    migrationResume: false,
    migrationRollback: false,
    disciplines: [],
    inputs: [],
    touch: [],
    stack: [],
    nonGoals: [],
    decisions: [],
    assumptions: [],
    usersRoles: [],
    workflows: [],
    invariants: [],
    sensitiveData: [],
    trustBoundaries: [],
    outcomes: [],
    constraints: [],
    projectAssumptions: [],
    unresolvedDecisions: [],
    backlog: [],
    runtimeCases: [],
    positionals: []
  };
  const valueFlags: Record<
    string,
    | "cwd"
    | "tier"
    | "summary"
    | "reason"
    | "criterion"
    | "base"
    | "name"
    | "scale"
    | "designRef"
    | "actor"
    | "riskCategory"
    | "url"
    | "role"
    | "designDirection"
    | "evidenceDir"
  > = {
    "--root": "cwd",
    "--cwd": "cwd",
    "--tier": "tier",
    "--summary": "summary",
    "--reason": "reason",
    "--criterion": "criterion",
    "--base": "base",
    "--name": "name",
    "--scale": "scale",
    "--design-ref": "designRef",
    "--actor": "actor",
    "--risk-category": "riskCategory",
    "--url": "url",
    "--role": "role",
    "--design-direction": "designDirection",
    "--evidence-dir": "evidenceDir"
  };
  const listFlags: Record<
    string,
    | "disciplines"
    | "inputs"
    | "touch"
    | "stack"
    | "nonGoals"
    | "decisions"
    | "assumptions"
    | "usersRoles"
    | "workflows"
    | "invariants"
    | "sensitiveData"
    | "trustBoundaries"
    | "outcomes"
    | "constraints"
    | "projectAssumptions"
    | "unresolvedDecisions"
    | "backlog"
    | "runtimeCases"
  > = {
    "--discipline": "disciplines",
    "--input": "inputs",
    "--touch": "touch",
    "--stack": "stack",
    "--non-goal": "nonGoals",
    "--decision": "decisions",
    "--assumption": "assumptions",
    "--user-role": "usersRoles",
    "--workflow": "workflows",
    "--invariant": "invariants",
    "--sensitive-data": "sensitiveData",
    "--trust-boundary": "trustBoundaries",
    "--outcome": "outcomes",
    "--constraint": "constraints",
    "--project-assumption": "projectAssumptions",
    "--unresolved-decision": "unresolvedDecisions",
    "--backlog": "backlog",
    "--runtime-case": "runtimeCases"
  };
  const assign = (key: (typeof valueFlags)[string], value: string): void => {
    if (key === "cwd") options.cwd = value;
    else if (key === "tier") options.tier = validateTier(value);
    else if (key === "riskCategory") options.riskCategory = validateRiskCategory(value);
    else options[key] = value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--json") options.json = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--global") options.global = true;
    else if (arg === "--offline") options.offline = true;
    else if (arg === "--allow-run") options.allowRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--resume") options.migrationResume = true;
    else if (arg === "--rollback") options.migrationRollback = true;
    else if (arg.startsWith("--") && arg.includes("=")) {
      const [flag, ...rest] = arg.split("=");
      const value = rest.join("=");
      const listKey = listFlags[flag ?? ""];
      const valueKey = valueFlags[flag ?? ""];
      if (listKey !== undefined) options[listKey].push(value);
      else if (valueKey !== undefined) assign(valueKey, value);
      else throw new Error(`Unknown option '${flag}'`);
    } else if (arg in listFlags) {
      const key = listFlags[arg];
      const value = argv[index + 1];
      if (key === undefined || value === undefined)
        throw new Error(`Option '${arg}' requires a value`);
      options[key].push(value);
      index += 1;
    } else if (arg in valueFlags) {
      const key = valueFlags[arg];
      const value = argv[index + 1];
      if (key === undefined || value === undefined)
        throw new Error(`Option '${arg}' requires a value`);
      assign(key, value);
      index += 1;
    } else if (arg.startsWith("-")) throw new Error(`Unknown option '${arg}'`);
    else options.positionals.push(arg);
  }
  options.cwd = resolve(options.cwd);
  return options;
}

// ---------------------------------------------------------------------------
// forge migrate build
// ---------------------------------------------------------------------------

async function buildMigrate(root: string, options: BuildOptions): Promise<number> {
  const target = options.positionals[1];
  if (target !== "build" || options.positionals.length !== 2)
    throw new Error(
      "Usage: forge migrate build [--dry-run] [--resume|--rollback]. Migration never runs implicitly."
    );
  const plan = await migrateBuildState(root, {
    dryRun: options.dryRun,
    resume: options.migrationResume,
    rollback: options.migrationRollback
  });
  return report(options, {
    operation: options.migrationRollback
      ? "migrate-build-rollback"
      : options.migrationResume
        ? "migrate-build-resume"
        : options.dryRun
          ? "migrate-build-dry-run"
          : "migrate-build",
    schema_version: 2,
    dry_run: options.dryRun,
    files: plan.entries,
    writes: plan.writes,
    next: options.dryRun
      ? "Review this plan, then run `forge migrate build`."
      : options.migrationRollback
        ? "Legacy v0.2.0 bytes were restored exactly; run migration again before other Build commands."
        : "Build state migration is complete."
  });
}

function validateTier(value: string): BuildTier {
  if (!(BUILD_TIERS as readonly string[]).includes(value))
    throw new Error(`Unknown tier '${value}'. Expected light, standard, or high.`);
  return value as BuildTier;
}

function validateRiskCategory(value: string): "advisory" | "operational" {
  if (value !== "advisory" && value !== "operational")
    throw new Error("--risk-category must be advisory or operational.");
  return value;
}

function parseDisciplines(values: string[]): { slug: string; reason: string }[] {
  return values.map((value) => {
    const separator = value.indexOf(":");
    const slug = (separator === -1 ? value : value.slice(0, separator)).trim();
    const reason = separator === -1 ? "selected at frame" : value.slice(separator + 1).trim();
    return { slug, reason: reason.length === 0 ? "selected at frame" : reason };
  });
}

function parseNonGoals(values: string[]): { item: string; reason: string }[] {
  return values.map((value) => {
    const separator = value.indexOf(":");
    const item = (separator === -1 ? value : value.slice(0, separator)).trim();
    const reason = separator === -1 ? "no reason recorded" : value.slice(separator + 1).trim();
    return { item, reason: reason.length === 0 ? "no reason recorded" : reason };
  });
}

function parseStackEntries(values: string[]): Array<{ name: string; rationale: string }> {
  return values.map((value) => {
    const separator = value.indexOf(":");
    const name = (separator === -1 ? value : value.slice(0, separator)).trim();
    if (name.length === 0) throw new Error("--stack requires a non-empty stack name.");
    return {
      name,
      rationale: separator === -1 ? "" : value.slice(separator + 1).trim()
    };
  });
}

function parseUsersRoles(values: string[]): Array<{ user: string; roles: string[] }> {
  return values.map((value) => {
    const separator = value.indexOf(":");
    const user = (separator === -1 ? value : value.slice(0, separator)).trim();
    const roles =
      separator === -1
        ? []
        : value
            .slice(separator + 1)
            .split(",")
            .map((role) => role.trim())
            .filter(Boolean);
    if (user.length === 0) throw new Error("--user-role requires a non-empty user label.");
    return { user, roles };
  });
}

// ---------------------------------------------------------------------------
// forge new
// ---------------------------------------------------------------------------

async function buildNew(root: string, options: BuildOptions): Promise<number> {
  const existing = await loadProject(root);
  if (existing !== undefined && !options.force)
    throw new Error(
      "A build project already exists at .forge/build/project.json. Pass --force to reinitialize it."
    );
  const project = newProject(options.summary ?? "", options.tier);
  const stackEntries = parseStackEntries(options.stack);
  const usersAndRoles = parseUsersRoles(options.usersRoles);
  project.stack = stackEntries.map((entry) => entry.name);
  project.non_goals = parseNonGoals(options.nonGoals);
  if (options.name !== undefined) project.product.name = options.name;
  project.frame = {
    ...project.frame,
    problem_statement: options.summary ?? project.frame.problem_statement,
    target_users: usersAndRoles.map((entry) => entry.user),
    users_and_roles: usersAndRoles,
    desired_outcomes: options.outcomes,
    business_rules: options.invariants,
    business_invariants: options.invariants,
    constraints: options.constraints,
    critical_workflows: options.workflows,
    sensitive_data_classes: options.sensitiveData,
    trust_boundaries: options.trustBoundaries,
    expected_scale: options.scale ?? "",
    stack_entries: stackEntries,
    assumptions: options.projectAssumptions,
    unresolved_decisions: options.unresolvedDecisions,
    initial_feature_backlog: options.backlog,
    design_direction_reference: options.designRef ?? ".forge/build/DESIGN.md"
  };
  project.design_alignment = {
    status: "NOT_VERIFIED",
    references: [project.frame.design_direction_reference],
    recorded_at: project.updated_at
  };
  const projectPath = await saveProject(root, project, options.dryRun);
  const decisionsPath = await writeArtifact(
    root,
    "DECISIONS.md",
    DECISIONS_TEMPLATE,
    options.dryRun
  );
  const designPath = await writeArtifact(
    root,
    "DESIGN.md",
    designTemplate(project.product.summary),
    options.dryRun
  );
  return report(options, {
    operation: "new",
    dry_run: options.dryRun,
    project_path: projectPath,
    artifacts: [decisionsPath, designPath].filter((path) => path !== undefined),
    project,
    next: "Run `forge feature <slug> --tier <light|standard|high>` to start a feature."
  });
}

// ---------------------------------------------------------------------------
// forge resume
// ---------------------------------------------------------------------------

async function buildResume(root: string, options: BuildOptions): Promise<number> {
  const loadedProject = await loadProject(root);
  const features = await listFeatures(root);
  const profile = await discoverProject(root);
  let project = loadedProject;
  if (project !== undefined) {
    project = { ...project, features: [] };
    for (const loaded of features) {
      const { feature, demoted, verified } = await reverifyEvidenceHashes(root, loaded);
      const planningChanged = await refreshBuildPlanning(root, feature, profile, options);
      if (feature.phase === "done" && missingForDone(feature, new Set(verified)).length > 0)
        feature.phase = "check";
      if (planningChanged || demoted.length > 0 || feature.phase !== loaded.phase)
        await saveFeature(root, feature, options.dryRun);
      project = upsertFeatureIndex(project, feature);
    }
    if (JSON.stringify(project.features) !== JSON.stringify(loadedProject?.features))
      await saveProject(root, project, options.dryRun);
  }
  const unfinished = (project?.features ?? []).filter((entry) => !TERMINAL_PHASES.has(entry.phase));
  const mostRecent = [...unfinished].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  return report(options, {
    operation: "resume",
    project_initialized: project !== undefined,
    unfinished_features: unfinished,
    most_recent: mostRecent,
    next:
      mostRecent === undefined
        ? "No unfinished features. Run `forge feature <slug>` to start one."
        : `Resume with \`forge feature ${mostRecent.slug}\`.`
  });
}

// ---------------------------------------------------------------------------
// forge feature dispatch
// ---------------------------------------------------------------------------

async function featureDispatch(root: string, options: BuildOptions): Promise<number> {
  const slug = options.positionals[1];
  const sub = options.positionals[2];
  if (slug === undefined)
    throw new Error(
      "forge feature requires a feature slug.\n" +
        "Usage: forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status]\n" +
        `Sub-verbs: ${BUILD_SUB_VERBS.join(", ")}.`
    );
  // A reserved word in the slug position is almost always a misremembered command such as
  // `forge feature audit`; explain the grammar rather than emitting a bare validation error.
  try {
    assertValidSlug(slug);
  } catch (error) {
    throw new Error(
      `${(error as Error).message}\n` +
        "Usage: forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status]\n" +
        "The first argument is a feature name you choose, not a command. To review an arbitrary diff use `forge all audit --scope changed`.",
      { cause: error }
    );
  }
  if (sub !== undefined && !(BUILD_SUB_VERBS as readonly string[]).includes(sub))
    throw new Error(
      `Unknown sub-verb '${sub}' for feature '${slug}'. Expected one of: ${BUILD_SUB_VERBS.join(", ")}.`
    );
  switch (sub) {
    case undefined:
      return featureStart(root, slug, options);
    case "frame":
      return featureFrame(root, slug, options);
    case "plan":
      return featurePlan(root, slug, options);
    case "check":
      return featureCheck(root, slug, options);
    case "done":
      return featureDone(root, slug, options);
    case "accept-risk":
      return featureAcceptRisk(root, slug, options);
    case "abandon":
      return featureAbandon(root, slug, options);
    case "status":
      return featureStatus(root, slug, options);
    default:
      throw new Error(`Unhandled sub-verb '${sub}'.`);
  }
}

async function ensureProjectIndex(
  root: string,
  feature: BuildFeature,
  options: BuildOptions
): Promise<void> {
  const project =
    (await loadProject(root)) ?? newProject("(created implicitly by forge feature)", undefined);
  await saveProject(root, upsertFeatureIndex(project, feature), options.dryRun);
}

// ---------------------------------------------------------------------------
// feature: start / resume (no sub-verb)
// ---------------------------------------------------------------------------

async function featureStart(root: string, slug: string, options: BuildOptions): Promise<number> {
  const existing = await loadFeature(root, slug);
  if (existing !== undefined) {
    const { feature, demoted, verified } = await reverifyEvidenceHashes(root, existing);
    const planningChanged = await refreshBuildPlanning(
      root,
      feature,
      await discoverProject(root),
      options
    );
    if (feature.phase === "done" && missingForDone(feature, new Set(verified)).length > 0)
      feature.phase = "check";
    if (planningChanged || demoted.length > 0 || feature.phase !== existing.phase) {
      await saveFeature(root, feature, options.dryRun);
      await ensureProjectIndex(root, feature, options);
    }
    return renderFeature(options, feature, {
      operation: "resume",
      demoted,
      next: nextStepFor(feature, new Set(verified))
    });
  }
  const tier = options.tier ?? "standard";
  const feature = newFeature(slug, tier, options.summary ?? "");
  applyFrameInputs(feature, options);
  const tierNotes: string[] = [];
  applyTierPolicy(feature, tierNotes);
  if (feature.tier === "light") {
    if (!options.json) for (const note of tierNotes) print(`Note: ${note}`);
    // Light tier is a one-shot flow: creating the feature immediately runs the check pass so the
    // whole lifecycle is `forge feature <slug> --tier light [--allow-run]` then `forge feature
    // <slug> done` — two CLI invocations, exactly as the design requires.
    return runCheckPass(root, feature, options, "start-light");
  }
  feature.phase = "frame";
  await saveFeature(root, feature, options.dryRun);
  await ensureProjectIndex(root, feature, options);
  return renderFeature(options, feature, {
    operation: "start",
    notes: tierNotes,
    next: nextStepFor(feature)
  });
}

/**
 * A feature whose slug, summary, tier inputs, or selected disciplines signal a high-risk class
 * (money movement, identity, tenancy, uploads, AI, migrations, secrets, sessions, cryptography,
 * SSRF, destructive data operations) must not silently run below high tier. The escalation is
 * overridable, but only with a recorded reason.
 */
const HIGH_TIER_TRIGGER = new RegExp(
  "\\b(payments?|billing|checkout|refunds?|authn?|authz|authorization|login|sessions?|" +
    "passwords?|credentials?|secrets?|tokens?|oauth|sso|uploads?|tenants?|tenancy|" +
    "ai|llm|prompts?|migrations?|destructive|cryptography|encryption|webhooks?|pii|" +
    "privacy|gdpr|ssrf)\\b",
  "giu"
);

function highTierTriggers(feature: BuildFeature): string[] {
  const sources = [
    feature.slug,
    feature.summary,
    ...feature.disciplines.map((selection) => selection.slug),
    ...feature.tier_inputs
  ];
  const found = new Set<string>();
  for (const source of sources)
    for (const match of source.toLowerCase().matchAll(HIGH_TIER_TRIGGER)) found.add(match[0]);
  return [...found].sort();
}

function applyTierPolicy(feature: BuildFeature, notes: string[]): void {
  if (feature.tier === "high") return;
  const triggers = highTierTriggers(feature);
  if (triggers.length === 0) return;
  const recorded = `high-tier triggers: ${triggers.join(", ")}`;
  feature.tier_inputs = [...new Set([...feature.tier_inputs, recorded])];
  if (feature.tier_override_reason !== undefined) {
    notes.push(`Tier kept at ${feature.tier} despite ${recorded}; override reason is recorded.`);
    return;
  }
  feature.tier = "high";
  notes.push(`Tier escalated to high (${recorded}). Override with --tier <tier> --reason "<why>".`);
}

function applyFrameInputs(feature: BuildFeature, options: BuildOptions): void {
  if (options.summary !== undefined) feature.summary = options.summary;
  applySelectedDisciplines(feature, options.disciplines);
  if (options.inputs.length > 0) feature.tier_inputs = [...new Set(options.inputs)];
  if (options.touch.length > 0)
    feature.touched_paths = [...new Set(options.touch.map((path) => toPosix(path)))];
  if (options.decisions.length > 0)
    feature.decisions = [...feature.decisions, ...options.decisions];
  if (options.assumptions.length > 0)
    feature.assumptions = [...feature.assumptions, ...options.assumptions];
  if (options.reason !== undefined) feature.tier_override_reason = options.reason;
}

function applySelectedDisciplines(feature: BuildFeature, values: string[]): void {
  if (values.length > 0) {
    const previous = new Map(feature.disciplines.map((item) => [item.slug, item.reason]));
    const selected = parseDisciplines(values);
    const next = new Set(selected.map((item) => item.slug));
    for (const item of selected)
      if (!previous.has(item.slug))
        feature.selection_events = appendSelectionEvent(feature, {
          kind: "discipline",
          action: "selected",
          value: item.slug,
          reason: item.reason,
          source: "user"
        }).selection_events;
    for (const [slug, reason] of previous)
      if (!next.has(slug))
        feature.selection_events = appendSelectionEvent(feature, {
          kind: "discipline",
          action: "deselected",
          value: slug,
          reason,
          source: "user"
        }).selection_events;
    feature.disciplines = selected;
  }
}

// ---------------------------------------------------------------------------
// feature frame / plan
// ---------------------------------------------------------------------------

async function featureFrame(root: string, slug: string, options: BuildOptions): Promise<number> {
  const feature =
    (await loadFeature(root, slug)) ?? newFeature(slug, options.tier ?? "standard", "");
  if (options.tier !== undefined) feature.tier = options.tier;
  applyFrameInputs(feature, options);
  const tierNotes: string[] = [];
  applyTierPolicy(feature, tierNotes);
  // frame is recorded guidance; it never regresses a feature past its current phase.
  if (feature.phase === "abandoned" || feature.phase === "done")
    throw new Error(`Feature '${slug}' is ${feature.phase} and cannot be reframed.`);
  if (feature.phase === "frame") feature.phase = "frame";
  const planning = await deriveBuildPlanning(root, feature, await discoverProject(root), options);
  applyBuildPlanning(feature, planning);
  await saveFeature(root, feature, options.dryRun);
  await ensureProjectIndex(root, feature, options);
  return renderFeature(options, feature, {
    operation: "frame",
    notes: tierNotes,
    next: nextStepFor(feature)
  });
}

async function featurePlan(root: string, slug: string, options: BuildOptions): Promise<number> {
  const feature = await requireFeature(root, slug);
  if (TERMINAL_PHASES.has(feature.phase))
    throw new Error(`Feature '${slug}' is ${feature.phase}; it cannot be planned.`);
  if (options.summary !== undefined && feature.summary.length === 0)
    feature.summary = options.summary;
  applySelectedDisciplines(feature, options.disciplines);
  const planSummary = options.summary ?? feature.plan_summary ?? feature.summary;
  feature.plan_summary = planSummary;
  feature.plan_hash = sha256(
    `${planSummary}\u0000${feature.disciplines
      .map((d) => d.slug)
      .sort()
      .join(",")}`
  );
  if (options.decisions.length > 0)
    feature.decisions = [...feature.decisions, ...options.decisions];
  // Disciplines added at plan time can introduce high-risk classes, so the tier floor is
  // re-evaluated here, not only at frame.
  const tierNotes: string[] = [];
  applyTierPolicy(feature, tierNotes);
  const planning = await deriveBuildPlanning(root, feature, await discoverProject(root), options);
  applyBuildPlanning(feature, planning);
  feature.phase = "plan";
  await saveFeature(root, feature, options.dryRun);
  await ensureProjectIndex(root, feature, options);
  return renderFeature(options, feature, {
    operation: "plan",
    notes: tierNotes,
    next: nextStepFor(feature)
  });
}

// ---------------------------------------------------------------------------
// feature check
// ---------------------------------------------------------------------------

type BuildPlanning = {
  revision: string;
  scope: ScopeResult;
  commands: CommandDefinition[];
  applicability: BuildApplicabilityResult;
  gatePlan: BuildGatePlan;
};

async function deriveBuildPlanning(
  root: string,
  feature: BuildFeature,
  profile: ProjectProfile,
  options: BuildOptions
): Promise<BuildPlanning> {
  const revision = await workingTreeRevision(root);
  const scope = await resolveBuildScope(root, profile, feature, options.base);
  const project = await loadProject(root);
  const derived = deriveBuildApplicability({
    profile,
    changed_paths: scope.files,
    touched_paths: feature.touched_paths,
    summary: feature.summary,
    risk_inputs: feature.tier_inputs,
    risk_baseline: project?.risk_class ?? feature.tier
  });
  const applicability = mergeExplicitApplicability(derived, feature);
  const commands = await detectProjectCommands(root);
  const gatePlan = planBuildGates({
    tier: feature.tier,
    commands,
    applicability,
    profile,
    runtime_available:
      options.url !== undefined ||
      options.runtimeCases.length > 0 ||
      feature.evidence.some(
        (record) => record.criterion === "runtime:rendered-ui" && record.status === "PASS"
      )
  });
  return { revision, scope, commands, applicability, gatePlan };
}

async function refreshBuildPlanning(
  root: string,
  feature: BuildFeature,
  profile: ProjectProfile,
  options: BuildOptions
): Promise<boolean> {
  applyTierPolicy(feature, []);
  const planning = await deriveBuildPlanning(root, feature, profile, options);
  if (buildPlanningMatches(feature, planning)) return false;
  applyBuildPlanning(feature, planning);
  return true;
}

function buildPlanningMatches(feature: BuildFeature, planning: BuildPlanning): boolean {
  const applicability = feature.applicability_snapshot;
  const gatePlan = feature.gate_plan;
  return (
    applicability?.revision === planning.revision &&
    JSON.stringify(applicability.decisions) === JSON.stringify(planning.applicability.decisions) &&
    JSON.stringify(applicability.required) === JSON.stringify(planning.applicability.required) &&
    JSON.stringify(applicability.suggested) === JSON.stringify(planning.applicability.suggested) &&
    JSON.stringify(applicability.unresolved) ===
      JSON.stringify(planning.applicability.unresolved) &&
    JSON.stringify(applicability.excluded) === JSON.stringify(planning.applicability.excluded) &&
    gatePlan?.revision === planning.revision &&
    JSON.stringify(gatePlan.gates) === JSON.stringify(planning.gatePlan.gates) &&
    JSON.stringify(gatePlan.required_criteria) ===
      JSON.stringify(planning.gatePlan.required_criteria)
  );
}

function mergeExplicitApplicability(
  derived: BuildApplicabilityResult,
  feature: BuildFeature
): BuildApplicabilityResult {
  const decisions = new Map(
    derived.decisions.map((decision) => [decision.discipline, structuredClone(decision)])
  );
  for (const selection of feature.disciplines) {
    const existing = decisions.get(selection.slug);
    if (existing?.status === "REQUIRED") continue;
    decisions.set(selection.slug, {
      discipline: selection.slug,
      status: "REQUIRED",
      confidence: existing?.status === "EXCLUDED" ? "MEDIUM" : "HIGH",
      evidence: [
        `The feature explicitly selected '${selection.slug}': ${redactToString(selection.reason, 300)}.`,
        ...(existing?.evidence ?? [])
      ]
    });
  }
  const ordered = [...decisions.values()].sort((left, right) =>
    left.discipline.localeCompare(right.discipline)
  );
  return {
    decisions: ordered,
    required: ordered.filter((item) => item.status === "REQUIRED").map((item) => item.discipline),
    suggested: ordered.filter((item) => item.status === "SUGGESTED").map((item) => item.discipline),
    unresolved: ordered
      .filter((item) => item.status === "UNRESOLVED")
      .map((item) => item.discipline),
    excluded: ordered.filter((item) => item.status === "EXCLUDED").map((item) => item.discipline)
  };
}

function applyBuildPlanning(feature: BuildFeature, planning: BuildPlanning): void {
  const recordedAt = utcNow();
  feature.applicability_snapshot = {
    recorded_at: recordedAt,
    revision: planning.revision,
    decisions: structuredClone(planning.applicability.decisions),
    required: [...planning.applicability.required],
    suggested: [...planning.applicability.suggested],
    unresolved: [...planning.applicability.unresolved],
    excluded: [...planning.applicability.excluded]
  };
  feature.gate_plan = {
    recorded_at: recordedAt,
    revision: planning.revision,
    gates: structuredClone(planning.gatePlan.gates),
    required_criteria: [...planning.gatePlan.required_criteria]
  };
  for (const decision of planning.applicability.decisions) {
    const value = `${decision.status}:${decision.discipline}`;
    if (
      feature.selection_events.some(
        (event) => event.kind === "applicability" && event.value === value
      )
    )
      continue;
    feature.selection_events = appendSelectionEvent(feature, {
      kind: "applicability",
      action: "recorded",
      value,
      reason: decision.evidence.join(" "),
      source: "cli"
    }).selection_events;
  }
}

async function featureCheck(root: string, slug: string, options: BuildOptions): Promise<number> {
  const loaded = await requireFeature(root, slug);
  const { feature } = await reverifyEvidenceHashes(root, loaded);
  applyTierPolicy(feature, []);
  if (feature.phase === "done" || feature.phase === "abandoned")
    throw new Error(`Feature '${slug}' is ${feature.phase}; it cannot be re-checked.`);
  if (feature.phase === "blocked") {
    return renderFeature(options, feature, {
      operation: "check",
      blocked: true,
      next: "This feature is blocked by a repair-cap blocker. Resolve or `abandon` it."
    });
  }
  return runCheckPass(root, feature, options, "check");
}

/**
 * Runs the check pass: resolves scope, runs analyzers and (with --allow-run) detected project
 * commands, and derives criterion statuses. Every status is producer-derived here — nothing an
 * agent wrote is trusted. Repair counters advance on repeated identical failures and trip the cap.
 */
async function runCheckPass(
  root: string,
  feature: BuildFeature,
  options: BuildOptions,
  operation: string
): Promise<number> {
  const profile = await discoverProject(root);
  const planning = await deriveBuildPlanning(root, feature, profile, options);
  applyBuildPlanning(feature, planning);
  const derived = await deriveCriteria(root, feature, options, planning);
  feature.evidence = mergeEvidence(feature.evidence, derived);
  feature.evidence_run_ids = [
    ...new Set(
      feature.evidence
        .map((record) => record.envelope?.run_id)
        .filter((runId): runId is string => runId !== undefined)
    )
  ];
  const { blockers, tripped } = advanceRepairCounters(feature, derived);
  feature.repair_counters = blockers.counters;
  if (tripped.length > 0) {
    feature.phase = "blocked";
    feature.blockers = [...feature.blockers, ...tripped];
  } else if (feature.phase === "frame" || feature.phase === "plan" || feature.phase === "check") {
    feature.phase = "check";
  } else if (feature.phase === "implement") {
    feature.phase = "check";
  }
  const reverified = await reverifyEvidenceHashes(root, feature);
  Object.assign(feature, reverified.feature);
  await saveFeature(root, feature, options.dryRun);
  await ensureProjectIndex(root, feature, options);
  const hasFail = derived.some((record) => record.status === "FAIL");
  const missing = missingForDone(feature, new Set(reverified.verified));
  const exitCode = feature.phase === "blocked" || hasFail || missing.length > 0 ? 1 : 0;
  return renderFeature(
    options,
    feature,
    {
      operation,
      derived,
      missing_for_done: missing,
      blocked: feature.phase === "blocked",
      next:
        feature.phase === "blocked"
          ? "Repair cap reached; the feature is blocked. Move on or `abandon`."
          : missing.length === 0
            ? `Ready. Run \`forge feature ${feature.slug} done\`.`
            : `Resolve ${missing.length} item(s), then run \`forge feature ${feature.slug} done\`.`
    },
    exitCode
  );
}

// ---------------------------------------------------------------------------
// feature done
// ---------------------------------------------------------------------------

async function featureDone(root: string, slug: string, options: BuildOptions): Promise<number> {
  const loaded = await requireFeature(root, slug);
  const { feature, demoted, verified } = await reverifyEvidenceHashes(root, loaded);
  const planningChanged = await refreshBuildPlanning(
    root,
    feature,
    await discoverProject(root),
    options
  );
  if (feature.phase === "abandoned" || feature.phase === "blocked")
    throw new Error(`Feature '${slug}' is ${feature.phase}; it cannot be completed.`);
  const missing = missingForDone(feature, new Set(verified));
  if (feature.phase === "done" && missing.length === 0) {
    if (planningChanged || demoted.length > 0) {
      await saveFeature(root, feature, options.dryRun);
      await ensureProjectIndex(root, feature, options);
    }
    return renderFeature(options, feature, { operation: "done", next: "Already done." });
  }
  if (feature.phase === "done" && missing.length > 0) feature.phase = "check";
  if (planningChanged || demoted.length > 0 || feature.phase !== loaded.phase)
    await saveFeature(root, feature, options.dryRun);
  if (missing.length > 0) {
    return renderFeature(
      options,
      feature,
      {
        operation: "done",
        refused: true,
        missing_for_done: missing,
        demoted,
        next: "Provide evidence, a reasoned NOT_APPLICABLE, or an eligible risk acceptance for each item, then re-run done."
      },
      1
    );
  }
  feature.phase = "done";
  await saveFeature(root, feature, options.dryRun);
  await ensureProjectIndex(root, feature, options);
  return renderFeature(options, feature, {
    operation: "done",
    next: "Feature complete. The independent backstop remains `forge all audit` and `forge ship`."
  });
}

// ---------------------------------------------------------------------------
// feature accept-risk / abandon / status
// ---------------------------------------------------------------------------

async function featureAcceptRisk(
  root: string,
  slug: string,
  options: BuildOptions
): Promise<number> {
  const loaded = await requireFeature(root, slug);
  const { feature } = await reverifyEvidenceHashes(root, loaded);
  await refreshBuildPlanning(root, feature, await discoverProject(root), options);
  if (options.criterion === undefined)
    throw new Error("accept-risk requires --criterion <criterion-id>.");
  if (options.reason === undefined || options.reason.trim().length === 0)
    throw new Error("accept-risk requires a non-empty --reason.");
  const record = feature.evidence.find((item) => item.criterion === options.criterion);
  if (record === undefined)
    throw new Error(
      `No evidence record exists for criterion '${options.criterion}'. Run \`forge feature ${slug} check\` first.`
    );
  if (feature.phase !== "check")
    throw new Error("accept-risk requires a current check result; run feature check first.");
  if (record.status === "PASS")
    throw new Error(`Criterion '${options.criterion}' already has verified PASS evidence.`);
  if (record.status === "FAIL")
    throw new Error(`Criterion '${options.criterion}' is FAIL and must be fixed, not waived.`);
  const gates = feature.gate_plan?.gates.filter((gate) =>
    gate.criteria.includes(options.criterion!)
  );
  if (gates === undefined || gates.length === 0)
    throw new Error(`Criterion '${options.criterion}' is not part of the current Build gate plan.`);
  if (gates.some((gate) => gate.waiver_policy === "never"))
    throw new Error(
      `Criterion '${options.criterion}' is non-waivable in the current gate plan and must be proved directly.`
    );
  const revision = await workingTreeRevision(root);
  if (feature.gate_plan?.revision !== revision)
    throw new Error("The gate plan is stale; run feature check again before accepting risk.");
  const policy = gates.some((gate) => gate.waiver_policy === "operational-human")
    ? "operational-human"
    : "advisory";
  const category = policy === "operational-human" ? "operational" : "advisory";
  if (options.riskCategory !== undefined && options.riskCategory !== category)
    throw new Error(`This criterion requires risk category '${category}'.`);
  if (policy === "operational-human" && (options.actor ?? "").trim().length === 0)
    throw new Error("Operational risk acceptance requires --actor <accountable-human>.");
  const relevantFiles = await hashFiles(
    root,
    record.files.map((file) => file.path)
  );
  if (relevantFiles.length === 0 || relevantFiles.length !== record.files.length)
    throw new Error("Risk acceptance requires a complete non-empty current file manifest.");
  const timestamp = utcNow();
  for (const acceptance of feature.risk_acceptances)
    if (acceptance.criterion === options.criterion && acceptance.lifecycle !== "expired") {
      acceptance.lifecycle = "expired";
      acceptance.expired_at = timestamp;
    }
  feature.risk_acceptances = [
    ...feature.risk_acceptances,
    {
      criterion: options.criterion,
      category,
      ...(options.actor === undefined ? {} : { actor: options.actor }),
      reason: options.reason,
      canonical_root: await canonicalDirectory(root),
      revision,
      policy,
      relevant_files: relevantFiles,
      timestamp,
      expires_at: new Date(Date.parse(timestamp) + BUILD_PRODUCER_EXPIRY_MS).toISOString(),
      lifecycle: "active"
    }
  ];
  await saveFeature(root, feature, options.dryRun);
  return renderFeature(options, feature, {
    operation: "accept-risk",
    next: `Recorded risk acceptance for '${options.criterion}'. It is never rendered as PASS.`
  });
}

async function featureAbandon(root: string, slug: string, options: BuildOptions): Promise<number> {
  const feature = await requireFeature(root, slug);
  if (feature.phase === "done")
    throw new Error(`Feature '${slug}' is done; it cannot be abandoned.`);
  feature.phase = "abandoned";
  if (options.reason !== undefined)
    feature.blockers = [
      ...feature.blockers,
      { criterion: "abandon", reason: options.reason, timestamp: utcNow() }
    ];
  await saveFeature(root, feature, options.dryRun);
  await ensureProjectIndex(root, feature, options);
  return renderFeature(options, feature, { operation: "abandon", next: "Feature abandoned." });
}

async function featureStatus(root: string, slug: string, options: BuildOptions): Promise<number> {
  const loaded = await requireFeature(root, slug);
  const { feature, demoted, verified } = await reverifyEvidenceHashes(root, loaded);
  const planningChanged = await refreshBuildPlanning(
    root,
    feature,
    await discoverProject(root),
    options
  );
  if (feature.phase === "done" && missingForDone(feature, new Set(verified)).length > 0)
    feature.phase = "check";
  if (planningChanged || demoted.length > 0 || feature.phase !== loaded.phase) {
    await saveFeature(root, feature, options.dryRun);
    await ensureProjectIndex(root, feature, options);
  }
  return renderFeature(options, feature, {
    operation: "status",
    demoted,
    missing_for_done: missingForDone(feature, new Set(verified)),
    next: nextStepFor(feature, new Set(verified))
  });
}

async function requireFeature(root: string, slug: string): Promise<BuildFeature> {
  const feature = await loadFeature(root, slug);
  if (feature === undefined)
    throw new Error(
      `Feature '${slug}' does not exist. Start it with \`forge feature ${slug} --tier <light|standard|high>\`.`
    );
  return feature;
}

// ---------------------------------------------------------------------------
// Criteria derivation
// ---------------------------------------------------------------------------

type ScopeResult = { files: string[]; mode: string; reasons: string[] };

async function deriveCriteria(
  root: string,
  feature: BuildFeature,
  options: BuildOptions,
  planning: BuildPlanning
): Promise<CriterionEvidence[]> {
  const now = utcNow();
  const criteria: CriterionEvidence[] = [];
  const { scope, revision, commands } = planning;
  feature.touched_paths = scope.files.slice(0, MAX_SCOPE_FILES);
  const scopeSource = scope.files.filter(isSourcePath);
  const scopeFiles = await hashFiles(root, scope.files);
  const scopeComplete = scope.files.length > 0 && scopeFiles.length === scope.files.length;
  criteria.push(
    await createCriterionRecord(root, revision, {
      criterion: "scope-resolution",
      discipline: "code",
      security_control: false,
      status: scopeComplete ? "PASS" : "NOT_VERIFIED",
      producer: "fullstack-forge/build-scope",
      evidence: [
        `Scope resolved via ${scope.mode}; ${scope.files.length} file(s) in scope.`,
        ...scope.reasons.slice(0, 5)
      ],
      limitations: scopeComplete
        ? []
        : ["Scope was empty or one or more scoped files could not be hashed completely."],
      files: scopeFiles,
      instance_ids: [],
      recorded_at: now
    })
  );

  const scopeSet = new Set(scope.files);
  const runs = await runAnalyzers("all", root, scopeSet.size > 0 ? scopeSet : undefined);
  const supported = runs.reduce((total, run) => total + run.supported_files, 0);
  const failFindings = runs.flatMap((run) => run.findings).filter((f) => f.status === "FAIL");
  const sourceFiles = await hashFiles(root, scopeSource);
  const analyzerStatus =
    failFindings.length > 0
      ? "FAIL"
      : supported > 0 && sourceFiles.length === scopeSource.length
        ? "PASS"
        : "NOT_VERIFIED";
  criteria.push(
    await createCriterionRecord(root, revision, {
      criterion: "supported-static-patterns",
      discipline: "code",
      security_control: false,
      status: analyzerStatus,
      producer: "fullstack-forge/build-analyzers",
      evidence:
        failFindings.length > 0
          ? failFindings
              .slice(0, 10)
              .map((finding) =>
                redactToString(
                  `${finding.instance_id ?? finding.id}: ${finding.title} (${finding.location[0]?.path ?? "?"})`
                )
              )
          : [
              supported > 0
                ? `PASS — supported analyzers found no reproduced failure in ${supported} supported file(s).`
                : "No analyzable source files were in scope, so supported static patterns were not verified."
            ],
      limitations: [
        "This bounded result does not verify runtime behavior, unsupported frameworks, or whole-feature security."
      ],
      files: sourceFiles,
      instance_ids: failFindings.map((finding) => finding.instance_id ?? finding.id).slice(0, 50),
      recorded_at: now
    })
  );

  criteria.push(
    await createCriterionRecord(root, revision, {
      criterion: "applicability",
      discipline: "requirements",
      security_control: false,
      status: planning.applicability.unresolved.length === 0 ? "PASS" : "NOT_VERIFIED",
      producer: "fullstack-forge/build-applicability",
      evidence: planning.applicability.decisions.map(
        (decision) =>
          `${decision.discipline}: ${decision.status}/${decision.confidence} — ${decision.evidence.join(" ")}`
      ),
      limitations: planning.applicability.unresolved.map(
        (discipline) => `Applicability for '${discipline}' remains unresolved.`
      ),
      files: scopeFiles,
      instance_ids: planning.applicability.unresolved,
      recorded_at: now
    })
  );

  for (const decision of planning.applicability.decisions) {
    if (decision.status !== "EXCLUDED") continue;
    criteria.push(
      await createCriterionRecord(root, revision, {
        criterion: `discipline:${decision.discipline}`,
        discipline: decision.discipline,
        security_control: SECURITY_DISCIPLINES.has(decision.discipline),
        status: scopeComplete ? "NOT_APPLICABLE" : "NOT_VERIFIED",
        producer: `fullstack-forge/build-applicability/${decision.discipline}`,
        evidence: decision.evidence,
        limitations: [],
        files: scopeFiles,
        instance_ids: [],
        recorded_at: now,
        ...(decision.exclusion_reason === undefined
          ? {}
          : { not_applicable_reason: decision.exclusion_reason })
      })
    );
  }

  const commandResults = new Map<
    string,
    Promise<{ exitCode: number; stdout: string; stderr: string }>
  >();
  const runCommand = (command: CommandDefinition, commandRoot: string) => {
    const key = JSON.stringify([command.executable, command.args, command.definition]);
    let result = commandResults.get(key);
    if (result === undefined) {
      result = runFile(command.executable, command.args, commandRoot, 10 * 60_000);
      commandResults.set(key, result);
    }
    return result;
  };
  const forgeOwned = await isForgePackageRoot(root);
  const internallyDerived = new Set([
    "scope-resolution",
    "supported-static-patterns",
    "applicability",
    "runtime:rendered-ui",
    "design-direction"
  ]);
  for (const criterion of planning.gatePlan.required_criteria) {
    if (internallyDerived.has(criterion)) continue;
    const candidates = BUILD_PRODUCER_REGISTRY.filter((entry) => entry.criterion === criterion);
    const matched = candidates
      .map((producer) => ({
        producer,
        command: commands.find((command) => command.name === producer.script_name)
      }))
      .find((entry) => entry.command !== undefined);
    if (matched?.command === undefined) {
      const expected = candidates[0];
      criteria.push(
        await createCriterionRecord(root, revision, {
          criterion,
          ...(expected === undefined ? {} : { discipline: expected.discipline }),
          security_control: expected?.security_control ?? securityCriterion(criterion),
          status: "NOT_VERIFIED",
          producer: expected?.id ?? BUILD_UNAVAILABLE_PRODUCER,
          evidence: [
            expected === undefined
              ? `No registered Build producer exists for '${criterion}'.`
              : `Required producer script '${expected.script_name}' was not detected for '${criterion}'.`
          ],
          limitations: ["Unsupported or absent producer evidence never becomes PASS."],
          files: scopeFiles,
          instance_ids: [],
          recorded_at: now
        })
      );
      continue;
    }
    const commandInputPaths = [
      ...new Set([...scope.files, matched.command.source].map((path) => toPosix(path)))
    ].sort();
    const commandInputFiles = await hashFiles(root, commandInputPaths);
    const observation = await executeBuildProducer({
      root,
      criterion,
      command: matched.command,
      input_manifest: commandInputFiles,
      input_manifest_complete:
        commandInputPaths.length > 0 && commandInputFiles.length === commandInputPaths.length,
      allow_run: options.allowRun,
      offline: options.offline,
      forge_owned: forgeOwned,
      run_command: runCommand
    });
    criteria.push(await recordFromObservation(root, revision, observation));
  }

  if (
    planning.gatePlan.required_criteria.includes("runtime:rendered-ui") ||
    planning.gatePlan.required_criteria.includes("design-direction")
  )
    criteria.push(
      ...(await deriveRuntimeCriteria(root, feature, options, planning, scopeFiles, now))
    );
  return criteria;
}

type CriterionRecordInput = Omit<
  CriterionEvidence,
  "producer_version" | "revision" | "expires_at" | "envelope"
>;

async function createCriterionRecord(
  root: string,
  revision: string,
  input: CriterionRecordInput
): Promise<CriterionEvidence> {
  const expiresAt = new Date(
    Date.parse(input.recorded_at) + BUILD_PRODUCER_EXPIRY_MS
  ).toISOString();
  const record: CriterionEvidence = {
    ...input,
    evidence: input.evidence.map((line) => redactToString(line, 1_000)),
    limitations: (input.limitations ?? []).map((line) => redactToString(line, 500)),
    ...(input.not_applicable_reason === undefined
      ? {}
      : { not_applicable_reason: redactToString(input.not_applicable_reason, 500) }),
    producer_version: BUILD_PRODUCER_VERSION,
    revision,
    expires_at: expiresAt
  };
  if (record.files.length === 0) {
    if (record.status === "PASS" || record.status === "NOT_APPLICABLE") {
      record.status = "NOT_VERIFIED";
      record.evidence.push("Positive evidence requires at least one current hashed artifact.");
    }
    return record;
  }
  const claim = toBuildEvidenceClaim(record);
  try {
    record.envelope = await createBuildEvidenceEnvelope({
      root,
      revision,
      claim,
      artifacts: record.files.map((file) => ({
        path: file.path,
        media_type: mediaTypeForPath(file.path)
      }))
    });
  } catch (error) {
    if (record.status === "PASS" || record.status === "NOT_APPLICABLE")
      record.status = "NOT_VERIFIED";
    record.evidence.push(`Evidence envelope unavailable: ${redactError(error)}`);
    delete record.envelope;
  }
  return record;
}

function toBuildEvidenceClaim(record: CriterionEvidence): BuildEvidenceClaim {
  if (
    record.producer_version === undefined ||
    record.limitations === undefined ||
    record.expires_at === undefined
  )
    throw new Error(`Criterion '${record.criterion}' lacks complete producer metadata.`);
  return {
    criterion: record.criterion,
    ...(record.discipline === undefined ? {} : { discipline: record.discipline }),
    security_control: record.security_control,
    status: record.status,
    producer: record.producer,
    producer_version: record.producer_version,
    evidence: record.evidence,
    limitations: record.limitations,
    files: record.files,
    instance_ids: record.instance_ids,
    recorded_at: record.recorded_at,
    expires_at: record.expires_at,
    ...(record.not_applicable_reason === undefined
      ? {}
      : { not_applicable_reason: record.not_applicable_reason }),
    ...(record.runtime === undefined ? {} : { runtime: record.runtime }),
    ...(record.command === undefined ? {} : { command: record.command })
  };
}

async function recordFromObservation(
  root: string,
  revision: string,
  observation: BuildProducerObservation
): Promise<CriterionEvidence> {
  const complete = observation.command.exit_code !== undefined;
  const command: EvidenceCommand | undefined = complete
    ? {
        name: observation.command.name,
        argv: [...observation.command.argv],
        definition: redactToString(observation.command.definition, 1_000),
        exit_code: observation.command.exit_code!,
        started_at: observation.command.started_at!,
        duration_ms: observation.command.duration_ms!,
        output_sha256: observation.command.output_sha256!,
        input_manifest: observation.input_manifest.map((file) => ({
          ...file,
          media_type: mediaTypeForPath(file.path)
        }))
      }
    : undefined;
  return createCriterionRecord(root, revision, {
    criterion: observation.criterion,
    discipline: observation.discipline,
    security_control: observation.security_control,
    status: observation.status,
    producer: observation.producer_id,
    evidence: [
      complete
        ? `Registered script '${observation.command.name}' exited ${observation.command.exit_code}.`
        : `Registered script '${observation.command.name}' did not produce an executed result.`,
      ...(observation.command.output_excerpt === undefined
        ? []
        : [observation.command.output_excerpt])
    ],
    limitations: observation.limitations,
    files: observation.input_manifest,
    instance_ids: [],
    recorded_at: observation.recorded_at,
    ...(command === undefined ? {} : { command })
  });
}

function securityCriterion(criterion: string): boolean {
  return [
    "authentication",
    "authorization",
    "tenant",
    "upload",
    "webhook",
    "security",
    "privacy",
    "payment"
  ].some((token) => criterion.includes(token));
}

function mediaTypeForPath(path: string): string {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".html") return "text/html";
  if ([".md", ".txt", ".ts", ".tsx", ".js", ".jsx", ".css"].includes(extension))
    return "text/plain";
  return "application/octet-stream";
}

async function deriveRuntimeCriteria(
  root: string,
  feature: BuildFeature,
  options: BuildOptions,
  planning: BuildPlanning,
  scopeFiles: EvidenceFile[],
  now: string
): Promise<CriterionEvidence[]> {
  const routeByState = parseRuntimeCases(options);
  const design = await designDirectionResult(root, options.designDirection);
  const designFiles = await hashFiles(root, [".forge/build/DESIGN.md"]);
  if (routeByState.size === 0) {
    return [
      await createCriterionRecord(root, planning.revision, {
        criterion: "runtime:rendered-ui",
        discipline: "ui",
        security_control: true,
        status: "NOT_VERIFIED",
        producer: "fullstack-forge/build-runtime",
        evidence: [
          "No rendered state URLs were supplied. Use --runtime-case <state>=<url> for every required state."
        ],
        limitations: [
          `Required states: ${BUILD_RUNTIME_STATES.join(", ")}. Browser evidence is never fabricated.`
        ],
        files: scopeFiles,
        instance_ids: BUILD_RUNTIME_STATES.map((state) => `missing:${state}`),
        recorded_at: now
      }),
      await createDesignCriterion(root, planning.revision, design, designFiles, scopeFiles, now)
    ];
  }
  const role = options.role ?? "representative-user";
  const statePlans = [...routeByState].map(([state, route]) =>
    planBuildRuntime({ route, role, states: [state] })
  );
  const plan: BuildRuntimePlan = {
    route: statePlans[0]!.route,
    role: statePlans[0]!.role,
    cases: statePlans.flatMap((entry) => entry.cases)
  };
  const captures: RuntimeStateCapture[] = [];
  for (const [state, url] of routeByState) {
    const renderedOptions: CliOptions = {
      cwd: root,
      json: true,
      dryRun: options.dryRun,
      global: false,
      offline: options.offline,
      allowRun: options.allowRun,
      safe: true,
      evidenceDir: options.evidenceDir ?? `.forge/build/evidence/${feature.slug}/${state}`
    };
    const captured = await inspectRenderedUi(root, [url], renderedOptions, planning.revision);
    captures.push({ state, rendered: captured.value });
  }
  const cases = captures.flatMap((capture) => casesFromRenderedCapture(plan, capture));
  const fallback: RenderedRuntimeCapture = captures[0]?.rendered ?? {
    capture_status: "BLOCKED",
    status: "BLOCKED",
    reason: "No runtime capture completed.",
    artifacts: [],
    viewports: [],
    console_errors: 0,
    limitations: ["No runtime capture completed."]
  };
  const [runtimeResult, designResult] = deriveBuildRuntimeEvidence({
    plan,
    rendered: fallback,
    captures,
    cases,
    design_direction: design
  });
  if (runtimeResult === undefined || designResult === undefined)
    throw new Error("Build runtime evidence adapter returned an incomplete result set.");
  const runtimePaths = [
    ...new Set(captures.flatMap((capture) => capture.rendered.artifacts))
  ].sort();
  const hashedRuntimeFiles = await hashFiles(root, runtimePaths);
  const runtimeArtifactsComplete = hashedRuntimeFiles.length === runtimePaths.length;
  const runtimeFiles = mergeEvidenceFiles(scopeFiles, hashedRuntimeFiles);
  const runtime: EvidenceRuntimeContext[] = plan.cases.map((entry) => ({
    url: entry.route,
    role: entry.role,
    state: entry.state,
    viewport: { ...entry.viewport }
  }));
  return [
    await createCriterionRecord(root, planning.revision, {
      criterion: runtimeResult.criterion,
      discipline: "ui",
      security_control: true,
      status:
        runtimeResult.status === "PASS" && !runtimeArtifactsComplete
          ? "NOT_VERIFIED"
          : runtimeResult.status,
      producer: "fullstack-forge/build-runtime",
      evidence: runtimeResult.evidence,
      limitations: [
        ...runtimeResult.limitations,
        ...(runtimeArtifactsComplete
          ? []
          : ["One or more declared rendered artifacts could not be hashed after capture."])
      ],
      files: runtimeFiles,
      instance_ids: plan.cases.map((entry) => entry.id),
      recorded_at: now,
      runtime
    }),
    await createCriterionRecord(root, planning.revision, {
      criterion: designResult.criterion,
      discipline: "ui",
      security_control: false,
      status: designResult.status,
      producer: "fullstack-forge/build-design",
      evidence: designResult.evidence,
      limitations: designResult.limitations,
      files: mergeEvidenceFiles(scopeFiles, designFiles),
      instance_ids: [],
      recorded_at: now
    })
  ];
}

async function createDesignCriterion(
  root: string,
  revision: string,
  design: DesignDirectionResult,
  designFiles: EvidenceFile[],
  scopeFiles: EvidenceFile[],
  now: string
): Promise<CriterionEvidence> {
  const placeholder: RenderedRuntimeCapture = {
    capture_status: "BLOCKED",
    status: "BLOCKED",
    artifacts: [],
    viewports: [],
    console_errors: 0,
    limitations: []
  };
  const plan = planBuildRuntime({
    route: "http://127.0.0.1/",
    role: "representative-user",
    states: []
  });
  const result = deriveBuildRuntimeEvidence({
    plan,
    rendered: placeholder,
    captures: [],
    cases: [],
    design_direction: design
  }).find((entry) => entry.criterion === "design-direction");
  if (result === undefined) throw new Error("Design-direction adapter returned no result.");
  return createCriterionRecord(root, revision, {
    criterion: "design-direction",
    discipline: "ui",
    security_control: false,
    status: result.status,
    producer: "fullstack-forge/build-design",
    evidence: result.evidence,
    limitations: result.limitations,
    files: mergeEvidenceFiles(scopeFiles, designFiles),
    instance_ids: [],
    recorded_at: now
  });
}

function parseRuntimeCases(options: BuildOptions): Map<BuildRuntimeState, string> {
  const result = new Map<BuildRuntimeState, string>();
  if (options.url !== undefined) result.set("success", options.url);
  for (const raw of options.runtimeCases) {
    const separator = raw.indexOf("=");
    if (separator <= 0 || separator === raw.length - 1)
      throw new Error("--runtime-case must use <state>=<absolute-http-url>.");
    const state = raw.slice(0, separator) as BuildRuntimeState;
    const url = raw.slice(separator + 1);
    if (!(BUILD_RUNTIME_STATES as readonly string[]).includes(state))
      throw new Error(
        `Unknown runtime state '${state}'. Expected one of: ${BUILD_RUNTIME_STATES.join(", ")}.`
      );
    if (result.has(state)) throw new Error(`Runtime state '${state}' was supplied more than once.`);
    result.set(state, url);
  }
  return result;
}

async function designDirectionResult(
  root: string,
  declaration: string | undefined
): Promise<DesignDirectionResult> {
  try {
    await readFile(resolveInside(root, ".forge/build/DESIGN.md"));
  } catch {
    return { status: "MISSING" };
  }
  if (declaration === undefined) return { status: "NOT_VERIFIED" };
  if (declaration === "follows") return { status: "PRESENT", follows_direction: true };
  if (declaration.startsWith("deviation:")) {
    const reason = declaration.slice("deviation:".length).trim();
    return {
      status: "PRESENT",
      follows_direction: false,
      ...(reason.length === 0 ? {} : { deviation_reason: reason })
    };
  }
  throw new Error("--design-direction must be 'follows' or 'deviation:<reason>'.");
}

function mergeEvidenceFiles(...groups: EvidenceFile[][]): EvidenceFile[] {
  const byPath = new Map<string, EvidenceFile>();
  for (const file of groups.flat()) byPath.set(file.path, file);
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

async function resolveBuildScope(
  root: string,
  profile: ProjectProfile,
  feature: BuildFeature,
  base: string | undefined
): Promise<ScopeResult> {
  try {
    const changed = await analyzeChangedScope(root, profile, base);
    return {
      files: [...changed.files],
      mode: "merge-base changed-scope",
      reasons: changed.evidence.included_files
        .slice(0, 5)
        .map((item) => `${item.path}: ${item.reasons.join(", ")}`)
    };
  } catch (error) {
    // New-repo fallback: without a resolvable merge base, scope to the feature's recorded touched
    // paths, and only if none exist scan the worktree — never BLOCKED.
    if (feature.touched_paths.length > 0)
      return {
        files: feature.touched_paths.slice(0, MAX_SCOPE_FILES),
        mode: "recorded touched paths (no merge base)",
        reasons: [redactError(error)]
      };
    const files = await collectWorktreeFiles(root);
    return {
      files,
      mode: "full worktree (no merge base, no recorded touched paths)",
      reasons: ["No comparison base and no recorded touched paths; scanned the worktree."]
    };
  }
}

async function collectWorktreeFiles(root: string): Promise<string[]> {
  const absolute = await walkFiles(root, {
    exclude: WORKTREE_EXCLUDE,
    maxBytes: 2 * 1024 * 1024,
    maxFiles: 20_000,
    maxTotalBytes: 256 * 1024 * 1024,
    maxDepth: 64
  });
  return absolute
    .map((path) => toPosix(relative(root, path)))
    .sort()
    .slice(0, MAX_SCOPE_FILES);
}

async function hashFiles(root: string, paths: string[]): Promise<EvidenceFile[]> {
  const files: EvidenceFile[] = [];
  for (const path of [...new Set(paths)].sort()) {
    try {
      const bytes = await readFile(resolveInside(root, path));
      files.push({ path, sha256: sha256(bytes) });
    } catch {
      // The caller compares requested and returned counts and must fail closed on any gap.
    }
  }
  return files;
}

function isSourcePath(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extname(path).toLowerCase());
}

// ---------------------------------------------------------------------------
// Evidence merge, repair counters, done requirements
// ---------------------------------------------------------------------------

/** Replaces stored evidence with the freshly derived record for each criterion. */
function mergeEvidence(
  stored: CriterionEvidence[],
  derived: CriterionEvidence[]
): CriterionEvidence[] {
  const byId = new Map(stored.map((record) => [record.criterion, record]));
  for (const record of derived) byId.set(record.criterion, record);
  return [...byId.values()].sort((a, b) => a.criterion.localeCompare(b.criterion));
}

/**
 * Advances repair counters. Each FAIL criterion has a signature derived from its failing instance
 * identities (or, absent those, its file hashes). The same signature recurring across checks means
 * a repair attempt did not change the failure, so the counter increments; a different signature is
 * a new failure and resets it. Unrelated tree changes therefore never reset a counter, because the
 * signature is keyed on the failing identity, not on the whole tree. At the cap the feature blocks.
 */
function advanceRepairCounters(
  feature: BuildFeature,
  derived: CriterionEvidence[]
): { blockers: { counters: BuildFeature["repair_counters"] }; tripped: BuildFeature["blockers"] } {
  const counters = new Map(feature.repair_counters.map((counter) => [counter.criterion, counter]));
  const tripped: BuildFeature["blockers"] = [];
  const failing = new Set<string>();
  for (const record of derived) {
    if (record.status !== "FAIL") continue;
    failing.add(record.criterion);
    const signature = failureSignature(record);
    const current = counters.get(record.criterion);
    if (current !== undefined && current.signature === signature) {
      const count = current.count + 1;
      counters.set(record.criterion, { criterion: record.criterion, signature, count });
      if (count >= REPAIR_CAP)
        tripped.push({
          criterion: record.criterion,
          reason: `Repair cap (${REPAIR_CAP}) reached for the same failing signature; the feature is blocked.`,
          timestamp: utcNow()
        });
    } else {
      counters.set(record.criterion, { criterion: record.criterion, signature, count: 1 });
    }
  }
  // A criterion that is no longer failing releases its counter.
  for (const key of [...counters.keys()]) if (!failing.has(key)) counters.delete(key);
  return { blockers: { counters: [...counters.values()] }, tripped };
}

function failureSignature(record: CriterionEvidence): string {
  const basis =
    record.instance_ids.length > 0
      ? [...record.instance_ids].sort().join("\n")
      : record.files
          .map((file) => file.sha256)
          .sort()
          .join("\n");
  return sha256(`${record.criterion}\u0000${basis}`);
}

/** Computes the actionable missing-items list for `done` from verified evidence and gate policy. */
export function missingForDone(
  feature: BuildFeature,
  verifiedCriteria: ReadonlySet<string> = new Set()
): string[] {
  const missing: string[] = [];
  if (feature.phase !== "check" && feature.phase !== "done")
    missing.push(
      `lifecycle: feature must reach check before done (current phase: ${feature.phase})`
    );
  for (const record of feature.evidence)
    if (record.status === "FAIL")
      missing.push(
        `${record.criterion}: FAIL must be fixed (${record.evidence[0] ?? "no detail"})`
      );
  if (feature.gate_plan === undefined) {
    missing.push("gate-plan: no Build gate plan is recorded (run `check`)");
    return [...new Set(missing)];
  }
  if (
    feature.evidence_revision === undefined ||
    feature.gate_plan.revision !== feature.evidence_revision
  )
    missing.push("gate-plan: evidence and gate plan belong to different working-tree revisions");
  const evidence = feature.evidence.map((record) => {
    if (
      (record.status === "PASS" || record.status === "NOT_APPLICABLE") &&
      !verifiedCriteria.has(record.criterion)
    )
      return {
        ...record,
        status: "NOT_VERIFIED" as const,
        evidence: [...record.evidence, "The persisted positive claim was not verified in memory."]
      };
    return record;
  });
  const accepted = feature.risk_acceptances
    .filter(
      (item) =>
        item.lifecycle !== "expired" &&
        item.migration_state === undefined &&
        item.policy !== undefined &&
        item.canonical_root !== undefined &&
        item.relevant_files !== undefined &&
        item.relevant_files.length > 0 &&
        item.expires_at !== undefined &&
        Date.parse(item.expires_at) > Date.now() &&
        item.revision === feature.evidence_revision &&
        (item.policy !== "operational-human" || (item.actor ?? "").trim().length > 0)
    )
    .map((item) => item.criterion);
  const evaluated = evaluateBuildGates(feature.gate_plan as BuildGatePlan, evidence, accepted);
  for (const gate of evaluated) {
    if (!gate.required || gate.status === "PASS") continue;
    missing.push(
      `${gate.id} ${gate.name}: ${gate.status} — ${gate.missing.join("; ") || "required evidence is incomplete"}`
    );
  }
  return [...new Set(missing)];
}

function nextStepFor(
  feature: BuildFeature,
  verifiedCriteria: ReadonlySet<string> = new Set()
): string {
  switch (feature.phase) {
    case "frame":
      return feature.tier === "light"
        ? `Run \`forge feature ${feature.slug} check --allow-run\`.`
        : `Run \`forge feature ${feature.slug} plan\`, then \`check\`.`;
    case "plan":
    case "implement":
      return `Implement, then run \`forge feature ${feature.slug} check --allow-run\`.`;
    case "check": {
      const missing = missingForDone(feature, verifiedCriteria);
      return missing.length === 0
        ? `Run \`forge feature ${feature.slug} done\`.`
        : `Resolve ${missing.length} item(s), then \`forge feature ${feature.slug} done\`.`;
    }
    case "done":
      return "Feature complete.";
    case "blocked":
      return "Feature is blocked; move on or `abandon`.";
    case "abandoned":
      return "Feature abandoned.";
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type RenderExtra = {
  operation?: string;
  next?: string;
  demoted?: string[];
  missing_for_done?: string[];
  refused?: boolean;
  blocked?: boolean;
  derived?: CriterionEvidence[];
  notes?: string[];
};

function renderFeature(
  options: BuildOptions,
  feature: BuildFeature,
  extra: RenderExtra,
  exitCode = 0
): number {
  if (options.json) {
    print(JSON.stringify({ feature, ...extra }, null, 2));
    return exitCode;
  }
  const lines: string[] = [];
  lines.push(`Feature: ${feature.slug}  [tier ${feature.tier}, phase ${feature.phase}]`);
  if (extra.operation !== undefined) lines.push(`Operation: ${extra.operation}`);
  if (feature.summary.length > 0) lines.push(`Summary: ${feature.summary}`);
  if (feature.disciplines.length > 0)
    lines.push(`Disciplines: ${feature.disciplines.map((d) => d.slug).join(", ")}`);
  if (feature.evidence.length > 0) {
    lines.push("Criteria:");
    for (const record of feature.evidence)
      lines.push(
        `  - ${record.criterion}: ${record.status}${record.security_control ? " (security control)" : ""}`
      );
  }
  if (feature.risk_acceptances.length > 0) {
    lines.push("Risk acceptances (never rendered as PASS):");
    for (const item of feature.risk_acceptances)
      lines.push(`  - ${item.criterion}: ${item.reason} @ ${item.revision}`);
  }
  if (feature.blockers.length > 0) {
    lines.push("Blockers:");
    for (const item of feature.blockers) lines.push(`  - ${item.criterion}: ${item.reason}`);
  }
  const demoted = extra.demoted;
  if (demoted !== undefined && demoted.length > 0)
    lines.push(`Demoted to NOT_VERIFIED (stale hashes): ${demoted.join(", ")}`);
  const missing = extra.missing_for_done;
  if (missing !== undefined) {
    if (extra.refused === true) lines.push("done refused — missing tier-required evidence:");
    else if (missing.length > 0) lines.push("Outstanding for done:");
    for (const item of missing) lines.push(`  - ${item}`);
  }
  const notes = extra.notes;
  if (notes !== undefined) for (const note of notes) lines.push(`Note: ${note}`);
  if (extra.next !== undefined) lines.push(`Next: ${extra.next}`);
  print(lines.join("\n"));
  return exitCode;
}

function report(options: BuildOptions, value: Record<string, unknown>): number {
  if (options.json) {
    print(JSON.stringify(value, null, 2));
    return 0;
  }
  const lines: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const text = Array.isArray(item)
      ? item.length === 0
        ? "none"
        : item.map(stringifyItem).join(", ")
      : stringifyItem(item);
    lines.push(`${key}: ${text}`);
  }
  print(lines.join("\n"));
  return 0;
}

function stringifyItem(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function print(value: string): void {
  console.log(value);
}

// ---------------------------------------------------------------------------
// Templates (minimal, self-contained seeds; canonical templates are another workstream's scope)
// ---------------------------------------------------------------------------

const DECISIONS_TEMPLATE = `# Build decisions

Append-only log of product and technical decisions for this build. Add one entry per decision and
never rewrite an earlier one.

- ${new Date().toISOString().slice(0, 10)} — Initialized build mode — Recorded by \`forge new\`.
`;

function designTemplate(summary: string): string {
  return `# Design direction

Product summary, users and roles, business rules, and explicit non-goals for this build. This file
is build context under .forge/build/ and is never written to the project docs directory.

## Product

${summary.length === 0 ? "_Summarize the product here._" : summary}

## Users and roles

_List the users and roles this build serves._

## Business rules

_Record the rules the build must enforce._

## Non-goals

_List the infrastructure and features this build deliberately does NOT need, with reasons._
`;
}
