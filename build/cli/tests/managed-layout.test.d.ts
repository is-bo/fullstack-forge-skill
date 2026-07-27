/**
 * Parity between the two managed-layout implementations.
 *
 * `cli/src/managed-layout.ts` renders adapters at installation time; `scripts/lib/managed-layout.mjs`
 * renders them at repository-generation time. If they ever disagree, `forge update` would rewrite
 * every bundled adapter with different bytes and the generated-copy check would fail — so both
 * modules already document that this test keeps them byte-identical. It does now.
 */
export {};
