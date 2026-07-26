import { readFile } from "node:fs/promises";
import { resolveInside, runFile, sha256, workingTreeRevision } from "./utils.js";
export async function bindAgentFindings(root, findings) {
    const currentRevision = await workingTreeRevision(root);
    const git = await runFile("git", ["rev-parse", "--is-inside-work-tree"], root, 10_000);
    const isGit = git.exitCode === 0 && git.stdout.trim() === "true";
    const bound = [];
    for (const finding of findings) {
        const candidate = structuredClone(finding);
        const binding = await bindOne(root, candidate, currentRevision, isGit);
        candidate.binding_state = binding.state;
        if (binding.state === "STALE") {
            candidate.status = "NOT_VERIFIED";
            candidate.evidence.push(binding.reason);
            candidate.remaining_limitations = [
                ...(candidate.remaining_limitations ?? []),
                "The cited content changed after review; retest against the current working tree."
            ];
        }
        bound.push(candidate);
    }
    return bound;
}
async function bindOne(root, finding, currentRevision, isGit) {
    const snapshots = finding.evidence_snapshot ?? [];
    const exact = finding.revision === currentRevision;
    if (!isGit) {
        if (!exact)
            throw new Error(`Finding ${finding.id} revision '${finding.revision ?? "missing"}' does not match non-Git content revision '${currentRevision}'.`);
        await verifySnapshots(root, snapshots, undefined, true);
        return { state: currentRevision.startsWith("tree:") ? "EXACT" : "EXACT_DIRTY", reason: "" };
    }
    if (exact) {
        await verifySnapshots(root, snapshots, undefined, true);
        return {
            state: currentRevision.includes(":dirty") ? "EXACT_DIRTY" : "EXACT",
            reason: ""
        };
    }
    const requested = gitCommitFromRevision(finding.revision);
    if (requested === undefined)
        throw new Error(`Finding ${finding.id} has malformed Git revision '${finding.revision ?? "missing"}'.`);
    const exists = await runFile("git", ["cat-file", "-e", `${requested}^{commit}`], root, 10_000);
    if (exists.exitCode !== 0)
        throw new Error(`Finding ${finding.id} references nonexistent Git revision '${requested}'.`);
    const snapshotState = await verifySnapshots(root, snapshots, requested, false);
    if (snapshotState === "STALE")
        return {
            state: "STALE",
            reason: `Finding ${finding.id} was reviewed at ${requested}, but at least one cited file or excerpt changed in the current tree.`
        };
    return {
        state: "REBASED",
        reason: `Finding ${finding.id} originated at ${requested}; every cited snapshot is unchanged in the current tree.`
    };
}
function gitCommitFromRevision(revision) {
    if (revision === undefined)
        return undefined;
    const raw = /^(?:git:)?([a-f0-9]{7,40})(?::.*)?$/u.exec(revision)?.[1];
    return raw;
}
async function verifySnapshots(root, snapshots, historicalRevision, exact) {
    let stale = false;
    for (const snapshot of snapshots) {
        const current = await readFile(resolveInside(root, snapshot.path), "utf8");
        const currentHash = sha256(current);
        if (historicalRevision === undefined) {
            if (currentHash !== snapshot.sha256)
                throw new Error(`Evidence snapshot hash mismatch for '${snapshot.path}' at the exact revision.`);
            verifyExcerpt(snapshot, current, "current");
            continue;
        }
        const historical = await runFile("git", ["show", `${historicalRevision}:${snapshot.path}`], root, 10_000);
        if (historical.exitCode !== 0)
            throw new Error(`Evidence snapshot '${snapshot.path}' does not exist at revision '${historicalRevision}'.`);
        if (sha256(historical.stdout) !== snapshot.sha256)
            throw new Error(`Evidence snapshot hash for '${snapshot.path}' does not match revision '${historicalRevision}'.`);
        verifyExcerpt(snapshot, historical.stdout, historicalRevision);
        if (currentHash !== snapshot.sha256)
            stale = true;
        else
            verifyExcerpt(snapshot, current, "current");
    }
    void exact;
    return stale ? "STALE" : "CURRENT";
}
function verifyExcerpt(snapshot, content, label) {
    if (snapshot.excerpt_hash === undefined || snapshot.line === undefined)
        return;
    const line = content.split(/\r?\n/u)[snapshot.line - 1] ?? "";
    if (sha256(line) !== snapshot.excerpt_hash)
        throw new Error(`Evidence excerpt mismatch for '${snapshot.path}:${snapshot.line}' in ${label}.`);
}
export function reconcileFindings(previous, incoming) {
    const historical = previous.map((finding) => structuredClone(finding));
    const current = incoming.map((finding) => structuredClone(finding));
    for (const finding of current) {
        if (finding.status !== "FAIL" ||
            finding.binding_state === "STALE" ||
            finding.binding_state === "INVALID" ||
            !["agent-reviewed-source", "agent-rendered-review", "agent-runtime-verification"].includes(finding.producer ?? ""))
            continue;
        for (const prior of historical) {
            if (prior.status !== "NOT_APPLICABLE" ||
                prior.section !== finding.section ||
                !sameScope(prior, finding))
                continue;
            const priorId = prior.instance_id ?? prior.id;
            const nextId = finding.instance_id ?? finding.id;
            prior.status = "SUPERSEDED";
            prior.superseded_by = nextId;
            prior.retraction_reason =
                "Stronger revision-bound agent evidence established that the risk is applicable in the same scope.";
            finding.supersedes = [...new Set([...(finding.supersedes ?? []), priorId])];
        }
    }
    return [...historical, ...current];
}
function sameScope(left, right) {
    if (left.location.length === 0)
        return true;
    const rightPaths = new Set(right.location.map((location) => location.path));
    return (left.location.some((location) => rightPaths.has(location.path)) ||
        left.section === right.section);
}
//# sourceMappingURL=agent-findings.js.map