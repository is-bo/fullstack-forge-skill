import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import ts from "typescript";
import { runNamedAnalyzer } from "./analyzers.js";
import { detectProjectCommands } from "./discovery.js";
import { readReport, writeReport, type AuditReport, type ExecutionRecord } from "./report.js";
import type { Finding } from "./types.js";
import {
  assertNoSymlinkPath,
  assertSafeRelative,
  canonicalDirectory,
  resolveInside,
  runFile,
  sha256,
  utcNow
} from "./utils.js";

export type FixRisk = "safe" | "risky";

export type FixRegistryEntry = {
  fix_id: string;
  supported_finding_pattern: string;
  section: string;
  description: string;
  risk: FixRisk;
  preconditions: string[];
  affected_files: string;
  expected_original_state: string;
  planned_edits: string;
  verification: string;
  rollback: string;
};

export type FixOperation = {
  fix_id: string;
  finding_id: string;
  section: string;
  risk: FixRisk;
  path: string;
  expected_sha256: string;
  resulting_sha256: string;
  description: string;
  verification: string;
  rollback: string;
};

export type FixResult = {
  status: "PASS" | "BLOCKED" | "FAIL";
  dry_run: boolean;
  operations: FixOperation[];
  changed_files: string[];
  blocked_findings: Array<{ finding_id: string; reason: string }>;
  execution: ExecutionRecord[];
  report_paths: string[];
};

type PlannedWrite = FixOperation & {
  original: string;
  next: string;
  analyzerId: string;
  absenceProvesResolution: boolean;
};

type FixDefinition = FixRegistryEntry & {
  matches: (finding: Finding) => boolean;
  plan: (finding: Finding, path: string, content: string) => string;
};

const SAFE_DEFINITIONS: FixDefinition[] = [
  {
    fix_id: "FF-FIX-ENV-PLACEHOLDER-001",
    supported_finding_pattern: "^FF-ENV-TEMPLATE-001$",
    section: "security",
    description:
      "Replace actual-looking values in environment examples with explicit placeholders.",
    risk: "safe",
    preconditions: [
      "The finding was emitted by structured-config-safety.",
      "The target is an environment example, sample, template, or defaults file.",
      "The exact post-audit file hash still matches."
    ],
    affected_files: "Only evidence_snapshot paths on the confirmed finding.",
    expected_original_state:
      "A KEY=value line at the finding location contains a non-placeholder credential-like value.",
    planned_edits: "Replace only the value token with <REPLACE_WITH_SECRET>.",
    verification:
      "Reparse and re-run structured-config-safety; provider-side rotation remains manual.",
    rollback:
      "Restore the exact original line from version control; the secret value is not copied into a rollback artifact.",
    matches: (finding) => finding.id === "FF-ENV-TEMPLATE-001",
    plan: planEnvironmentPlaceholder
  },
  {
    fix_id: "FF-FIX-BLANK-REL-001",
    supported_finding_pattern: "^FF-FRONTEND-BLANK-001$",
    section: "frontend",
    description: "Add noopener and noreferrer to a proven JSX target=_blank link.",
    risk: "safe",
    preconditions: [
      "The target parses as JavaScript/TypeScript JSX.",
      "The finding location still identifies a target=_blank anchor.",
      "The exact post-audit file hash still matches."
    ],
    affected_files: "Only JSX files named in evidence_snapshot.",
    expected_original_state:
      "A literal target=_blank anchor lacks one or both required rel tokens.",
    planned_edits: "Insert or minimally extend the literal rel attribute.",
    verification: "Reparse JSX and re-run js-ts-frontend-safety.",
    rollback: "Remove the inserted rel attribute or restore its exact prior literal value.",
    matches: (finding) => finding.id === "FF-FRONTEND-BLANK-001",
    plan: planBlankRel
  },
  {
    fix_id: "FF-FIX-VERCEL-NOSNIFF-001",
    supported_finding_pattern: "^FF-DEPLOY-HEADER-001$",
    section: "deployment",
    description: "Add X-Content-Type-Options: nosniff to an existing global Vercel header rule.",
    risk: "safe",
    preconditions: [
      "vercel.json parses as JSON.",
      "An existing global headers rule is present.",
      "No X-Content-Type-Options entry already exists.",
      "The exact post-audit file hash still matches."
    ],
    affected_files: "Only the confirmed vercel.json evidence path.",
    expected_original_state:
      "The existing global rule has a headers array without X-Content-Type-Options.",
    planned_edits:
      "Append { key: X-Content-Type-Options, value: nosniff } and serialize deterministically.",
    verification: "Parse vercel.json and re-run structured-config-safety.",
    rollback:
      "Remove the exact appended header object or restore the original file from version control.",
    matches: (finding) => finding.id === "FF-DEPLOY-HEADER-001",
    plan: planVercelNosniff
  }
];

const RISKY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^FF-(?:AUTHZ|TENANT)-/u,
    reason:
      "Authorization and tenant semantics require an explicitly authorized risky-change mechanism."
  },
  {
    pattern: /^FF-UPLOAD-/u,
    reason:
      "Upload limits, type policy, quarantine, and scanner behavior require existing product policy or explicit approval."
  },
  {
    pattern: /^FF-(?:AI|PAY|INTEGRATION)-/u,
    reason: "AI, financial, entitlement, and integration side effects are approval-bound."
  }
];

export const FIX_REGISTRY: readonly FixRegistryEntry[] = [
  ...SAFE_DEFINITIONS.map(publicRegistryEntry),
  {
    fix_id: "FF-FIX-RISKY-BOUNDARY-001",
    supported_finding_pattern: "^FF-(AUTHZ|TENANT|UPLOAD|AI|PAY|INTEGRATION)-",
    section: "multiple",
    description:
      "Approval-bound product, identity, tenant, upload, AI, payment, or integration change.",
    risk: "risky",
    preconditions: ["A separate risky-change mechanism must be explicit and authorized."],
    affected_files: "Not planned in safe mode.",
    expected_original_state: "Confirmed high-risk finding evidence.",
    planned_edits: "None; safe mode refuses the mutation.",
    verification: "Behavior-level negative tests and operator evidence are required.",
    rollback: "Defined only after a concrete risky change is authorized."
  }
];

export async function executeFixes(
  rootInput: string,
  section: string,
  options: { dryRun: boolean; severity?: string; allowRun?: boolean }
): Promise<FixResult> {
  const root = await canonicalDirectory(rootInput);
  const reportPath = join(root, ".forge", "report.json");
  await assertNoSymlinkPath(root, reportPath);
  const report = await readReport(root, reportPath);
  if ((await canonicalDirectory(report.root)) !== root)
    throw new Error("The previous report root does not match the selected repository root.");
  const severity = options.severity?.toUpperCase();
  if (severity !== undefined && !["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(severity))
    throw new Error(`Unknown severity '${options.severity}'.`);
  const scoped = report.findings.filter(
    (finding) =>
      (section === "all" || finding.section === section) &&
      ["FAIL", "WARNING", "BLOCKED"].includes(finding.status) &&
      (severity === undefined || finding.severity === severity)
  );
  const planned: PlannedWrite[] = [];
  const blocked: Array<{ finding_id: string; reason: string }> = [];
  for (const finding of scoped) {
    const definition = SAFE_DEFINITIONS.find((candidate) => candidate.matches(finding));
    if (definition === undefined) {
      const risky = RISKY_PATTERNS.find((candidate) => candidate.pattern.test(finding.id));
      if (risky !== undefined || finding.safe_fix === false) {
        blocked.push({
          finding_id: finding.id,
          reason:
            risky?.reason ??
            "No bounded safe registry entry supports this finding; the finding remains approval-bound."
        });
      }
      continue;
    }
    if (!finding.safe_fix) {
      blocked.push({
        finding_id: finding.id,
        reason: "The confirmed finding is not marked safe-fix eligible."
      });
      continue;
    }
    if (finding.analyzer_id === undefined || finding.evidence_snapshot === undefined) {
      blocked.push({
        finding_id: finding.id,
        reason: "The finding lacks a trusted analyzer ID or evidence snapshot."
      });
      continue;
    }
    const byPath = new Map<string, string>();
    for (const snapshot of finding.evidence_snapshot) {
      assertSafeRelative(snapshot.path);
      const current = byPath.get(snapshot.path);
      if (current !== undefined && current !== snapshot.sha256)
        throw new Error(`Finding ${finding.id} contains inconsistent hashes for ${snapshot.path}.`);
      byPath.set(snapshot.path, snapshot.sha256);
    }
    for (const [path, expectedHash] of byPath) {
      const target = resolveInside(root, path);
      await assertNoSymlinkPath(root, target);
      const original = await readFile(target, "utf8");
      if (sha256(original) !== expectedHash) {
        blocked.push({
          finding_id: finding.id,
          reason: `${path} changed after audit; expected ${expectedHash} and refused to overwrite it.`
        });
        continue;
      }
      const next = definition.plan(finding, path, original);
      if (next === original) {
        blocked.push({
          finding_id: finding.id,
          reason: `${path} no longer satisfies the exact fix preconditions.`
        });
        continue;
      }
      const action = finding.verification_plan?.actions.find(
        (candidate) => candidate.type === "analyzer" && candidate.finding_id === finding.id
      );
      planned.push({
        fix_id: definition.fix_id,
        finding_id: finding.id,
        section: finding.section,
        risk: "safe",
        path,
        expected_sha256: expectedHash,
        resulting_sha256: sha256(next),
        description: definition.planned_edits,
        verification: definition.verification,
        rollback: definition.rollback,
        original,
        next,
        analyzerId: finding.analyzer_id,
        absenceProvesResolution: action?.type === "analyzer" && action.absence_proves_resolution
      });
    }
  }

  if (options.dryRun) {
    const idempotent =
      planned.length === 0 && blocked.length === 0 && hasPreviouslyResolvedSafeFix(report, section);
    return {
      status:
        blocked.length > 0 ? "BLOCKED" : planned.length > 0 || idempotent ? "PASS" : "BLOCKED",
      dry_run: true,
      operations: planned.map(publicOperation),
      changed_files: [],
      blocked_findings: blocked,
      execution: [],
      report_paths: []
    };
  }

  const written: PlannedWrite[] = [];
  try {
    for (const operation of planned) {
      await writeIfUnchanged(root, operation);
      written.push(operation);
    }
    await verifyAppliedFixes(root, written);
  } catch (error) {
    await rollbackWrites(root, written);
    throw error;
  }

  const execution = options.allowRun ? await runAuthorizedRegression(root) : [];
  const regressionFailure = execution.find((record) => record.exitCode !== 0);
  if (regressionFailure !== undefined) {
    await rollbackWrites(root, written);
    for (const finding of report.findings) {
      if (written.some((operation) => operation.finding_id === finding.id))
        finding.evidence.push(
          `${utcNow()}: automatic fix was rolled back because the authorized project regression command exited ${regressionFailure.exitCode}.`
        );
    }
    report.execution.push(...execution);
    report.generated_at = utcNow();
    report.scope = `${report.scope}; bounded safe fix rolled back`;
    const reportPaths = await writeReport(report);
    return {
      status: "FAIL",
      dry_run: false,
      operations: [],
      changed_files: [],
      blocked_findings: blocked,
      execution,
      report_paths: reportPaths
    };
  }

  updateReportAfterFix(report, written, blocked);
  report.execution.push(...execution);
  const reportPaths = written.length === 0 && blocked.length === 0 ? [] : await writeReport(report);
  const idempotent =
    written.length === 0 && blocked.length === 0 && hasPreviouslyResolvedSafeFix(report, section);
  return {
    status: blocked.length > 0 ? "BLOCKED" : written.length > 0 || idempotent ? "PASS" : "BLOCKED",
    dry_run: false,
    operations: written.map(publicOperation),
    changed_files: [...new Set(written.map((operation) => operation.path))].sort(),
    blocked_findings: blocked,
    execution,
    report_paths: reportPaths
  };
}

async function runAuthorizedRegression(root: string): Promise<ExecutionRecord[]> {
  const test = (await detectProjectCommands(root)).find((command) => command.name === "test");
  if (test === undefined) return [];
  const started = Date.now();
  const startedAt = utcNow();
  const result = await runFile(test.executable, test.args, root, 10 * 60_000);
  return [
    {
      command: [test.executable, ...test.args],
      exitCode: result.exitCode,
      output: `${result.stdout}\n${result.stderr}`.trim(),
      started_at: startedAt,
      duration_ms: Date.now() - started
    }
  ];
}

function hasPreviouslyResolvedSafeFix(report: AuditReport, section: string): boolean {
  return report.findings.some(
    (finding) =>
      (section === "all" || finding.section === section) &&
      SAFE_DEFINITIONS.some((definition) => definition.matches(finding)) &&
      ["PASS", "NOT_VERIFIED"].includes(finding.status) &&
      finding.evidence.some((item) => item.includes("applied FF-FIX-"))
  );
}

function planEnvironmentPlaceholder(finding: Finding, path: string, content: string): string {
  if (!/(?:^|\/)\.env\.(?:example|sample|template|defaults)$/iu.test(path))
    throw new Error(`Refusing environment placeholder fix outside a supported template: ${path}`);
  const lines = content.split(/(\r?\n)/u);
  const targetLines = new Set(
    finding.location
      .filter((location) => location.path === path)
      .flatMap((location) => location.line ?? [])
  );
  let lineNumber = 1;
  let changed = false;
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index] ?? "";
    if (targetLines.has(lineNumber)) {
      const match = /^(\s*[A-Z][A-Z0-9_]*\s*=\s*)(.*)$/u.exec(line);
      if (match === null || !looksLikeCredential(match[2] ?? ""))
        throw new Error(`Environment fix precondition failed at ${path}:${lineNumber}.`);
      lines[index] = `${match[1]}<REPLACE_WITH_SECRET>`;
      changed = true;
    }
    lineNumber += 1;
  }
  if (!changed) throw new Error(`No confirmed environment finding location was found in ${path}.`);
  return lines.join("");
}

function planBlankRel(finding: Finding, path: string, content: string): string {
  if (![".jsx", ".tsx"].includes(extname(path).toLowerCase()))
    throw new Error(`The target=_blank safe fix supports JSX/TSX only: ${path}`);
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const diagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  if (diagnostics.length > 0) throw new Error(`Refusing to transform invalid JSX: ${path}`);
  const targetLines = new Set(
    finding.location
      .filter((location) => location.path === path)
      .flatMap((location) => location.line ?? [])
  );
  const edits: Array<{ start: number; end: number; value: string }> = [];
  walk(sourceFile, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    if (node.tagName.getText(sourceFile).toLowerCase() !== "a") return;
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    if (!targetLines.has(line)) return;
    const target = jsxLiteral(node, "target");
    if (target?.value.toLowerCase() !== "_blank")
      throw new Error(`JSX fix precondition failed at ${path}:${line}.`);
    const rel = jsxLiteral(node, "rel");
    if (rel === undefined) {
      const insert = node.attributes.end;
      edits.push({ start: insert, end: insert, value: ' rel="noopener noreferrer"' });
      return;
    }
    const tokens = new Set(rel.value.toLowerCase().split(/\s+/u).filter(Boolean));
    tokens.add("noopener");
    tokens.add("noreferrer");
    edits.push({ start: rel.start, end: rel.end, value: [...tokens].join(" ") });
  });
  if (edits.length === 0)
    throw new Error(`No confirmed target=_blank JSX location was found in ${path}.`);
  return applyTextEdits(content, edits);
}

function planVercelNosniff(_finding: Finding, path: string, content: string): string {
  if (!path.toLowerCase().endsWith("vercel.json"))
    throw new Error(`The secure-header fix supports vercel.json only: ${path}`);
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.headers))
    throw new Error(`vercel.json has no structured headers array: ${path}`);
  let changed = false;
  for (const rule of parsed.headers) {
    if (!isRecord(rule) || typeof rule.source !== "string" || !Array.isArray(rule.headers))
      continue;
    if (!["/(.*)", "/(.*)?", "/*", "/:path*"].includes(rule.source)) continue;
    const present = rule.headers.some(
      (header) =>
        isRecord(header) &&
        typeof header.key === "string" &&
        header.key.toLowerCase() === "x-content-type-options"
    );
    if (!present) {
      rule.headers.push({ key: "X-Content-Type-Options", value: "nosniff" });
      changed = true;
    }
  }
  if (!changed) throw new Error(`No eligible global Vercel header rule remains in ${path}.`);
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  return `${JSON.stringify(parsed, null, detectIndent(content)).replaceAll("\n", newline)}${newline}`;
}

async function writeIfUnchanged(root: string, operation: PlannedWrite): Promise<void> {
  const target = resolveInside(root, operation.path);
  await assertNoSymlinkPath(root, target);
  const info = await lstat(target);
  if (info.isSymbolicLink() || !info.isFile())
    throw new Error(`Refusing non-regular fix target: ${operation.path}`);
  const flags = constants.O_RDWR | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW);
  const handle = await open(target, flags);
  try {
    const currentInfo = await handle.stat();
    if (!currentInfo.isFile()) throw new Error(`Refusing non-file fix handle: ${operation.path}`);
    const current = await handle.readFile({ encoding: "utf8" });
    if (sha256(current) !== operation.expected_sha256)
      throw new Error(`${operation.path} changed after fix planning; no bytes were written.`);
    await handle.truncate(0);
    await handle.write(operation.next, 0, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  if (sha256(await readFile(target)) !== operation.resulting_sha256)
    throw new Error(`Post-write hash verification failed for ${operation.path}.`);
}

async function verifyAppliedFixes(root: string, operations: PlannedWrite[]): Promise<void> {
  for (const analyzerId of new Set(operations.map((operation) => operation.analyzerId))) {
    const run = await runNamedAnalyzer(analyzerId, root);
    const relevant = operations.filter((operation) => operation.analyzerId === analyzerId);
    for (const operation of relevant) {
      if (
        run.findings.some(
          (finding) =>
            finding.id === operation.finding_id &&
            finding.location.some((location) => location.path === operation.path)
        )
      )
        throw new Error(
          `Finding-specific analyzer still reproduces ${operation.finding_id} in ${operation.path}.`
        );
    }
  }
}

async function rollbackWrites(root: string, operations: PlannedWrite[]): Promise<void> {
  for (const operation of [...operations].reverse()) {
    const target = resolveInside(root, operation.path);
    await assertNoSymlinkPath(root, target);
    const current = await readFile(target, "utf8");
    if (sha256(current) !== operation.resulting_sha256)
      throw new Error(`Cannot roll back ${operation.path}: it changed after the fix write.`);
    const rollback: PlannedWrite = {
      ...operation,
      expected_sha256: operation.resulting_sha256,
      resulting_sha256: operation.expected_sha256,
      next: operation.original
    };
    await writeIfUnchanged(root, rollback);
  }
}

function updateReportAfterFix(
  report: AuditReport,
  operations: PlannedWrite[],
  blocked: Array<{ finding_id: string; reason: string }>
): void {
  const byFinding = new Map<string, PlannedWrite[]>();
  for (const operation of operations) {
    const current = byFinding.get(operation.finding_id) ?? [];
    current.push(operation);
    byFinding.set(operation.finding_id, current);
  }
  for (const finding of report.findings) {
    const applied = byFinding.get(finding.id);
    if (applied !== undefined) {
      const directlyProven = applied.every((operation) => operation.absenceProvesResolution);
      finding.status = directlyProven ? "PASS" : "NOT_VERIFIED";
      finding.evidence.push(
        `${utcNow()}: applied ${applied.map((operation) => operation.fix_id).join(", ")} to ${applied.map((operation) => operation.path).join(", ")}; finding-specific structural analyzers no longer reproduce the exact condition.`
      );
      if (!directlyProven)
        finding.evidence.push(
          "Provider-side rotation or other behavior-level proof remains manual; structural disappearance was not treated as PASS."
        );
    }
    const refusal = blocked.find((item) => item.finding_id === finding.id);
    if (refusal !== undefined) {
      finding.status = "BLOCKED";
      finding.evidence.push(`${utcNow()}: automatic fix refused: ${refusal.reason}`);
    }
  }
  report.generated_at = utcNow();
  report.scope = `${report.scope}; bounded safe fix`;
}

function publicOperation(operation: PlannedWrite): FixOperation {
  return {
    fix_id: operation.fix_id,
    finding_id: operation.finding_id,
    section: operation.section,
    risk: operation.risk,
    path: operation.path,
    expected_sha256: operation.expected_sha256,
    resulting_sha256: operation.resulting_sha256,
    description: operation.description,
    verification: operation.verification,
    rollback: operation.rollback
  };
}

function publicRegistryEntry(entry: FixDefinition): FixRegistryEntry {
  return {
    fix_id: entry.fix_id,
    supported_finding_pattern: entry.supported_finding_pattern,
    section: entry.section,
    description: entry.description,
    risk: entry.risk,
    preconditions: entry.preconditions,
    affected_files: entry.affected_files,
    expected_original_state: entry.expected_original_state,
    planned_edits: entry.planned_edits,
    verification: entry.verification,
    rollback: entry.rollback
  };
}

function looksLikeCredential(value: string): boolean {
  const normalized = value.trim().replace(/^['"]|['"]$/gu, "");
  return (
    normalized.length >= 12 &&
    /[A-Za-z]/u.test(normalized) &&
    /[0-9_-]/u.test(normalized) &&
    !/^(?:your[-_ ]|example|sample|test|dummy|fixture|placeholder|changeme|xxx|<|\$\{|\*+)/iu.test(
      normalized
    )
  );
}

function walk(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node);
  node.forEachChild((child) => walk(child, callback));
}

function jsxLiteral(
  node: ts.JsxOpeningLikeElement,
  name: string
): { value: string; start: number; end: number } | undefined {
  const attribute = node.attributes.properties.find(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) && candidate.name.getText() === name
  );
  if (attribute?.initializer === undefined) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) {
    return {
      value: attribute.initializer.text,
      start: attribute.initializer.getStart() + 1,
      end: attribute.initializer.getEnd() - 1
    };
  }
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression !== undefined &&
    ts.isStringLiteralLike(attribute.initializer.expression)
  ) {
    const literal = attribute.initializer.expression;
    return { value: literal.text, start: literal.getStart() + 1, end: literal.getEnd() - 1 };
  }
  throw new Error(`The ${name} attribute is not a literal and cannot be changed safely.`);
}

function applyTextEdits(
  content: string,
  edits: Array<{ start: number; end: number; value: string }>
): string {
  let output = content;
  for (const edit of [...edits].sort((a, b) => b.start - a.start))
    output = `${output.slice(0, edit.start)}${edit.value}${output.slice(edit.end)}`;
  return output;
}

function detectIndent(content: string): number | string {
  const match = /\n([ \t]+)"/u.exec(content);
  if (match?.[1]?.includes("\t")) return "\t";
  return Math.max(2, match?.[1]?.length ?? 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
