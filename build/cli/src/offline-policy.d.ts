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
import type { CommandDefinition, NetworkPolicy } from "./types.js";
export type CommandNetworkPolicy = "forge-internal-offline-safe" | "cache-only-installation" | "UNKNOWN";
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
export declare function classifyCommandNetworkPolicy(command: CommandDefinition, context: PolicyContext): CommandNetworkPolicy;
/** Decides whether a detected project command may execute under the active offline state. */
export declare function decideCommandExecution(command: CommandDefinition, context: PolicyContext): CommandPolicyDecision;
/**
 * Projects a command's network policy into the report vocabulary used by `PlannedCheck`.
 *
 * Two vocabularies exist for good reasons. `CommandNetworkPolicy` names *why* a command may run,
 * so it distinguishes the two provable exemptions. `NetworkPolicy` is the coarser report-facing
 * value. This function is the only sanctioned bridge between them, and it exists so that the
 * report vocabulary can never be used to launder an unproven claim.
 *
 * The mapping is deliberately one-way and lossy in the safe direction:
 *
 *  - The two structurally provable exemptions become `OFFLINE_SAFE`, because a proof exists.
 *  - `UNKNOWN` stays `UNKNOWN`. It never becomes `OFFLINE_SAFE`.
 *
 * There is no inverse function and no path that promotes `UNKNOWN`. Absence of network keywords is
 * not proof of offline safety, so nothing may downgrade an arbitrary audited-project command to
 * `OFFLINE_SAFE`. Escalation in the other direction — `UNKNOWN` to `NETWORK_REQUIRED` once network
 * dependence is actually demonstrated — is legitimate and is performed by the caller that holds
 * that evidence, not here.
 */
export declare function plannedCheckNetworkPolicy(policy: CommandNetworkPolicy): NetworkPolicy;
export declare function ledgerRecord(command: CommandDefinition, decision: CommandPolicyDecision, disposition: CommandDisposition, offline: boolean, exitCode?: number): CommandLedgerRecord;
/**
 * A registry address that cannot serve packages: an unspecified address, or a loopback address with
 * an explicit port. Both keep resolution inside the machine, so an install that still needs the
 * network fails rather than quietly succeeding.
 */
export declare function isUnreachableRegistry(value: string): boolean;
