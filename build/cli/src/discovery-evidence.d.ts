import type { ModuleSlug } from "./constants.js";
import type { Confidence } from "./types.js";
import { type RepositoryInventory } from "./repository-inventory.js";
/**
 * Discovery evidence classification.
 *
 * Detecting the word "payments" somewhere in a repository never proved that the audited
 * project processes payments. This module separates *where* a signal was observed from
 * *whether* that signal activates a production capability, so documentation, tests,
 * fixtures, examples, and Forge's own generated skill copies can no longer switch an
 * audit module on by themselves.
 */
export declare const EVIDENCE_CLASSES: readonly ["manifest", "implementation", "configuration", "route", "schema", "test", "documentation", "fixture", "generated", "example", "unknown"];
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];
export declare const CAPABILITY_STATUSES: readonly ["PRESENT", "ABSENT", "UNKNOWN"];
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];
export declare const CAPABILITY_KINDS: readonly ["control", "surface"];
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];
export type DiscoveryEvidence = {
    evidence_class: EvidenceClass;
    path: string;
    line?: number;
    confidence: Confidence;
    activation_weight: number;
    reason: string;
    workspace: string;
};
export type CapabilityAssessment = {
    capability: string;
    /** Explicit in current profiles; optional only for historical schema-v2 compatibility. */
    kind?: CapabilityKind;
    workspace: string;
    status: CapabilityStatus;
    score: number;
    evidence: DiscoveryEvidence[];
    reasons: string[];
};
export type RiskEvidence = {
    risk: string;
    modules: ModuleSlug[];
    path: string;
    line?: number;
    confidence: Confidence;
    reason: string;
};
export declare function capabilityKindFor(capability: string): CapabilityKind;
/**
 * Activation weight per evidence class.
 *
 * Zero means "observed, but never sufficient to activate a production capability".
 * A capability activates at `ACTIVATION_THRESHOLD`; anything above zero but below the
 * threshold produces `UNKNOWN` so that a pile of weak signals cannot masquerade as proof.
 */
export declare const ACTIVATION_WEIGHTS: Readonly<Record<EvidenceClass, number>>;
/** Score at which a capability is reported as `PRESENT`. */
export declare const ACTIVATION_THRESHOLD = 1;
/** Multiplier applied when a match sits inside a comment or a passive string literal. */
export declare const WEAK_CONTEXT_MULTIPLIER = 0.2;
export declare function activationWeightFor(evidenceClass: EvidenceClass): number;
type Classification = {
    evidence_class: EvidenceClass;
    reason: string;
};
/**
 * Classifies a repository-relative POSIX path into a single evidence class.
 *
 * Precedence matters: a `package.json` inside `fixtures/` is fixture evidence, not manifest
 * evidence, and a generated platform copy is never implementation evidence for the audited
 * project. Neutralizing classes are therefore tested before activating ones.
 */
export declare function classifyEvidencePath(path: string): Classification;
/**
 * Resolves the workspace a path belongs to. `workspaceRoots` holds repository-relative
 * directories (`"."` for the repository root). The longest matching root wins so a nested
 * package is never attributed to its parent.
 */
export declare function workspaceForPath(path: string, workspaceRoots: readonly string[]): string;
type CapabilityRule = {
    capability: string;
    /** Matches dependency names and imports inside manifests. */
    manifest?: RegExp;
    /** Matches implementation, route, schema, and configuration content. */
    content?: RegExp;
};
/**
 * Independent capability signatures. These deliberately favour concrete provider names and
 * API shapes over generic vocabulary, because generic vocabulary is exactly what appears in
 * README prose and test fixtures.
 */
export declare const CAPABILITY_RULES: readonly CapabilityRule[];
/**
 * Reports whether a match sits inside a comment or a passive string literal. Manifests are
 * exempt because every JSON dependency name is legitimately a string literal.
 */
export declare function isWeakContext(content: string, index: number, evidenceClass: EvidenceClass): boolean;
/**
 * Builds a single classified evidence record. Exported so callers can classify signals that
 * were produced by other analyzers without duplicating the weighting policy.
 */
export declare function buildEvidence(options: {
    path: string;
    workspaceRoots?: readonly string[];
    line?: number;
    weak?: boolean;
    detail?: string;
}): DiscoveryEvidence;
/** Evidence paired with the capability whose signature produced it. */
export type CapabilityEvidence = {
    capability: string;
    evidence: DiscoveryEvidence;
};
/**
 * Turns classified evidence into a per-workspace capability decision.
 *
 * `capabilities` names every capability that must receive an assessment, so a capability with
 * no evidence at all is reported as `ABSENT` rather than silently omitted.
 */
export declare function assessCapabilities(tagged: readonly CapabilityEvidence[], capabilities: readonly string[], workspaces?: readonly string[]): CapabilityAssessment[];
/** Applies the activation policy to one capability in one workspace. */
export declare function decideCapability(capability: string, workspace: string, evidence: readonly DiscoveryEvidence[], kind?: CapabilityKind): CapabilityAssessment;
/**
 * Scans a repository and returns one assessment per capability per workspace.
 *
 * Unlike the legacy detection walk, this scan deliberately descends into fixtures, examples,
 * generated output, and documentation so that those signals can be observed *and* neutralized
 * instead of being invisible.
 */
export declare function assessProjectCapabilities(rootInput: string, workspaceRoots?: readonly string[], sharedInventory?: RepositoryInventory): Promise<CapabilityAssessment[]>;
/** Collects classified, capability-tagged evidence for a file list. Deterministic by path. */
export declare function collectEvidence(root: string, files: readonly string[], workspaceRoots: readonly string[], contentByFile?: ReadonlyMap<string, string>): Promise<CapabilityEvidence[]>;
/** Derives bounded risk-surface evidence from the inventory used by project discovery. */
export declare function discoverRiskEvidence(inventory: RepositoryInventory): RiskEvidence[];
export {};
