import assert from "node:assert/strict";
import test from "node:test";
import { adaptDetectorRun, blocksShip } from "../src/upstream-detector.js";
const provenance = {
    provider: "impeccable",
    upstreamTag: "skill-v4.0.2",
    upstreamCommit: "fc2e694afca1ac0cc384b4fe56bab3335fea7912"
};
/** Reads the first element and proves it exists, so neither the type checker nor the linter has to
 * guess. Indexed access is `T | undefined` under `noUncheckedIndexedAccess`, while an optional
 * chain on it reads as unnecessary to the lint rule; asserting once satisfies both. */
function first(values) {
    const [value] = values;
    assert.ok(value !== undefined, "expected at least one element");
    return value;
}
function run(overrides) {
    return { findings: [], ...overrides };
}
test("a subjective style rule becomes an advisory and never a finding", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "side-tab",
                name: "Side-tab accent border",
                description: "Thick coloured border on one side of a card.",
                category: "slop",
                file: "app/Card.tsx",
                line: 12
            }
        ]
    }), provenance);
    assert.equal(result.findings.length, 0);
    assert.equal(result.advisories.length, 1);
    assert.equal(first(result.advisories).severity, "INFO");
    assert.equal(first(result.advisories).section, "Visual craft advisory");
});
test("an explicitly advisory rule is never treated as objective", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "contrast-weak",
                name: "Weak contrast",
                description: "d",
                category: "quality",
                advisory: true,
                file: "a.css"
            }
        ]
    }), provenance);
    assert.equal(result.findings.length, 0);
    assert.equal(result.advisories.length, 1);
});
test("an accessibility rule with file evidence becomes an accessibility finding", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "contrast-insufficient",
                name: "Insufficient contrast",
                description: "Text does not meet the contrast minimum.",
                category: "quality",
                severity: "error",
                file: "app/styles.css",
                line: 40
            }
        ]
    }), provenance);
    assert.equal(result.findings.length, 1);
    const finding = first(result.findings);
    assert.equal(finding.module, "accessibility");
    assert.equal(finding.status, "FAIL");
    assert.deepEqual(finding.location, [{ path: "app/styles.css", line: 40 }]);
});
test("a concrete layout defect is routed to the frontend module", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "content-hidden-at-rest",
                name: "Content hidden at rest",
                description: "Text renders invisible.",
                category: "quality",
                file: "app/page.tsx"
            }
        ]
    }), provenance);
    assert.equal(first(result.findings).module, "frontend");
});
test("an objective rule with no location cannot become a confident finding", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "contrast-insufficient",
                name: "Insufficient contrast",
                description: "d",
                category: "quality",
                severity: "error"
            }
        ]
    }), provenance);
    assert.equal(result.findings.length, 0);
    assert.equal(result.notVerified.length, 1);
    assert.equal(first(result.notVerified).status, "NOT_VERIFIED");
});
test("a rule that needs a running interface is NOT_VERIFIED, never passing", () => {
    const result = adaptDetectorRun(run({ unresolved: [{ antipattern: "focus-visible", reason: "requires a rendered page" }] }), provenance);
    assert.equal(result.notVerified.length, 1);
    assert.equal(first(result.notVerified).status, "NOT_VERIFIED");
    assert.ok(first(result.notVerified).remaining_limitations !== undefined);
});
test("a user-approved deviation is superseded with the approval as evidence", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "overused-font",
                name: "Overused font",
                description: "d",
                category: "slop",
                file: "a.css"
            }
        ],
        approved: { "overused-font": "Brand system mandates Inter (DESIGN.md)" }
    }), provenance);
    assert.equal(result.superseded.length, 1);
    assert.equal(first(result.superseded).status, "SUPERSEDED");
    assert.ok(first(result.superseded).evidence.some((line) => line.includes("Brand system mandates")));
    assert.equal(result.advisories.length, 0);
});
test("no detector output can ever produce a PASS", () => {
    const result = adaptDetectorRun(run({
        findings: [
            { antipattern: "a", name: "A", description: "d", category: "quality", file: "a.css" },
            { antipattern: "b", name: "B", description: "d", category: "slop", file: "b.css" }
        ],
        unresolved: [{ antipattern: "c", reason: "needs rendering" }],
        approved: {}
    }), provenance);
    const all = [
        ...result.findings,
        ...result.advisories,
        ...result.notVerified,
        ...result.superseded
    ];
    assert.ok(all.length > 0);
    for (const finding of all)
        assert.notEqual(finding.status, "PASS");
});
test("every adapted result carries the upstream rule id and pinned version", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "contrast-insufficient",
                name: "N",
                description: "d",
                category: "quality",
                file: "a.css"
            }
        ]
    }), provenance);
    const finding = first(result.findings);
    const provenanceLine = first(finding.evidence);
    assert.ok(provenanceLine.includes("contrast-insufficient"));
    assert.ok(provenanceLine.includes("skill-v4.0.2"));
    assert.deepEqual(finding.standards, ["impeccable:contrast-insufficient@skill-v4.0.2"]);
    assert.equal(finding.producer, "external-tool");
    assert.equal(finding.analyzer_id, "upstream-detector:impeccable");
});
test("subjective advisories cannot block Ship, and Forge findings still can", () => {
    const result = adaptDetectorRun(run({
        findings: [
            { antipattern: "side-tab", name: "S", description: "d", category: "slop", file: "a.tsx" },
            {
                antipattern: "contrast-insufficient",
                name: "C",
                description: "d",
                category: "quality",
                severity: "error",
                file: "a.css"
            }
        ]
    }), provenance);
    assert.equal(blocksShip(first(result.advisories)), false);
    assert.equal(blocksShip(first(result.findings)), true);
    const forgeFinding = { status: "FAIL", section: "Authorization" };
    assert.equal(blocksShip(forgeFinding), true, "Forge findings are unaffected by this guard");
});
test("adapted findings are never marked safe to auto-apply", () => {
    const result = adaptDetectorRun(run({
        findings: [
            {
                antipattern: "contrast-insufficient",
                name: "N",
                description: "d",
                category: "quality",
                file: "a.css"
            }
        ]
    }), provenance);
    assert.equal(first(result.findings).safe_fix, false);
    assert.equal(first(result.findings).safe_fix_classification, "approval-required");
});
