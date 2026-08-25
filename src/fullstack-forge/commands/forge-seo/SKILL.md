---
name: forge-seo
description: "Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering."
---

# forge-seo: Search discoverability

Engine: Forge native

## Purpose

Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" seo compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves search discoverability, when
the user explicitly names `forge-seo`, or when discovery proves an applicable boundary.

- Public indexable web routes
- Marketing, documentation, catalog, or editorial content

## When not to activate

- Private applications and routes intentionally excluded from search

## Automated support

Relevant discovery inputs are:

- public route inventory
- robots and sitemap files
- rendered HTML

Deterministic support, bounded evidence only:

- None; use detected project commands and direct manual evidence.

## Agent inspection procedure

1. Decide applicability first: enumerate genuinely public indexable routes; for private dashboards or non-public products record `NOT_APPLICABLE` with the routing evidence.
2. Fetch each public route as a crawler would and verify title, meta description, canonical URL, and robots directives in the delivered HTML.
3. Validate structured data and Open Graph metadata against the rendered content.
4. Crawl internal links for broken targets, redirect chains, and duplicate-content URLs.
5. Verify sitemap coverage matches the actual public route set and check rendering of JavaScript-dependent content in the crawler-delivered output.

Manual inspection requirements:

- Judge search intent and snippet quality
- Confirm private or tenant data is never made indexable

Stack-specific guidance:

- Inspect both framework metadata APIs and final response HTML

## Evidence to collect

Standards used as criteria:

- Google Search Essentials
- Schema.org
- RFC 9110

## Common production failures

- Verify status codes, indexability, canonical URLs, robots directives, sitemap coverage, titles, descriptions, and social metadata
- Inspect server-rendered content, internal links, pagination, redirects, duplicate URLs, and structured-data validity
- Separate performance evidence from unmeasured assumptions

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Correct deterministic canonical, robots, or metadata omissions
- Add missing image dimensions and link descriptions

## Approval-required changes

- Changing URL structure, redirect policy, or indexability

## Verification

- Fetch representative routes as a crawler
- Validate sitemap and structured data with recorded output

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Rankings and external index state cannot be promised from repository evidence
