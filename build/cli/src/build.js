import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { BUILD_SUB_VERBS } from "./constants.js";
import { runAnalyzers } from "./analyzers.js";
import { detectProjectCommands, discoverProject } from "./discovery.js";
import { isModuleSlug } from "./inspectors.js";
import { decideCommandExecution } from "./offline-policy.js";
import { analyzeChangedScope, capabilityStatusFor } from "./scope.js";
import { isForgePackageRoot } from "./tools.js";
import { redactError, redactToString } from "./redaction.js";
import { canonicalDirectory, resolveInside, runFile, sha256, toPosix, utcNow, walkFiles, workingTreeRevision } from "./utils.js";
import { BUILD_TIERS, REPAIR_CAP, SECURITY_DISCIPLINES, TERMINAL_PHASES, assertValidSlug, loadFeature, loadProject, newFeature, newProject, reverifyEvidenceHashes, saveFeature, saveProject, upsertFeatureIndex, writeArtifact } from "./build-state.js";
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
const PROJECT_CHECK_ORDER = ["lint", "typecheck", "test", "build"];
const MAX_EVIDENCE_FILES = 60;
const MAX_SCOPE_FILES = 2000;
/**
 * Build-mode entry point.
 *
 * `cli.ts` delegates here before any module-slug parsing when the first token is a build verb, so
 * every existing audit command behaves exactly as before. Build has its own flag surface (tiers,
 * summaries, disciplines) and parses its own argv rather than widening the audit option type.
 */
export async function runBuild(argv) {
    const options = parseBuildArgs(argv);
    const verb = options.positionals[0];
    const root = await canonicalDirectory(options.cwd);
    if (verb === "new")
        return buildNew(root, options);
    if (verb === "resume")
        return buildResume(root, options);
    if (verb === "feature")
        return featureDispatch(root, options);
    throw new Error(`Unknown build verb '${verb ?? ""}'. Expected new, feature, or resume.`);
}
// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseBuildArgs(argv) {
    const options = {
        cwd: process.cwd(),
        json: false,
        dryRun: false,
        global: false,
        offline: false,
        allowRun: false,
        force: false,
        disciplines: [],
        inputs: [],
        touch: [],
        stack: [],
        nonGoals: [],
        decisions: [],
        assumptions: [],
        positionals: []
    };
    const valueFlags = {
        "--root": "cwd",
        "--cwd": "cwd",
        "--tier": "tier",
        "--summary": "summary",
        "--reason": "reason",
        "--criterion": "criterion",
        "--base": "base",
        "--name": "name"
    };
    const listFlags = {
        "--discipline": "disciplines",
        "--input": "inputs",
        "--touch": "touch",
        "--stack": "stack",
        "--non-goal": "nonGoals",
        "--decision": "decisions",
        "--assumption": "assumptions"
    };
    const assign = (key, value) => {
        if (key === "cwd")
            options.cwd = value;
        else if (key === "tier")
            options.tier = validateTier(value);
        else
            options[key] = value;
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] ?? "";
        if (arg === "--json")
            options.json = true;
        else if (arg === "--dry-run")
            options.dryRun = true;
        else if (arg === "--global")
            options.global = true;
        else if (arg === "--offline")
            options.offline = true;
        else if (arg === "--allow-run")
            options.allowRun = true;
        else if (arg === "--force")
            options.force = true;
        else if (arg.startsWith("--") && arg.includes("=")) {
            const [flag, ...rest] = arg.split("=");
            const value = rest.join("=");
            const listKey = listFlags[flag ?? ""];
            const valueKey = valueFlags[flag ?? ""];
            if (listKey !== undefined)
                options[listKey].push(value);
            else if (valueKey !== undefined)
                assign(valueKey, value);
            else
                throw new Error(`Unknown option '${flag}'`);
        }
        else if (arg in listFlags) {
            const key = listFlags[arg];
            const value = argv[index + 1];
            if (key === undefined || value === undefined)
                throw new Error(`Option '${arg}' requires a value`);
            options[key].push(value);
            index += 1;
        }
        else if (arg in valueFlags) {
            const key = valueFlags[arg];
            const value = argv[index + 1];
            if (key === undefined || value === undefined)
                throw new Error(`Option '${arg}' requires a value`);
            assign(key, value);
            index += 1;
        }
        else if (arg.startsWith("-"))
            throw new Error(`Unknown option '${arg}'`);
        else
            options.positionals.push(arg);
    }
    options.cwd = resolve(options.cwd);
    return options;
}
function validateTier(value) {
    if (!BUILD_TIERS.includes(value))
        throw new Error(`Unknown tier '${value}'. Expected light, standard, or high.`);
    return value;
}
function parseDisciplines(values) {
    return values.map((value) => {
        const separator = value.indexOf(":");
        const slug = (separator === -1 ? value : value.slice(0, separator)).trim();
        const reason = separator === -1 ? "selected at frame" : value.slice(separator + 1).trim();
        return { slug, reason: reason.length === 0 ? "selected at frame" : reason };
    });
}
function parseNonGoals(values) {
    return values.map((value) => {
        const separator = value.indexOf(":");
        const item = (separator === -1 ? value : value.slice(0, separator)).trim();
        const reason = separator === -1 ? "no reason recorded" : value.slice(separator + 1).trim();
        return { item, reason: reason.length === 0 ? "no reason recorded" : reason };
    });
}
// ---------------------------------------------------------------------------
// forge new
// ---------------------------------------------------------------------------
async function buildNew(root, options) {
    const existing = await loadProject(root);
    if (existing !== undefined && !options.force)
        throw new Error("A build project already exists at .forge/build/project.json. Pass --force to reinitialize it.");
    const project = newProject(options.summary ?? "", options.tier);
    project.stack = options.stack;
    project.non_goals = parseNonGoals(options.nonGoals);
    if (options.name !== undefined)
        project.product.name = options.name;
    const projectPath = await saveProject(root, project, options.dryRun);
    const decisionsPath = await writeArtifact(root, "DECISIONS.md", DECISIONS_TEMPLATE, options.dryRun);
    const designPath = await writeArtifact(root, "DESIGN.md", designTemplate(project.product.summary), options.dryRun);
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
async function buildResume(root, options) {
    const project = await loadProject(root);
    const unfinished = (project?.features ?? []).filter((entry) => !TERMINAL_PHASES.has(entry.phase));
    const mostRecent = [...unfinished].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    return report(options, {
        operation: "resume",
        project_initialized: project !== undefined,
        unfinished_features: unfinished,
        most_recent: mostRecent,
        next: mostRecent === undefined
            ? "No unfinished features. Run `forge feature <slug>` to start one."
            : `Resume with \`forge feature ${mostRecent.slug}\`.`
    });
}
// ---------------------------------------------------------------------------
// forge feature dispatch
// ---------------------------------------------------------------------------
async function featureDispatch(root, options) {
    const slug = options.positionals[1];
    const sub = options.positionals[2];
    if (slug === undefined)
        throw new Error("forge feature requires a feature slug.\n" +
            "Usage: forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status]\n" +
            `Sub-verbs: ${BUILD_SUB_VERBS.join(", ")}.`);
    // A reserved word in the slug position is almost always a misremembered command such as
    // `forge feature audit`; explain the grammar rather than emitting a bare validation error.
    try {
        assertValidSlug(slug);
    }
    catch (error) {
        throw new Error(`${error.message}\n` +
            "Usage: forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status]\n" +
            "The first argument is a feature name you choose, not a command. To review an arbitrary diff use `forge all audit --scope changed`.", { cause: error });
    }
    if (sub !== undefined && !BUILD_SUB_VERBS.includes(sub))
        throw new Error(`Unknown sub-verb '${sub}' for feature '${slug}'. Expected one of: ${BUILD_SUB_VERBS.join(", ")}.`);
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
async function ensureProjectIndex(root, feature, options) {
    const project = (await loadProject(root)) ?? newProject("(created implicitly by forge feature)", undefined);
    await saveProject(root, upsertFeatureIndex(project, feature), options.dryRun);
}
// ---------------------------------------------------------------------------
// feature: start / resume (no sub-verb)
// ---------------------------------------------------------------------------
async function featureStart(root, slug, options) {
    const existing = await loadFeature(root, slug);
    if (existing !== undefined) {
        const { feature, demoted } = await reverifyEvidenceHashes(root, existing);
        if (demoted.length > 0)
            await saveFeature(root, feature, options.dryRun);
        return renderFeature(options, feature, {
            operation: "resume",
            demoted,
            next: nextStepFor(feature)
        });
    }
    const tier = options.tier ?? "standard";
    const feature = newFeature(slug, tier, options.summary ?? "");
    applyFrameInputs(feature, options);
    if (tier === "light") {
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
        next: nextStepFor(feature)
    });
}
function applyFrameInputs(feature, options) {
    if (options.summary !== undefined)
        feature.summary = options.summary;
    if (options.disciplines.length > 0)
        feature.disciplines = parseDisciplines(options.disciplines);
    if (options.inputs.length > 0)
        feature.tier_inputs = [...new Set(options.inputs)];
    if (options.touch.length > 0)
        feature.touched_paths = [...new Set(options.touch.map((path) => toPosix(path)))];
    if (options.decisions.length > 0)
        feature.decisions = [...feature.decisions, ...options.decisions];
    if (options.assumptions.length > 0)
        feature.assumptions = [...feature.assumptions, ...options.assumptions];
    if (options.reason !== undefined)
        feature.tier_override_reason = options.reason;
}
// ---------------------------------------------------------------------------
// feature frame / plan
// ---------------------------------------------------------------------------
async function featureFrame(root, slug, options) {
    const feature = (await loadFeature(root, slug)) ?? newFeature(slug, options.tier ?? "standard", "");
    if (options.tier !== undefined)
        feature.tier = options.tier;
    applyFrameInputs(feature, options);
    // frame is recorded guidance; it never regresses a feature past its current phase.
    if (feature.phase === "abandoned" || feature.phase === "done")
        throw new Error(`Feature '${slug}' is ${feature.phase} and cannot be reframed.`);
    if (feature.phase === "frame")
        feature.phase = "frame";
    await saveFeature(root, feature, options.dryRun);
    await ensureProjectIndex(root, feature, options);
    return renderFeature(options, feature, { operation: "frame", next: nextStepFor(feature) });
}
async function featurePlan(root, slug, options) {
    const feature = await requireFeature(root, slug);
    if (TERMINAL_PHASES.has(feature.phase))
        throw new Error(`Feature '${slug}' is ${feature.phase}; it cannot be planned.`);
    if (options.summary !== undefined && feature.summary.length === 0)
        feature.summary = options.summary;
    const planSummary = options.summary ?? feature.plan_summary ?? feature.summary;
    feature.plan_summary = planSummary;
    feature.plan_hash = sha256(`${planSummary} ${feature.disciplines
        .map((d) => d.slug)
        .sort()
        .join(",")}`);
    if (options.decisions.length > 0)
        feature.decisions = [...feature.decisions, ...options.decisions];
    if (options.disciplines.length > 0)
        feature.disciplines = parseDisciplines(options.disciplines);
    feature.phase = "plan";
    await saveFeature(root, feature, options.dryRun);
    await ensureProjectIndex(root, feature, options);
    return renderFeature(options, feature, { operation: "plan", next: nextStepFor(feature) });
}
// ---------------------------------------------------------------------------
// feature check
// ---------------------------------------------------------------------------
async function featureCheck(root, slug, options) {
    const loaded = await requireFeature(root, slug);
    const { feature } = await reverifyEvidenceHashes(root, loaded);
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
async function runCheckPass(root, feature, options, operation) {
    const profile = await discoverProject(root);
    const derived = await deriveCriteria(root, feature, profile, options);
    feature.evidence = mergeEvidence(feature.evidence, derived);
    const { blockers, tripped } = advanceRepairCounters(feature, derived);
    feature.repair_counters = blockers.counters;
    if (tripped.length > 0) {
        feature.phase = "blocked";
        feature.blockers = [...feature.blockers, ...tripped];
    }
    else if (feature.phase === "frame" || feature.phase === "plan" || feature.phase === "check") {
        feature.phase = "check";
    }
    else if (feature.phase === "implement") {
        feature.phase = "check";
    }
    await saveFeature(root, feature, options.dryRun);
    await ensureProjectIndex(root, feature, options);
    const hasFail = derived.some((record) => record.status === "FAIL");
    const missing = missingForDone(feature);
    const exitCode = feature.phase === "blocked" || hasFail ? 1 : 0;
    return renderFeature(options, feature, {
        operation,
        derived,
        missing_for_done: missing,
        blocked: feature.phase === "blocked",
        next: feature.phase === "blocked"
            ? "Repair cap reached; the feature is blocked. Move on or `abandon`."
            : missing.length === 0
                ? `Ready. Run \`forge feature ${feature.slug} done\`.`
                : `Resolve ${missing.length} item(s), then run \`forge feature ${feature.slug} done\`.`
    }, exitCode);
}
// ---------------------------------------------------------------------------
// feature done
// ---------------------------------------------------------------------------
async function featureDone(root, slug, options) {
    const loaded = await requireFeature(root, slug);
    const { feature, demoted } = await reverifyEvidenceHashes(root, loaded);
    if (feature.phase === "done")
        return renderFeature(options, feature, { operation: "done", next: "Already done." });
    if (feature.phase === "abandoned" || feature.phase === "blocked")
        throw new Error(`Feature '${slug}' is ${feature.phase}; it cannot be completed.`);
    const missing = missingForDone(feature);
    if (demoted.length > 0)
        await saveFeature(root, feature, options.dryRun);
    if (missing.length > 0) {
        return renderFeature(options, feature, {
            operation: "done",
            refused: true,
            missing_for_done: missing,
            demoted,
            next: "Provide evidence, a reasoned NOT_APPLICABLE, or an eligible risk acceptance for each item, then re-run done."
        }, 1);
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
async function featureAcceptRisk(root, slug, options) {
    const feature = await requireFeature(root, slug);
    if (options.criterion === undefined)
        throw new Error("accept-risk requires --criterion <criterion-id>.");
    if (options.reason === undefined || options.reason.trim().length === 0)
        throw new Error("accept-risk requires a non-empty --reason.");
    const record = feature.evidence.find((item) => item.criterion === options.criterion);
    if (record === undefined)
        throw new Error(`No evidence record exists for criterion '${options.criterion}'. Run \`forge feature ${slug} check\` first.`);
    if (feature.tier === "high" && record.security_control)
        throw new Error(`Criterion '${options.criterion}' is a required security control at high tier and cannot be risk-accepted. It must be PASS or a reasoned NOT_APPLICABLE.`);
    const revision = await workingTreeRevision(root);
    feature.risk_acceptances = [
        ...feature.risk_acceptances,
        {
            criterion: options.criterion,
            reason: options.reason,
            revision,
            timestamp: utcNow()
        }
    ];
    await saveFeature(root, feature, options.dryRun);
    return renderFeature(options, feature, {
        operation: "accept-risk",
        next: `Recorded risk acceptance for '${options.criterion}'. It is never rendered as PASS.`
    });
}
async function featureAbandon(root, slug, options) {
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
async function featureStatus(root, slug, options) {
    const loaded = await requireFeature(root, slug);
    const { feature, demoted } = await reverifyEvidenceHashes(root, loaded);
    return renderFeature(options, feature, {
        operation: "status",
        demoted,
        missing_for_done: missingForDone(feature),
        next: nextStepFor(feature)
    });
}
async function requireFeature(root, slug) {
    const feature = await loadFeature(root, slug);
    if (feature === undefined)
        throw new Error(`Feature '${slug}' does not exist. Start it with \`forge feature ${slug} --tier <light|standard|high>\`.`);
    return feature;
}
async function deriveCriteria(root, feature, profile, options) {
    const now = utcNow();
    const criteria = [];
    const scope = await resolveBuildScope(root, profile, feature, options.base);
    feature.touched_paths = scope.files.slice(0, MAX_SCOPE_FILES);
    const scopeSource = scope.files.filter(isSourcePath);
    criteria.push({
        criterion: "scope-resolution",
        security_control: false,
        status: "PASS",
        producer: "scope.ts",
        evidence: [
            `Scope resolved via ${scope.mode}; ${scope.files.length} file(s) in scope.`,
            ...scope.reasons.slice(0, 5)
        ],
        files: await hashFiles(root, scope.files),
        instance_ids: [],
        recorded_at: now
    });
    const scopeSet = new Set(scope.files);
    const runs = await runAnalyzers("all", root, scopeSet.size > 0 ? scopeSet : undefined);
    const supported = runs.reduce((total, run) => total + run.supported_files, 0);
    const failFindings = runs.flatMap((run) => run.findings).filter((f) => f.status === "FAIL");
    criteria.push({
        criterion: "static-analysis",
        security_control: false,
        status: failFindings.length > 0 ? "FAIL" : supported > 0 ? "PASS" : "NOT_VERIFIED",
        producer: "analyzers.ts",
        evidence: failFindings.length > 0
            ? failFindings
                .slice(0, 10)
                .map((f) => redactToString(`${f.instance_id ?? f.id}: ${f.title} (${f.location[0]?.path ?? "?"})`))
            : [
                supported > 0
                    ? `Analyzed ${supported} supported source file(s) in scope; no failing pattern was reproduced.`
                    : "No analyzable source files were in scope, so static analysis could not run."
            ],
        files: await hashFiles(root, scopeSource),
        instance_ids: failFindings.map((f) => f.instance_id ?? f.id).slice(0, 50),
        recorded_at: now
    });
    const commands = await detectProjectCommands(root);
    const policy = { offline: options.offline, forgeOwned: await isForgePackageRoot(root) };
    for (const name of PROJECT_CHECK_ORDER) {
        const command = commands.find((candidate) => candidate.name === name);
        if (command === undefined)
            continue;
        criteria.push(await deriveCommandCriterion(root, command, name, options.allowRun, policy, scopeSource, now));
    }
    for (const discipline of feature.disciplines) {
        criteria.push(deriveDisciplineCriterion(discipline, profile, failFindings, now));
    }
    return criteria;
}
async function deriveCommandCriterion(root, command, name, allowRun, policy, scopeSource, now) {
    const criterion = `project:${name}`;
    const files = await hashFiles(root, scopeSource);
    if (!allowRun)
        return {
            criterion,
            security_control: false,
            status: "NOT_VERIFIED",
            producer: `project-command:${name}`,
            evidence: [
                `'${name}' was detected but requires explicit --allow-run after review; it did not execute.`
            ],
            files,
            instance_ids: [],
            recorded_at: now
        };
    const decision = decideCommandExecution(command, policy);
    if (!decision.permitted)
        return {
            criterion,
            security_control: false,
            status: "BLOCKED",
            producer: `project-command:${name}`,
            evidence: [redactToString(decision.reason)],
            files,
            instance_ids: [],
            recorded_at: now
        };
    const result = await runFile(command.executable, command.args, root, 10 * 60_000);
    const output = redactToString(`${result.stdout}\n${result.stderr}`.trim(), 800);
    return {
        criterion,
        security_control: false,
        status: result.exitCode === 0 ? "PASS" : "FAIL",
        producer: `project-command:${name}`,
        evidence: [
            `${command.executable} ${command.args.join(" ")} exited ${result.exitCode}.`,
            output
        ],
        files,
        instance_ids: [],
        recorded_at: now
    };
}
function deriveDisciplineCriterion(discipline, profile, failFindings, now) {
    const slug = discipline.slug;
    const securityControl = SECURITY_DISCIPLINES.has(slug);
    const criterion = `discipline:${slug}`;
    const failing = failFindings.filter((finding) => finding.section === slug);
    if (failing.length > 0)
        return {
            criterion,
            discipline: slug,
            security_control: securityControl,
            status: "FAIL",
            producer: "analyzers.ts",
            evidence: failing
                .slice(0, 10)
                .map((f) => redactToString(`${f.instance_id ?? f.id}: ${f.title}`)),
            files: [],
            instance_ids: failing.map((f) => f.instance_id ?? f.id).slice(0, 50),
            recorded_at: now
        };
    if (isModuleSlug(slug)) {
        const capability = capabilityStatusFor(slug, profile);
        if (capability.status === "ABSENT")
            return {
                criterion,
                discipline: slug,
                security_control: securityControl,
                status: "NOT_APPLICABLE",
                producer: "discovery",
                evidence: capability.evidence.slice(0, 3),
                files: [],
                instance_ids: [],
                recorded_at: now,
                not_applicable_reason: `Discovery proved the '${slug}' capability is absent.`
            };
    }
    return {
        criterion,
        discipline: slug,
        security_control: securityControl,
        status: "NOT_VERIFIED",
        producer: "build",
        evidence: [
            `Discipline '${slug}' has no executable producer that proved it in this scope. Provide direct evidence, a reasoned NOT_APPLICABLE, or an eligible risk acceptance.`
        ],
        files: [],
        instance_ids: [],
        recorded_at: now
    };
}
// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------
async function resolveBuildScope(root, profile, feature, base) {
    try {
        const changed = await analyzeChangedScope(root, profile, base);
        return {
            files: [...changed.files],
            mode: "merge-base changed-scope",
            reasons: changed.evidence.included_files
                .slice(0, 5)
                .map((item) => `${item.path}: ${item.reasons.join(", ")}`)
        };
    }
    catch (error) {
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
async function collectWorktreeFiles(root) {
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
async function hashFiles(root, paths) {
    const files = [];
    for (const path of paths.slice(0, MAX_EVIDENCE_FILES)) {
        try {
            const bytes = await readFile(resolveInside(root, path));
            files.push({ path, sha256: sha256(bytes) });
        }
        catch {
            // A path that cannot be read contributes no freshness anchor; skip it silently.
        }
    }
    return files;
}
function isSourcePath(path) {
    return SOURCE_EXTENSIONS.has(extname(path).toLowerCase());
}
// ---------------------------------------------------------------------------
// Evidence merge, repair counters, done requirements
// ---------------------------------------------------------------------------
/** Replaces stored evidence with the freshly derived record for each criterion. */
function mergeEvidence(stored, derived) {
    const byId = new Map(stored.map((record) => [record.criterion, record]));
    for (const record of derived)
        byId.set(record.criterion, record);
    return [...byId.values()].sort((a, b) => a.criterion.localeCompare(b.criterion));
}
/**
 * Advances repair counters. Each FAIL criterion has a signature derived from its failing instance
 * identities (or, absent those, its file hashes). The same signature recurring across checks means
 * a repair attempt did not change the failure, so the counter increments; a different signature is
 * a new failure and resets it. Unrelated tree changes therefore never reset a counter, because the
 * signature is keyed on the failing identity, not on the whole tree. At the cap the feature blocks.
 */
function advanceRepairCounters(feature, derived) {
    const counters = new Map(feature.repair_counters.map((counter) => [counter.criterion, counter]));
    const tripped = [];
    const failing = new Set();
    for (const record of derived) {
        if (record.status !== "FAIL")
            continue;
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
        }
        else {
            counters.set(record.criterion, { criterion: record.criterion, signature, count: 1 });
        }
    }
    // A criterion that is no longer failing releases its counter.
    for (const key of [...counters.keys()])
        if (!failing.has(key))
            counters.delete(key);
    return { blockers: { counters: [...counters.values()] }, tripped };
}
function failureSignature(record) {
    const basis = record.instance_ids.length > 0
        ? [...record.instance_ids].sort().join("\n")
        : record.files
            .map((file) => file.sha256)
            .sort()
            .join("\n");
    return sha256(`${record.criterion} ${basis}`);
}
/** The criteria that must be satisfied for `done`, by tier. */
function requiredCriteria(feature) {
    const required = new Set(["scope-resolution", "static-analysis"]);
    if (feature.tier !== "light") {
        for (const discipline of feature.disciplines)
            required.add(`discipline:${discipline.slug}`);
        if (feature.evidence.some((record) => record.criterion === "project:test"))
            required.add("project:test");
    }
    return required;
}
/**
 * Computes the actionable missing-items list for `done`.
 *
 * A criterion is satisfied by PASS, a reasoned NOT_APPLICABLE, or an eligible risk acceptance. A
 * FAIL is never waivable. A high-tier required security control that is NOT_VERIFIED can never be
 * satisfied and is reported as such.
 */
export function missingForDone(feature) {
    const missing = [];
    const byId = new Map(feature.evidence.map((record) => [record.criterion, record]));
    for (const record of feature.evidence)
        if (record.status === "FAIL")
            missing.push(`${record.criterion}: FAIL must be fixed (${record.evidence[0] ?? "no detail"})`);
    const accepted = new Set(feature.risk_acceptances.map((item) => item.criterion));
    for (const criterion of requiredCriteria(feature)) {
        const record = byId.get(criterion);
        if (record === undefined) {
            missing.push(`${criterion}: no evidence recorded (run \`check\`)`);
            continue;
        }
        if (record.status === "PASS")
            continue;
        if (record.status === "FAIL")
            continue; // already reported above
        if (record.status === "NOT_APPLICABLE" && record.not_applicable_reason !== undefined)
            continue;
        const highSecurity = feature.tier === "high" && record.security_control;
        if (highSecurity && record.status === "NOT_VERIFIED") {
            missing.push(`${criterion}: high-tier required security control is NOT_VERIFIED and cannot be waived`);
            continue;
        }
        if (accepted.has(criterion) && !highSecurity)
            continue;
        missing.push(`${criterion}: ${record.status} — provide evidence, a reasoned NOT_APPLICABLE, or an eligible risk acceptance`);
    }
    return [...new Set(missing)];
}
function nextStepFor(feature) {
    switch (feature.phase) {
        case "frame":
            return feature.tier === "light"
                ? `Run \`forge feature ${feature.slug} check --allow-run\`.`
                : `Run \`forge feature ${feature.slug} plan\`, then \`check\`.`;
        case "plan":
        case "implement":
            return `Implement, then run \`forge feature ${feature.slug} check --allow-run\`.`;
        case "check": {
            const missing = missingForDone(feature);
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
function renderFeature(options, feature, extra, exitCode = 0) {
    if (options.json) {
        print(JSON.stringify({ feature, ...extra }, null, 2));
        return exitCode;
    }
    const lines = [];
    lines.push(`Feature: ${feature.slug}  [tier ${feature.tier}, phase ${feature.phase}]`);
    if (extra.operation !== undefined)
        lines.push(`Operation: ${extra.operation}`);
    if (feature.summary.length > 0)
        lines.push(`Summary: ${feature.summary}`);
    if (feature.disciplines.length > 0)
        lines.push(`Disciplines: ${feature.disciplines.map((d) => d.slug).join(", ")}`);
    if (feature.evidence.length > 0) {
        lines.push("Criteria:");
        for (const record of feature.evidence)
            lines.push(`  - ${record.criterion}: ${record.status}${record.security_control ? " (security control)" : ""}`);
    }
    if (feature.risk_acceptances.length > 0) {
        lines.push("Risk acceptances (never rendered as PASS):");
        for (const item of feature.risk_acceptances)
            lines.push(`  - ${item.criterion}: ${item.reason} @ ${item.revision}`);
    }
    if (feature.blockers.length > 0) {
        lines.push("Blockers:");
        for (const item of feature.blockers)
            lines.push(`  - ${item.criterion}: ${item.reason}`);
    }
    const demoted = extra.demoted;
    if (demoted !== undefined && demoted.length > 0)
        lines.push(`Demoted to NOT_VERIFIED (stale hashes): ${demoted.join(", ")}`);
    const missing = extra.missing_for_done;
    if (missing !== undefined) {
        if (extra.refused === true)
            lines.push("done refused — missing tier-required evidence:");
        else if (missing.length > 0)
            lines.push("Outstanding for done:");
        for (const item of missing)
            lines.push(`  - ${item}`);
    }
    if (extra.next !== undefined)
        lines.push(`Next: ${extra.next}`);
    print(lines.join("\n"));
    return exitCode;
}
function report(options, value) {
    if (options.json) {
        print(JSON.stringify(value, null, 2));
        return 0;
    }
    const lines = [];
    for (const [key, item] of Object.entries(value)) {
        if (item === undefined)
            continue;
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
function stringifyItem(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    return JSON.stringify(value);
}
function print(value) {
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
function designTemplate(summary) {
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
//# sourceMappingURL=build.js.map