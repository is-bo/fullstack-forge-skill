import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import {
  PRECEDENCE,
  evaluateActivation,
  precedenceRank,
  resolveComposition,
  resolveConflict,
  resolveModuleDependencyClosure,
  type ActivationCondition,
  type CompositionEvidence,
  type CompositionManifest,
  type CompositionSource,
  type ModuleComposition
} from "../src/composition.js";
import {
  compositionEvidenceFor,
  explicitGreenfieldDependenciesFor,
  resolveRuntimeCompositionWithRoot,
  resolveRuntimeModuleDependencyClosure
} from "../src/composition-runtime.js";
import { expandApplicableDependencies } from "../src/dependency-expansion.js";
import { decideModules } from "../src/scope.js";
import { runFile } from "../src/utils.js";
import type { ProfileRecord, ProjectProfile } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

// Tests run from the repository root, and the compiled test lives under `build/`, so the canonical
// registry is read from the working directory rather than relative to this file.
const projectRoot = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(projectRoot, "config", "module-composition.json"), "utf8")
) as unknown as CompositionManifest;

const runtimePathFor = (source: CompositionSource): string =>
  `.fullstack-forge/upstream/${source.provider}/${source.path.replace(/SKILL\.md$/u, "PLAYBOOK.md")}`;

/** Reads the first element and proves it exists, so neither the type checker nor the linter has to
 * guess. Indexed access is `T | undefined` under `noUncheckedIndexedAccess`, while an optional
 * chain on it reads as unnecessary to the lint rule; asserting once satisfies both. */
function first<T>(values: T[]): T {
  const [value] = values;
  assert.ok(value !== undefined, "expected at least one element");
  return value;
}

function record(
  name: string,
  confidence: ProfileRecord["confidence"] = "HIGH",
  evidence: string[] = [`detected ${name}`],
  type = name
): ProfileRecord {
  return { name, type, confidence, evidence };
}

function profile(overrides: Partial<ProjectProfile>): ProjectProfile {
  const empty: ProfileRecord[] = [];
  return {
    schema_version: 2,
    root: "/repo",
    generated_at: "2026-07-27T00:00:00.000Z",
    detections: [],
    capabilities: {},
    repository: record("repo"),
    workspaces: empty,
    applications: empty,
    languages: empty,
    frameworks: empty,
    package_managers: empty,
    databases: empty,
    orms: empty,
    authentication: empty,
    sessions: empty,
    authorization: empty,
    roles: empty,
    tenant_boundaries: empty,
    routes: [],
    storage: empty,
    upload_pipelines: empty,
    caches: empty,
    queues: empty,
    scheduled_jobs: empty,
    tests: empty,
    ci: empty,
    observability: empty,
    integrations: empty,
    ai_providers: empty,
    payment_providers: empty,
    hosting: empty,
    deployment: empty,
    environment_templates: empty,
    critical_workflows: empty,
    ...overrides
  };
}

function resolve(module: string, evidence: CompositionEvidence) {
  return resolveComposition({ manifest, module, evidence, runtimePathFor });
}

function providers(result: ReturnType<typeof resolve>): string[] {
  return result.selected.filter((entry) => entry.tier !== "forge-contract").map((e) => e.provider);
}

function dependencyManifest(
  entries: ReadonlyArray<readonly [string, readonly string[]]>
): CompositionManifest {
  const modules: ModuleComposition[] = entries.map(([module, dependsOn]) => ({
    module,
    mode: "forge-native",
    designation: "dependency-test",
    forgeContract: `references/build/${module}.md`,
    primary: [],
    overlays: [],
    conflicts: [],
    dependsOn: [...dependsOn],
    outputClassification: "finding",
    forgeAuthority: []
  }));
  return {
    schemaVersion: 2,
    defaultContextBudget: {
      maxPrimarySkills: 0,
      maxOverlays: 0,
      maxSupplemental: 0
    },
    modules
  };
}

test("the Forge contract is always first in the load order for every module", () => {
  for (const declaration of manifest.modules) {
    const result = resolve(declaration.module, {});
    assert.equal(first(result.selected).tier, "forge-contract");
    assert.equal(first(result.selected).provider, "fullstack-forge");
    assert.equal(first(result.selected).runtimePath, declaration.forgeContract);
  }
});

test("workflow-aware composition excludes build briefs and primary build procedures from Audit", () => {
  const build = resolve("architecture", {});
  assert.equal(build.workflow, "build");
  assert.match(first(build.selected).runtimePath, /references\/build\/architecture\.md/u);
  assert.ok(build.selected.some((source) => source.tier === "primary"));
  assert.deepEqual(
    build.eager?.map((source) => source.tier),
    ["forge-contract", "primary"]
  );

  const audit = resolve("architecture", { workflow: "audit" });
  assert.equal(audit.workflow, "audit");
  assert.equal(first(audit.selected).runtimePath, "references/workflows/audit.md");
  assert.ok(
    audit.selected.every((source) => !source.runtimePath.includes("references/build/")),
    "Audit must never expose a build brief"
  );
  assert.equal(
    audit.selected.some((source) => source.tier === "primary"),
    false
  );
  assert.ok(
    audit.suppressed.some(
      (source) => source.skill === "spec-driven-development" && /not declared/u.test(source.reason)
    )
  );
  assert.deepEqual(
    audit.eager?.map((source) => source.tier),
    ["forge-contract"],
    "the Audit contract is eager while unavailable build procedures stay suppressed"
  );
  assert.deepEqual(
    audit.deferred?.map((source) => source.tier),
    audit.selected.filter((source) => source.tier !== "forge-contract").map((source) => source.tier)
  );
});

test("an explicitly workflow-scoped source cannot be forced into another workflow", () => {
  const custom: CompositionManifest = {
    schemaVersion: 2,
    defaultContextBudget: { maxPrimarySkills: 1, maxOverlays: 1, maxSupplemental: 1 },
    modules: [
      {
        module: "fixture",
        mode: "forge-native",
        designation: "fixture",
        forgeContract: "references/build/fixture.md",
        primary: [
          {
            provider: "fixture",
            skill: "build-only",
            path: "build-only.md",
            workflows: ["build"],
            when: { always: true }
          }
        ],
        overlays: [],
        conflicts: [],
        dependsOn: [],
        outputClassification: "finding",
        forgeAuthority: []
      }
    ]
  };
  const audit = resolveComposition({
    manifest: custom,
    module: "fixture",
    evidence: { workflow: "audit" },
    runtimePathFor: (source) => source.path
  });
  assert.equal(audit.selected.length, 1);
  assert.match(audit.selected[0]?.runtimePath ?? "", /references\/workflows\/audit\.md/u);
  assert.match(audit.suppressed[0]?.reason ?? "", /not declared for the audit workflow/u);
});

test("every one of the 42 public modules is declared exactly once", () => {
  const slugs = manifest.modules.map((module) => module.module);
  assert.equal(slugs.length, 42);
  assert.equal(new Set(slugs).size, 42);
});

test("module dependency closure is transitive, ordered, and de-duplicated", () => {
  const graph = dependencyManifest([
    ["root", ["left", "right"]],
    ["left", ["shared"]],
    ["right", ["shared", "leaf"]],
    ["shared", ["leaf"]],
    ["leaf", []]
  ]);

  const closure = resolveModuleDependencyClosure(graph, ["root", "root"]);
  assert.deepEqual(closure.roots, ["root"]);
  assert.deepEqual(closure.modules, ["root", "left", "right", "shared", "leaf"]);
  assert.deepEqual(
    closure.edges.map(({ parent, dependency }) => [parent, dependency]),
    [
      ["root", "left"],
      ["root", "right"],
      ["left", "shared"],
      ["right", "shared"],
      ["right", "leaf"],
      ["shared", "leaf"]
    ]
  );
  assert.ok(
    closure.edges.every(
      (edge) =>
        edge.reason === `Module '${edge.parent}' declares '${edge.dependency}' as a dependency.`
    )
  );
});

test("high-value task roots declare the cross-domain team they coordinate directly", () => {
  const expected = {
    frontend: ["ui", "ux", "accessibility", "performance", "testing"],
    auth: ["authorization", "security", "privacy", "api", "database", "frontend", "testing"],
    database: ["queries", "tenancy", "recovery", "performance", "security", "architecture", "api"]
  } as const;
  for (const [root, dependencies] of Object.entries(expected)) {
    const direct = manifest.modules.find((module) => module.module === root)?.dependsOn;
    assert.deepEqual(direct, dependencies, `${root} direct coordination team drifted`);
  }
});

test("module dependency closure terminates cycles and retains the closing edge", () => {
  const graph = dependencyManifest([
    ["a", ["b"]],
    ["b", ["c"]],
    ["c", ["a"]]
  ]);

  const first = resolveModuleDependencyClosure(graph, ["a"]);
  const second = resolveModuleDependencyClosure(graph, ["a"]);
  assert.deepEqual(first, second, "the same cyclic graph must resolve deterministically");
  assert.deepEqual(first.modules, ["a", "b", "c"]);
  assert.deepEqual(
    first.edges.map(({ parent, dependency }) => [parent, dependency]),
    [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"]
    ]
  );
});

test("module dependency closure rejects unknown roots and unknown dependency targets", () => {
  const valid = dependencyManifest([["known", []]]);
  assert.throws(
    () => resolveModuleDependencyClosure(valid, ["missing"]),
    /Unknown Forge module: missing/u
  );

  const damaged = dependencyManifest([
    ["root", []],
    ["unrelated", ["missing"]]
  ]);
  assert.throws(
    () => resolveModuleDependencyClosure(damaged, ["root"]),
    /module 'unrelated' depends on unknown module 'missing'/u
  );
});

test("the installed runtime manifest exposes the same dependency closure without writing", async () => {
  const expected = resolveModuleDependencyClosure(manifest, ["frontend"]);
  const actual = await resolveRuntimeModuleDependencyClosure(
    projectRoot,
    ["frontend"],
    projectRoot
  );
  assert.deepEqual(actual, expected);
});

test("an empty repository activates no provider content at all", () => {
  for (const declaration of manifest.modules) {
    const result = resolve(declaration.module, {});
    for (const entry of result.selected) {
      if (entry.tier === "forge-contract") continue;
      const source = [
        ...declaration.primary,
        ...declaration.overlays,
        ...(declaration.supplemental ?? [])
      ].find((candidate) => candidate.skill === entry.skill);
      assert.ok(
        source?.when.always === true,
        `${declaration.module} loaded ${entry.provider}/${entry.skill} with no evidence`
      );
    }
  }
});

test("composition evidence distinguishes backend frameworks from frontend and honors explicit greenfield intent", () => {
  const backend = compositionEvidenceFor(profile({ frameworks: [record("Express")] }));
  assert.ok(!backend.riskSurfaces?.includes("frontend"));

  const frontend = compositionEvidenceFor(profile({}), { modules: ["frontend"] });
  assert.ok(frontend.riskSurfaces?.includes("frontend"));

  const testing = compositionEvidenceFor(profile({}), { modules: ["testing"] });
  assert.equal(testing.flags?.testingApplicable, true);
});

test("greenfield intent is an explicit bounded override, not automatic applicability evidence", async () => {
  const empty = profile({});
  const initial = decideModules({ candidates: ["frontend"], profile: empty, explicit: true });
  const automatic = await expandApplicableDependencies(
    projectRoot,
    empty,
    initial,
    ["frontend"],
    {},
    projectRoot
  );
  for (const dependency of ["ui", "ux", "accessibility"])
    assert.equal(
      automatic.selected.includes(dependency as "ui" | "ux" | "accessibility"),
      false,
      `${dependency} must remain evidence-gated without explicit greenfield policy`
    );

  const explicit = await expandApplicableDependencies(
    projectRoot,
    empty,
    initial,
    ["frontend"],
    {
      explicitIntentDependencies: explicitGreenfieldDependenciesFor(empty, ["frontend"])
    },
    projectRoot
  );
  for (const dependency of ["ui", "ux", "accessibility"] as const) {
    assert.ok(explicit.selected.includes(dependency), `expected bounded ${dependency} intent`);
    const decision = explicit.decisions.find((candidate) => candidate.module === dependency);
    assert.ok(decision);
    assert.equal(decision.selection_status, "SELECTED");
    assert.notEqual(
      decision.risk_status,
      "PRESENT",
      "explicit greenfield intent must not be relabeled as repository evidence"
    );
    assert.ok(decision.reasons.some((reason) => reason.includes("not automatic")));
  }
});

test("React overlays activate for React and stay suppressed for Vue", () => {
  const react = resolve("frontend", {
    riskSurfaces: ["frontend"],
    profile: profile({ frameworks: [record("react")] })
  });
  assert.ok(react.selected.some((entry) => entry.skill === "react-best-practices"));

  const vue = resolve("frontend", {
    riskSurfaces: ["frontend"],
    profile: profile({ frameworks: [record("vue")] })
  });
  assert.ok(!vue.selected.some((entry) => entry.skill === "react-best-practices"));
  assert.ok(
    vue.suppressed.some(
      (entry) => entry.skill === "react-best-practices" && entry.reason === "no activation evidence"
    )
  );
});

test("React Native guidance needs React Native evidence, not merely React", () => {
  const web = resolve("frontend", {
    riskSurfaces: ["frontend"],
    profile: profile({ frameworks: [record("react")] })
  });
  assert.ok(!web.selected.some((entry) => entry.skill === "react-native-skills"));

  const native = resolve("frontend", {
    riskSurfaces: ["frontend"],
    profile: profile({ frameworks: [record("expo")] })
  });
  assert.ok(native.selected.some((entry) => entry.skill === "react-native-skills"));
  const spaced = resolve("frontend", {
    profile: profile({ frameworks: [record("React Native")] })
  });
  assert.ok(spaced.selected.some((entry) => entry.skill === "react-native-skills"));
  assert.ok(
    !spaced.selected.some((entry) => entry.skill === "react-best-practices"),
    "React must not match the React token inside React Native"
  );
});

test("path-shaped evidence cannot activate a provider by substring", () => {
  const cases = [
    { target: { frameworks: ["expo"] }, observed: "Next.js", path: "apps/exporter/package.json" },
    { target: { frameworks: ["react"] }, observed: "Preact", path: "packages/preact/package.json" },
    { target: { hosting: ["gcp"] }, observed: "AWS", path: "infra/gcp-exporter.tf" },
    { target: { frameworks: ["next"] }, observed: "Nextra", path: "apps/docs/package.json" }
  ] satisfies {
    target: ActivationCondition;
    observed: string;
    path: string;
  }[];
  for (const fixture of cases) {
    const dimensions =
      "hosting" in fixture.target
        ? profile({ hosting: [record(fixture.observed, "HIGH", [fixture.path])] })
        : profile({ frameworks: [record(fixture.observed, "HIGH", [fixture.path])] });
    assert.equal(
      evaluateActivation(fixture.target, { profile: dimensions }),
      undefined,
      `${Object.keys(fixture.target)[0]} must not match ${fixture.observed} or ${fixture.path}`
    );
  }
  assert.match(
    evaluateActivation(
      { frameworks: ["nextjs"] },
      { profile: profile({ frameworks: [record("Next.js")] }) }
    ) ?? "",
    /Next\.js/u
  );
});

test("activation grammar supports allOf, anyOf, not, nesting, and confidence thresholds", () => {
  const sentryNext = {
    allOf: [
      { observability: ["sentry"], minimumConfidence: "MEDIUM" as const },
      {
        anyOf: [{ frameworks: ["next", "nextjs"] }, { requested: ["sentry-nextjs"] }],
        not: { frameworks: ["nextra"] }
      }
    ]
  };
  assert.match(
    evaluateActivation(sentryNext, {
      profile: profile({
        observability: [record("sentry", "HIGH")],
        frameworks: [record("Next.js", "MEDIUM")]
      })
    }) ?? "",
    /all conditions matched/u
  );
  assert.equal(
    evaluateActivation(sentryNext, {
      profile: profile({ frameworks: [record("Next.js")] })
    }),
    undefined,
    "the framework alone is insufficient"
  );
  assert.equal(
    evaluateActivation(sentryNext, {
      profile: profile({
        observability: [record("sentry", "HIGH")],
        frameworks: [record("Nextra", "HIGH")]
      })
    }),
    undefined,
    "a matching exclusion suppresses the condition"
  );
  assert.equal(
    evaluateActivation(
      { observability: ["sentry"], minimumConfidence: "HIGH" },
      { profile: profile({ observability: [record("sentry", "MEDIUM")] }) }
    ),
    undefined
  );
});

test("Vercel optimisation stays out of composition while its required scripts are not vendored", () => {
  for (const declaration of manifest.modules) {
    const sources = [
      ...declaration.primary,
      ...declaration.overlays,
      ...(declaration.supplemental ?? [])
    ];
    assert.ok(!sources.some((source) => source.skill === "vercel-optimize"));
  }
});

test("Supabase content stays suppressed on plain PostgreSQL, but PostgreSQL guidance still loads", () => {
  const plain = resolve("database", { profile: profile({ databases: [record("postgres")] }) });
  assert.ok(plain.selected.some((entry) => entry.skill === "supabase-postgres-best-practices"));
  assert.ok(
    !plain.selected.some((entry) => entry.skill === "supabase"),
    "the Supabase platform skill must not load without Supabase evidence"
  );

  const supabase = resolve("database", {
    profile: profile({ databases: [record("postgres")], integrations: [record("supabase")] })
  });
  assert.ok(supabase.selected.some((entry) => entry.skill === "supabase"));
});

test("Cloudflare guidance does not activate on generic queue or cache concepts", () => {
  const generic = resolve("jobs", {
    profile: profile({ queues: [record("bullmq")], caches: [record("redis")] })
  });
  assert.equal(providers(generic).filter((id) => id === "cloudflare-skills").length, 0);

  const cloudflare = resolve("jobs", { profile: profile({ hosting: [record("Cloudflare")] }) });
  assert.ok(providers(cloudflare).includes("cloudflare-skills"));
});

test("Sentry bundles need Sentry, and generic observability never requires it", () => {
  const generic = resolve("observability", { profile: profile({}) });
  assert.ok(generic.selected.some((entry) => entry.skill === "observability-and-instrumentation"));
  assert.equal(providers(generic).filter((id) => id === "sentry-agent-skills").length, 0);

  const sentry = resolve("observability", {
    profile: profile({ observability: [record("sentry")] })
  });
  assert.ok(providers(sentry).includes("sentry-agent-skills"));
});

test("Sentry SDK guidance requires Sentry and the matching stack", () => {
  const matching = resolve("observability", {
    profile: profile({
      observability: [record("sentry")],
      frameworks: [record("Next.js")]
    })
  });
  assert.ok(matching.selected.some((entry) => entry.skill === "sentry-nextjs-sdk"));

  const frameworkOnly = resolve("observability", {
    profile: profile({ frameworks: [record("Next.js")] })
  });
  assert.ok(!frameworkOnly.selected.some((entry) => entry.skill === "sentry-nextjs-sdk"));

  const sentryOnly = resolve("observability", {
    profile: profile({ observability: [record("sentry")] })
  });
  assert.ok(!sentryOnly.selected.some((entry) => entry.skill === "sentry-nextjs-sdk"));

  const explicitlyRequested = resolve("observability", {
    requested: ["sentry-nextjs"]
  });
  assert.ok(explicitlyRequested.selected.some((entry) => entry.skill === "sentry-nextjs-sdk"));

  const lowConfidence = resolve("observability", {
    profile: profile({
      observability: [record("sentry", "LOW")],
      frameworks: [record("Next.js")]
    })
  });
  assert.ok(!lowConfidence.selected.some((entry) => entry.skill === "sentry-nextjs-sdk"));
});

test("an exclusion-only branch does not weaken a matching Sentry React conjunction", () => {
  const result = resolve("observability", {
    profile: profile({
      observability: [record("sentry")],
      frameworks: [record("React")]
    })
  });
  assert.ok(
    result.selected.some((entry) => entry.skill === "sentry-react-sdk"),
    "Sentry + React must select the matching SDK instead of lower-priority generic Sentry sources"
  );
});

test("two proven Sentry stacks fill but do not exceed the overlay budget", () => {
  const result = resolve("observability", {
    profile: profile({
      observability: [record("sentry")],
      frameworks: [record("Next.js"), record("SvelteKit")]
    })
  });
  assert.deepEqual(
    result.selected
      .filter((entry) => entry.tier === "overlay")
      .map((entry) => entry.skill)
      .sort(),
    ["sentry-nextjs-sdk", "sentry-svelte-sdk"]
  );
});

test("Google Cloud and GKE overlays need Google Cloud evidence", () => {
  const aws = resolve("infrastructure", { profile: profile({ hosting: [record("AWS")] }) });
  assert.equal(providers(aws).filter((id) => id === "google-skills").length, 0);

  const gke = resolve("infrastructure", { profile: profile({ hosting: [record("GKE")] }) });
  assert.ok(providers(gke).includes("google-skills"));
});

test("Stripe and PayPal activate only for their own provider", () => {
  const stripe = resolve("payments", {
    riskSurfaces: ["payments"],
    profile: profile({ payment_providers: [record("stripe")] })
  });
  assert.ok(stripe.selected.some((entry) => entry.skill === "stripe-integration"));
  assert.ok(!stripe.selected.some((entry) => entry.skill === "paypal-integration"));

  const paypal = resolve("payments", {
    riskSurfaces: ["payments"],
    profile: profile({ payment_providers: [record("paypal")] })
  });
  assert.ok(paypal.selected.some((entry) => entry.skill === "paypal-integration"));
  assert.ok(!paypal.selected.some((entry) => entry.skill === "stripe-integration"));
});

test("a low-confidence detection alone does not activate a provider overlay", () => {
  const weak = resolve("performance", { profile: profile({ hosting: [record("Vercel", "LOW")] }) });
  assert.ok(!weak.selected.some((entry) => entry.skill === "vercel-optimize"));
});

test("GDPR guidance loads only when GDPR is proven relevant", () => {
  assert.ok(!resolve("privacy", {}).selected.some((entry) => entry.skill === "gdpr-data-handling"));
  assert.ok(
    resolve("privacy", { flags: { gdprRelevant: true } }).selected.some(
      (entry) => entry.skill === "gdpr-data-handling"
    )
  );
});

test("the context budget is enforced and every drop is reported", () => {
  const everything: CompositionEvidence = {
    riskSurfaces: ["frontend", "api", "payments"],
    requested: ["vercel", "cloudflare", "google-cloud", "supabase", "sentry", "gke"],
    profile: profile({
      frameworks: [record("react"), record("next")],
      hosting: [record("Vercel"), record("Cloudflare"), record("GKE")],
      databases: [record("postgres")],
      observability: [record("sentry")],
      integrations: [record("supabase")],
      payment_providers: [record("stripe"), record("paypal")]
    }),
    flags: { ci: true, retrieval: true, threatModelling: true, testingApplicable: true }
  };
  for (const declaration of manifest.modules) {
    const result = resolve(declaration.module, everything);
    const counts = { primary: 0, overlay: 0, supplemental: 0 };
    for (const entry of result.selected) {
      if (entry.tier === "forge-contract") continue;
      counts[entry.tier] += 1;
    }
    assert.ok(counts.primary <= result.budget.maxPrimarySkills, `${declaration.module} primary`);
    assert.ok(counts.overlay <= result.budget.maxOverlays, `${declaration.module} overlays`);
    assert.ok(
      counts.supplemental <= result.budget.maxSupplemental,
      `${declaration.module} supplemental`
    );
    for (const dropped of result.suppressed)
      assert.ok(dropped.reason.length > 0, "every suppression states a reason");
  }
});

test("an explicit provider request wins a saturated overlay budget", () => {
  const result = resolve("infrastructure", {
    requested: ["gke"],
    profile: profile({ hosting: [record("Cloudflare")] })
  });
  const selected = result.selected.filter((entry) => entry.tier === "overlay");
  assert.equal(selected.length, 2);
  assert.ok(selected.every((entry) => entry.provider === "google-skills"));
  assert.ok(selected.every((entry) => entry.reason.startsWith("explicitly requested")));
});

test("an exact source request makes every declared composition source reachable", () => {
  for (const declaration of manifest.modules) {
    for (const source of [
      ...declaration.primary,
      ...declaration.overlays,
      ...(declaration.supplemental ?? [])
    ]) {
      const result = resolve(declaration.module, { requested: [source.skill] });
      assert.ok(
        result.selected.some(
          (entry) => entry.provider === source.provider && entry.skill === source.skill
        ),
        `${declaration.module} cannot select ${source.provider}/${source.skill} by exact request`
      );
    }
  }
});

test("high-confidence provider evidence outranks generic repository evidence", () => {
  const synthetic: CompositionManifest = {
    schemaVersion: 2,
    defaultContextBudget: {
      maxPrimarySkills: 1,
      maxOverlays: 1,
      maxSupplemental: 1
    },
    modules: [
      {
        module: "observability",
        mode: "hybrid",
        designation: "fixture",
        forgeContract: "references/build/observability.md",
        primary: [],
        overlays: [
          {
            provider: "addy-agent-skills",
            skill: "generic-react-observability",
            path: "generic/SKILL.md",
            when: { frameworks: ["react"] }
          },
          {
            provider: "sentry-agent-skills",
            skill: "sentry-observability",
            path: "sentry/SKILL.md",
            when: { observability: ["sentry"] }
          }
        ],
        conflicts: [],
        dependsOn: [],
        outputClassification: "finding",
        forgeAuthority: []
      }
    ]
  };
  const result = resolveComposition({
    manifest: synthetic,
    module: "observability",
    evidence: {
      profile: profile({
        frameworks: [record("react")],
        observability: [record("sentry")]
      })
    },
    runtimePathFor
  });
  assert.equal(
    result.selected.find((entry) => entry.tier === "overlay")?.skill,
    "sentry-observability"
  );
});

test("every over-budget module preserves an exact requested source and reports other drops", () => {
  for (const declaration of manifest.modules) {
    const budget = declaration.contextBudget ?? manifest.defaultContextBudget;
    for (const [tier, sources, limit] of [
      ["primary", declaration.primary, budget.maxPrimarySkills],
      ["overlay", declaration.overlays, budget.maxOverlays],
      ["supplemental", declaration.supplemental ?? [], budget.maxSupplemental]
    ] as const) {
      if (sources.length <= limit) continue;
      for (const source of sources) {
        const result = resolve(declaration.module, {
          requested: [source.skill],
          riskSurfaces: ["frontend", "api", "payments"],
          flags: {
            ci: true,
            retrieval: true,
            migration: true,
            threatModelling: true,
            gdprRelevant: true,
            testingApplicable: true,
            missingEssentialRequirements: true,
            divergentExploration: true,
            incidentInvestigation: true
          },
          profile: profile({
            languages: [record("Python"), record("Go"), record("Ruby"), record(".NET")],
            frameworks: [
              record("React"),
              record("Next.js"),
              record("React Native"),
              record("SvelteKit")
            ],
            databases: [record("PostgreSQL"), record("Supabase")],
            hosting: [
              record("Cloudflare"),
              record("Google Cloud"),
              record("GKE"),
              record("Vercel")
            ],
            integrations: [record("Supabase")],
            observability: [record("Sentry")],
            ai_providers: [record("Gemini")],
            payment_providers: [record("Stripe"), record("PayPal")]
          })
        });
        assert.ok(
          result.selected.some(
            (entry) =>
              entry.tier === tier &&
              entry.provider === source.provider &&
              entry.skill === source.skill
          ),
          `${declaration.module}/${tier} dropped exact request ${source.provider}/${source.skill}`
        );
        assert.ok(
          result.suppressed
            .filter((entry) => entry.tier === tier)
            .every((entry) => entry.reason.length > 0),
          `${declaration.module}/${tier} hid a saturation drop`
        );
      }
    }
  }
});

test("resolution is deterministic and requirements keep their declared sequence", () => {
  const evidence: CompositionEvidence = {
    requested: ["planning-and-task-breakdown"],
    flags: { missingEssentialRequirements: true, divergentExploration: true }
  };
  const first = resolve("requirements", evidence);
  const second = resolve("requirements", evidence);
  assert.deepEqual(first.selected, second.selected);
  assert.deepEqual(
    first.selected.filter((entry) => entry.tier === "primary").map((entry) => entry.skill),
    ["interview-me", "idea-refine", "spec-driven-development", "planning-and-task-breakdown"]
  );
});

test("missing upstream content is reported as a damaged installation, never as clean", () => {
  const result = resolveComposition({
    manifest,
    module: "frontend",
    evidence: { riskSurfaces: ["frontend"], profile: profile({ frameworks: [record("react")] }) },
    runtimePathFor,
    availableRuntimePaths: new Set()
  });
  assert.ok(result.missing.length > 0);
  assert.ok(
    result.suppressed.some((entry) => entry.reason.includes("missing from this installation"))
  );
});

test("runtime manifests cannot elevate repository files outside Forge-owned subtrees", async () => {
  const manifestFor = (input: { auditContract: string; sourceRuntimePath?: string }): object => ({
    schemaVersion: 2,
    defaultContextBudget: { maxPrimarySkills: 0, maxOverlays: 1, maxSupplemental: 0 },
    workflowContracts: { audit: input.auditContract },
    modules: [
      {
        module: "observability",
        mode: "hybrid",
        designation: "fixture",
        forgeContract: "references/build/observability.md",
        primary: [],
        overlays:
          input.sourceRuntimePath === undefined
            ? []
            : [
                {
                  provider: "fixture",
                  skill: "repository-file",
                  path: "fixture/SKILL.md",
                  when: { always: true }
                }
              ],
        supplemental: [],
        conflicts: [],
        dependsOn: [],
        outputClassification: "finding",
        forgeAuthority: [],
        resolvedSources:
          input.sourceRuntimePath === undefined
            ? []
            : [
                {
                  provider: "fixture",
                  skill: "repository-file",
                  runtimePath: input.sourceRuntimePath
                }
              ]
      }
    ]
  });

  for (const scenario of [
    {
      name: "contract-traversal",
      manifest: manifestFor({ auditContract: "../../../README.md" }),
      expected: /contract.*path is unsafe/iu
    },
    {
      name: "repository-source",
      manifest: manifestFor({
        auditContract: "references/workflows/audit.md",
        sourceRuntimePath: "README.md"
      }),
      expected: /source.*path must stay inside '\.fullstack-forge\/upstream'/iu
    }
  ]) {
    await withTemporaryProject(`composition-owned-path-${scenario.name}`, async (root) => {
      const manifestRoot = join(root, ".fullstack-forge", "manifests");
      await mkdir(manifestRoot, { recursive: true });
      await writeFile(join(root, "README.md"), "# repository-controlled text\n", "utf8");
      await writeFile(
        join(manifestRoot, "module-composition.json"),
        `${JSON.stringify(scenario.manifest, null, 2)}\n`,
        "utf8"
      );
      await assert.rejects(
        resolveRuntimeCompositionWithRoot(root, ["observability"], { workflow: "audit" }, root),
        scenario.expected
      );
    });
  }
});

test("a directory at a declared runtime source is damaged content, not available content", async () => {
  await withTemporaryProject("composition-directory-source", async (root) => {
    const runtimeSource = join(PACKAGE_ROOT, ".fullstack-forge", "runtime", "cli");
    const runtimeDestination = join(root, ".fullstack-forge", "runtime", "cli");
    await cp(runtimeSource, runtimeDestination, { recursive: true });

    const manifestRoot = join(root, ".fullstack-forge", "manifests");
    await mkdir(manifestRoot, { recursive: true });
    const sourceRuntimePath = ".fullstack-forge/upstream/fixture/fixture/PLAYBOOK.md";
    await writeFile(
      join(manifestRoot, "module-composition.json"),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          defaultContextBudget: { maxPrimarySkills: 0, maxOverlays: 1, maxSupplemental: 0 },
          workflowContracts: { build: "references/workflows/build.md" },
          modules: [
            {
              module: "observability",
              mode: "hybrid",
              designation: "fixture",
              forgeContract: "references/build/observability.md",
              primary: [],
              overlays: [
                {
                  provider: "fixture",
                  skill: "fixture",
                  path: "fixture/SKILL.md",
                  when: { always: true }
                }
              ],
              supplemental: [],
              conflicts: [],
              dependsOn: [],
              outputClassification: "finding",
              forgeAuthority: [],
              resolvedSources: [
                { provider: "fixture", skill: "fixture", runtimePath: sourceRuntimePath }
              ]
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const contractPath = join(
      root,
      ".fullstack-forge",
      "skills",
      "fullstack-forge",
      "references",
      "build",
      "observability.md"
    );
    await mkdir(join(contractPath, ".."), { recursive: true });
    await writeFile(contractPath, "# fixture contract\n", "utf8");
    await mkdir(join(root, ".fullstack-forge", "upstream", "fixture", "fixture", "PLAYBOOK.md"), {
      recursive: true
    });

    const runner = join(runtimeDestination, "src", "composition-entry.js");
    const result = await runFile(
      process.execPath,
      [runner, "observability", "compose", "--root", root, "--dry-run", "--json"],
      root
    );
    assert.equal(result.exitCode, 2, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout) as {
      compositions: Array<{ missing: string[] }>;
    };
    assert.ok(parsed.compositions[0]?.missing.includes(sourceRuntimePath));
  });
});

test("forge-all keeps its own routing and takes no upstream primary", () => {
  const declaration = manifest.modules.find((module) => module.module === "all");
  assert.ok(declaration);
  assert.equal(declaration.primary.length, 0);
  assert.equal(declaration.overlays.length, 0);
  assert.equal(declaration.mode, "forge-native");
});

test("modules that must stay Forge-authoritative declare no upstream primary", () => {
  for (const slug of [
    "all",
    "discover",
    "authorization",
    "tenancy",
    "uploads",
    "i18n",
    "seo",
    "integrations",
    "jobs",
    "notifications",
    "offline",
    "privacy",
    "ship"
  ]) {
    const declaration = manifest.modules.find((module) => module.module === slug);
    assert.ok(declaration, `${slug} must be declared`);
    assert.equal(declaration.primary.length, 0, `${slug} must not take an upstream primary`);
    assert.equal(declaration.mode, "forge-native");
  }
});

test("an unknown activation key can never activate a source", () => {
  const reason = evaluateActivation({ unknownDimension: ["react"] } as never, {
    profile: profile({ frameworks: [record("react")] })
  });
  assert.equal(reason, undefined);
});

test("an unknown activation key nested under not fails closed", () => {
  const reason = evaluateActivation({ not: { unknownDimension: ["react"] } } as never, {
    profile: profile({ frameworks: [record("react")] })
  });
  assert.equal(reason, undefined);

  const result = resolveComposition({
    manifest: {
      schemaVersion: 2,
      defaultContextBudget: { maxPrimarySkills: 0, maxOverlays: 1, maxSupplemental: 0 },
      modules: [
        {
          module: "fixture",
          mode: "hybrid",
          designation: "fixture",
          forgeContract: "references/build/fixture.md",
          primary: [],
          overlays: [
            {
              provider: "fixture-provider",
              skill: "typoed-exclusion",
              path: "typoed-exclusion.md",
              when: { not: { unknownDimension: ["react"] } } as never
            }
          ],
          supplemental: [],
          conflicts: [],
          dependsOn: [],
          outputClassification: "finding",
          forgeAuthority: []
        }
      ]
    },
    module: "fixture",
    evidence: {
      profile: profile({ frameworks: [record("react")] }),
      requested: ["fixture-provider/typoed-exclusion"]
    },
    runtimePathFor: (source) => source.path
  });
  assert.equal(
    result.selected.some((source) => source.skill === "typoed-exclusion"),
    false
  );
  assert.equal(
    result.suppressed.find((source) => source.skill === "typoed-exclusion")?.reason,
    "no activation evidence"
  );
});

test("an exclusion-only condition cannot establish applicability", () => {
  assert.equal(
    evaluateActivation({ not: { frameworks: ["react"] } }, {}),
    undefined,
    "missing evidence must not make a negative-only provider condition active"
  );
  assert.equal(
    evaluateActivation(
      {
        allOf: [{ frameworks: ["vue"] }, { not: { frameworks: ["react"] } }]
      },
      { profile: profile({ frameworks: [record("vue")] }) }
    )?.startsWith("all conditions matched"),
    true,
    "not remains a filter when positive applicability evidence is present"
  );
});

test("conflict precedence puts Forge contracts above every upstream workflow", () => {
  assert.equal(PRECEDENCE.length, 9);
  assert.ok(
    precedenceRank("forge-evidence-and-ship-contracts") <
      precedenceRank("primary-upstream-workflow")
  );
  assert.ok(
    precedenceRank("primary-upstream-workflow") < precedenceRank("conditional-provider-overlay")
  );
  assert.ok(
    precedenceRank("security-privacy-integrity-legal") <
      precedenceRank("forge-evidence-and-ship-contracts")
  );
  assert.equal(
    resolveConflict("primary-upstream-workflow", "forge-evidence-and-ship-contracts"),
    "forge-evidence-and-ship-contracts"
  );
  assert.equal(
    resolveConflict("optional-style-preference", "security-privacy-integrity-legal"),
    "security-privacy-integrity-legal"
  );
  assert.equal(
    resolveConflict("primary-upstream-workflow", "primary-upstream-workflow"),
    undefined,
    "a same-level conflict must be resolved explicitly, not guessed"
  );
});

test("modules that must never be overridden declare an explicit wildcard conflict rule", () => {
  for (const slug of ["authorization", "tenancy", "security", "ship", "all"]) {
    const declaration = manifest.modules.find((module) => module.module === slug);
    assert.ok(
      declaration?.conflicts.some((conflict) => conflict.with === "*"),
      `${slug} must declare a wildcard precedence rule`
    );
  }
});
