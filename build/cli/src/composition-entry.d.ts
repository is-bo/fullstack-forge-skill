/**
 * Standalone deterministic composition entry for release archives and installed host adapters.
 *
 * This file deliberately calls the same discovery and resolver functions as the npm CLI. The
 * generated archive runtime is a transpiled closure of this entry, not a second implementation.
 */
export declare function isDirectExecution(argumentPath: string | undefined, modulePath?: string, canonicalize?: (path: string) => string): boolean;
export declare function runCompositionEntry(argv: string[]): Promise<number>;
