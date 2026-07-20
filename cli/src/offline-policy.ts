/**
 * Network policy for executed project commands.
 *
 * `--offline` previously reached only the rendered-UI driver. Every other execution path — `forge
 * tool run-project-command` and every `forge ship` gate command — spawned the audited project's own
 * scripts with unrestricted network access while the report recorded `offline: true`. That is a
 * silently ignored flag and a false offline claim, so classification now happens here and every
 * execution path consults it.
 *
 * The model is deliberately small and pessimistic:
 *
 *  - An arbitrary audited-project script is `UNKNOWN`. Forge cannot read the transitive behaviour of
 *    a shell pipeline, a package-manager lifecycle chain, or a task runner, so it never claims such
 *    a script is offline-safe.
 *  - Forge does NOT implement operating-system network isolation. There is no namespace, seccomp,
 *    firewall, or container boundary in this codebase, so no sandbox is ever claimed and `UNKNOWN`
 *    commands are blocked offline rather than "sandboxed".
 *  - Only two structurally provable exemptions exist: Forge's own repository scripts (recognized by
 *    exact definition inside the Forge package root itself), and an explicitly designed cache-only
 *    installation check that combines an offline package-manager flag with an unreachable registry.
 *
 * A blocked command produces a ledger record, never a command result, so it can never be converted
 * into typed PASS gate evidence.
 */

import { classifyHost } from "./net-policy.js";
import type { CommandDefinition } from "./types.js";

export type CommandNetworkPolicy =
  "forge-internal-offline-safe" | "cache-only-installation" | "UNKNOWN";

/** Why a command appears in the ledger. `NOT_RUN` covers ordering and authorization, not policy. */
export type CommandDisposition = "RAN" | "BLOCKED" | "NOT_RUN";

export type CommandPolicyDecision = {
  network_policy: CommandNetworkPolicy;
  /** True only when policy permits execution under the active offline state. */
  permitted: boolean;
  /**
   * Sandbox actually applied. Always `none`: no operating-system network isolation is implemented
   * in this codebase, and claiming one that does not exist would be a false safety claim.
   */
  sandbox: "none";
  reason: string;
};

export type CommandLedgerRecord = CommandPolicyDecision & {
  name: string;
  command: string[];
  definition: string;
  offline: boolean;
  disposition: CommandDisposition;
  exit_code?: number;
};

/**
 * Forge's own repository scripts, by exact `package.json` definition.
 *
 * Each entry reads and writes only files inside the checkout and spawns no installer or fetcher.
 * The definition string is matched exactly, and only when the audited root is the Forge package
 * root itself, so an audited project cannot inherit the exemption by reusing a script name.
 */
const FORGE_OFFLINE_SAFE_DEFINITIONS = new Set([
  "node scripts/check-branding.mjs",
  "node scripts/check-fixtures.mjs",
  "node scripts/check-install-docs.mjs",
  "node scripts/check-links.mjs",
  "node scripts/check-platform-assets.mjs",
  "node scripts/check-workflows.mjs",
  "node scripts/generate-modules.mjs && node scripts/sync-platform-assets.mjs",
  "node scripts/secret-scan.mjs",
  "node scripts/sync-platform-assets.mjs",
  "node scripts/validate-dist.mjs",
  "node scripts/validate-release-docs.mjs",
  "node scripts/validate-skill.mjs"
]);

const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const INSTALL_VERBS = new Set(["ci", "install", "add"]);
const OFFLINE_INSTALL_FLAGS = new Set(["--offline", "--frozen-lockfile-offline"]);

export type PolicyContext = {
  offline: boolean;
  /** True only when the audited root is the Fullstack Forge package root itself. */
  forgeOwned: boolean;
};

/**
 * Classifies a detected project command without executing it.
 *
 * Classification never depends on the command's *name*. `test`, `lint`, or `verify:offline` say
 * nothing about what the underlying definition does; only the definition text is inspected.
 */
export function classifyCommandNetworkPolicy(
  command: CommandDefinition,
  context: PolicyContext
): CommandNetworkPolicy {
  const definition = command.definition.trim();
  if (context.forgeOwned && FORGE_OFFLINE_SAFE_DEFINITIONS.has(definition))
    return "forge-internal-offline-safe";
  if (isCacheOnlyInstallation(definition)) return "cache-only-installation";
  return "UNKNOWN";
}

/** Decides whether a detected project command may execute under the active offline state. */
export function decideCommandExecution(
  command: CommandDefinition,
  context: PolicyContext
): CommandPolicyDecision {
  const policy = classifyCommandNetworkPolicy(command, context);
  if (!context.offline) {
    return {
      network_policy: policy,
      permitted: true,
      sandbox: "none",
      reason:
        policy === "UNKNOWN"
          ? `Offline mode is not active; '${command.name}' ran with unrestricted network access and its network behaviour remains UNKNOWN.`
          : `Offline mode is not active; '${command.name}' is classified ${policy}.`
    };
  }
  if (policy === "forge-internal-offline-safe") {
    return {
      network_policy: policy,
      permitted: true,
      sandbox: "none",
      reason: `'${command.name}' is a Fullstack Forge repository script whose exact definition '${command.definition}' reads and writes only checkout files and spawns no installer or fetcher.`
    };
  }
  if (policy === "cache-only-installation") {
    return {
      network_policy: policy,
      permitted: true,
      sandbox: "none",
      reason: `'${command.name}' is an explicitly designed cache-only installation check: it combines an offline package-manager flag with an unreachable registry, so any remaining network requirement fails loudly instead of silently succeeding.`
    };
  }
  return {
    network_policy: policy,
    permitted: false,
    sandbox: "none",
    reason: `'${command.name}' is an arbitrary audited-project script with UNKNOWN network policy. Fullstack Forge implements no operating-system network isolation, so it cannot be executed offline without making an unproven offline-safety claim. Re-run without --offline to execute it, and record that the result was obtained with network access.`
  };
}

export function ledgerRecord(
  command: CommandDefinition,
  decision: CommandPolicyDecision,
  disposition: CommandDisposition,
  offline: boolean,
  exitCode?: number
): CommandLedgerRecord {
  return {
    name: command.name,
    command: [command.executable, ...command.args],
    definition: command.definition,
    offline,
    disposition,
    ...decision,
    ...(exitCode === undefined ? {} : { exit_code: exitCode })
  };
}

/**
 * Structural recognition of a cache-only installation check.
 *
 * Requires all of: a package-manager invocation, an install verb, an offline flag that forces
 * cache-only resolution, and a registry override pointing at an address that cannot serve a
 * registry. Any of these alone is insufficient — `npm install --registry=...` still reaches the
 * network, and `npm install --offline` against the real registry proves nothing about the override.
 */
function isCacheOnlyInstallation(definition: string): boolean {
  const tokens = definition.split(/\s+/u).filter((token) => token.length > 0);
  const managerIndex = tokens.findIndex((token) => PACKAGE_MANAGERS.has(token));
  if (managerIndex < 0) return false;
  const verb = tokens[managerIndex + 1];
  if (verb === undefined || !INSTALL_VERBS.has(verb)) return false;
  if (!tokens.some((token) => OFFLINE_INSTALL_FLAGS.has(token))) return false;
  return registryValues(tokens).some(isUnreachableRegistry);
}

function registryValues(tokens: string[]): string[] {
  const values: string[] = [];
  for (const [index, token] of tokens.entries()) {
    if (token.startsWith("--registry=")) values.push(token.slice("--registry=".length));
    else if (token === "--registry") {
      const value = tokens[index + 1];
      if (value !== undefined) values.push(value);
    }
  }
  return values;
}

/**
 * A registry address that cannot serve packages: an unspecified address, or a loopback address with
 * an explicit port. Both keep resolution inside the machine, so an install that still needs the
 * network fails rather than quietly succeeding.
 */
export function isUnreachableRegistry(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.replace(/^["']|["']$/gu, ""));
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.replace(/^\[|\]$/gu, "");
  if (host === "0.0.0.0" || host === "::") return true;
  return classifyHost(host) === "loopback" && parsed.port !== "";
}
