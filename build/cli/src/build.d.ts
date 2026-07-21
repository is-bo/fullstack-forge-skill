import { type BuildFeature } from "./build-state.js";
/**
 * Build-mode entry point.
 *
 * `cli.ts` delegates here before any module-slug parsing when the first token is a build verb, so
 * every existing audit command behaves exactly as before. Build has its own flag surface (tiers,
 * summaries, disciplines) and parses its own argv rather than widening the audit option type.
 */
export declare function runBuild(argv: string[]): Promise<number>;
/** Computes the actionable missing-items list for `done` from verified evidence and gate policy. */
export declare function missingForDone(feature: BuildFeature, verifiedCriteria?: ReadonlySet<string>): string[];
