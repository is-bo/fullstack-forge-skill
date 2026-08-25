// Runs the composition evaluation corpus and reports raw results.
//
//   node scripts/run-composition-eval.mjs [--json]
//
// Measures what can be measured deterministically: which upstream sources each scenario activates,
// which it suppresses, and what the composition costs in loaded instruction bytes compared with the
// same task before the upstream-powered architecture. It deliberately does NOT score agent task
// outcomes; see ff-eval/COMPOSITION_EVALUATION.md for what is and is not claimed.

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";
import { runtimePathFor } from "./lib/upstream-compile.mjs";

const corpus = JSON.parse(
  await readFile(join(projectRoot, "ff-eval", "composition-corpus.json"), "utf8")
);
const saturationCorpus = JSON.parse(
  await readFile(join(projectRoot, "ff-eval", "composition-saturation-corpus.json"), "utf8")
);
const composition = JSON.parse(
  await readFile(join(projectRoot, "config", "module-composition.json"), "utf8")
);
const overlays = JSON.parse(
  await readFile(join(projectRoot, "config", "upstream-overlays.json"), "utf8")
).overlays;

const { resolveComposition } = await import(
  new URL("../build/cli/src/composition.js", import.meta.url).href
);

const DIMENSIONS = [
  "languages",
  "frameworks",
  "databases",
  "hosting",
  "integrations",
  "observability",
  "paymentProviders",
  "aiProviders"
];

/** Turns the corpus's compact evidence into the profile shape the engine expects. */
function toEvidence(raw) {
  const profileInput = raw.profile ?? {};
  const profile = {
    languages: [],
    frameworks: [],
    databases: [],
    orms: [],
    hosting: [],
    deployment: [],
    integrations: [],
    observability: [],
    payment_providers: [],
    ai_providers: []
  };
  const target = {
    languages: "languages",
    frameworks: "frameworks",
    databases: "databases",
    hosting: "hosting",
    integrations: "integrations",
    observability: "observability",
    paymentProviders: "payment_providers",
    aiProviders: "ai_providers"
  };
  for (const dimension of DIMENSIONS) {
    for (const name of profileInput[dimension] ?? []) {
      profile[target[dimension]].push({
        name,
        type: name,
        confidence: "HIGH",
        evidence: [`corpus fixture: ${name}`]
      });
    }
  }
  return {
    profile,
    requested: raw.requested ?? [],
    riskSurfaces: raw.riskSurfaces ?? [],
    flags: raw.flags ?? {}
  };
}

async function sizeOf(relative) {
  try {
    return (await stat(join(projectRoot, relative))).size;
  } catch {
    return 0;
  }
}

const results = [];
let failures = 0;

const saturatedEvidence = {
  requested: [],
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
  profile: {
    languages: ["Python", "Go", "Ruby", ".NET"],
    frameworks: ["React", "Next.js", "React Native", "SvelteKit"],
    databases: ["PostgreSQL", "Supabase"],
    hosting: ["Cloudflare", "Google Cloud", "GKE", "Vercel", "Kubernetes"],
    integrations: ["Supabase"],
    observability: ["Sentry"],
    paymentProviders: ["Stripe", "PayPal"],
    aiProviders: ["Gemini"]
  }
};
const cases = [
  ...corpus.cases,
  ...saturationCorpus.cases.map((entry) => ({
    id: entry.id,
    title: `Saturated ${entry.module} ${entry.tier} budget`,
    modules: [entry.module],
    evidence: {
      ...saturatedEvidence,
      requested: [entry.request]
    },
    expectActive: [entry.expectActive],
    expectSuppressed: [],
    saturation: entry
  }))
];

for (const testCase of cases) {
  const evidence = toEvidence(testCase.evidence);
  const active = new Set();
  const suppressed = new Set();
  let baselineBytes = 0;
  // Eager cost: what a task actually reads on entering the module — the Forge contract, the module
  // playbook, and the one primary upstream workflow. Overlays and supplemental references are
  // progressive: the manifest makes them available, and they are read only when the work reaches
  // them. Both numbers are reported because only reporting the smaller one would flatter the design.
  let eagerUpstreamBytes = 0;
  let availableUpstreamBytes = 0;
  const saturationProblems = [];

  for (const module of testCase.modules) {
    const result = resolveComposition({
      manifest: composition,
      module,
      evidence,
      runtimePathFor: (source) =>
        `.fullstack-forge/upstream/${source.provider}/${runtimePathFor(source.path, overlays[source.provider])}`
    });
    const eagerKeys = new Set(
      (result.eager ?? []).map(
        (entry) => `${entry.tier}\u0000${entry.provider}\u0000${entry.skill}`
      )
    );
    for (const entry of result.selected) {
      if (entry.tier === "forge-contract") {
        // Baseline cost: the Forge contract and module playbook, which both versions load.
        baselineBytes += await sizeOf(join("src", "fullstack-forge", entry.runtimePath));
        baselineBytes += await sizeOf(
          join("src", "fullstack-forge", "commands", `forge-${module}`, "SKILL.md")
        );
        continue;
      }
      active.add(`${entry.provider}/${entry.skill}`);
      const bytes = await sizeOf(entry.runtimePath);
      availableUpstreamBytes += bytes;
      if (eagerKeys.has(`${entry.tier}\u0000${entry.provider}\u0000${entry.skill}`))
        eagerUpstreamBytes += bytes;
    }
    for (const entry of result.suppressed) suppressed.add(`${entry.provider}/${entry.skill}`);
    if (testCase.saturation !== undefined && module === testCase.saturation.module) {
      const limit =
        testCase.saturation.tier === "primary"
          ? result.budget.maxPrimarySkills
          : testCase.saturation.tier === "overlay"
            ? result.budget.maxOverlays
            : result.budget.maxSupplemental;
      const selectedInTier = result.selected.filter(
        (entry) => entry.tier === testCase.saturation.tier
      ).length;
      if (selectedInTier !== limit)
        saturationProblems.push(
          `${testCase.saturation.tier} selected ${selectedInTier}, expected saturated limit ${limit}`
        );
      if (
        !result.suppressed.some(
          (entry) =>
            entry.tier === testCase.saturation.tier && entry.reason.includes("context budget")
        )
      )
        saturationProblems.push(
          `${testCase.saturation.tier} reported no reasoned context-budget suppression`
        );
    }
  }

  const missingExpected = testCase.expectActive.filter((name) => !active.has(name));
  const wronglyActive = testCase.expectSuppressed.filter((name) => active.has(name));
  const ok =
    missingExpected.length === 0 && wronglyActive.length === 0 && saturationProblems.length === 0;
  if (!ok) failures += 1;

  results.push({
    id: testCase.id,
    title: testCase.title,
    modules: testCase.modules,
    saturation: testCase.saturation !== undefined,
    ok,
    activeCount: active.size,
    active: [...active].sort(),
    suppressedCount: suppressed.size,
    missingExpected,
    wronglyActive,
    saturationProblems,
    baselineBytes,
    eagerUpstreamBytes,
    availableUpstreamBytes,
    // A stable proxy for context cost, not a tokenizer.
    approxBaselineTokens: Math.round(baselineBytes / 4),
    approxEagerTokens: Math.round((baselineBytes + eagerUpstreamBytes) / 4),
    approxAvailableTokens: Math.round((baselineBytes + availableUpstreamBytes) / 4),
    eagerPercentIncrease:
      baselineBytes === 0 ? null : Number(((eagerUpstreamBytes / baselineBytes) * 100).toFixed(1)),
    availablePercentIncrease:
      baselineBytes === 0
        ? null
        : Number(((availableUpstreamBytes / baselineBytes) * 100).toFixed(1))
  });
}

const measured = results.filter((row) => !row.saturation && row.eagerPercentIncrease !== null);
const summary = {
  cases: results.length,
  passed: results.length - failures,
  failed: failures,
  baseCases: results.filter((row) => !row.saturation).length,
  saturationCases: results.filter((row) => row.saturation).length,
  saturationPassed: results.filter((row) => row.saturation && row.ok).length,
  medianEagerPercentIncrease: median(measured.map((row) => row.eagerPercentIncrease)),
  maxEagerPercentIncrease: Math.max(...measured.map((row) => row.eagerPercentIncrease)),
  medianAvailablePercentIncrease: median(measured.map((row) => row.availablePercentIncrease)),
  maxAvailablePercentIncrease: Math.max(...measured.map((row) => row.availablePercentIncrease)),
  casesWithNoProviderContent: results.filter((row) => row.activeCount === 0).length,
  totalSuppressedAcrossCorpus: results.reduce((sum, row) => sum + row.suppressedCount, 0)
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  console.log(
    "id                              ok  actv  supp   base    eager   +%      available   +%"
  );
  for (const row of results) {
    console.log(
      `${row.id.padEnd(31)} ${row.ok ? "PASS" : "FAIL"} ${String(row.activeCount).padStart(4)} ` +
        `${String(row.suppressedCount).padStart(5)} ${String(row.approxBaselineTokens).padStart(6)} ` +
        `${String(row.approxEagerTokens).padStart(8)} ${String(row.eagerPercentIncrease ?? "n/a").padStart(7)} ` +
        `${String(row.approxAvailableTokens).padStart(10)} ${String(row.availablePercentIncrease ?? "n/a").padStart(7)}`
    );
    for (const name of row.missingExpected) console.log(`    MISSING  ${name}`);
    for (const name of row.wronglyActive) console.log(`    LEAKED   ${name}`);
    for (const problem of row.saturationProblems) console.log(`    BUDGET   ${problem}`);
  }
  console.log(`\n${JSON.stringify(summary, null, 2)}`);
}

if (failures > 0) process.exitCode = 1;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Number((((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2).toFixed(1))
    : (sorted[middle] ?? null);
}
