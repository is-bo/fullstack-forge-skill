/**
 * Converts a bounded inventory limitation into evidence, never into a product defect or a pass.
 * The profile retains every signal collected before the limit was reached.
 */
export function inventoryLimitationFinding(profile, section) {
    const diagnostics = profile.inventory;
    if (diagnostics === undefined || diagnostics.status === "COMPLETE")
        return undefined;
    const contributors = diagnostics.largest_contributing_directories
        .slice(0, 5)
        .map((entry) => `${entry.path} (${entry.bytes} bytes read)`);
    return {
        id: "FF-INVENTORY-001",
        section,
        title: "Repository inspection is incomplete",
        severity: "HIGH",
        confidence: "HIGH",
        status: "NOT_VERIFIED",
        location: [{ path: ".forge/project-profile.json" }],
        evidence: [
            `status=${diagnostics.status}; reason=${diagnostics.reason ?? "bounded inventory incomplete"}; source=${diagnostics.source}`,
            `candidate_files=${diagnostics.candidate_files_discovered}; files_inspected=${diagnostics.files_inspected}; files_skipped=${diagnostics.files_skipped}; bytes_read=${diagnostics.bytes_read}; inspection_budget=${diagnostics.inspection_budget_bytes}`,
            `affected_modules=${diagnostics.affected_modules.join(", ") || "discovery"}`,
            `largest_contributors=${contributors.join(", ") || "none recorded"}`
        ],
        impact: "Required repository evidence may be missing, so affected criteria and release gates cannot be represented as passed.",
        recommendation: diagnostics.suggested_actions.join(" "),
        safe_fix: false,
        verification: [
            "Review excluded and skipped paths in .forge/project-profile.json",
            "Adjust .forgeignore, --exclude, the selected root, or the explicit budget and rerun the command"
        ],
        standards: ["Fullstack Forge evidence protocol"]
    };
}
