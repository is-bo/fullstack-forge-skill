import { type BuildFeature } from "./build-state.js";
/**
 * Build-mode entry point.
 *
 * `cli.ts` delegates here before any module-slug parsing when the first token is a build verb, so
 * every existing audit command behaves exactly as before. Build has its own flag surface (tiers,
 * summaries, disciplines) and parses its own argv rather than widening the audit option type.
 */
export declare function runBuild(argv: string[]): Promise<number>;
/**
 * Computes the actionable missing-items list for `done`.
 *
 * A criterion is satisfied by PASS, a reasoned NOT_APPLICABLE, or an eligible risk acceptance. A
 * FAIL is never waivable. A high-tier required security control that is NOT_VERIFIED can never be
 * satisfied and is reported as such.
 */
export declare function missingForDone(feature: BuildFeature): string[];
