/**
 * Adapter from the vendored Impeccable deterministic detector to Forge findings.
 *
 * Forge does not reimplement the detector's rules; it translates their results into its own
 * evidence contract. The translation is deliberately conservative:
 *
 *   - a subjective style or "AI tell" rule becomes an **advisory** and can never block Ship;
 *   - an accessibility, layout, or performance rule with concrete file evidence becomes a
 *     **finding** owned by the matching Forge module;
 *   - a rule that could only be settled by running the interface becomes `NOT_VERIFIED`;
 *   - a deviation the user has already approved is `SUPERSEDED`, with the approval as evidence.
 *
 * The upstream rule id and the pinned upstream version travel with every result, so any finding
 * can be traced back to the exact rule and commit that produced it.
 */
import type { Finding } from "./types.js";
/** One result as emitted by `scripts/detector/findings.mjs` in the vendored detector. */
export type DetectorFinding = {
    antipattern: string;
    name: string;
    description: string;
    severity?: string;
    category?: string | null;
    file?: string;
    line?: number;
    snippet?: string;
    advisory?: boolean;
};
export type DetectorRun = {
    findings: DetectorFinding[];
    /** Rules the detector could not settle from static input alone. */
    unresolved?: {
        antipattern: string;
        reason: string;
    }[];
    /** Deviations the user approved, keyed by rule id, with the approval evidence. */
    approved?: Record<string, string>;
};
export type DetectorProvenance = {
    provider: string;
    upstreamTag: string | null;
    upstreamCommit: string;
    detectorVersion?: string;
};
export type AdaptedResult = {
    findings: Finding[];
    advisories: Finding[];
    notVerified: Finding[];
    superseded: Finding[];
};
/**
 * Translates one detector run. Nothing is invented: a result with no file evidence cannot become a
 * confident finding, and no detector output can produce a PASS — the detector proves defects, not
 * their absence.
 */
export declare function adaptDetectorRun(run: DetectorRun, provenance: DetectorProvenance): AdaptedResult;
/**
 * Guard used by the Ship gate. Upstream visual craft advice is never a release blocker, however
 * severe the upstream rule claims to be.
 */
export declare function blocksShip(finding: Finding): boolean;
