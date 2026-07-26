---
name: forge-seo
description: Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering. Activate automatically for public indexable web routes when that concern is relevant to a software-engineering request.
---

# forge-seo: Search discoverability

## Purpose

Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves search discoverability, when
the user explicitly names `forge-seo`, or when discovery proves an applicable boundary.

- Public indexable web routes
- Marketing, documentation, catalog, or editorial content

## When not to activate

- Private applications and routes intentionally excluded from search

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- public route inventory
- robots and sitemap files
- rendered HTML

Available deterministic support, where present:

- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Decide applicability first: enumerate genuinely public indexable routes; for private dashboards or non-public products record `NOT_APPLICABLE` with the routing evidence.
3. Fetch each public route as a crawler would and verify title, meta description, canonical URL, and robots directives in the delivered HTML.
4. Validate structured data and Open Graph metadata against the rendered content.
5. Crawl internal links for broken targets, redirect chains, and duplicate-content URLs.
6. Verify sitemap coverage matches the actual public route set and check rendering of JavaScript-dependent content in the crawler-delivered output.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Judge search intent and snippet quality
- Confirm private or tenant data is never made indexable

Stack-specific guidance:

- Inspect both framework metadata APIs and final response HTML

## Evidence to collect

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

Primary standards used as criteria, not proof of compliance:

- Google Search Essentials
- Schema.org
- RFC 9110

## Common production failures

- Verify status codes, indexability, canonical URLs, robots directives, sitemap coverage, titles, descriptions, and social metadata
- Inspect server-rendered content, internal links, pagination, redirects, duplicate URLs, and structured-data validity
- Separate performance evidence from unmeasured assumptions

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Conditional applicability for public web pages
- Page titles
- Meta descriptions
- Canonical URLs
- Robots directives
- Sitemap
- Structured data
- Open Graph metadata
- Social metadata
- Crawlable links
- Duplicate pages
- Redirects
- Broken links
- Heading hierarchy
- Public rendering
- Image metadata
- Local-business metadata
- Public page performance
- NOT_APPLICABLE evidence for private dashboards and non-public products

## Commands and tools

- Run `forge seo audit --json` or `fullstack-forge seo audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Correct deterministic canonical, robots, or metadata omissions
- Add missing image dimensions and link descriptions

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing URL structure, redirect policy, or indexability

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Fetch representative routes as a crawler
- Validate sitemap and structured data with recorded output

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Rankings and external index state cannot be promised from repository evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
