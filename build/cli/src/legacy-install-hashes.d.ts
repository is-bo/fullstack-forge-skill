/**
 * Hash aliases for the immutable v0.1.0 and v0.2.2 installer layouts.
 *
 * This table contains path names and SHA-256 values only; it does not redistribute historical
 * content. The release grouping preserves provenance, while current-version manifests may match
 * any listed hash during a partial multi-host migration. Arbitrary hashes remain unauthorized.
 * Regenerate this table from immutable release tags when adding a supported legacy release.
 */
export declare const LEGACY_INSTALL_HASHES: Readonly<Record<string, Readonly<Record<string, string>>>>;
export declare function legacyHashMatches(version: string, path: string, hash: string, currentVersion: string): boolean;
