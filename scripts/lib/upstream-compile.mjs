// Compiles pristine vendored upstream content into Forge's managed runtime tree.
//
// Nothing under `third_party/` is ever edited in place. The runtime copy is generated from three
// inputs — pristine content, a declared overlay, and the transforms below — so every difference
// between what upstream published and what Forge ships is reproducible and reviewable. Each
// transform records what it changed in the transform manifest.
//
// The single most important transform is `non-discoverable`: an upstream `SKILL.md` becomes
// `PLAYBOOK.md` and loses the frontmatter fields a host uses to auto-trigger a skill. Upstream
// expertise reaches the agent only when Forge's composition engine selects it.

export const RUNTIME_SKILL_FILENAME = "PLAYBOOK.md";

/** Frontmatter keys that make a host discover, announce, or auto-trigger a skill. */
const ACTIVATION_KEYS = Object.freeze([
  "name",
  "description",
  "triggers",
  "when_to_use",
  "whenToUse",
  "alwaysApply",
  "globs",
  "auto",
  "activation"
]);

const TRANSFORMS = Object.freeze([
  {
    id: "non-discoverable",
    reason:
      "An upstream SKILL.md inside an installed project could be discovered and triggered by the " +
      "agent host independently of Forge. The file is renamed and its activation frontmatter is " +
      "moved into an inert provenance block so only Forge's composition engine can select it.",
    appliesTo: (path) => path.endsWith("SKILL.md"),
    apply: (text, context) => neutralizeFrontmatter(text, context)
  },
  {
    id: "forge-command-routes",
    reason:
      "Upstream command names are rewritten to Forge command routes so users never need to learn " +
      "or invoke an upstream product's commands.",
    appliesTo: (path, context) => context.commandRoutes.size > 0 && /\.mdc?$/u.test(path),
    apply: (text, context) => rewriteCommands(text, context)
  },
  {
    id: "no-upstream-installation",
    reason:
      "Runtime guidance must not tell a user to install, update, or manage a separate upstream " +
      "product. Forge is one installable product and owns its own installation.",
    appliesTo: (path) => /\.mdc?$/u.test(path),
    apply: (text, context) => stripInstallationGuidance(text, context)
  },
  {
    id: "no-update-checks",
    reason:
      "Upstream automatic update checks are disabled: Forge controls updates, and normal runtime " +
      "use performs no network access.",
    appliesTo: (path) => /\.mjs$/u.test(path),
    apply: (text, context) => disableUpdateChecks(text, context)
  },
  {
    id: "no-telemetry",
    reason: "No vendored code may report usage anywhere. Forge ships no telemetry.",
    appliesTo: (path) => /\.mjs$/u.test(path),
    apply: (text, context) => disableTelemetry(text, context)
  },
  {
    id: "forge-owned-procedure",
    reason:
      "Declared replacements that hand a step back to Forge where the upstream procedure assumes " +
      "its own installation, its own project state, or a runtime component Forge does not vendor.",
    appliesTo: (path, context) =>
      context.contentReplacements.some((entry) => path.endsWith(entry.appliesTo)),
    apply: (text, context) => applyReplacements(text, context)
  },
  {
    id: "managed-paths",
    reason:
      "Upstream state directories are redirected to Forge-managed locations so no separately " +
      "managed upstream installation is created inside a user's repository.",
    appliesTo: (path) => /\.(?:mdc?|mjs)$/u.test(path),
    apply: (text, context) => rewriteManagedPaths(text, context)
  }
]);

/**
 * Compiles one vendored file. Returns the runtime path, the runtime bytes, and the list of
 * transforms that actually changed something.
 */
export function compileFile({ providerId, path, text, overlay }) {
  const context = {
    providerId,
    path,
    commandRoutes: new Map(Object.entries(overlay?.commandRoutes ?? {})),
    // Longest-first so a specific mapping is never pre-empted by a shorter prefix of itself.
    managedPaths: new Map(
      Object.entries(overlay?.managedPaths ?? {}).sort((a, b) => b[0].length - a[0].length)
    ),
    contentReplacements: overlay?.contentReplacements ?? [],
    applied: []
  };
  let output = text;
  for (const transform of TRANSFORMS) {
    if (!transform.appliesTo(path, context)) continue;
    const next = transform.apply(output, context);
    if (next !== output) {
      context.applied.push(transform.id);
      output = next;
    }
  }
  return { runtimePath: runtimePathFor(path, overlay), text: output, applied: context.applied };
}

/**
 * Runtime location of a vendored file. An upstream `SKILL.md` becomes `PLAYBOOK.md` so no host can
 * discover it, and a declared prefix is stripped so upstream host-specific directory layouts
 * (`.claude/skills/<name>/`) do not leak into Forge's managed tree.
 */
export function runtimePathFor(path, overlay) {
  const prefix = overlay?.stripPathPrefix;
  const stripped =
    prefix !== undefined && path.startsWith(prefix) ? path.slice(prefix.length) : path;
  return stripped.endsWith("SKILL.md")
    ? `${stripped.slice(0, -"SKILL.md".length)}${RUNTIME_SKILL_FILENAME}`
    : stripped;
}

function applyReplacements(text, context) {
  let output = text;
  for (const entry of context.contentReplacements) {
    if (!context.path.endsWith(entry.appliesTo)) continue;
    if (!output.includes(entry.find))
      throw new Error(
        `Overlay replacement for ${context.providerId}/${entry.appliesTo} no longer matches the ` +
          "vendored content. Re-review the upstream text and update config/upstream-overlays.json."
      );
    output = output.replaceAll(entry.find, entry.replace);
  }
  return output;
}

export function transformCatalog() {
  return TRANSFORMS.map((transform) => ({ id: transform.id, reason: transform.reason }));
}

/**
 * Replaces an upstream skill's activation frontmatter with an inert provenance block. The original
 * values are preserved as comments so provenance is never lost, but no host can read them as a
 * trigger: the emitted document has no YAML frontmatter at all.
 */
function neutralizeFrontmatter(text, context) {
  const normalized = text.replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n");
  if (!normalized.startsWith("---\n")) return normalized;
  const end = normalized.indexOf("\n---\n", 3);
  if (end === -1) return normalized;
  const block = normalized.slice(4, end + 1);
  const body = normalized.slice(end + 5);

  const preserved = [];
  for (const line of block.split("\n")) {
    const key = /^([A-Za-z_][\w-]*):/u.exec(line)?.[1];
    if (key !== undefined && ACTIVATION_KEYS.includes(key)) preserved.push(line.trimEnd());
  }

  const header = [
    `<!-- fullstack-forge:upstream-reference provider=${context.providerId} -->`,
    "",
    "> **Fullstack Forge managed reference.** This is vendored upstream expertise, compiled into",
    "> Forge's managed tree. It is not an independently installable skill and no agent host can",
    "> discover or trigger it: Forge's composition engine decides when it applies. Forge's module",
    "> contract, evidence rules, and status semantics take precedence over anything written here.",
    ""
  ];
  if (preserved.length > 0) {
    header.push(
      "<!-- upstream activation metadata, preserved for provenance and deliberately inert:",
      ...preserved.map((line) => `     ${line}`),
      "-->",
      ""
    );
  }
  return `${header.join("\n")}${body.replace(/^\n+/u, "")}`;
}

function rewriteCommands(text, context) {
  let output = text;
  for (const [upstream, forge] of context.commandRoutes) {
    // Only rewrite an actual command invocation, never prose that happens to contain the word.
    output = output.replaceAll(
      new RegExp(`(?<![\\w/])${escapeRegExp(upstream)}(?![\\w-])`, "gu"),
      forge
    );
  }
  return output;
}

const INSTALLATION_PATTERNS = Object.freeze([
  /^.*\bnpx\s+[\w@/.-]*impeccable[\w@/.-]*.*$/gimu,
  /^.*\bnpm\s+i(?:nstall)?\s+(?:-g\s+)?[\w@/.-]*impeccable[\w@/.-]*.*$/gimu,
  /^.*\b(?:install|update|upgrade)\s+the\s+(?:latest\s+)?impeccable\b.*$/gimu
]);

function stripInstallationGuidance(text, context) {
  let output = text;
  for (const pattern of INSTALLATION_PATTERNS) {
    output = output.replace(pattern, (line) =>
      line.trim().length === 0
        ? line
        : `<!-- fullstack-forge: upstream installation instruction removed (${context.providerId}) -->`
    );
  }
  return output;
}

function disableUpdateChecks(text) {
  if (!/update[-_ ]?check|latestVersion|checkForUpdates|registry\.npmjs\.org/iu.test(text))
    return text;
  return `${FORGE_RUNTIME_GUARD}${text}`;
}

function disableTelemetry(text) {
  if (!/telemetry|posthog|analytics\.(?:track|capture)/iu.test(text)) return text;
  return text.includes(FORGE_RUNTIME_GUARD) ? text : `${FORGE_RUNTIME_GUARD}${text}`;
}

/**
 * Prepended to any vendored executable that mentions updating or reporting. Forge's detector
 * adapter also runs the detector with an offline, no-network argument set, so this is a second
 * layer rather than the only one.
 */
const FORGE_RUNTIME_GUARD = `// fullstack-forge: vendored runtime module.
// Forge performs no automatic upstream update check and ships no telemetry. If this module
// contains an update or reporting path, it is unreachable in Forge: the detector adapter invokes
// only the documented offline entry point, and normal Forge use makes no network request.
`;

function rewriteManagedPaths(text, context) {
  let output = text;
  for (const [upstream, managed] of context.managedPaths) {
    output = output.replaceAll(upstream, managed);
  }
  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
