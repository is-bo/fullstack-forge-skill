---
name: forge-seo
description: Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering. Activate automatically for public indexable web routes when that concern is relevant to a software-engineering request.
---

# forge-seo: Search discoverability

## Purpose

Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

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

Available deterministic support, where present:

- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.

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

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Correct deterministic canonical, robots, or metadata omissions
- Add missing image dimensions and link descriptions

## Approval-required changes

- Changing URL structure, redirect policy, or indexability

## Verification

- Fetch representative routes as a crawler
- Validate sitemap and structured data with recorded output

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Rankings and external index state cannot be promised from repository evidence
