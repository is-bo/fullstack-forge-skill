import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
    assertFindings(value.findings);
    return value;
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
        Array.isArray(candidate.residual_risk));
}
export function createReport(root, profile, findings, scope, execution = [], assumptions = [], residualRisk = [], scopeEvidence) {
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
        ...(scopeEvidence === undefined ? {} : { scope_evidence: scopeEvidence })
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
    const remediation = report.findings
        .filter((finding) => finding.status === "FAIL" || finding.status === "WARNING")
        .map((finding, index) => `${index + 1}. **${finding.severity} ${finding.id}** — ${finding.recommendation} (${finding.safe_fix ? "candidate safe fix" : "manual review or approval required"})`)
        .join("\n");
    const notRun = report.findings
        .filter((finding) => ["BLOCKED", "NOT_VERIFIED"].includes(finding.status))
        .map((finding) => `- ${finding.id}: ${finding.verification.join("; ")}`)
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

## Checks not run or not verified

${notRun || "- None recorded."}

## Assumptions

${assumptions}

## Residual risk

${residual}
`;
}
function renderFinding(finding) {
    const locations = finding.location
        .map((location) => `\`${location.path}${location.line === undefined ? "" : `:${location.line}`}\``)
        .join(", ");
    return `### ${finding.id}: ${finding.title}

- Section: ${finding.section}
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