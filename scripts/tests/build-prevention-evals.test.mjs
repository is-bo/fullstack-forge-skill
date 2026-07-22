import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { expectedSlugs, projectRoot } from "../project.mjs";

/**
 * Prevention-scenario evaluations for build mode (WS-C).
 *
 * Detection-mode evals (evals/cases.json) prove an analyzer reproduces a finding against a
 * deliberately flawed fixture. Build mode has no equivalent "flawed project" to scan: prevention
 * is about whether an agent, working from a product brief through `forge new` / `forge feature`,
 * gets steered into the right tier, the right disciplines, and cannot reach `done` without real
 * evidence for the defects each scenario names. That agent judgment is not automatable, so this
 * file proves exactly two things and is explicit about the boundary between them:
 *
 *  1. (deterministic) The real CLI state machine enforces the mechanical guarantees each scenario
 *     depends on: tier and disciplines persist as recorded, the current gate plan is authoritative
 *     about waiver policy, every high-tier discipline must be proved directly, eligible
 *     operational acceptances name an accountable actor (and are never rendered as PASS), and a
 *     legitimately absent cache is excluded only when the feature did not explicitly select it.
 *  2. (structural) evals/build-cases.json itself is well-formed: every scenario names a real
 *     entry point, real disciplines, real build-briefs, and an honest_completion contract whose
 *     never_waivable_at_high_tier list is consistent with the CLI's high-tier gate policy.
 *
 * Whether an agent actually derives the right tier/disciplines from the prompt, and produces the
 * concrete evidence (negative tests, hostile-file fixtures, rendered UI states, adversarial
 * injection tests) the briefs require, is recorded per scenario as `verification.manual_notes` and
 * is not asserted here — inventing that proof would be exactly the dishonesty this harness exists
 * to prevent.
 */

const CASES_PATH = join(projectRoot, "evals", "build-cases.json");
const BUILD_BRIEFS_DIR = join(projectRoot, "src", "fullstack-forge", "references", "build");
const BUILD_SRC_DIR = join(projectRoot, "build", "cli", "src");

const EXPECTED_IDS = [
  "saas-start",
  "dashboard-no-slop",
  "registration-rbac",
  "secure-upload",
  "search-at-scale",
  "cache-justification",
  "multi-tenant-resource",
  "payment-webhooks",
  "ai-invoice-hostile",
  "idempotent-background-job",
  "offline-workflow"
];

async function loadCases() {
  return JSON.parse(await readFile(CASES_PATH, "utf8"));
}

async function loadBuildModule(name) {
  const url = pathToFileURL(join(BUILD_SRC_DIR, name)).href;
  return import(url);
}

async function withTemporaryProject(prefix, callback) {
  const safePrefix = `fullstack-forge-build-eval-${prefix.replace(/[^a-z0-9-]/giu, "-")}-`;
  const canonicalTemp = await realpath(tmpdir());
  const root = await realpath(await mkdtemp(join(canonicalTemp, safePrefix)));
  const validate = () => {
    const resolved = resolve(root);
    const temp = resolve(canonicalTemp);
    const separator = process.platform === "win32" ? "\\" : "/";
    if (!resolved.startsWith(`${temp}${separator}`) || !basename(resolved).startsWith(safePrefix))
      throw new Error(`Refusing to remove unexpected test path: ${resolved}`);
  };
  validate();
  try {
    return await callback(root);
  } finally {
    validate();
    await rm(root, { recursive: true });
  }
}

async function captureRun(runBuild, argv) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args.map((value) => String(value)).join(" "));
  };
  try {
    const code = await runBuild(argv);
    return { code, out: lines.join("\n") };
  } finally {
    console.log = original;
  }
}

// ---------------------------------------------------------------------------
// Fixture source per scenario: safe, non-executed TypeScript that trips the same discovery
// capability signatures cli/src/discovery-evidence.ts and cli/src/discovery.ts use, so that the
// disciplines a scenario depends on being genuinely "unproven" (NOT_VERIFIED) do not instead
// auto-resolve to NOT_APPLICABLE because discovery saw no signal at all. Verified empirically
// against the real compiled CLI before being committed here (see PR description / task notes).
// ---------------------------------------------------------------------------

const TRIVIAL_SOURCE = "export const value = 1;\n";

const FIXTURE_SOURCE = {
  "saas-start": `export function createAccount(req: { user?: { email: string } }): void {
  requireAuth(req);
}
`,
  "registration-rbac": `export function registerUser(req: { user?: { role: string } }): void {
  requireAuth(req);
  requireRole(req.user, "admin");
}
`,
  "secure-upload": `export function handleUpload(): void {
  const middleware = multer({ dest: "uploads/" });
  void middleware;
}
`,
  "multi-tenant-resource": `export function loadProjects(user: { tenantId: string; role: string }): void {
  const tenantId = user.tenantId;
  requireRole(user, "admin");
  void tenantId;
}
`,
  "payment-webhooks": `export function handleWebhook(payload: string, sig: string, secret: string): void {
  stripe.webhooks.constructEvent(payload, sig, secret);
}
`,
  "ai-invoice-hostile": `export function reviewExtraction(user: { role: string }): void {
  requireRole(user, "finance-approver");
}
`,
  "offline-workflow": `export function syncInspection(user: { email: string }): void {
  requireAuth(user);
  const email = user.email;
  indexedDB.open("inspections", 1);
  void email;
}
`
};

// ---------------------------------------------------------------------------
// Structural validation: evals/build-cases.json is well-formed and internally consistent.
// ---------------------------------------------------------------------------

test("build-cases.json covers the exact 11 required prevention scenarios", async () => {
  const cases = await loadCases();
  assert.deepEqual(
    cases.map((entry) => entry.id),
    EXPECTED_IDS
  );
  assert.equal(new Set(cases.map((entry) => entry.id)).size, EXPECTED_IDS.length);
});

test("every scenario declares a well-formed entry point, tier, disciplines, and briefs", async () => {
  const { BUILD_TIERS } = await loadBuildModule("build-state.js");
  const cases = await loadCases();
  const slugSet = new Set(expectedSlugs);
  for (const entry of cases) {
    await test(`${entry.id}: shape`, async () => {
      assert.match(entry.entry_point, /^forge (?:new|feature [a-z0-9][a-z0-9-]*)$/u, entry.id);
      assert.match(entry.feature_slug, /^[a-z0-9][a-z0-9-]{0,63}$/u, entry.id);
      assert.ok(BUILD_TIERS.includes(entry.expected_tier), `${entry.id} tier must be a valid tier`);
      assert.ok(entry.prompt.length > 40, `${entry.id} prompt must be a real brief`);
      assert.ok(
        Array.isArray(entry.expected_disciplines) && entry.expected_disciplines.length > 0,
        `${entry.id} must select at least one discipline`
      );
      for (const discipline of entry.expected_disciplines) {
        assert.ok(
          slugSet.has(discipline.slug),
          `${entry.id}: '${discipline.slug}' is not a module slug`
        );
        assert.ok(
          discipline.reason.length > 20,
          `${entry.id}: discipline '${discipline.slug}' needs a substantive reason`
        );
      }
      assert.ok(
        Array.isArray(entry.references_consulted) && entry.references_consulted.length > 0,
        `${entry.id} must name at least one build brief`
      );
      for (const brief of entry.references_consulted) {
        await assert.doesNotReject(
          readFile(join(BUILD_BRIEFS_DIR, brief), "utf8"),
          `${entry.id}: references_consulted brief '${brief}' must exist under references/build/`
        );
      }
      assert.ok(entry.defects_prevented.length >= 3, `${entry.id} needs concrete defects listed`);
      for (const defect of entry.defects_prevented)
        assert.ok(defect.length > 15, `${entry.id}: defect string too vague: '${defect}'`);
      assert.ok(Array.isArray(entry.expected_artifacts.state_paths));
      assert.ok(Array.isArray(entry.expected_artifacts.content_classes));
      assert.ok(entry.verification.mode.length > 0);
      assert.ok(entry.verification.deterministic_summary.length > 40);
      assert.ok(entry.verification.manual_notes.length > 40);

      // The never_waivable_at_high_tier list is not free text. At high tier every selected
      // discipline is a required, non-waivable gate; below high tier this high-tier-only list is
      // empty and the runtime gate plan still decides any tier-independent waiver restrictions.
      const selectedSlugs = new Set(entry.expected_disciplines.map((d) => d.slug));
      for (const criterion of entry.honest_completion.never_waivable_at_high_tier) {
        const match = /^discipline:([a-z0-9-]+)$/u.exec(criterion);
        assert.ok(match, `${entry.id}: '${criterion}' must be a 'discipline:<slug>' criterion`);
        const slug = match[1];
        assert.ok(
          selectedSlugs.has(slug),
          `${entry.id}: never-waivable discipline '${slug}' was not selected by this scenario`
        );
      }
      const expectedHighTierLocks =
        entry.expected_tier === "high"
          ? [...selectedSlugs].map((slug) => `discipline:${slug}`).sort()
          : [];
      assert.deepEqual(
        [...entry.honest_completion.never_waivable_at_high_tier].sort(),
        expectedHighTierLocks,
        `${entry.id}: high-tier lock metadata must match the current gate policy`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Deterministic CLI exercise: for each scenario, run the real compiled build-mode CLI against a
// temporary project and prove the mechanical enforcement the scenario's honest_completion contract
// depends on. This never asserts anything about agent judgment -- only about what the CLI itself
// guarantees once a feature carries the scenario's tier and disciplines.
// ---------------------------------------------------------------------------

test("the real CLI state machine enforces every scenario's honest-completion contract", async (t) => {
  const { runBuild, missingForDone } = await loadBuildModule("build.js");
  const { loadFeature, loadProject } = await loadBuildModule("build-state.js");
  const cases = await loadCases();

  for (const scenario of cases) {
    await t.test(scenario.id, async () => {
      await withTemporaryProject(scenario.id, async (root) => {
        if (scenario.entry_point === "forge new") {
          const created = await captureRun(runBuild, [
            "new",
            "--summary",
            scenario.prompt.slice(0, 120),
            "--stack",
            "Node.js/PostgreSQL: team already ships Node and Postgres in production",
            "--non-goal",
            "redis:no measured latency or cost problem exists yet",
            "--root",
            root
          ]);
          assert.equal(created.code, 0);
          const project = await loadProject(root);
          assert.ok(project);
          assert.equal(project.non_goals.length, 1);
          assert.equal(project.non_goals[0].item, "redis");
          assert.equal(project.stack.length, 1);
        }

        await writeFile(
          join(root, "app.ts"),
          FIXTURE_SOURCE[scenario.id] ?? TRIVIAL_SOURCE,
          "utf8"
        );

        const disciplineArgs = scenario.expected_disciplines.flatMap((d) => [
          "--discipline",
          `${d.slug}:${d.reason.slice(0, 80)}`
        ]);
        const start = await captureRun(runBuild, [
          "feature",
          scenario.feature_slug,
          "--tier",
          scenario.expected_tier,
          "--summary",
          scenario.title,
          ...disciplineArgs,
          "--touch",
          "app.ts",
          "--root",
          root
        ]);
        assert.equal(start.code, 0, `${scenario.id}: starting the feature must succeed`);

        let feature = await loadFeature(root, scenario.feature_slug);
        assert.ok(feature);
        assert.equal(feature.tier, scenario.expected_tier);
        assert.deepEqual(
          feature.disciplines.map((d) => d.slug).sort(),
          scenario.expected_disciplines.map((d) => d.slug).sort(),
          `${scenario.id}: recorded disciplines must match the scenario exactly`
        );

        const check = await captureRun(runBuild, [
          "feature",
          scenario.feature_slug,
          "check",
          "--root",
          root
        ]);
        feature = await loadFeature(root, scenario.feature_slug);
        assert.notEqual(check.code, undefined);
        for (const record of feature.evidence)
          assert.notEqual(
            record.status,
            "FAIL",
            `${scenario.id}: '${record.criterion}' unexpectedly FAIL against a safe fixture (${record.evidence[0]})`
          );

        const lockedCriteria = new Set(
          (feature.gate_plan?.gates ?? [])
            .filter((gate) => gate.waiver_policy === "never")
            .flatMap((gate) => gate.criteria)
            .filter((criterion) => criterion.startsWith("discipline:"))
        );
        for (const discipline of scenario.expected_disciplines) {
          const criterion = `discipline:${discipline.slug}`;
          const record = feature.evidence.find((entry) => entry.criterion === criterion);
          assert.ok(record, `${scenario.id}: missing evidence for ${criterion}`);
          if (record.status === "NOT_APPLICABLE") continue; // legitimately auto-resolved; nothing to accept-risk
          assert.equal(
            record.status,
            "NOT_VERIFIED",
            `${scenario.id}: ${criterion} expected NOT_VERIFIED or NOT_APPLICABLE, got ${record.status}`
          );
          if (lockedCriteria.has(criterion)) {
            await assert.rejects(
              runBuild([
                "feature",
                scenario.feature_slug,
                "accept-risk",
                "--criterion",
                criterion,
                "--reason",
                "attempting to waive a required security control",
                "--root",
                root
              ]),
              /non-waivable in the current gate plan/u,
              `${scenario.id}: accept-risk must be refused for locked criterion ${criterion}`
            );
          } else {
            const accepted = await captureRun(runBuild, [
              "feature",
              scenario.feature_slug,
              "accept-risk",
              "--criterion",
              criterion,
              "--reason",
              "recorded for the prevention eval under the current operational gate policy",
              "--actor",
              "prevention-eval-reviewer",
              "--root",
              root
            ]);
            assert.equal(
              accepted.code,
              0,
              `${scenario.id}: accept-risk should succeed for non-locked criterion ${criterion}`
            );
          }
        }

        feature = await loadFeature(root, scenario.feature_slug);
        // A risk acceptance is never rendered as a PASS on the underlying evidence record.
        for (const acceptance of feature.risk_acceptances) {
          const record = feature.evidence.find((entry) => entry.criterion === acceptance.criterion);
          assert.notEqual(
            record?.status,
            "PASS",
            `${scenario.id}: risk acceptance must never read as PASS`
          );
        }

        const stillLocked = [...lockedCriteria].some((criterion) => {
          const record = feature.evidence.find((entry) => entry.criterion === criterion);
          return record?.status === "NOT_VERIFIED";
        });
        const missing = missingForDone(feature);
        const done = await captureRun(runBuild, [
          "feature",
          scenario.feature_slug,
          "done",
          "--root",
          root
        ]);
        if (stillLocked) {
          assert.equal(
            done.code,
            1,
            `${scenario.id}: done must refuse while a required security control stays NOT_VERIFIED`
          );
          assert.match(done.out, /done refused/u);
          assert.ok(
            missing.some((item) =>
              [...lockedCriteria].some((criterion) => item.includes(`${criterion}:`))
            ),
            `${scenario.id}: missing_for_done must actionably name the locked criterion`
          );
        } else {
          assert.equal(
            done.code,
            0,
            `${scenario.id}: done must succeed once every discipline is resolved (${missing.join("; ")})`
          );
          assert.equal((await loadFeature(root, scenario.feature_slug))?.phase, "done");
        }
      });
    });
  }
});

test("an absent cache is excluded when the feature does not explicitly select cache", async () => {
  const { runBuild } = await loadBuildModule("build.js");
  const { loadFeature } = await loadBuildModule("build-state.js");
  const cases = await loadCases();
  const scenario = cases.find((entry) => entry.id === "cache-justification");
  assert.ok(scenario);

  await withTemporaryProject("cache-not-applicable", async (root) => {
    const featureSlug = "database-backed-dashboard";
    await writeFile(join(root, "app.ts"), TRIVIAL_SOURCE, "utf8");
    await captureRun(runBuild, [
      "feature",
      featureSlug,
      "--tier",
      scenario.expected_tier,
      "--summary",
      "Keep the existing database-backed dashboard query",
      "--touch",
      "app.ts",
      "--root",
      root
    ]);
    await captureRun(runBuild, ["feature", featureSlug, "check", "--root", root]);
    const feature = await loadFeature(root, featureSlug);
    const decision = feature.applicability_snapshot?.decisions.find(
      (entry) => entry.discipline === "cache"
    );
    assert.equal(decision?.status, "EXCLUDED");
    assert.ok(!feature.applicability_snapshot?.required.includes("cache"));
    assert.ok(!feature.gate_plan?.required_criteria.includes("discipline:cache"));
    const cacheEvidence = feature.evidence.find((entry) => entry.criterion === "discipline:cache");
    assert.equal(cacheEvidence?.status, "NOT_APPLICABLE");
    assert.match(cacheEvidence?.not_applicable_reason ?? "", /absent/u);
  });
});
