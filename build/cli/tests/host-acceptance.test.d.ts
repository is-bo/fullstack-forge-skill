/**
 * Host-acceptance tests for the canonical installation layout.
 *
 * ## What these tests are, and what they are NOT
 *
 * Every test in this file is a **host simulation**, never a live host run. No Claude Code, Codex,
 * Cursor, Gemini CLI, Windsurf, or GitHub Copilot process is launched here, and nothing in this
 * file may be reported as evidence that a live host loaded, triggered, or followed a skill. Live
 * host UI and live host loader behaviour remain `NOT_VERIFIED`.
 *
 * A "host simulation" is deliberately narrow, and that narrowness is what gives it value: the
 * resolver in this file reads **only what the named host's documented loader would read**, starting
 * from **that host's documented discovery root**, and follows the adapter's relative pointer using
 * **the same relative-path resolution an agent reading that file would perform** — from the
 * adapter's own directory, not from the install root. It fails if anything it needs is missing.
 * That proves the layout is mechanically resolvable. It does not prove any product implements the
 * loader we simulate; the documented discovery paths themselves come from `docs/PLATFORM_SUPPORT.md`
 * and could change without notice.
 *
 * Test names carry their check number so the release matrix can be read straight off the runner
 * output, and each carries `(simulated)` so no reader mistakes a filesystem pass for a live pass.
 */
export {};
