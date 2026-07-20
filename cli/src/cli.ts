import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  BUILD_VERBS,
  MODULE_SLUGS,
  PACKAGE_ROOT,
  PLATFORM_ALIASES,
  PLATFORM_CONFIG,
  TOOL_NAMES,
  VERSION,
  type ModuleSlug
} from "./constants.js";
import { runBuild } from "./build.js";
import {
  ReportAuditLedger,
  orchestrateAudit,
  type RuntimeEvidenceRecord
} from "./audit-orchestration.js";
import { detectProjectCommands, discoverProject, writeProjectArtifacts } from "./discovery.js";
import { inspectRenderedUi } from "./rendered-ui.js";
import { writeReportOutput } from "./report-output.js";
import { executeFixes } from "./fixes.js";
import { runShipGates } from "./gates.js";
import { install, readInstallManifest, uninstall } from "./installer.js";
import { inspectSection, isModuleSlug } from "./inspectors.js";
import {
  captureEnvironment,
  createReport,
  readReport,
  renderMarkdown,
  writeReport
} from "./report.js";
import {
  analyzeChangedScope,
  decideModules,
  decisionFindingStatus,
  type ChangedScope
} from "./scope.js";
import { coverageForProfile } from "./support.js";
import type {
  AnalyzerCoverage,
  CliOptions,
  Finding,
  InspectionResult,
  ModuleDecision,
  ProjectProfile
} from "./types.js";
import { isForgePackageRoot, runTool } from "./tools.js";
import { canonicalDirectory, workingTreeRevision } from "./utils.js";
import { verifyFindings } from "./verification.js";

const MODES = new Set(["audit", "fix", "verify", "report"]);
const HIGH_RISK_MODULES = new Set<ModuleSlug>([
  "code",
  "jobs",
  "integrations",
  "auth",
  "authorization",
  "security",
  "privacy",
  "tenancy",
  "uploads",
  "database",
  "queries",
  "cache",
  "storage",
  "testing",
  "recovery",
  "deployment",
  "infrastructure",
  "supply-chain",
  "ai",
  "payments"
]);
const ADAPTER_MODULES = new Set<ModuleSlug>([
  "accessibility",
  "ai",
  "auth",
  "authorization",
  "cache",
  "deployment",
  "frontend",
  "integrations",
  "payments",
  "queries",
  "security",
  "tenancy",
  "uploads"
]);

export async function runCli(argv: string[]): Promise<number> {
  // Build-mode verbs are dispatched before any audit argument parsing so that build's distinct flag
  // surface never has to widen the audit option type, and every existing audit command is untouched.
  if (argv[0] !== undefined && (BUILD_VERBS as readonly string[]).includes(argv[0]))
    return runBuild(argv);
  const parsed = parseArguments(argv);
  const [command, ...positionals] = parsed.positionals;
  const options = parsed.options;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return 0;
  }
  if (command === "list") {
    printValue(
      {
        version: VERSION,
        modules: MODULE_SLUGS,
        tools: TOOL_NAMES,
        platform_destinations: PLATFORM_CONFIG,
        platform_aliases: PLATFORM_ALIASES
      },
      options.json
    );
    return 0;
  }
  if (command === "init" || command === "update") {
    const selector = selectPlatform(positionals[0], options.platform);
    const actions = await install(options.cwd, selector, {
      global: options.global,
      dryRun: options.dryRun
    });
    printValue({ operation: command, selector, dry_run: options.dryRun, actions }, options.json);
    if (!options.json)
      console.log(
        "Build mode (new in 0.2.0): start work with `forge new` or `forge feature <slug>`. " +
          "See docs/BUILD_MODE.md in the repository."
      );
    return 0;
  }
  if (command === "uninstall") {
    const selector = selectPlatform(positionals[0], options.platform);
    const actions = await uninstall(options.cwd, selector, {
      global: options.global,
      dryRun: options.dryRun
    });
    printValue({ operation: command, selector, dry_run: options.dryRun, actions }, options.json);
    return actions.some((action) => action.action === "preserve-modified") ? 1 : 0;
  }
  if (command === "doctor") return doctor(options);
  if (command === "validate") {
    const response = await runTool("validate-skill", positionals, options);
    printValue(response.value, options.json);
    return response.exitCode;
  }
  if (command === "package") {
    const response = await runTool("package-platforms", positionals, options);
    printValue(response.value, options.json);
    return response.exitCode;
  }
  if (command === "tool") {
    const [tool, ...args] = positionals;
    if (tool === undefined) throw new Error("forge tool requires a tool name");
    const response = await runTool(tool, args, options);
    printValue(response.value, options.json);
    return response.exitCode;
  }
  if (!isModuleSlug(command))
    throw new Error(`Unknown command or section '${command}'. Run 'forge help'.`);
  if (command === "ship") return ship(options);
  const mode = positionals[0] ?? "audit";
  if (!MODES.has(mode))
    throw new Error(`Unknown mode '${mode}'. Expected audit, fix, verify, or report.`);
  return runModule(command, mode, options);
}

async function runModule(section: ModuleSlug, mode: string, options: CliOptions): Promise<number> {
  const root = await canonicalDirectory(options.cwd);
  if (mode === "report") return reportMode(root, options);
  if (mode === "fix") {
    const response = await executeFixes(root, section, {
      dryRun: options.dryRun,
      safe: options.safe,
      allowRun: options.allowRun,
      ...(options.severity === undefined ? {} : { severity: options.severity })
    });
    printValue(response, options.json);
    return response.status === "PASS" ? 0 : response.status === "FAIL" ? 1 : 2;
  }

  const profile = await discoverProject(root);
  const revision = await workingTreeRevision(root);
  if (section === "discover") {
    const artifacts = await writeProjectArtifacts(profile, options.dryRun);
    const findings: Finding[] = [
      coverageFinding(
        "discover",
        profile.detections.length,
        "Discovery completed; runtime-only boundaries remain unverified."
      )
    ];
    const report = createReport(
      root,
      profile,
      findings,
      "discover",
      [],
      [],
      [],
      undefined,
      [],
      [],
      revision,
      captureEnvironment({ offline: options.offline, allowRun: options.allowRun, version: VERSION })
    );
    const paths = options.dryRun ? [] : await writeReport(report);
    printValue({ profile, artifacts, report_paths: paths, dry_run: options.dryRun }, options.json);
    return 0;
  }

  if (mode === "verify") {
    return verifySection(section, root, profile, options);
  }

  let changedScope: ChangedScope | undefined;
  if (section === "all" && options.scope === "changed")
    changedScope = await analyzeChangedScope(root, profile, options.base);
  const decisions = decideModules({
    candidates: candidateSections(section),
    profile,
    explicit: section !== "all",
    ...(section === "all" && options.risk === "high"
      ? { riskAllowed: HIGH_RISK_MODULES, riskLabel: "high" }
      : {}),
    ...(changedScope === undefined ? {} : { changedModules: changedScope.modules })
  });
  let selected = decisions
    .filter((decision) => decision.selection_status === "SELECTED")
    .map((decision) => decision.module as ModuleSlug);
  if (!options.dryRun) await writeProjectArtifacts(profile);

  // Orchestration decides what this audit is authorized to do before any of it happens, so the
  // planned-check ledger is produced even when nothing turns out to be executable.
  const ledger = new ReportAuditLedger(revision);
  const orchestration = await orchestrateAudit({
    root,
    modules: selected,
    commands: await detectProjectCommands(root),
    allowRun: options.allowRun,
    offline: options.offline,
    dryRun: options.dryRun,
    forgeOwned: await isForgePackageRoot(root),
    ledger,
    collectRuntimeEvidence: (input) => collectRenderedEvidence(input, options, revision),
    ...(options.url === undefined ? {} : { url: options.url }),
    ...(options.evidenceDir === undefined ? {} : { evidenceDir: options.evidenceDir }),
    ...(options.checks === undefined ? {} : { select: options.checks }),
    ...(options.skipChecks === undefined ? {} : { skip: options.skipChecks })
  });
  // Module inspection runs only for modules orchestration actually planned and did not exclude.
  const executedModules = new Set(
    orchestration.outcomes
      .filter((outcome) => outcome.kind === "module-inspection" && outcome.status === "EXECUTED")
      .map((outcome) => outcome.id.slice("module:".length))
  );
  selected = selected.filter((slug) => executedModules.has(slug));
  const results = await Promise.all(
    selected.map((slug) => inspectSection(slug, root, profile, changedScope?.files))
  );
  for (const [index, result] of results.entries()) {
    const selectedModule = selected[index];
    result.gate_evidence = result.gate_evidence.map((evidence) => ({
      ...evidence,
      revision
    }));
    result.analyzer_coverage =
      selectedModule !== undefined && ADAPTER_MODULES.has(selectedModule)
        ? coverageForProfile(selectedModule, profile)
        : [];
  }
  const findings = results.flatMap((result, index) => {
    const selectedModule = selected[index] ?? section;
    const adapterFindings = result.analyzer_coverage
      .filter((coverage) => coverage.status === "NOT_VERIFIED")
      .map((coverage, coverageIndex) =>
        adapterCoverageFinding(selectedModule, coverage, coverageIndex)
      );
    if (result.findings.length > 0 || adapterFindings.length > 0)
      return [...result.findings, ...adapterFindings];
    return [
      coverageFinding(
        selectedModule,
        result.observations.length,
        coverageDetail(selectedModule, result)
      )
    ];
  });
  if (section === "all") {
    findings.push(
      ...decisions
        .filter((decision) => decision.selection_status !== "SELECTED")
        .map(moduleDecisionFinding)
    );
  }
  findings.push(...ledger.findings());
  const report = createReport(
    root,
    profile,
    findings,
    options.scope ?? (section === "all" ? "applicable" : section),
    orchestration.execution,
    [],
    [
      "Static inspection does not verify running application, production, provider, database, browser, or operator controls.",
      ...ledger.residualRisk()
    ],
    changedScope?.evidence,
    results.flatMap((result) => result.gate_evidence),
    results.flatMap((result) => result.analyzer_coverage),
    revision,
    captureEnvironment({ offline: options.offline, allowRun: options.allowRun, version: VERSION }),
    { module_decisions: decisions, ...ledger.ledgers() }
  );
  const paths = options.dryRun ? [] : await writeReport(report);
  printValue(
    options.json
      ? {
          report,
          report_paths: paths,
          observations: summarize(results),
          planned_checks: orchestration.planned,
          check_outcomes: orchestration.outcomes,
          runtime_evidence: orchestration.runtime_evidence,
          evidence_complete: orchestration.evidence_complete,
          dry_run: options.dryRun
        }
      : renderMarkdown(report),
    options.json
  );
  // A proven defect outranks missing evidence, so FAIL keeps exit 1. Requested evidence that could
  // not be collected exits 2: nothing failed, but the run did not prove what it was asked to prove.
  if (report.findings.some((finding) => finding.status === "FAIL")) return 1;
  return orchestration.evidence_complete ? 0 : 2;
}

/**
 * Adapts the rendered-UI tool to the orchestration ledger.
 *
 * Only a `COMPLETE` capture counts as complete evidence; `PARTIAL`, `BLOCKED`, and `FAILED` all fail
 * closed upstream, which is what keeps a half-captured page from contributing a rendered pass.
 */
async function collectRenderedEvidence(
  input: { root: string; url: string; offline: boolean; allowRun: boolean; evidenceDir?: string },
  options: CliOptions,
  revision: string
): Promise<RuntimeEvidenceRecord> {
  const response = await inspectRenderedUi(
    input.root,
    [input.url],
    {
      ...options,
      offline: input.offline,
      allowRun: input.allowRun,
      ...(input.evidenceDir === undefined ? {} : { evidenceDir: input.evidenceDir })
    },
    revision
  );
  const value = response.value;
  return {
    kind: "rendered-ui",
    status: value.capture_status,
    ...(value.url === undefined ? {} : { url: value.url }),
    ...(value.evidence_dir === undefined ? {} : { evidence_dir: value.evidence_dir }),
    artifacts: value.artifacts,
    limitations:
      value.reason === undefined ? value.limitations : [value.reason, ...value.limitations],
    complete: value.capture_status === "COMPLETE"
  };
}

/**
 * Renders an audit that already ran.
 *
 * Report mode reads `.forge/report.json` and never re-audits: the rendered document must describe
 * the run it names, with the same identity, revision, timestamps, and evidence. Stdout behavior is
 * unchanged from earlier releases — Markdown by default, JSON under `--json`. `--output` redirects
 * the documents to files and prints the write summary instead, so the two flags never compete for
 * stdout: `--json` selects the *format* of what stdout carries, `--output` selects its *subject*.
 */
async function reportMode(root: string, options: CliOptions): Promise<number> {
  const report = await readReport(root, join(root, ".forge", "report.json"));
  const failing = report.findings.some((finding) => finding.status === "FAIL");
  if (options.output === undefined) {
    printValue(options.json ? report : renderMarkdown(report), options.json);
    return failing ? 1 : 0;
  }
  const result = await writeReportOutput(root, options.output, report, options.dryRun);
  const summary = {
    operation: "report",
    output: result.relative_directory,
    dry_run: result.dry_run,
    planned_paths: result.files.map((file) => ({ path: file.path, action: file.action })),
    written: result.written
  };
  printValue(
    options.json
      ? summary
      : [
          `${result.dry_run ? "Planned" : "Wrote"} report output in ${result.relative_directory}:`,
          ...result.files.map((file) => `- ${file.path} (${file.action})`)
        ].join("\n"),
    options.json
  );
  return failing ? 1 : 0;
}

async function verifySection(
  section: ModuleSlug,
  root: string,
  profile: ProjectProfile,
  options: CliOptions
): Promise<number> {
  const result = await verifyFindings(root, section, profile, {
    allowRun: options.allowRun,
    dryRun: options.dryRun
  });
  printValue(options.json ? result : renderMarkdown(result.report), options.json);
  if (result.report.findings.some((finding) => finding.status === "FAIL")) return 1;
  if (result.report.findings.some((finding) => finding.status === "BLOCKED")) return 2;
  return 0;
}

async function ship(options: CliOptions): Promise<number> {
  const root = await canonicalDirectory(options.cwd);
  const commands = await detectProjectCommands(root);
  const profile = await discoverProject(root);
  const revision = await workingTreeRevision(root);
  let previous: Awaited<ReturnType<typeof readReport>> | undefined;
  try {
    previous = await readReport(root, join(root, ".forge", "report.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const gateResult = await runShipGates(root, profile, previous, commands, options.allowRun, {
    offline: options.offline,
    forgeOwned: await isForgePackageRoot(root)
  });
  const status = gateResult.status;
  const blockedByPolicy = gateResult.command_ledger.filter(
    (record) => record.disposition === "BLOCKED"
  );
  const finding: Finding = {
    id: "FF-SHIP-001",
    section: "ship",
    title:
      status === "FAIL"
        ? "Release-readiness gate failed"
        : status === "BLOCKED"
          ? "Release readiness is not fully verified"
          : "Executed release-readiness gates passed",
    severity: status === "PASS" ? "INFO" : "HIGH",
    confidence: "HIGH",
    status,
    location: [{ path: "package.json" }],
    evidence: [
      ...gateResult.gates.map(
        (gate) => `${gate.gate_id} ${gate.status}: ${gate.evidence.join("; ")}`
      ),
      ...gateResult.command_ledger.map(
        (record) =>
          `command-ledger ${record.name} ${record.disposition} (policy=${record.network_policy}, offline=${record.offline}, sandbox=${record.sandbox}): ${record.reason}`
      )
    ],
    impact:
      status === "PASS"
        ? "The recorded local gates and prior audit support release readiness for this checkout."
        : "The candidate cannot be represented as release-ready with the current evidence.",
    recommendation:
      status === "PASS"
        ? "Review residual risk and verify remote publication evidence before release."
        : "Resolve failed gates and open high findings, complete high-risk verification, then repeat the full audit and ship command.",
    safe_fix: false,
    verification: [
      "Repeat forge ship --allow-run after the final change",
      "Verify remote CI and release state separately"
    ],
    standards: ["NIST SSDF", "SLSA 1.2", "Agent Skills Specification"]
  };
  const report = createReport(
    root,
    profile,
    [...(previous?.findings.filter((candidate) => candidate.section !== "ship") ?? []), finding],
    "ship",
    gateResult.execution,
    previous?.assumptions ?? [],
    [
      ...(previous?.residual_risk ?? []),
      "Remote CI, registry, GitHub release, deployment, and production state require separate direct evidence.",
      ...(blockedByPolicy.length === 0
        ? []
        : [
            `Offline mode blocked ${blockedByPolicy.length} project command(s) with UNKNOWN network policy (${blockedByPolicy.map((record) => record.name).join(", ")}). Fullstack Forge implements no operating-system network isolation, so those gates remain unproven rather than passed.`
          ])
    ],
    previous?.scope_evidence,
    [...(previous?.gate_evidence ?? []), ...gateResult.evidence],
    previous?.analyzer_coverage ?? [],
    revision,
    captureEnvironment({ offline: options.offline, allowRun: options.allowRun, version: VERSION })
  );
  if (!options.dryRun) await writeReport(report);
  printValue(options.json ? report : renderMarkdown(report), options.json);
  return status === "FAIL" ? 1 : status === "BLOCKED" ? 2 : 0;
}

/**
 * The full candidate set a run considers, before any capability, risk, or changed-scope filter.
 *
 * Filters are never applied here: every candidate must reach `decideModules` so that a module
 * dropped by a filter still produces a decision recording why. Previously, risk-filtered modules
 * vanished from the report entirely, which left no trace that they had gone unaudited.
 */
function candidateSections(section: ModuleSlug): ModuleSlug[] {
  return section === "all"
    ? MODULE_SLUGS.filter((slug) => !["discover", "all", "ship"].includes(slug))
    : [section];
}

async function doctor(options: CliOptions): Promise<number> {
  const root = await canonicalDirectory(options.cwd);
  const checks: Array<{
    name: string;
    status: "PASS" | "FAIL" | "NOT_VERIFIED";
    evidence: string;
  }> = [];
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  checks.push({
    name: "Node.js current LTS baseline",
    status: major >= 24 ? "PASS" : "FAIL",
    evidence: process.version
  });
  for (const path of [
    "src/fullstack-forge/SKILL.md",
    "config/modules.json",
    ".agents/skills/fullstack-forge/SKILL.md"
  ]) {
    try {
      await access(join(PACKAGE_ROOT, ...path.split("/")));
      checks.push({ name: `bundled ${path}`, status: "PASS", evidence: "readable" });
    } catch {
      checks.push({ name: `bundled ${path}`, status: "FAIL", evidence: "missing" });
    }
  }
  const manifest = options.global
    ? await readInstallManifest(homedir())
    : await readInstallManifest(root);
  checks.push({
    name: "ownership manifest",
    status: manifest === undefined ? "NOT_VERIFIED" : "PASS",
    evidence:
      manifest === undefined
        ? "not installed in selected root"
        : `${Object.keys(manifest.files).length} records`
  });
  printValue({ root, package_root: PACKAGE_ROOT, checks }, options.json);
  return checks.some((check) => check.status === "FAIL") ? 1 : 0;
}

function coverageFinding(section: ModuleSlug, observations: number, detail: string): Finding {
  return {
    id: `FF-${section.toUpperCase()}-900`,
    section,
    title: `${section} checks require additional direct verification`,
    severity: "INFO",
    confidence: observations > 0 ? "MEDIUM" : "LOW",
    status: "NOT_VERIFIED",
    location: [{ path: ".forge/project-profile.json" }],
    evidence: [`${observations} static implementation signal(s) recorded. ${detail}`],
    impact: "Unexecuted manual or runtime criteria cannot support a pass.",
    recommendation: `Follow the forge-${section} command skill procedure and attach direct evidence.`,
    safe_fix: false,
    verification: [`Complete the module procedure and re-run forge ${section} verify.`],
    standards: ["Fullstack Forge evidence protocol"]
  };
}

/**
 * Turns an unselected module decision into a finding.
 *
 * NOT_APPLICABLE is emitted only when the capability was proven absent. A module skipped because
 * its files did not change, because a risk filter narrowed the run, or because discovery could
 * not determine the capability is NOT_VERIFIED: the run produced no evidence about it, and
 * labelling that as inapplicable would assert a fact nobody established.
 */
function moduleDecisionFinding(decision: ModuleDecision): Finding {
  const section = decision.module as ModuleSlug;
  const status = decisionFindingStatus(decision);
  const applicable = status === "NOT_APPLICABLE";
  const base = coverageFinding(section, 0, decision.reasons.join(" "));
  return {
    ...base,
    id: `FF-${section.toUpperCase()}-001`,
    title: applicable
      ? `${section} module is not applicable: the capability does not exist`
      : `${section} module was not audited in this run`,
    status: applicable ? "NOT_APPLICABLE" : "NOT_VERIFIED",
    severity: applicable ? "INFO" : "LOW",
    evidence: [
      `Capability status: ${decision.capability_status}. Selection status: ${decision.selection_status}.`,
      ...decision.evidence,
      ...decision.reasons
    ],
    impact: applicable
      ? "No audit impact: the capability this module audits does not exist in the project."
      : "The module exists or may exist but produced no evidence in this run, so its state is unknown.",
    recommendation: applicable
      ? `Re-run forge ${section} if the project later gains this capability.`
      : `Re-run forge ${section} (or widen the scope or risk filter) to obtain evidence for this module.`,
    verification: applicable
      ? ["Confirm through discovery that the capability is still absent."]
      : [`Run forge ${section} audit against the full scope and attach direct evidence.`]
  };
}

function summarize(results: InspectionResult[]) {
  return results.map((result) => ({
    tool: result.tool,
    observations: result.observations.length,
    findings: result.findings.length,
    gate_evidence: result.gate_evidence.length,
    analyzer_coverage: result.analyzer_coverage.length
  }));
}

function coverageDetail(section: ModuleSlug, result: InspectionResult): string {
  const analyzerRan = result.observations.some(
    (observation) => observation.category === "bounded-analyzer"
  );
  return `${analyzerRan ? "A bounded analyzer ran" : `The ${section} inventory ran`}; manual, runtime, cross-file, and provider checks remain NOT_VERIFIED.`;
}

function adapterCoverageFinding(
  section: ModuleSlug,
  coverage: AnalyzerCoverage,
  index: number
): Finding {
  return {
    id: `FF-${section.toUpperCase()}-${String(801 + index).padStart(3, "0")}`,
    section,
    title: `${coverage.language}/${coverage.framework} analyzer coverage is ${coverage.coverage}`,
    severity: "INFO",
    confidence: "HIGH",
    status: "NOT_VERIFIED",
    location: [{ path: ".forge/project-profile.json" }],
    evidence: [
      `module=${coverage.module}; language=${coverage.language}; framework=${coverage.framework}; coverage=${coverage.coverage}; analyzer=${coverage.analyzer_id}; required_adapter=${coverage.required_adapter ?? "none"}; unsupported_shapes=${coverage.unsupported_shapes.join(", ") || "none"}`
    ],
    impact:
      "The selected module cannot claim executable coverage for these detected source shapes.",
    recommendation:
      coverage.required_adapter === undefined
        ? "Complete the listed manual and runtime verification procedures."
        : `Implement or install the ${coverage.required_adapter} adapter and retain manual verification for unsupported shapes.`,
    safe_fix: false,
    verification: [
      `Provide direct evidence for: ${coverage.unsupported_shapes.join("; ") || "all detected shapes"}`
    ],
    standards: ["Fullstack Forge evidence protocol"]
  };
}

function parseArguments(argv: string[]): { positionals: string[]; options: CliOptions } {
  const options: CliOptions = {
    cwd: process.cwd(),
    json: false,
    dryRun: false,
    global: false,
    offline: false,
    allowRun: false,
    safe: false
  };
  const positionals: string[] = [];
  const valueFlags: Record<string, keyof CliOptions> = {
    "--root": "cwd",
    "--cwd": "cwd",
    "--scope": "scope",
    "--base": "base",
    "--risk": "risk",
    "--severity": "severity",
    "--ai": "platform",
    "--platform": "platform",
    "--output": "output",
    "--url": "url",
    "--evidence-dir": "evidenceDir"
  };
  // Repeatable flags accumulate instead of overwriting, so `--check lint --check test` selects both
  // rather than silently discarding the first value.
  const listFlags: Record<string, "checks" | "skipChecks"> = {
    "--check": "checks",
    "--skip-check": "skipChecks"
  };
  const appendList = (flag: string, value: string): void => {
    const key = listFlags[flag] as "checks" | "skipChecks";
    options[key] = [...(options[key] ?? []), value];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (["--help", "-h", "--version", "-v"].includes(arg)) positionals.push(arg);
    else if (arg === "--json") options.json = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--global") options.global = true;
    else if (arg === "--offline") options.offline = true;
    else if (arg === "--allow-run") options.allowRun = true;
    else if (arg === "--safe") options.safe = true;
    else if (arg.startsWith("--") && arg.includes("=")) {
      const [flag, ...rest] = arg.split("=");
      if ((flag ?? "") in listFlags) {
        appendList(flag ?? "", rest.join("="));
        continue;
      }
      const key = valueFlags[flag ?? ""];
      if (key === undefined) throw new Error(`Unknown option '${flag}'`);
      options[key] = rest.join("=") as never;
    } else if (arg in listFlags) {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`Option '${arg}' requires a value`);
      appendList(arg, value);
      index += 1;
    } else if (arg in valueFlags) {
      const key = valueFlags[arg];
      const value = argv[index + 1];
      if (key === undefined || value === undefined)
        throw new Error(`Option '${arg}' requires a value`);
      options[key] = value as never;
      index += 1;
    } else if (arg.startsWith("-")) throw new Error(`Unknown option '${arg}'`);
    else positionals.push(arg);
  }
  options.cwd = resolve(options.cwd);
  if (options.scope !== undefined && !["full", "changed", "applicable"].includes(options.scope))
    throw new Error(`Unknown scope '${options.scope}'. Expected full, changed, or applicable.`);
  if (options.risk !== undefined && options.risk !== "high")
    throw new Error(`Unknown risk profile '${options.risk}'. Expected high.`);
  if (
    options.severity !== undefined &&
    !["critical", "high", "medium", "low", "info"].includes(options.severity.toLowerCase())
  )
    throw new Error(`Unknown severity '${options.severity}'.`);
  // A malformed --url is rejected before any audit work begins, so an operator who mistypes the
  // address is told immediately instead of receiving a report whose runtime criteria silently
  // stayed NOT_VERIFIED.
  if (options.url !== undefined) {
    let parsed: URL;
    try {
      parsed = new URL(options.url);
    } catch {
      throw new Error(
        `Option '--url' requires an absolute http or https URL, got '${options.url}'`
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      throw new Error(`Option '--url' supports only http and https, got '${parsed.protocol}'`);
  }
  return { positionals, options };
}

function selectPlatform(positional: string | undefined, option: string | undefined): string {
  if (positional !== undefined && option !== undefined && positional !== option)
    throw new Error(`Conflicting platform selectors '${positional}' and '${option}'`);
  return positional ?? option ?? "all";
}

function printValue(value: unknown, json: boolean): void {
  if (typeof value === "string" && !json) console.log(value);
  else console.log(JSON.stringify(value, null, json ? 2 : 2));
}

function printHelp(): void {
  console.log(`Fullstack Forge ${VERSION}

Usage:
  Build mode (v0.2.0):
  forge new [--tier light|standard|high] [--summary <text>] [--stack <name>] [--non-goal <item:reason>]
  forge feature <slug> [--tier <tier>] [--summary <text>] [--discipline <slug[:reason]>] [--input <trigger>]
  forge feature <slug> <frame|plan|check|done|accept-risk|abandon|status> [options]
  forge resume
  Light tier is a two-invocation flow: 'forge feature <slug> --tier light --allow-run' runs framing
  and the check pass in one shot; 'forge feature <slug> done' completes it. Standard and high tiers
  add 'plan' and per-discipline evidence; accept-risk requires --criterion and --reason and is
  refused for high-tier required security controls.

  Audit mode:
  forge <section> <audit|fix|verify|report> [options]
  forge all audit [--scope full|changed] [--base origin/main] [--risk high]
  forge all audit --allow-run [--check lint --check test] [--skip-check build]
  forge all audit --url http://127.0.0.1:3000 --allow-run [--evidence-dir .forge/evidence]
  forge security report [--json] [--output <directory> [--dry-run]]
  forge ship --allow-run
  forge init <platform|all> | init --ai <platform|all>
  forge update [platform] | uninstall [platform] | doctor | validate | package | list
  forge tool <name> [arguments]

Options:
  --root <path>   Select a project root (defaults to the current directory)
  --ai <platform> Platform selector for init (alias: --platform)
  --global        Use the verified user-level platform path
  --base <ref>    Select the Git base for --scope changed
  --dry-run       Plan writes or removals without changing files
  --json          Emit machine-readable JSON
  --offline       Refuse non-loopback destinations, remote driver resolution, and any other
                  network-dependent step; such checks report BLOCKED or NOT_VERIFIED
  --allow-run     Explicitly authorize inspected local project scripts
  --safe          Authorize execution of bounded safe fixes; without it 'fix' only plans
  --check <name>       Run only the named planned check (repeatable)
  --skip-check <name>  Never run the named planned check (repeatable)
  --url <url>          Collect rendered evidence from an application you already started
  --evidence-dir <dir> Repository-relative directory for collected runtime evidence
  --output <dir>       Report mode only: write report.json and report.md into <dir>

Exit codes: 0 success; 1 a FAIL finding or an error; 2 requested evidence could not be collected.

Audit never treats missing evidence as PASS. See 'forge list' for modules and tools.`);
}
