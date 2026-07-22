import { createHash } from "node:crypto";
import type { FixResult } from "./fixes.js";
import type { InstallAction } from "./installer.js";
import type { AuditReport } from "./report.js";
import { assertValidSlug } from "./build-state.js";
import { MODULE_SLUGS, VERSION, type ModuleSlug } from "./constants.js";
import { redactToString } from "./redaction.js";

export const SIMPLE_COMMANDS = [
  "build",
  "continue",
  "audit",
  "fix",
  "verify",
  "ship",
  "status",
  "help"
] as const;

export type SimpleCommand = (typeof SIMPLE_COMMANDS)[number];

export type SimpleRoute =
  | { kind: "none" }
  | { kind: "menu" }
  | { kind: "help"; advanced: boolean }
  | { kind: "build"; request?: string; flags: string[] }
  | { kind: "continue"; flags: string[] }
  | { kind: "status"; flags: string[] }
  | { kind: "default-audit"; flags: string[] }
  | { kind: "expert"; command: SimpleCommand; argv: string[] };

type StatusSnapshot = {
  root: string;
  installed: boolean;
  installedSkills: number;
  buildInitialized: boolean;
  features: Array<{ slug: string; summary?: string; phase: string; updated_at: string }>;
  report?: AuditReport;
};

export type DoctorCheck = {
  name: string;
  status: "PASS" | "FAIL" | "NOT_VERIFIED";
  evidence: string;
  recovery?: string;
};

const AUDITABLE_MODULES = MODULE_SLUGS.filter(
  (slug) => !["all", "discover", "ship"].includes(slug)
);

const AREA_ALIASES: Readonly<Record<string, readonly ModuleSlug[]>> = {
  "access control": ["authorization"],
  a11y: ["accessibility"],
  "agent ai": ["ai"],
  authentication: ["auth"],
  backups: ["recovery"],
  billing: ["payments"],
  caching: ["cache"],
  ci: ["deployment", "supply-chain"],
  database: ["database"],
  db: ["database"],
  dependencies: ["supply-chain"],
  deployment: ["deployment"],
  docs: ["docs"],
  documentation: ["docs"],
  frontend: ["frontend"],
  "front end": ["frontend"],
  "file storage": ["storage"],
  identity: ["auth"],
  infrastructure: ["infrastructure"],
  internationalization: ["i18n"],
  localization: ["i18n"],
  login: ["auth"],
  observability: ["observability"],
  permissions: ["authorization"],
  privacy: ["privacy"],
  queues: ["jobs"],
  roles: ["authorization"],
  search: ["queries", "performance"],
  security: ["security"],
  tests: ["testing"],
  testing: ["testing"],
  translations: ["i18n"],
  ui: ["ui"],
  uploads: ["uploads"],
  "user experience": ["ux"],
  "user interface": ["ui"],
  ux: ["ux"],
  webhooks: ["integrations"],
  websockets: ["realtime"]
};

const COMMAND_CHOICES = [
  ...SIMPLE_COMMANDS,
  "new",
  "feature",
  "resume",
  "doctor",
  "init",
  "update",
  "uninstall",
  "list",
  "package",
  "validate"
];

export function parseSimpleRoute(argv: string[]): SimpleRoute {
  const [rawCommand, ...rest] = argv;
  if (rawCommand === undefined) return { kind: "menu" };
  const command = rawCommand.toLowerCase();
  if (!(SIMPLE_COMMANDS as readonly string[]).includes(command)) return { kind: "none" };

  if (command === "help") {
    const advanced = rest.includes("advanced") || rest.includes("--advanced");
    const unexpected = rest.filter(
      (value) => !["advanced", "--advanced", "--no-color"].includes(value)
    );
    if (unexpected.length > 0)
      throw new Error(
        `forge help does not accept '${unexpected.join(" ")}'. Try 'forge help advanced'.`
      );
    return { kind: "help", advanced };
  }

  const { words, flags } = splitWordsAndFlags(rest);
  if (command === "build") {
    const request = words.join(" ").trim();
    return request.length === 0 ? { kind: "build", flags } : { kind: "build", request, flags };
  }
  if (command === "continue") {
    assertNoWords(command, words);
    return { kind: "continue", flags };
  }
  if (command === "status") {
    assertNoWords(command, words);
    return { kind: "status", flags };
  }
  if (command === "ship") {
    assertNoWords(command, words);
    return { kind: "expert", command, argv: ["ship", ...flags] };
  }

  const area = words.join(" ").trim();
  if (command === "audit" && area.length === 0) return { kind: "default-audit", flags };
  const section = area.length === 0 ? "all" : resolveAuditArea(area);
  const mode = command;
  const normalizedFlags =
    command === "audit" && section === "all" && !hasValueFlag(flags, "--scope")
      ? [...flags, "--scope", "full"]
      : flags;
  return {
    kind: "expert",
    command: command as SimpleCommand,
    argv: [section, mode, ...normalizedFlags]
  };
}

export function resolveAuditArea(input: string): ModuleSlug {
  const normalized = normalizePhrase(input);
  if (normalized === "all" || normalized === "everything") return "all";
  const exact = AUDITABLE_MODULES.find((slug) => normalizePhrase(slug) === normalized);
  if (exact !== undefined) return exact;

  const candidates = new Set<ModuleSlug>();
  for (const [alias, modules] of Object.entries(AREA_ALIASES)) {
    if (containsPhrase(normalized, alias)) for (const module of modules) candidates.add(module);
  }
  if (candidates.size === 1) return [...candidates][0] as ModuleSlug;
  if (candidates.size > 1)
    throw new Error(
      `Audit area '${input}' is ambiguous. Choose one: ${[...candidates].sort().join(", ")}.`
    );

  const suggestion = closestSuggestion(normalized, [
    ...AUDITABLE_MODULES,
    ...Object.keys(AREA_ALIASES)
  ]);
  throw new Error(
    `Unknown audit area '${input}'.${suggestion === undefined ? "" : ` Did you mean '${suggestion}'?`} Run 'forge list' for every area.`
  );
}

export function featureSlugFromRequest(request: string): string {
  const safeRequest = redactToString(request);
  const normalized = safeRequest
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const words = normalized.split("-").filter(Boolean);
  const stopWords = new Set(["add", "build", "create", "feature", "implement", "make", "new"]);
  const meaningful = words.filter((word) => !stopWords.has(word));
  const source = (meaningful.length > 0 ? meaningful : words).join("-");
  const digest = createHash("sha256").update(safeRequest).digest("hex").slice(0, 8);
  let slug = (source.length === 0 ? `feature-${digest}` : source).slice(0, 64).replace(/-+$/u, "");
  try {
    assertValidSlug(slug);
  } catch {
    const suffix = slug.length === 0 ? digest : slug;
    slug = `feature-${suffix}`.slice(0, 64).replace(/-+$/u, "");
    assertValidSlug(slug);
  }
  return slug;
}

export function featureSlugWithCollision(request: string, baseSlug: string): string {
  const digest = createHash("sha256").update(request).digest("hex").slice(0, 8);
  const prefix = baseSlug.slice(0, 55).replace(/-+$/u, "");
  const slug = `${prefix}-${digest}`;
  assertValidSlug(slug);
  return slug;
}

export function suggestCommand(input: string): string | undefined {
  const suggestion = closestSuggestion(normalizePhrase(input), COMMAND_CHOICES);
  return suggestion === undefined ? undefined : `forge ${suggestion}`;
}

export function renderSimpleHelp(): string {
  return `Fullstack Forge ${VERSION}

Build, inspect, repair, and verify an application with evidence.

Start here:
  forge build                         Start or frame a project
  forge build "add customer login"    Start a feature from plain language
  forge continue                      Continue unfinished work
  forge audit                         Audit changed work when Git scope is reliable
  forge audit all                     Audit the full applicable project
  forge audit security                Audit one area
  forge fix                           Preview bounded safe fixes
  forge fix --safe                    Apply only reviewed, bounded safe fixes
  forge verify                        Recheck the latest findings
  forge ship                          Evaluate independent release gates
  forge status                        Show project, evidence, and next-step status

Helpful commands:
  forge doctor                        Diagnose installation and project setup
  forge init all                      Install every bundled skill in this project
  forge help advanced                 Show the complete expert CLI reference

Safety: missing evidence never becomes PASS. JSON remains available with --json; use --details
on simple audit, verify, or ship commands for the complete technical report.`;
}

export function renderSimpleMenu(): string {
  return `What would you like to do?

  1. Build something
  2. Continue unfinished work
  3. Audit changed work
  4. Audit the whole project
  5. Preview safe fixes
  6. Verify findings
  7. Check release readiness
  8. Show status
  9. Help
  0. Exit`;
}

export function menuChoiceToArgs(choice: string, buildRequest?: string): string[] | undefined {
  const value = choice.trim().toLowerCase();
  if (["0", "q", "quit", "exit", "cancel"].includes(value)) return undefined;
  const routes: Readonly<Record<string, string[]>> = {
    "1": buildRequest === undefined ? ["build"] : ["build", buildRequest],
    "2": ["continue"],
    "3": ["audit"],
    "4": ["audit", "all"],
    "5": ["fix"],
    "6": ["verify"],
    "7": ["ship"],
    "8": ["status"],
    "9": ["help"]
  };
  return routes[value];
}

export function renderPlainReport(
  report: AuditReport,
  operation: "audit" | "verify" | "ship"
): string {
  const count = (status: string): number =>
    report.findings.filter((finding) => finding.status === status).length;
  const failed = count("FAIL");
  const warnings = count("WARNING");
  const blocked = count("BLOCKED");
  const unverified = count("NOT_VERIFIED");
  const heading =
    failed > 0
      ? `${title(operation)} finished — action required.`
      : blocked > 0 || unverified > 0
        ? `${title(operation)} finished — evidence is incomplete.`
        : `${title(operation)} finished — recorded checks passed.`;
  const actionable = report.findings
    .filter((finding) => ["FAIL", "WARNING", "BLOCKED", "NOT_VERIFIED"].includes(finding.status))
    .slice(0, 5);
  const lines = [
    heading,
    `Scope: ${report.scope}`,
    `Confirmed: ${failed} failed, ${warnings} warning(s)`,
    `Evidence gaps: ${blocked} blocked, ${unverified} not verified`,
    `Commands run: ${report.execution.length}`
  ];
  if (actionable.length > 0) {
    lines.push("", "Top actions:");
    for (const [index, finding] of actionable.entries()) {
      lines.push(
        `  ${index + 1}. ${plainRiskLabel(finding.status, finding.severity)}: ${redactToString(finding.title)}`,
        `     Why it matters: ${redactToString(finding.impact)}`,
        `     Safe fix: ${finding.safe_fix ? "available for preview with 'forge fix'" : "not automatic; review or approval is required"}`
      );
    }
  }
  lines.push("", "Details: .forge/report.md and .forge/report.json");
  if (operation === "audit" && (failed > 0 || warnings > 0))
    lines.push("Next: run 'forge fix' to preview bounded safe fixes.");
  else if (operation === "audit" && (blocked > 0 || unverified > 0))
    lines.push(
      "Next: review the evidence gaps; authorize project checks only after inspecting them."
    );
  else if (operation === "verify" && (blocked > 0 || unverified > 0))
    lines.push("Next: collect the named missing evidence and run 'forge verify' again.");
  else if (operation === "ship")
    lines.push(
      failed > 0 || blocked > 0 || unverified > 0
        ? "Next: resolve the named gates, then run 'forge ship' again."
        : "Next: verify remote CI, publication, and production state separately."
    );
  else lines.push("Next: run 'forge status' or continue your work.");
  return lines.join("\n");
}

export function renderPlainFix(result: FixResult, applied: boolean): string {
  const lines = [
    applied ? "Safe-fix run finished." : "Safe-fix preview finished — no files changed.",
    `Planned safe edits: ${result.operations.length}`,
    `Files changed: ${result.changed_files.length}`,
    `Approval-bound or unsupported findings: ${result.blocked_findings.length}`
  ];
  if (result.operations.length > 0) {
    lines.push("", applied ? "Applied:" : "Would change:");
    for (const operation of result.operations.slice(0, 8))
      lines.push(`  - ${operation.path}: ${operation.description}`);
  }
  if (result.blocked_findings.length > 0) {
    lines.push("", "Not changed automatically:");
    for (const finding of result.blocked_findings.slice(0, 5))
      lines.push(`  - ${finding.instance_id ?? finding.finding_id}: ${finding.reason}`);
  }
  lines.push(
    "",
    applied
      ? "Next: inspect the diff, then run 'forge verify'."
      : result.operations.length > 0
        ? "Next: review this plan, then run 'forge fix --safe' to apply only these bounded edits."
        : "Next: review .forge/report.md for manual remediation."
  );
  return lines.join("\n");
}

export function renderStatus(snapshot: StatusSnapshot): string {
  const unfinished = snapshot.features.filter(
    (feature) => !["done", "blocked", "abandoned"].includes(feature.phase)
  );
  const lines = [
    `Fullstack Forge ${VERSION}`,
    `Project: ${snapshot.root}`,
    `Skills: ${snapshot.installed ? `${snapshot.installedSkills} installed records` : "not installed in this scope"}`,
    `Build state: ${snapshot.buildInitialized ? `${snapshot.features.length} feature(s), ${unfinished.length} unfinished` : "not initialized"}`
  ];
  if (unfinished.length > 0) {
    lines.push("", "Unfinished work:");
    for (const feature of unfinished.slice(0, 8))
      lines.push(
        `  - ${feature.summary === undefined || feature.summary === feature.slug ? feature.slug : `${feature.summary} (${feature.slug})`}: ${feature.phase}`
      );
  }
  if (snapshot.report === undefined) {
    lines.push("", "Latest audit: none", "Release readiness: not evaluated");
  } else {
    const failed = snapshot.report.findings.filter((finding) => finding.status === "FAIL").length;
    const incomplete = snapshot.report.findings.filter((finding) =>
      ["BLOCKED", "NOT_VERIFIED"].includes(finding.status)
    ).length;
    lines.push(
      "",
      `Latest report: ${snapshot.report.scope} at ${snapshot.report.generated_at}`,
      `Latest evidence: ${failed} failed, ${incomplete} incomplete`,
      `Release readiness: ${snapshot.report.scope === "ship" ? "see latest Ship report" : "not evaluated by this audit"}`
    );
  }
  lines.push(
    "",
    unfinished.length > 0
      ? "Next: run 'forge continue'."
      : snapshot.report === undefined
        ? "Next: run 'forge audit' or 'forge build'."
        : "Next: run 'forge ship' for an independent release decision."
  );
  return lines.join("\n");
}

export function renderInstallResult(
  operation: "init" | "update" | "uninstall",
  selector: string,
  global: boolean,
  dryRun: boolean,
  actions: InstallAction[]
): string {
  const counts = new Map<string, number>();
  for (const action of actions) counts.set(action.action, (counts.get(action.action) ?? 0) + 1);
  const platforms = [...new Set(actions.map((action) => action.platform))].sort();
  const skills = new Set<string>();
  for (const action of actions) {
    const parts = action.path.split(/[\\/]+/u);
    const index = parts.lastIndexOf("skills");
    const name = index === -1 ? undefined : parts[index + 1];
    if (name !== undefined) skills.add(name);
  }
  const actionSummary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
  const lines = [
    dryRun
      ? `${title(operation)} preview finished — no files changed.`
      : operation === "uninstall"
        ? "Fullstack Forge uninstall finished."
        : `Fullstack Forge ${VERSION} is ready.`,
    `Scope: ${global ? "user/global" : "this project"}`,
    `Selector: ${selector}`,
    `Agents: ${platforms.join(", ") || "none"}`,
    `Skills: ${skills.size}`,
    `Files: ${actions.length}${actionSummary.length === 0 ? "" : ` (${actionSummary})`}`
  ];
  if (operation !== "uninstall" && !dryRun)
    lines.push("", "Next: run 'forge doctor', then 'forge help'.");
  if (operation === "uninstall" && actions.some((action) => action.action === "preserve-modified"))
    lines.push("", "Modified files were preserved. Review the paths in --json output.");
  return lines.join("\n");
}

export function renderDoctor(root: string, checks: DoctorCheck[]): string {
  const failed = checks.filter((check) => check.status === "FAIL");
  const unverified = checks.filter((check) => check.status === "NOT_VERIFIED");
  const lines = [
    `Fullstack Forge doctor ${VERSION}`,
    `Project: ${root}`,
    `Overall: ${failed.length > 0 ? "needs attention" : unverified.length > 0 ? "setup incomplete" : "ready"}`,
    ""
  ];
  for (const check of checks) {
    lines.push(`[${check.status}] ${check.name}: ${check.evidence}`);
    if (check.recovery !== undefined) lines.push(`  Fix: ${check.recovery}`);
  }
  return lines.join("\n");
}

function splitWordsAndFlags(values: string[]): { words: string[]; flags: string[] } {
  const firstFlag = values.findIndex((value) => value.startsWith("-"));
  if (firstFlag === -1) return { words: values, flags: [] };
  return { words: values.slice(0, firstFlag), flags: values.slice(firstFlag) };
}

function assertNoWords(command: string, words: string[]): void {
  if (words.length > 0)
    throw new Error(`forge ${command} does not accept '${words.join(" ")}'. Run 'forge help'.`);
}

function hasValueFlag(flags: string[], name: string): boolean {
  return flags.some((flag) => flag === name || flag.startsWith(`${name}=`));
}

function normalizePhrase(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${phrase} `);
}

function closestSuggestion(value: string, choices: readonly string[]): string | undefined {
  if (value.length === 0) return undefined;
  const scored = choices.map((choice) => ({
    choice,
    distance: editDistance(value, normalizePhrase(choice))
  }));
  scored.sort((a, b) => a.distance - b.distance || a.choice.localeCompare(b.choice));
  const best = scored[0];
  if (best === undefined) return undefined;
  const limit = Math.max(2, Math.floor(Math.max(value.length, best.choice.length) / 3));
  return best.distance <= limit ? best.choice : undefined;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitution
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function title(operation: string): string {
  return `${operation.slice(0, 1).toUpperCase()}${operation.slice(1)}`;
}

function plainRiskLabel(status: string, severity: string): string {
  if (status === "BLOCKED") return "Blocked check";
  if (status === "NOT_VERIFIED") return "Not verified";
  return `${severity.slice(0, 1)}${severity.slice(1).toLowerCase()} risk`;
}
