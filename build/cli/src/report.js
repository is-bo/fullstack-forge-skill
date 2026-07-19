import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GATE_EVIDENCE_TYPES } from "./types.js";
import { assertFindings } from "./finding.js";
import { assertNoSymlinkPath, utcNow } from "./utils.js";
export async function writeReport(report, outputDirectory) {
    assertFindings(report.findings);
    const directory = outputDirectory ?? join(report.root, ".forge");
    await assertNoSymlinkPath(report.root, directory);
    await mkdir(directory, { recursive: true });
    const jsonPath = join(directory, "report.json");
    const markdownPath = join(directory, "report.md");
    await assertNoSymlinkPath(report.root, jsonPath);
    await assertNoSymlinkPath(report.root, markdownPath);
    assertGateEvidence(report.gate_evidence);
    assertAnalyzerCoverage(report.analyzer_coverage);
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, renderMarkdown(report), "utf8");
    return [jsonPath, markdownPath];
}
export async function readReport(root, path) {
    await assertNoSymlinkPath(root, path);
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!isAuditReport(value)) {
        throw new Error("Unsupported or invalid Fullstack Forge report");
    }
    const migrated = {
        ...value,
        gate_evidence: Array.isArray(value.gate_evidence) ? value.gate_evidence : [],
        analyzer_coverage: Array.isArray(value.analyzer_coverage) ? value.analyzer_coverage : []
    };
    assertFindings(migrated.findings);
    assertGateEvidence(migrated.gate_evidence);
    assertAnalyzerCoverage(migrated.analyzer_coverage);
    return migrated;
}
function isAuditReport(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schema_version === 1 &&
        typeof candidate.generated_at === "string" &&
        typeof candidate.root === "string" &&
        typeof candidate.scope === "string" &&
        typeof candidate.profile === "object" &&
        candidate.profile !== null &&
        Array.isArray(candidate.findings) &&
        Array.isArray(candidate.execution) &&
        Array.isArray(candidate.assumptions) &&
        Array.isArray(candidate.residual_risk) &&
        (candidate.gate_evidence === undefined || Array.isArray(candidate.gate_evidence)) &&
        (candidate.analyzer_coverage === undefined || Array.isArray(candidate.analyzer_coverage)));
}
export function createReport(root, profile, findings, scope, execution = [], assumptions = [], residualRisk = [], scopeEvidence, gateEvidence = [], analyzerCoverage = [], revision) {
    return {
        schema_version: 1,
        generated_at: utcNow(),
        root,
        scope,
        profile,
        findings: sortFindings(deduplicateFindings(findings)),
        execution,
        assumptions,
        residual_risk: residualRisk,
        ...(scopeEvidence === undefined ? {} : { scope_evidence: scopeEvidence }),
        gate_evidence: structuredClone(gateEvidence),
        analyzer_coverage: structuredClone(analyzerCoverage),
        ...(revision === undefined ? {} : { revision })
    };
}
export function renderMarkdown(report) {
    const counts = new Map();
    for (const finding of report.findings)
        counts.set(finding.status, (counts.get(finding.status) ?? 0) + 1);
    const summary = [...counts.entries()].map(([status, count]) => `- ${status}: ${count}`).join("\n") ||
        "- No findings were recorded.";
    const findings = report.findings.map(renderFinding).join("\n\n") ||
        "No findings were recorded. This is not evidence of a pass.";
    const execution = report.execution
        .map((record) => {
        const timing = [
            record.started_at === undefined ? undefined : `started ${record.started_at}`,
            record.duration_ms === undefined ? undefined : `${record.duration_ms} ms`
        ]
            .filter((value) => value !== undefined)
            .join(", ");
        return `- \`${record.command.join(" ")}\` → exit ${record.exitCode}${timing.length === 0 ? "" : ` (${timing})`}: ${compact(record.output)}`;
    })
        .join("\n");
    const assumptions = report.assumptions.map((value) => `- ${value}`).join("\n") || "- None recorded.";
    const residual = report.residual_risk.map((value) => `- ${value}`).join("\n") || "- None recorded.";
    const typedEvidence = report.gate_evidence.map(renderGateEvidence).join("\n") || "- No typed gate evidence recorded.";
    const analyzerCoverage = report.analyzer_coverage.map(renderAnalyzerCoverage).join("\n") ||
        "- No analyzer coverage records were applicable.";
    const remediation = report.findings
        .filter((finding) => finding.status === "FAIL" || finding.status === "WARNING")
        .map((finding, index) => `${index + 1}. **${finding.severity} ${finding.instance_id ?? finding.id}** — ${finding.recommendation} (${finding.safe_fix ? "candidate safe fix" : "manual review or approval required"})`)
        .join("\n");
    const notRun = report.findings
        .filter((finding) => ["BLOCKED", "NOT_VERIFIED"].includes(finding.status))
        .map((finding) => `- ${finding.instance_id ?? finding.id}: ${finding.verification.join("; ")}`)
        .join("\n");
    const changedScope = report.scope_evidence === undefined
        ? "- Not a Git-aware changed-scope report."
        : `- Base: \`${report.scope_evidence.base_ref}\` (${report.scope_evidence.base_commit})
- Merge base: \`${report.scope_evidence.merge_base}\`
- Changed paths: ${report.scope_evidence.changed_files.length}
- Included paths after impact expansion: ${report.scope_evidence.included_files.length}
- Affected applications: ${report.scope_evidence.affected_applications.map((application) => application.name).join(", ") || "none"}

${report.scope_evidence.included_files.map((item) => `- \`${item.path}\`: ${item.reasons.join("; ")}`).join("\n")}`;
    return `# Fullstack Forge report

- Generated: ${report.generated_at}
- Scope: ${report.scope}
- Root: \`${report.root}\`
- Revision: \`${report.revision ?? "legacy/unrecorded"}\`

## Status summary

${summary}

## Detected profile

${report.profile.detections.map((detection) => `- **${detection.name}** (${detection.confidence}): ${detection.evidence.join(", ")}`).join("\n") || "- No technologies detected."}

## Changed-scope evidence

${changedScope}

## Findings

${findings}

## Prioritized remediation plan

${remediation || "- No FAIL or WARNING finding requires remediation in this report."}

## Execution ledger

${execution || "- No project command was executed."}

## Typed gate evidence

${typedEvidence}

## Analyzer coverage and missing adapters

${analyzerCoverage}

## Checks not run or not verified

${notRun || "- None recorded."}

## Assumptions

${assumptions}

## Residual risk

${residual}
`;
}
function renderGateEvidence(evidence) {
    return `- **${evidence.evidence_type} / ${evidence.status}** — producer \`${evidence.producer}\`, revision \`${evidence.revision}\`, scope ${evidence.scope.map((path) => `\`${path}\``).join(", ") || "none"}; absence proves success: ${evidence.absence_proves_success ? "yes" : "no"}; relevant instances: ${evidence.relevant_instance_ids.join(", ") || "none"}; limitations: ${evidence.limitations.join("; ")}`;
}
function renderAnalyzerCoverage(coverage) {
    return `- **${coverage.status}** module=${coverage.module}; language=${coverage.language}; framework=${coverage.framework}; coverage=${coverage.coverage}; analyzer=${coverage.analyzer_id}; required adapter=${coverage.required_adapter ?? "none"}; supported shapes=${coverage.supported_shapes.join(", ") || "none"}; unsupported shapes=${coverage.unsupported_shapes.join(", ") || "none"}`;
}
function assertGateEvidence(values) {
    const errors = [];
    for (const [index, value] of values.entries()) {
        if (!GATE_EVIDENCE_TYPES.includes(value.evidence_type))
            errors.push(`[${index}] invalid evidence_type`);
        if (typeof value.producer !== "string" ||
            value.producer.length === 0 ||
            typeof value.timestamp !== "string" ||
            value.timestamp.length === 0 ||
            !Number.isFinite(Date.parse(value.timestamp)) ||
            typeof value.revision !== "string" ||
            value.revision.length === 0)
            errors.push(`[${index}] producer, timestamp, and revision are required`);
        if (!Array.isArray(value.scope) ||
            !value.scope.every((path) => typeof path === "string" && isSafeReportPath(path)) ||
            !Array.isArray(value.relevant_instance_ids) ||
            !value.relevant_instance_ids.every((id) => typeof id === "string" && /^FF-[A-Z0-9-]+-[0-9]{3,}(?::[a-f0-9]{8,})?$/u.test(id)))
            errors.push(`[${index}] scope and relevant_instance_ids must be arrays`);
        if (!Array.isArray(value.limitations) ||
            value.limitations.length === 0 ||
            !value.limitations.every((item) => typeof item === "string" && item.length > 0))
            errors.push(`[${index}] limitations must be a non-empty array`);
        if (!["PASS", "FAIL", "BLOCKED", "NOT_VERIFIED", "NOT_APPLICABLE"].includes(value.status))
            errors.push(`[${index}] invalid status`);
        if (typeof value.absence_proves_success !== "boolean")
            errors.push(`[${index}] absence_proves_success must be boolean`);
    }
    if (errors.length > 0)
        throw new Error(`Invalid typed gate evidence:\n${errors.join("\n")}`);
}
function assertAnalyzerCoverage(values) {
    const errors = [];
    for (const [index, value] of values.entries()) {
        if (!["PASS", "NOT_VERIFIED"].includes(value.status))
            errors.push(`[${index}] invalid analyzer coverage status`);
        if (!["executable", "partial", "none"].includes(value.coverage))
            errors.push(`[${index}] invalid analyzer coverage level`);
        for (const field of ["module", "language", "framework", "analyzer_id"])
            if (typeof value[field] !== "string" || value[field].length === 0)
                errors.push(`[${index}] ${field} must be a non-empty string`);
        for (const field of ["supported_shapes", "unsupported_shapes"])
            if (!Array.isArray(value[field]) ||
                !value[field].every((shape) => typeof shape === "string" && shape.length > 0))
                errors.push(`[${index}] ${field} must be a string array`);
        if (value.coverage === "executable"
            ? value.status !== "PASS" || value.required_adapter !== undefined
            : value.status !== "NOT_VERIFIED" ||
                typeof value.required_adapter !== "string" ||
                value.required_adapter.length === 0)
            errors.push(`[${index}] analyzer coverage status and required adapter are inconsistent`);
    }
    if (errors.length > 0)
        throw new Error(`Invalid analyzer coverage:\n${errors.join("\n")}`);
}
function isSafeReportPath(value) {
    return (value.length > 0 &&
        !value.includes("\0") &&
        !/^(?:[A-Za-z]:|[\\/]{1,2})/u.test(value) &&
        !value
            .split(/[\\/]+/u)
            .some((part) => part === "" || part === "." || part === ".." || part.includes(":")));
}
function renderFinding(finding) {
    const locations = finding.location
        .map((location) => `\`${location.path}${location.line === undefined ? "" : `:${location.line}`}\``)
        .join(", ");
    return `### ${finding.id}: ${finding.title}

- Section: ${finding.section}
- Rule / instance: ${finding.id} / ${finding.instance_id ?? "legacy report (no instance ID)"}
- Severity / confidence / status: **${finding.severity} / ${finding.confidence} / ${finding.status}**
- Location: ${locations || "No code location"}
- Evidence: ${finding.evidence.join("; ")}
- Impact: ${finding.impact}
- Recommendation: ${finding.recommendation}
- Safe automatic fix: ${finding.safe_fix ? "yes" : "no"}
- Verification: ${finding.verification.join("; ")}
- Standards: ${finding.standards.join(", ") || "None"}`;
}
function deduplicateFindings(findings) {
    const byKey = new Map();
    for (const finding of findings) {
        // Machine-readable findings preserve instance-level state. A finding carrying an
        // instance identity merges only with the same instance; legacy
        // findings without one keep the previous section/title/recommendation key.
        const key = finding.instance_id ??
            `${finding.section}\u0000${finding.title}\u0000${finding.recommendation}`;
        const current = byKey.get(key);
        if (current === undefined) {
            byKey.set(key, structuredClone(finding));
            continue;
        }
        current.location = unique([...current.location, ...finding.location], (location) => `${location.path}:${location.line ?? ""}`);
        current.evidence = [...new Set([...current.evidence, ...finding.evidence])];
        current.verification = [...new Set([...current.verification, ...finding.verification])];
        current.standards = [...new Set([...current.standards, ...finding.standards])];
    }
    return [...byKey.values()];
}
function sortFindings(findings) {
    const severity = new Map(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((value, index) => [value, index]));
    const confidence = new Map(["HIGH", "MEDIUM", "LOW"].map((value, index) => [value, index]));
    return findings.sort((a, b) => (severity.get(a.severity) ?? 99) - (severity.get(b.severity) ?? 99) ||
        (confidence.get(a.confidence) ?? 99) - (confidence.get(b.confidence) ?? 99) ||
        a.id.localeCompare(b.id));
}
function unique(values, key) {
    const seen = new Set();
    return values.filter((value) => {
        const candidate = key(value);
        if (seen.has(candidate))
            return false;
        seen.add(candidate);
        return true;
    });
}
function compact(value) {
    const compacted = value.replace(/\s+/gu, " ").trim();
    return compacted.length > 240 ? `${compacted.slice(0, 237)}...` : compacted || "no output";
}
//# sourceMappingURL=report.js.map