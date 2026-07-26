import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MODULE_SLUGS, PACKAGE_ROOT, TOOL_NAMES, type ToolName } from "./constants.js";
import { detectProjectCommands, discoverProject, writeProjectArtifacts } from "./discovery.js";
import { assertAgentFindings, assertFindings, validateFinding } from "./finding.js";
import { inspectWithTool } from "./inspectors.js";
import { decideCommandExecution, ledgerRecord } from "./offline-policy.js";
import { inspectRenderedUi } from "./rendered-ui.js";
import { createReport, readReport, writeReport } from "./report.js";
import type { CliOptions, ProjectProfile } from "./types.js";
import { canonicalDirectory, resolveInside, runFile, workingTreeRevision } from "./utils.js";

export type ToolResponse = { value: unknown; exitCode: number };

export async function runTool(
  nameInput: string,
  args: string[],
  options: CliOptions
): Promise<ToolResponse> {
  if (!isToolName(nameInput))
    throw new Error(`Unknown tool '${nameInput}'. Run 'forge list' for valid tools.`);
  const root = await canonicalDirectory(options.cwd);
  if (nameInput === "detect-stack") {
    const profile = await discoverProject(root);
    return {
      value: {
        root: profile.root,
        generated_at: profile.generated_at,
        detections: profile.detections
      },
      exitCode: 0
    };
  }
  if (nameInput === "discover-project") {
    const profile = await discoverProject(root);
    const artifacts = await writeProjectArtifacts(profile, options.dryRun);
    return { value: { profile, artifacts, dry_run: options.dryRun }, exitCode: 0 };
  }
  if (nameInput === "detect-project-commands") {
    return { value: await detectProjectCommands(root), exitCode: 0 };
  }
  if (nameInput === "run-project-command") {
    const commandName = args[0];
    if (commandName === undefined)
      throw new Error("run-project-command requires a detected script name");
    const commands = await detectProjectCommands(root);
    const command = commands.find((candidate) => candidate.name === commandName);
    if (command === undefined)
      throw new Error(`'${commandName}' is not a detected project command`);
    const context = { offline: options.offline, forgeOwned: await isForgePackageRoot(root) };
    const decision = decideCommandExecution(command, context);
    if (!options.allowRun) {
      return {
        value: {
          status: "BLOCKED",
          reason:
            "Execution requires explicit --allow-run after reviewing the local script definition.",
          command,
          ledger: [ledgerRecord(command, decision, "NOT_RUN", options.offline)]
        },
        exitCode: 2
      };
    }
    if (!decision.permitted) {
      // A blocked command is never executed and never produces an execution record, so it can
      // never be promoted into typed PASS evidence downstream.
      return {
        value: {
          status: "BLOCKED",
          reason: decision.reason,
          command,
          ledger: [ledgerRecord(command, decision, "BLOCKED", options.offline)]
        },
        exitCode: 2
      };
    }
    const execution = await runFile(command.executable, command.args, root);
    return {
      value: {
        command,
        ...execution,
        ledger: [ledgerRecord(command, decision, "RAN", options.offline, execution.exitCode)]
      },
      exitCode: execution.exitCode
    };
  }
  if (nameInput === "inspect-rendered-ui") {
    return inspectRenderedUi(root, args, options, await workingTreeRevision(root));
  }
  if (isInspectionTool(nameInput)) {
    const inspection = await inspectWithTool(nameInput, root);
    return {
      value: inspection,
      exitCode: inspection.findings.some((finding) => finding.status === "FAIL") ? 1 : 0
    };
  }
  if (nameInput === "generate-report") {
    const profile = await loadOrDiscoverProfile(root);
    const findingPath =
      args[0] === undefined ? join(root, ".forge", "findings.json") : resolveInside(root, args[0]);
    const parsed = JSON.parse(await readFile(findingPath, "utf8")) as unknown;
    const findings = extractFindings(parsed);
    assertFindings(findings);
    const report = createReport(root, profile, findings, "generated from findings input");
    const paths = options.dryRun
      ? []
      : await writeReport(
          report,
          options.output === undefined ? undefined : resolveInside(root, options.output)
        );
    return {
      value: { report, paths, dry_run: options.dryRun },
      exitCode: findings.some((finding) => finding.status === "FAIL") ? 1 : 0
    };
  }
  if (nameInput === "ingest-agent-findings") {
    const input = args[0];
    if (input === undefined)
      throw new Error("ingest-agent-findings requires a JSON path under the project root");
    const parsed = JSON.parse(await readFile(resolveInside(root, input), "utf8")) as unknown;
    const findings = extractFindings(parsed);
    assertAgentFindings(findings);
    const profile = await loadOrDiscoverProfile(root);
    let previous;
    try {
      previous = await readReport(root, join(root, ".forge", "report.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const report = createReport(
      root,
      previous?.profile ?? profile,
      [...(previous?.findings ?? []), ...findings],
      previous === undefined ? "agent findings" : `${previous.scope}; agent findings ingested`,
      previous?.execution ?? [],
      previous?.assumptions ?? [],
      previous?.residual_risk ?? [],
      previous?.scope_evidence,
      previous?.gate_evidence ?? [],
      previous?.analyzer_coverage ?? [],
      await workingTreeRevision(root),
      previous?.environment,
      previous === undefined
        ? {}
        : {
            tools: previous.tools,
            planned_checks: previous.planned_checks,
            runtime_evidence: previous.runtime_evidence,
            module_decisions: previous.module_decisions
          }
    );
    const paths = options.dryRun ? [] : await writeReport(report);
    return {
      value: { report, paths, dry_run: options.dryRun },
      exitCode: findings.some((finding) => finding.status === "FAIL") ? 1 : 0
    };
  }
  if (nameInput === "validate-finding-schema") {
    const input = args[0];
    if (input === undefined)
      throw new Error("validate-finding-schema requires a JSON path under the project root");
    const parsed = JSON.parse(await readFile(resolveInside(root, input), "utf8")) as unknown;
    const values = extractFindings(parsed);
    const errors = values.flatMap((value, index) =>
      validateFinding(value).map((error) => `[${index}] ${error}`)
    );
    return {
      value: { valid: errors.length === 0, count: values.length, errors },
      exitCode: errors.length === 0 ? 0 : 1
    };
  }
  if (nameInput === "validate-skill") {
    const validation = await validateBundledSkills();
    return { value: validation, exitCode: validation.errors.length === 0 ? 0 : 1 };
  }
  const scripts: Partial<Record<ToolName, string>> = {
    "sync-platform-assets": "sync-platform-assets.mjs",
    "check-platform-assets": "check-platform-assets.mjs",
    "package-platforms": "package-platforms.mjs",
    "smoke-install": "smoke-install.mjs"
  };
  const script = scripts[nameInput];
  if (script !== undefined) {
    const scriptArgs = options.dryRun
      ? [join(PACKAGE_ROOT, "scripts", script), "--dry-run"]
      : [join(PACKAGE_ROOT, "scripts", script)];
    const execution = await runFile(process.execPath, scriptArgs, PACKAGE_ROOT, 10 * 60_000);
    return { value: { tool: nameInput, ...execution }, exitCode: execution.exitCode };
  }
  throw new Error(`Internal dispatch invariant failed for tool '${nameInput}'`);
}

/**
 * True only when the audited root really is the Fullstack Forge package root.
 *
 * Both paths are canonicalized before comparison, so a project cannot claim the Forge-internal
 * exemption by naming a directory or a script the same way.
 */
export async function isForgePackageRoot(root: string): Promise<boolean> {
  try {
    return (await canonicalDirectory(root)) === (await canonicalDirectory(PACKAGE_ROOT));
  } catch {
    return false;
  }
}

export async function validateBundledSkills(): Promise<{
  valid: boolean;
  skills: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const catalog = JSON.parse(
    await readFile(join(PACKAGE_ROOT, "config", "modules.json"), "utf8")
  ) as Array<{ slug?: unknown }>;
  const rawCriteria = JSON.parse(
    await readFile(join(PACKAGE_ROOT, "config", "module-criteria.json"), "utf8")
  ) as unknown;
  const criteriaBySlug =
    typeof rawCriteria === "object" && rawCriteria !== null && !Array.isArray(rawCriteria)
      ? (rawCriteria as Record<string, unknown>)
      : {};
  const expected = [...TOOL_NAMES];
  if (new Set(expected).size !== expected.length)
    errors.push("tool catalog contains duplicate names");
  const slugs = catalog.map((entry) => entry.slug);
  if (slugs.some((slug) => typeof slug !== "string"))
    errors.push("module catalog contains an invalid slug");
  if (JSON.stringify(slugs) !== JSON.stringify(MODULE_SLUGS))
    errors.push("module catalog does not match the authoritative module set");
  if (JSON.stringify(Object.keys(criteriaBySlug)) !== JSON.stringify(MODULE_SLUGS))
    errors.push("inspection criteria do not match the authoritative module set");
  const paths = [join(PACKAGE_ROOT, "src", "fullstack-forge", "SKILL.md")];
  for (const slug of slugs) {
    if (typeof slug === "string")
      paths.push(
        join(PACKAGE_ROOT, "src", "fullstack-forge", "commands", `forge-${slug}`, "SKILL.md")
      );
  }
  // Product-router and Build-mode command skills carry the generic contract checks but have no
  // per-slug inspection criteria, so they are appended after the audit set.
  for (const workflowCommand of ["forge", "forge-new", "forge-feature"]) {
    paths.push(
      join(PACKAGE_ROOT, "src", "fullstack-forge", "commands", workflowCommand, "SKILL.md")
    );
  }
  for (const [index, path] of paths.entries()) {
    let content: string;
    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      errors.push(`${path}: ${(error as Error).message}`);
      continue;
    }
    const lines = content.split(/\r?\n/u);
    if (lines.length > 500) errors.push(`${path}: exceeds 500 lines`);
    if (!/^---\r?\nname:\s*[a-z0-9-]+\r?\ndescription:\s*\S[\s\S]*?\r?\n---\r?\n/u.test(content)) {
      errors.push(`${path}: invalid name/description frontmatter`);
    }
    if (/\[TODO\]|(?:^|\n)\s*(?:[-*]\s*)?TODO(?:\s*:|\s*$)/iu.test(content))
      errors.push(`${path}: unresolved TODO placeholder`);
    if (
      !content.includes("Never hide failed checks or claim that an operation ran when it did not.")
    ) {
      errors.push(`${path}: missing completion contract`);
    }
    if (index > 0 && index - 1 < slugs.length) {
      const slug = slugs[index - 1];
      const criteria = typeof slug === "string" ? criteriaBySlug[slug] : undefined;
      if (
        !Array.isArray(criteria) ||
        criteria.length === 0 ||
        criteria.some(
          (value) =>
            typeof value !== "string" ||
            value.trim().length === 0 ||
            value !== value.trim() ||
            /[\r\n]/u.test(value)
        ) ||
        new Set(criteria).size !== criteria.length
      ) {
        errors.push(`${path}: invalid or duplicate inspection criteria`);
      } else {
        if (!content.includes("## Missing-control checks"))
          errors.push(`${path}: missing missing-control checks heading`);
        for (const criterion of criteria)
          if (!content.includes(`- ${criterion}`))
            errors.push(`${path}: missing inspection criterion ${criterion}`);
      }
    }
  }
  return { valid: errors.length === 0, skills: paths.length, errors };
}

async function loadOrDiscoverProfile(root: string): Promise<ProjectProfile> {
  try {
    const parsed = JSON.parse(
      await readFile(join(root, ".forge", "project-profile.json"), "utf8")
    ) as unknown;
    if (isProjectProfile(parsed)) return parsed;
    if (isLegacyProjectProfile(parsed)) return discoverProject(root);
    throw new Error("Invalid .forge/project-profile.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return discoverProject(root);
  }
}

function isProjectProfile(value: unknown): value is ProjectProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schema_version === 2 &&
    typeof candidate.root === "string" &&
    typeof candidate.generated_at === "string" &&
    Array.isArray(candidate.detections) &&
    typeof candidate.capabilities === "object" &&
    candidate.capabilities !== null &&
    !Array.isArray(candidate.capabilities) &&
    typeof candidate.repository === "object" &&
    candidate.repository !== null &&
    [
      "workspaces",
      "applications",
      "languages",
      "frameworks",
      "package_managers",
      "databases",
      "orms",
      "authentication",
      "sessions",
      "authorization",
      "roles",
      "tenant_boundaries",
      "routes",
      "storage",
      "upload_pipelines",
      "caches",
      "queues",
      "scheduled_jobs",
      "tests",
      "ci",
      "observability",
      "integrations",
      "ai_providers",
      "payment_providers",
      "hosting",
      "deployment",
      "environment_templates",
      "critical_workflows"
    ].every((field) => Array.isArray(candidate[field]))
  );
}

function isLegacyProjectProfile(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schema_version === 1 &&
    typeof candidate.root === "string" &&
    Array.isArray(candidate.detections) &&
    typeof candidate.capabilities === "object" &&
    candidate.capabilities !== null
  );
}

function extractFindings(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null && "findings" in value) {
    const findings = (value as { findings?: unknown }).findings;
    if (Array.isArray(findings)) return findings;
  }
  return [value];
}

function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

function isInspectionTool(
  value: ToolName
): value is Exclude<
  Extract<ToolName, `inspect-${string}` | "scan-secret-patterns">,
  "inspect-rendered-ui"
> {
  if (value === "inspect-rendered-ui") return false;
  return value.startsWith("inspect-") && value !== "inspect-platform-skills"
    ? true
    : value === "inspect-platform-skills" || value === "scan-secret-patterns";
}
