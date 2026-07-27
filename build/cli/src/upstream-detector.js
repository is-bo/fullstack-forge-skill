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
/**
 * Rule categories that carry objective, file-anchored evidence and therefore map to a Forge
 * module. Everything not listed here is treated as subjective craft guidance: useful, reported,
 * and never a release gate.
 */
const OBJECTIVE_CATEGORIES = new Set(["quality"]);
/** Rule-id prefixes that identify the owning Forge module when the category is objective. */
const MODULE_ROUTES = [
    {
        match: /contrast|focus|aria|semantic|alt-text|label|tabindex|heading/u,
        module: "accessibility",
        section: "Accessibility"
    },
    {
        match: /hidden-at-rest|overflow|broken-image|viewport|responsive|layout|clipped/u,
        module: "frontend",
        section: "Rendered interface"
    },
    {
        match: /font-loading|render-block|unsized|lazy|cls|lcp|payload/u,
        module: "performance",
        section: "Frontend performance"
    }
];
const SEVERITY_MAP = {
    error: "MEDIUM",
    warning: "LOW",
    advisory: "INFO"
};
/**
 * Translates one detector run. Nothing is invented: a result with no file evidence cannot become a
 * confident finding, and no detector output can produce a PASS — the detector proves defects, not
 * their absence.
 */
export function adaptDetectorRun(run, provenance) {
    const result = { findings: [], advisories: [], notVerified: [], superseded: [] };
    for (const raw of run.findings) {
        const approval = run.approved?.[raw.antipattern];
        const objective = isObjective(raw);
        const route = objective ? routeFor(raw.antipattern) : undefined;
        if (approval !== undefined) {
            result.superseded.push(build(raw, provenance, {
                status: "SUPERSEDED",
                module: route?.module ?? "ui",
                section: route?.section ?? "Visual craft",
                severity: "INFO",
                extraEvidence: [`User-approved design decision: ${approval}`],
                recommendation: "No action: this deviation was explicitly approved and is recorded as such."
            }));
            continue;
        }
        if (!objective || route === undefined) {
            result.advisories.push(build(raw, provenance, {
                status: "WARNING",
                module: "ui",
                section: "Visual craft advisory",
                severity: "INFO",
                extraEvidence: [
                    "Subjective craft guidance from the upstream design detector. Advisory only: it is " +
                        "reported for judgement and never blocks Verify or Ship."
                ],
                recommendation: raw.description
            }));
            continue;
        }
        // An objective rule still needs a concrete location to be a finding.
        if (typeof raw.file !== "string" || raw.file.length === 0) {
            result.notVerified.push(build(raw, provenance, {
                status: "NOT_VERIFIED",
                module: route.module,
                section: route.section,
                severity: "INFO",
                extraEvidence: ["The detector reported this rule without a file location."],
                recommendation: "Re-run the detector against a concrete target, or verify manually."
            }));
            continue;
        }
        result.findings.push(build(raw, provenance, {
            status: "FAIL",
            module: route.module,
            section: route.section,
            severity: SEVERITY_MAP[raw.severity ?? "warning"] ?? "LOW",
            recommendation: raw.description
        }));
    }
    for (const entry of run.unresolved ?? []) {
        result.notVerified.push(build({ antipattern: entry.antipattern, name: entry.antipattern, description: entry.reason }, provenance, {
            status: "NOT_VERIFIED",
            module: routeFor(entry.antipattern)?.module ?? "ui",
            section: routeFor(entry.antipattern)?.section ?? "Visual craft",
            severity: "INFO",
            extraEvidence: [`Unresolved without running the interface: ${entry.reason}`],
            recommendation: "Verify by rendering the interface, or record the limitation. Do not report this as passing."
        }));
    }
    return result;
}
function isObjective(raw) {
    if (raw.advisory === true)
        return false;
    if (raw.severity === "advisory")
        return false;
    return OBJECTIVE_CATEGORIES.has(raw.category ?? "");
}
function routeFor(ruleId) {
    return MODULE_ROUTES.find((route) => route.match.test(ruleId));
}
function build(raw, provenance, options) {
    const version = provenance.upstreamTag ?? provenance.upstreamCommit.slice(0, 12);
    const evidence = [
        `Upstream rule \`${raw.antipattern}\` (${provenance.provider} ${version}): ${raw.name}`,
        ...(options.extraEvidence ?? [])
    ];
    if (typeof raw.snippet === "string" && raw.snippet.length > 0)
        evidence.push(`Matched source: ${raw.snippet.slice(0, 200)}`);
    return {
        id: `FF-UI-UPSTREAM-${raw.antipattern.toUpperCase().replace(/[^A-Z0-9]+/gu, "-")}`,
        section: options.section,
        title: raw.name,
        severity: options.severity,
        // Static detection of a rendered concern is never high confidence on its own.
        confidence: options.status === "FAIL" ? "MEDIUM" : "LOW",
        status: options.status,
        location: typeof raw.file === "string" && raw.file.length > 0
            ? [
                {
                    path: raw.file,
                    ...(raw.line !== undefined && raw.line > 0 ? { line: raw.line } : {})
                }
            ]
            : [],
        evidence,
        impact: raw.description,
        recommendation: options.recommendation,
        safe_fix: false,
        safe_fix_classification: "approval-required",
        verification: [
            "Re-run the Forge UI audit and confirm the upstream rule no longer matches.",
            "Confirm the change preserves the established design system and accessibility requirements."
        ],
        standards: [`${provenance.provider}:${raw.antipattern}@${version}`],
        module: options.module,
        producer: "external-tool",
        evidence_type: "external-tool-output",
        analyzer_id: `upstream-detector:${provenance.provider}`,
        ...(options.status === "NOT_VERIFIED"
            ? {
                remaining_limitations: [
                    "Not settled by static analysis; rendering the interface is required."
                ]
            }
            : {})
    };
}
/**
 * Classifies whether an adapted result would ever be a release blocker.
 *
 * This is a predicate, not the enforcement point — nothing in the Ship gate calls it today, and the
 * "advisories cannot block Ship" property does not depend on it. That property holds structurally:
 * `adaptDetectorRun` builds every subjective craft result with `status: "WARNING"`, and the Ship
 * gate blocks only on `FAIL` and `BLOCKED` records. This helper exists so that claim is asserted
 * directly by tests, and so a future caller that wants to filter adapted results has one honest
 * definition to use rather than inventing its own.
 *
 * It returns `true` for every non-upstream finding, so wiring it in could only ever add blocking,
 * never remove it from Forge's own findings.
 */
export function blocksShip(finding) {
    if (finding.analyzer_id?.startsWith("upstream-detector:") !== true)
        return true;
    return finding.status === "FAIL" && finding.section !== "Visual craft advisory";
}
//# sourceMappingURL=upstream-detector.js.map