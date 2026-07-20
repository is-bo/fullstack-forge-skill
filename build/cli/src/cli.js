import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ALWAYS_APPLICABLE, MODULE_SLUGS, PACKAGE_ROOT, PLATFORM_ALIASES, PLATFORM_CONFIG, TOOL_NAMES, VERSION } from "./constants.js";
import { detectProjectCommands, discoverProject, writeProjectArtifacts } from "./discovery.js";
import { executeFixes } from "./fixes.js";
import { runShipGates } from "./gates.js";
import { install, readInstallManifest, uninstall } from "./installer.js";
import { inspectSection, isModuleSlug } from "./inspectors.js";
import { captureEnvironment, createReport, readReport, renderMarkdown, writeReport } from "./report.js";
import { analyzeChangedScope } from "./scope.js";
import { coverageForProfile } from "./support.js";
import { isForgePackageRoot, runTool } from "./tools.js";
import { canonicalDirectory, workingTreeRevision } from "./utils.js";
import { verifyFindings } from "./verification.js";
const MODES = new Set(["audit", "fix", "verify", "report"]);
const HIGH_RISK_MODULES = new Set([
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
const ADAPTER_MODULES = new Set([
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
export async function runCli(argv) {
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
        printValue({
            version: VERSION,
            modules: MODULE_SLUGS,
            tools: TOOL_NAMES,
            platform_destinations: PLATFORM_CONFIG,
            platform_aliases: PLATFORM_ALIASES
        }, options.json);
        return 0;
    }
    if (command === "init" || command === "update") {
        const selector = selectPlatform(positionals[0], options.platform);
        const actions = await install(options.cwd, selector, {
            global: options.global,
            dryRun: options.dryRun
        });
        printValue({ operation: command, selector, dry_run: options.dryRun, actions }, options.json);
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
    if (command === "doctor")
        return doctor(options);
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
        if (tool === undefined)
            throw new Error("forge tool requires a tool name");
        const response = await runTool(tool, args, options);
        printValue(response.value, options.json);
        return response.exitCode;
    }
    if (!isModuleSlug(command))
        throw new Error(`Unknown command or section '${command}'. Run 'forge help'.`);
    if (command === "ship")
        return ship(options);
    const mode = positionals[0] ?? "audit";
    if (!MODES.has(mode))
        throw new Error(`Unknown mode '${mode}'. Expected audit, fix, verify, or report.`);
    return runModule(command, mode, options);
}
async function runModule(section, mode, options) {
    const root = await canonicalDirectory(options.cwd);
    if (mode === "report") {
        const report = await readReport(root, join(root, ".forge", "report.json"));
        printValue(options.json ? report : renderMarkdown(report), options.json);
        return report.findings.some((finding) => finding.status === "FAIL") ? 1 : 0;
    }
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
        const findings = [
            coverageFinding("discover", profile.detections.length, "Discovery completed; runtime-only boundaries remain unverified.")
        ];
        const report = createReport(root, profile, findings, "discover", [], [], [], undefined, [], [], revision, captureEnvironment({ offline: options.offline, allowRun: options.allowRun, version: VERSION }));
        const paths = options.dryRun ? [] : await writeReport(report);
        printValue({ profile, artifacts, report_paths: paths, dry_run: options.dryRun }, options.json);
        return 0;
    }
    if (mode === "verify") {
        return verifySection(section, root, profile, options);
    }
    const selection = selectSections(section, profile, options);
    let selected = selection.selected;
    let changedScope;
    if (section === "all" && options.scope === "changed") {
        changedScope = await analyzeChangedScope(root, profile, options.base);
        selected = selected.filter((slug) => changedScope?.modules.has(slug));
    }
    if (!options.dryRun)
        await writeProjectArtifacts(profile);
    const results = await Promise.all(selected.map((slug) => inspectSection(slug, root, profile, changedScope?.files)));
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
            .map((coverage, coverageIndex) => adapterCoverageFinding(selectedModule, coverage, coverageIndex));
        if (result.findings.length > 0 || adapterFindings.length > 0)
            return [...result.findings, ...adapterFindings];
        return [
            coverageFinding(selectedModule, result.observations.length, coverageDetail(selectedModule, result))
        ];
    });
    if (section === "all") {
        const notApplicable = selection.sections
            .filter((slug) => !selected.includes(slug))
            .map((slug) => applicabilityFinding(slug, profile));
        findings.push(...notApplicable);
    }
    const report = createReport(root, profile, findings, options.scope ?? (section === "all" ? "applicable" : section), [], [], [
        "Static inspection does not verify running application, production, provider, database, browser, or operator controls."
    ], changedScope?.evidence, results.flatMap((result) => result.gate_evidence), results.flatMap((result) => result.analyzer_coverage), revision, captureEnvironment({ offline: options.offline, allowRun: options.allowRun, version: VERSION }));
    const paths = options.dryRun ? [] : await writeReport(report);
    printValue(options.json
        ? { report, report_paths: paths, observations: summarize(results), dry_run: options.dryRun }
        : renderMarkdown(report), options.json);
    return report.findings.some((finding) => finding.status === "FAIL") ? 1 : 0;
}
async function verifySection(section, root, profile, options) {
    const result = await verifyFindings(root, section, profile, {
        allowRun: options.allowRun,
        dryRun: options.dryRun
    });
    printValue(options.json ? result : renderMarkdown(result.report), options.json);
    if (result.report.findings.some((finding) => finding.status === "FAIL"))
        return 1;
    if (result.report.findings.some((finding) => finding.status === "BLOCKED"))
        return 2;
    return 0;
}
async function ship(options) {
    const root = await canonicalDirectory(options.cwd);
    const commands = await detectProjectCommands(root);
    const profile = await discoverProject(root);
    const revision = await workingTreeRevision(root);
    let previous;
    try {
        previous = await readReport(root, join(root, ".forge", "report.json"));
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const gateResult = await runShipGates(root, profile, previous, commands, options.allowRun, {
        offline: options.offline,
        forgeOwned: await isForgePackageRoot(root)
    });
    const status = gateResult.status;
    const blockedByPolicy = gateResult.command_ledger.filter((record) => record.disposition === "BLOCKED");
    const finding = {
        id: "FF-SHIP-001",
        section: "ship",
        title: status === "FAIL"
            ? "Release-readiness gate failed"
            : status === "BLOCKED"
                ? "Release readiness is not fully verified"
                : "Executed release-readiness gates passed",
        severity: status === "PASS" ? "INFO" : "HIGH",
        confidence: "HIGH",
        status,
        location: [{ path: "package.json" }],
        evidence: [
            ...gateResult.gates.map((gate) => `${gate.gate_id} ${gate.status}: ${gate.evidence.join("; ")}`),
            ...gateResult.command_ledger.map((record) => `command-ledger ${record.name} ${record.disposition} (policy=${record.network_policy}, offline=${record.offline}, sandbox=${record.sandbox}): ${record.reason}`)
        ],
        impact: status === "PASS"
            ? "The recorded local gates and prior audit support release readiness for this checkout."
            : "The candidate cannot be represented as release-ready with the current evidence.",
        recommendation: status === "PASS"
            ? "Review residual risk and verify remote publication evidence before release."
            : "Resolve failed gates and open high findings, complete high-risk verification, then repeat the full audit and ship command.",
        safe_fix: false,
        verification: [
            "Repeat forge ship --allow-run after the final change",
            "Verify remote CI and release state separately"
        ],
        standards: ["NIST SSDF", "SLSA 1.2", "Agent Skills Specification"]
    };
    const report = createReport(root, profile, [...(previous?.findings.filter((candidate) => candidate.section !== "ship") ?? []), finding], "ship", gateResult.execution, previous?.assumptions ?? [], [
        ...(previous?.residual_risk ?? []),
        "Remote CI, registry, GitHub release, deployment, and production state require separate direct evidence.",
        ...(blockedByPolicy.length === 0
            ? []
            : [
                `Offline mode blocked ${blockedByPolicy.length} project command(s) with UNKNOWN network policy (${blockedByPolicy.map((record) => record.name).join(", ")}). Fullstack Forge implements no operating-system network isolation, so those gates remain unproven rather than passed.`
            ])
    ], previous?.scope_evidence, [...(previous?.gate_evidence ?? []), ...gateResult.evidence], previous?.analyzer_coverage ?? [], revision, captureEnvironment({ offline: options.offline, allowRun: options.allowRun, version: VERSION }));
    if (!options.dryRun)
        await writeReport(report);
    printValue(options.json ? report : renderMarkdown(report), options.json);
    return status === "FAIL" ? 1 : status === "BLOCKED" ? 2 : 0;
}
function selectSections(section, profile, options) {
    let sections = section === "all"
        ? MODULE_SLUGS.filter((slug) => !["discover", "all", "ship"].includes(slug))
        : [section];
    if (section === "all" && options.risk === "high")
        sections = sections.filter((slug) => HIGH_RISK_MODULES.has(slug));
    const selected = sections.filter((slug) => ALWAYS_APPLICABLE.has(slug) || section !== "all" || shouldApply(slug, profile));
    return { sections, selected };
}
async function doctor(options) {
    const root = await canonicalDirectory(options.cwd);
    const checks = [];
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
        }
        catch {
            checks.push({ name: `bundled ${path}`, status: "FAIL", evidence: "missing" });
        }
    }
    const manifest = options.global
        ? await readInstallManifest(homedir())
        : await readInstallManifest(root);
    checks.push({
        name: "ownership manifest",
        status: manifest === undefined ? "NOT_VERIFIED" : "PASS",
        evidence: manifest === undefined
            ? "not installed in selected root"
            : `${Object.keys(manifest.files).length} records`
    });
    printValue({ root, package_root: PACKAGE_ROOT, checks }, options.json);
    return checks.some((check) => check.status === "FAIL") ? 1 : 0;
}
function shouldApply(section, profile) {
    const result = inspectCapability(section, profile);
    return result !== undefined;
}
function inspectCapability(section, profile) {
    const map = {
        ui: "frontend",
        ux: "frontend",
        accessibility: "frontend",
        i18n: "internationalization",
        seo: "public-web",
        frontend: "frontend",
        api: "api",
        jobs: "jobs",
        integrations: "integrations",
        auth: "authentication",
        authorization: "authorization",
        privacy: "personal-data",
        tenancy: "tenancy",
        uploads: "uploads",
        database: "database",
        queries: "database",
        cache: "cache",
        storage: "storage",
        performance: "runtime",
        scale: "runtime",
        observability: "observability",
        reliability: "runtime",
        recovery: "database",
        deployment: "deployment",
        infrastructure: "infrastructure",
        cost: "paid-services",
        analytics: "analytics",
        notifications: "notifications",
        ai: "ai",
        payments: "payments",
        realtime: "realtime",
        offline: "offline"
    };
    const capability = map[section];
    return capability === undefined || profile.capabilities[capability] !== undefined
        ? (capability ?? "always")
        : undefined;
}
function coverageFinding(section, observations, detail) {
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
function applicabilityFinding(section, profile) {
    return {
        ...coverageFinding(section, 0, "Discovery found no applicable capability evidence."),
        id: `FF-${section.toUpperCase()}-001`,
        title: `${section} module is not applicable to detected scope`,
        status: "NOT_APPLICABLE",
        evidence: [
            `No matching capability was found among: ${Object.keys(profile.capabilities).sort().join(", ") || "none"}.`
        ],
        impact: "No audit impact within the detected repository scope."
    };
}
function summarize(results) {
    return results.map((result) => ({
        tool: result.tool,
        observations: result.observations.length,
        findings: result.findings.length,
        gate_evidence: result.gate_evidence.length,
        analyzer_coverage: result.analyzer_coverage.length
    }));
}
function coverageDetail(section, result) {
    const analyzerRan = result.observations.some((observation) => observation.category === "bounded-analyzer");
    return `${analyzerRan ? "A bounded analyzer ran" : `The ${section} inventory ran`}; manual, runtime, cross-file, and provider checks remain NOT_VERIFIED.`;
}
function adapterCoverageFinding(section, coverage, index) {
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
        impact: "The selected module cannot claim executable coverage for these detected source shapes.",
        recommendation: coverage.required_adapter === undefined
            ? "Complete the listed manual and runtime verification procedures."
            : `Implement or install the ${coverage.required_adapter} adapter and retain manual verification for unsupported shapes.`,
        safe_fix: false,
        verification: [
            `Provide direct evidence for: ${coverage.unsupported_shapes.join("; ") || "all detected shapes"}`
        ],
        standards: ["Fullstack Forge evidence protocol"]
    };
}
function parseArguments(argv) {
    const options = {
        cwd: process.cwd(),
        json: false,
        dryRun: false,
        global: false,
        offline: false,
        allowRun: false,
        safe: false
    };
    const positionals = [];
    const valueFlags = {
        "--root": "cwd",
        "--cwd": "cwd",
        "--scope": "scope",
        "--base": "base",
        "--risk": "risk",
        "--severity": "severity",
        "--ai": "platform",
        "--platform": "platform",
        "--output": "output"
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] ?? "";
        if (["--help", "-h", "--version", "-v"].includes(arg))
            positionals.push(arg);
        else if (arg === "--json")
            options.json = true;
        else if (arg === "--dry-run")
            options.dryRun = true;
        else if (arg === "--global")
            options.global = true;
        else if (arg === "--offline")
            options.offline = true;
        else if (arg === "--allow-run")
            options.allowRun = true;
        else if (arg === "--safe")
            options.safe = true;
        else if (arg.startsWith("--") && arg.includes("=")) {
            const [flag, ...rest] = arg.split("=");
            const key = valueFlags[flag ?? ""];
            if (key === undefined)
                throw new Error(`Unknown option '${flag}'`);
            options[key] = rest.join("=");
        }
        else if (arg in valueFlags) {
            const key = valueFlags[arg];
            const value = argv[index + 1];
            if (key === undefined || value === undefined)
                throw new Error(`Option '${arg}' requires a value`);
            options[key] = value;
            index += 1;
        }
        else if (arg.startsWith("-"))
            throw new Error(`Unknown option '${arg}'`);
        else
            positionals.push(arg);
    }
    options.cwd = resolve(options.cwd);
    if (options.scope !== undefined && !["full", "changed", "applicable"].includes(options.scope))
        throw new Error(`Unknown scope '${options.scope}'. Expected full, changed, or applicable.`);
    if (options.risk !== undefined && options.risk !== "high")
        throw new Error(`Unknown risk profile '${options.risk}'. Expected high.`);
    if (options.severity !== undefined &&
        !["critical", "high", "medium", "low", "info"].includes(options.severity.toLowerCase()))
        throw new Error(`Unknown severity '${options.severity}'.`);
    return { positionals, options };
}
function selectPlatform(positional, option) {
    if (positional !== undefined && option !== undefined && positional !== option)
        throw new Error(`Conflicting platform selectors '${positional}' and '${option}'`);
    return positional ?? option ?? "all";
}
function printValue(value, json) {
    if (typeof value === "string" && !json)
        console.log(value);
    else
        console.log(JSON.stringify(value, null, json ? 2 : 2));
}
function printHelp() {
    console.log(`Fullstack Forge ${VERSION}

Usage:
  forge <section> <audit|fix|verify|report> [options]
  forge all audit [--scope full|changed] [--base origin/main] [--risk high]
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

Audit never treats missing evidence as PASS. See 'forge list' for modules and tools.`);
}
//# sourceMappingURL=cli.js.map