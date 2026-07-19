import { extname, relative } from "node:path";
import ts from "typescript";
import type {
  Confidence,
  EvidenceSnapshot,
  Finding,
  FindingLocation,
  Severity,
  TraceEvidence
} from "./types.js";
import {
  buildTaintModel,
  type ProtectionKind,
  type TaintModel,
  type TaintOrigin
} from "./dataflow.js";
import { lineNumber, readTextIfPresent, sha256, toPosix, walkFiles } from "./utils.js";

const EXCLUDED = new Set([
  ".git",
  ".forge",
  ".fullstack-forge",
  ".agents",
  ".claude",
  ".cursor",
  ".gemini",
  ".windsurf",
  ".tmp",
  "build",
  "coverage",
  "dist",
  "fixtures",
  "node_modules",
  "target",
  "vendor"
]);

const SCRIPT_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

export type AnalyzerScope = ReadonlySet<string> | undefined;

export type AnalyzerRun = {
  analyzer_id: string;
  supported_files: number;
  findings: Finding[];
};

type SourceRecord = {
  absolute: string;
  path: string;
  content: string;
  hash: string;
  sourceFile: ts.SourceFile;
};

type IssueSpec = {
  id: string;
  analyzer: string;
  section: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  impact: string;
  recommendation: string;
  safeFix: boolean;
  absenceProvesResolution: boolean;
  verification: string[];
  standards: string[];
};

type Issue = {
  spec: IssueSpec;
  file: SourceRecord;
  node?: ts.Node;
  start: number;
  end?: number;
  evidence: string;
  source: string;
  sink: string;
};

const SPECS = {
  sql: spec(
    "FF-SEC-SQL-001",
    "js-ts-security",
    "security",
    "Request-controlled data reaches an interpolated SQL execution sink",
    "HIGH",
    "Request input can alter the query structure and read or modify unintended data.",
    "Use the database driver's parameter binding and add a negative injection regression test.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Run a hostile-input query regression test"],
    ["OWASP ASVS 5.0", "CWE-89"]
  ),
  nosql: spec(
    "FF-SEC-NOSQL-001",
    "js-ts-security",
    "security",
    "Request-controlled object reaches a NoSQL filter sink",
    "HIGH",
    "Request-supplied operators can change query meaning or bypass intended filters.",
    "Validate an allowlisted scalar filter schema and construct the final query server-side.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Run negative operator-injection tests"],
    ["OWASP ASVS 5.0", "CWE-943"]
  ),
  shell: spec(
    "FF-SEC-SHELL-001",
    "js-ts-security",
    "security",
    "Request-controlled data reaches shell execution",
    "CRITICAL",
    "An attacker may execute commands with the application process privileges.",
    "Remove the shell boundary or use an allowlisted executable with a validated argument array.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Run hostile metacharacter regression tests"],
    ["OWASP ASVS 5.0", "CWE-78"]
  ),
  redirect: spec(
    "FF-SEC-REDIRECT-001",
    "js-ts-security",
    "security",
    "Request-controlled redirect target is not constrained",
    "HIGH",
    "An attacker can send users to an untrusted origin and support phishing or token leakage.",
    "Map redirect choices to server-owned relative destinations or an explicit origin allowlist.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Test absolute, protocol-relative, and encoded targets"],
    ["OWASP Unvalidated Redirects and Forwards Cheat Sheet", "CWE-601"]
  ),
  credential: spec(
    "FF-SEC-CREDENTIAL-001",
    "js-ts-security",
    "security",
    "Obvious credential-like constant is hard-coded",
    "HIGH",
    "A committed credential can grant unauthorized access and persist in repository history.",
    "Move the value to an approved secret store and rotate it if it was ever valid.",
    false,
    false,
    [
      "Re-run the js-ts-security analyzer",
      "Verify provider-side revocation without logging the value"
    ],
    ["OWASP Secrets Management Cheat Sheet", "CWE-798"]
  ),
  sensitiveLog: spec(
    "FF-SEC-LOG-001",
    "js-ts-security",
    "security",
    "Sensitive request data reaches a logging sink",
    "HIGH",
    "Credentials or personal data can persist in logs beyond the request boundary.",
    "Log an allowlisted event shape and redact supported sensitive fields before serialization.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Exercise the request and inspect captured logs"],
    ["OWASP Logging Cheat Sheet", "CWE-532"]
  ),
  validation: spec(
    "FF-SEC-VALIDATION-001",
    "js-ts-security",
    "security",
    "Supported high-risk sink lacks demonstrated server-side validation",
    "HIGH",
    "Malformed or hostile input reaches a boundary that depends on trusted shape or meaning.",
    "Validate and normalize the input immediately before constructing the supported sink input.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Run schema rejection tests at the server boundary"],
    ["OWASP ASVS 5.0", "CWE-20"]
  ),
  ssrf: spec(
    "FF-SEC-SSRF-001",
    "js-ts-security",
    "security",
    "Request-controlled URL reaches a server-side HTTP client",
    "HIGH",
    "The server can be induced to reach internal services, metadata endpoints, or attacker infrastructure.",
    "Resolve the destination from a server-owned allowlist and block private and link-local ranges.",
    false,
    false,
    [
      "Re-run the js-ts-security analyzer",
      "Test internal, metadata, and redirect-based destinations"
    ],
    ["OWASP SSRF Prevention Cheat Sheet", "CWE-918"]
  ),
  deserialize: spec(
    "FF-SEC-DESERIALIZE-001",
    "js-ts-security",
    "security",
    "Request-controlled data reaches an unsafe deserialization or code-evaluation sink",
    "CRITICAL",
    "Deserializing attacker-controlled input can execute code or corrupt application state.",
    "Parse untrusted input with a safe data-only format and validate an explicit schema.",
    false,
    false,
    ["Re-run the js-ts-security analyzer", "Run hostile-payload tests against the boundary"],
    ["OWASP Deserialization Cheat Sheet", "CWE-502"]
  ),
  csvFormula: spec(
    "FF-SEC-CSV-001",
    "js-ts-security",
    "security",
    "CSV export assembles untrusted values without formula escaping",
    "MEDIUM",
    "Values beginning with =, +, -, or @ can execute as formulas in spreadsheet clients.",
    "Escape or prefix risky leading characters and quote fields before writing CSV output.",
    false,
    false,
    [
      "Re-run the js-ts-security analyzer",
      "Export a cell starting with = and inspect the escaping"
    ],
    ["OWASP CSV Injection guidance", "CWE-1236"]
  ),
  massAssign: spec(
    "FF-SEC-MASS-ASSIGN-001",
    "js-ts-security",
    "security",
    "Entire request body is written to a data model without field allowlisting",
    "HIGH",
    "A caller can set fields that were never intended to be writable, including roles or ownership.",
    "Copy an explicit allowlist of validated fields from the request into the write payload.",
    false,
    false,
    [
      "Re-run the js-ts-security analyzer",
      "Attempt to set a privileged field through the endpoint"
    ],
    ["OWASP Mass Assignment Cheat Sheet", "CWE-915"]
  ),
  authCookie: spec(
    "FF-AUTH-COOKIE-001",
    "js-ts-auth",
    "auth",
    "Session cookie is issued with weakened security attributes",
    "HIGH",
    "Disabling HttpOnly or Secure exposes the session credential to script access or cleartext transport.",
    "Set httpOnly and secure on session cookies and choose a SameSite value that fits the login flow.",
    false,
    false,
    ["Re-run the js-ts-auth analyzer", "Inspect Set-Cookie attributes in a real login response"],
    ["OWASP Session Management Cheat Sheet", "CWE-614", "CWE-1004"]
  ),
  authSessionValue: spec(
    "FF-AUTH-SESSION-001",
    "js-ts-auth",
    "auth",
    "Session identifier is derived from request-controlled input",
    "CRITICAL",
    "A caller can forge or predict another user's session credential and bypass authentication.",
    "Issue an opaque high-entropy server-generated session identifier bound to server-side state.",
    false,
    false,
    ["Re-run the js-ts-auth analyzer", "Prove a forged cookie value cannot authenticate"],
    ["OWASP Session Management Cheat Sheet", "CWE-384", "CWE-330"]
  ),
  objectAuth: spec(
    "FF-AUTHZ-OBJECT-001",
    "js-ts-authorization",
    "authorization",
    "Object lookup lacks a demonstrated subject/object authorization predicate",
    "HIGH",
    "An authenticated caller may read or modify another subject's object by changing its identifier.",
    "Bind the final lookup to the authenticated subject or enforce a per-object policy before release.",
    false,
    false,
    ["Re-run the js-ts-authorization analyzer", "Run negative tests with another user's object ID"],
    ["OWASP API Security Top 10 2023 API1", "CWE-639"]
  ),
  tenantInput: spec(
    "FF-TENANT-INPUT-001",
    "js-ts-tenancy",
    "tenancy",
    "Tenant context is accepted from untrusted request input",
    "CRITICAL",
    "A caller can select another tenant's data boundary.",
    "Derive tenant context from authenticated identity and pass it through trusted server context.",
    false,
    false,
    ["Re-run the js-ts-tenancy analyzer", "Run a negative cross-tenant identifier test"],
    ["OWASP Multi Tenant Security Cheat Sheet", "CWE-639"]
  ),
  tenantScope: spec(
    "FF-TENANT-SCOPE-001",
    "js-ts-tenancy",
    "tenancy",
    "Tenant-owned query is not scoped by authenticated tenant identity",
    "CRITICAL",
    "Records can cross tenant boundaries at the final data-access sink.",
    "Include the authenticated tenant predicate in the final query and enforce it in negative tests.",
    false,
    false,
    ["Re-run the js-ts-tenancy analyzer", "Run same-ID tests in two tenants"],
    ["OWASP Multi Tenant Security Cheat Sheet", "CWE-284"]
  ),
  tenantBackground: spec(
    "FF-TENANT-BACKGROUND-001",
    "js-ts-tenancy",
    "tenancy",
    "Background or export access is unscoped for tenant-owned data",
    "HIGH",
    "Asynchronous work can aggregate or disclose records across tenants.",
    "Persist trusted tenant context with the job/export and require it in every data query.",
    false,
    false,
    ["Re-run the js-ts-tenancy analyzer", "Run a multi-tenant job/export isolation test"],
    ["OWASP Multi Tenant Security Cheat Sheet"]
  ),
  uploadAny: spec(
    "FF-UPLOAD-ANY-001",
    "js-ts-uploads",
    "uploads",
    "Upload middleware accepts unrestricted file fields",
    "HIGH",
    "Attackers can submit unbounded file counts and unexpected file types.",
    "Replace upload.any() with explicit fields and existing policy-backed count and byte limits.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Test excess fields, counts, and bytes"],
    ["OWASP File Upload Cheat Sheet", "CWE-434"]
  ),
  uploadExtension: spec(
    "FF-UPLOAD-EXTENSION-001",
    "js-ts-uploads",
    "uploads",
    "Upload acceptance relies on filename extension",
    "HIGH",
    "A renamed active or malformed file can pass the content policy.",
    "Validate decoded content and file signatures against an allowlisted type.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Test extension/content mismatches"],
    ["OWASP File Upload Cheat Sheet"]
  ),
  uploadMime: spec(
    "FF-UPLOAD-MIME-001",
    "js-ts-uploads",
    "uploads",
    "Client MIME is trusted without decoded or signature validation",
    "HIGH",
    "A client can spoof Content-Type and submit unsupported active content.",
    "Treat client MIME as a hint and validate signature plus decoded output.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Test MIME/signature mismatches"],
    ["OWASP File Upload Cheat Sheet", "CWE-434"]
  ),
  uploadPublic: spec(
    "FF-UPLOAD-PUBLIC-001",
    "js-ts-uploads",
    "uploads",
    "Untrusted upload is stored publicly before quarantine approval",
    "CRITICAL",
    "Hostile bytes can be fetched before security decisions complete.",
    "Write to private quarantine and publish only after every required scanner approves.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Attempt access before and after scanner approval"],
    ["OWASP File Upload Cheat Sheet"]
  ),
  uploadScan: spec(
    "FF-UPLOAD-SCAN-001",
    "js-ts-uploads",
    "uploads",
    "Upload path has no demonstrated malware-scan boundary",
    "HIGH",
    "Untrusted content may reach durable or public storage without a security decision.",
    "Insert an approved scanner between private quarantine and release.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Run clean, malicious, timeout, and scanner-error tests"],
    ["OWASP File Upload Cheat Sheet"]
  ),
  uploadFailOpen: spec(
    "FF-UPLOAD-SCAN-ERROR-001",
    "js-ts-uploads",
    "uploads",
    "Scanner error path can release an upload",
    "CRITICAL",
    "Scanner outages or malformed files can bypass quarantine.",
    "Fail closed on scanner error or timeout and keep the object private.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Force scanner error and timeout paths"],
    ["OWASP File Upload Cheat Sheet", "CWE-636"]
  ),
  uploadFilename: spec(
    "FF-UPLOAD-FILENAME-001",
    "js-ts-uploads",
    "uploads",
    "Original filename is used in a storage path",
    "HIGH",
    "Traversal, collision, Unicode, and active-content naming can affect storage or delivery.",
    "Generate an opaque server-owned object key and store the original name only as sanitized metadata.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Test traversal and collision filenames"],
    ["OWASP File Upload Cheat Sheet", "CWE-22"]
  ),
  uploadLimits: spec(
    "FF-UPLOAD-LIMITS-001",
    "js-ts-uploads",
    "uploads",
    "Supported upload path lacks bounded count, byte, archive, or parser limits",
    "HIGH",
    "An attacker can exhaust memory, storage, CPU, or parser resources.",
    "Enforce existing policy values for count, bytes, archive expansion, and parser time before processing.",
    false,
    false,
    ["Re-run the js-ts-uploads analyzer", "Exercise boundary and over-limit cases"],
    ["OWASP File Upload Cheat Sheet", "CWE-400"]
  ),
  nPlusOne: spec(
    "FF-QUERY-N1-001",
    "js-ts-queries-cache",
    "queries",
    "Data query executes inside a loop",
    "HIGH",
    "Query count grows with parent rows and can exhaust latency and connection budgets.",
    "Batch, join, or preload the child relation and assert a bounded query count.",
    false,
    false,
    ["Re-run the js-ts-queries-cache analyzer", "Run a representative query-count test"],
    ["OWASP ASVS 5.0", "CWE-400"]
  ),
  unbounded: spec(
    "FF-QUERY-UNBOUNDED-001",
    "js-ts-queries-cache",
    "queries",
    "Collection query has no enforced bound",
    "HIGH",
    "Large tables can cause excessive response size, memory use, and database load.",
    "Apply the existing application page-size policy and stable pagination at the query boundary.",
    false,
    false,
    ["Re-run the js-ts-queries-cache analyzer", "Test the maximum page boundary"],
    ["OWASP API Security Top 10 2023 API4"]
  ),
  paginationOrder: spec(
    "FF-QUERY-ORDER-001",
    "js-ts-queries-cache",
    "queries",
    "Paginated query lacks deterministic ordering",
    "MEDIUM",
    "Rows can be duplicated or skipped between pages.",
    "Add a stable order including a unique tie-breaker consistent with the existing API contract.",
    false,
    false,
    ["Re-run the js-ts-queries-cache analyzer", "Run insert-between-pages regression tests"],
    ["PostgreSQL 18 documentation"]
  ),
  cacheUser: spec(
    "FF-CACHE-USER-001",
    "js-ts-queries-cache",
    "cache",
    "User-specific cache key omits user identity",
    "CRITICAL",
    "Cached private data can be returned to another user.",
    "Include the authenticated user identity in the key and test two users against the same resource.",
    false,
    false,
    ["Re-run the js-ts-queries-cache analyzer", "Run a two-user isolation test"],
    ["OWASP ASVS 5.0"]
  ),
  cacheTenant: spec(
    "FF-CACHE-TENANT-001",
    "js-ts-queries-cache",
    "cache",
    "Tenant-specific cache key omits tenant identity",
    "CRITICAL",
    "Cached data or invalidation can cross tenant boundaries.",
    "Include authenticated tenant identity in keys and invalidation paths.",
    false,
    false,
    ["Re-run the js-ts-queries-cache analyzer", "Run same-ID tests in two tenants"],
    ["OWASP Multi Tenant Security Cheat Sheet"]
  ),
  aiPrompt: spec(
    "FF-AI-PROMPT-001",
    "js-ts-ai",
    "ai",
    "Untrusted document text is concatenated into model instructions",
    "HIGH",
    "Hostile document content can influence system or tool behavior.",
    "Keep document text in an isolated data field and enforce tool policy outside the model prompt.",
    false,
    false,
    ["Re-run the js-ts-ai analyzer", "Execute indirect prompt-injection evaluations"],
    ["OWASP LLM Prompt Injection Prevention Cheat Sheet"]
  ),
  aiIrreversible: spec(
    "FF-AI-IRREVERSIBLE-001",
    "js-ts-ai",
    "ai",
    "Model output can directly invoke an irreversible business action",
    "CRITICAL",
    "A probabilistic or manipulated output can commit financial, inventory, accounting, or permission changes.",
    "Require deterministic authorization, validated arguments, and a recorded confirmation before commit.",
    false,
    false,
    [
      "Re-run the js-ts-ai analyzer",
      "Test denial and confirmation paths with hostile model output"
    ],
    ["OWASP AI Agent Security Cheat Sheet"]
  ),
  aiValidation: spec(
    "FF-AI-OUTPUT-001",
    "js-ts-ai",
    "ai",
    "Model output lacks structured validation before a sensitive boundary",
    "HIGH",
    "Malformed or hallucinated identifiers and amounts can reach sensitive tools.",
    "Validate strict structured output and independently resolve identifiers and totals.",
    false,
    false,
    ["Re-run the js-ts-ai analyzer", "Run malformed-output and unknown-field evaluations"],
    ["OWASP AI Agent Security Cheat Sheet"]
  ),
  aiConfirmation: spec(
    "FF-AI-CONFIRM-001",
    "js-ts-ai",
    "ai",
    "Irreversible AI action has no demonstrated human or deterministic confirmation",
    "CRITICAL",
    "A single model response can cause irreversible harm without an independent decision boundary.",
    "Bind execution to a server-recorded approval or deterministic confirmation policy.",
    false,
    false,
    ["Re-run the js-ts-ai analyzer", "Prove an unconfirmed action cannot commit"],
    ["OWASP AI Agent Security Cheat Sheet"]
  ),
  webhookSignature: spec(
    "FF-PAY-WEBHOOK-SIGNATURE-001",
    "js-ts-payments",
    "payments",
    "Payment webhook side effects occur without prior signature verification",
    "CRITICAL",
    "Forged events can create financial or entitlement side effects.",
    "Verify the provider signature over raw bytes before parsing or performing side effects.",
    false,
    false,
    ["Re-run the js-ts-payments analyzer", "Send unsigned and invalid-signature events"],
    ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]
  ),
  webhookRaw: spec(
    "FF-PAY-WEBHOOK-RAW-001",
    "js-ts-payments",
    "payments",
    "Webhook signature verification uses a parsed payload",
    "HIGH",
    "Payload reserialization can invalidate or weaken provider signature verification.",
    "Preserve and verify the exact raw request bytes required by the provider.",
    false,
    false,
    ["Re-run the js-ts-payments analyzer", "Test byte-preserving signature verification"],
    ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]
  ),
  webhookIdempotency: spec(
    "FF-PAY-IDEMPOTENCY-001",
    "js-ts-payments",
    "payments",
    "Provider event lacks a durable idempotency boundary",
    "CRITICAL",
    "Retries or concurrent deliveries can repeat financial or entitlement effects.",
    "Atomically persist the provider event ID under a unique constraint before side effects.",
    false,
    false,
    ["Re-run the js-ts-payments analyzer", "Replay and concurrently deliver the same event"],
    ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]
  ),
  webhookDuplicate: spec(
    "FF-INTEGRATION-DUPLICATE-001",
    "js-ts-payments",
    "integrations",
    "Duplicate webhook delivery can repeat a side effect",
    "HIGH",
    "Provider retries can duplicate fulfillment, notification, ledger, or entitlement changes.",
    "Make side effects conditional on an atomically claimed durable event identifier.",
    false,
    false,
    ["Re-run the js-ts-payments analyzer", "Replay the same provider event"],
    ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]
  ),
  clientAmount: spec(
    "FF-PAY-AMOUNT-001",
    "js-ts-payments",
    "payments",
    "Client-controlled amount reaches a payment request",
    "CRITICAL",
    "A caller can alter the charged amount or currency outside server-owned pricing rules.",
    "Resolve the amount and currency from server-owned product or invoice records.",
    false,
    false,
    ["Re-run the js-ts-payments analyzer", "Tamper with amount and currency inputs"],
    ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]
  ),
  missingLabel: spec(
    "FF-A11Y-LABEL-001",
    "js-ts-accessibility",
    "accessibility",
    "Form control has no structurally detectable accessible name",
    "HIGH",
    "Screen-reader and voice-control users may be unable to identify the field.",
    "Associate a visible label or an appropriate accessible name with the control.",
    false,
    true,
    ["Re-run the js-ts-accessibility analyzer", "Inspect the browser accessibility tree"],
    ["WCAG 2.2 SC 1.3.1", "WCAG 2.2 SC 4.1.2"]
  ),
  blankRel: spec(
    "FF-FRONTEND-BLANK-001",
    "js-ts-frontend-safety",
    "frontend",
    "target=_blank link lacks noopener and noreferrer",
    "MEDIUM",
    "The opened page can retain opener access or receive referrer data.",
    'Add rel="noopener noreferrer" to the proven target=_blank link.',
    true,
    true,
    ["Re-run the js-ts-frontend-safety analyzer", "Parse the link and confirm both rel tokens"],
    ["OWASP Reverse Tabnabbing guidance"]
  ),
  envTemplate: spec(
    "FF-ENV-TEMPLATE-001",
    "structured-config-safety",
    "security",
    "Environment template contains an actual-looking credential",
    "HIGH",
    "Published templates can disclose a credential.",
    "Replace the template value with an explicit placeholder and rotate it if it was ever valid.",
    true,
    false,
    ["Re-run the structured-config-safety analyzer", "Verify provider-side rotation manually"],
    ["OWASP Secrets Management Cheat Sheet"]
  ),
  secureHeader: spec(
    "FF-DEPLOY-HEADER-001",
    "structured-config-safety",
    "deployment",
    "Existing global Vercel header rule omits X-Content-Type-Options",
    "MEDIUM",
    "Browsers may MIME-sniff responses contrary to the declared content type.",
    "Add the deterministic nosniff header to the existing global rule.",
    true,
    true,
    [
      "Re-run the structured-config-safety analyzer",
      "Parse vercel.json and inspect the global header rule"
    ],
    ["OWASP HTTP Headers Cheat Sheet"]
  )
} as const;

export async function runAnalyzers(
  section: string,
  root: string,
  scope?: AnalyzerScope
): Promise<AnalyzerRun[]> {
  const records = await loadSources(root, scope);
  const scriptRun = analyzeScripts(records);
  const configRun = await analyzeStructuredFiles(root, scope);
  return [scriptRun, configRun].map((run) => ({
    ...run,
    findings: run.findings.filter((finding) => section === "all" || finding.section === section)
  }));
}

export async function runNamedAnalyzer(
  analyzerId: string,
  root: string,
  scope?: AnalyzerScope
): Promise<AnalyzerRun> {
  const runs = await runAnalyzers("all", root, scope);
  const normalized = analyzerId.startsWith("js-ts-") ? "js-ts-boundaries" : analyzerId;
  const run = runs.find((candidate) => candidate.analyzer_id === normalized);
  if (run === undefined) {
    return { analyzer_id: analyzerId, supported_files: 0, findings: [] };
  }
  return run;
}

function analyzeScripts(files: SourceRecord[]): AnalyzerRun {
  const issues: Issue[] = [];
  for (const file of files) {
    const labelIds = collectLabelIds(file.sourceFile);
    const functions = collectFunctionRanges(file.sourceFile);
    const taint = buildTaintModel(file.sourceFile);
    visit(file.sourceFile, [], (node, ancestors) => {
      if (ts.isCallExpression(node)) {
        const name = callName(node.expression);
        const argumentText = node.arguments
          .map((argument) => argument.getText(file.sourceFile))
          .join(", ");
        // Data-flow first: resolves aliases, reassignment, destructuring, template and
        // concatenation propagation, and same-file parameter summaries. The literal-text regex
        // is retained as a union so no previously detected direct flow regresses.
        const flow = resolveArgumentTaint(node, file, taint);
        const requestControlled = flow !== undefined || containsRequestData(argumentText);
        // Validation remains distinct from taint and from sink-specific protections. It can
        // satisfy the generic validation sub-finding, but it never suppresses structural SQL,
        // shell, redirect, or network findings by itself.
        const validated = argumentsHaveProtection(node, file, taint, ["validated", "allowlisted"]);
        if (
          isSqlSink(name) &&
          requestControlled &&
          (hasInterpolation(node.arguments, file.sourceFile) ||
            flowPassedThroughInterpolation(flow))
        ) {
          issues.push(issue(SPECS.sql, file, node, flowSource(flow, argumentText), name));
          if (!validated)
            issues.push(issue(SPECS.validation, file, node, flowSource(flow, argumentText), name));
        }
        if (
          isNoSqlSink(name) &&
          requestControlled &&
          /[${}]|\$where|req\.(?:body|query)(?:\.|\b)/u.test(argumentText)
        ) {
          issues.push(issue(SPECS.nosql, file, node, flowSource(flow, argumentText), name));
          if (!validated)
            issues.push(issue(SPECS.validation, file, node, flowSource(flow, argumentText), name));
        }
        if (isShellSink(name) && requestControlled && !isShellSeparatedCall(node, file, taint)) {
          issues.push(issue(SPECS.shell, file, node, flowSource(flow, argumentText), name));
          if (!validated)
            issues.push(issue(SPECS.validation, file, node, flowSource(flow, argumentText), name));
        }
        if (
          /\bredirect$/u.test(name) &&
          requestControlled &&
          !isConstrainedRedirect(node, file, taint)
        ) {
          issues.push(issue(SPECS.redirect, file, node, flowSource(flow, argumentText), name));
        }
        if (isLogSink(name) && containsSensitiveLogData(argumentText))
          issues.push(issue(SPECS.sensitiveLog, file, node, flowSource(flow, argumentText), name));
        if (name.endsWith("upload.any"))
          issues.push(issue(SPECS.uploadAny, file, node, "unrestricted multipart fields", name));
        if (isQuerySink(name) && ancestors.some(isLoop))
          issues.push(issue(SPECS.nPlusOne, file, node, "loop iteration", name));
        if (/\bfindMany$/u.test(name)) {
          const options = argumentText;
          if (!/\b(?:take|limit|first|maxResults)\s*:/u.test(options))
            issues.push(issue(SPECS.unbounded, file, node, "collection query", name));
          if (
            /\b(?:skip|cursor|take|limit)\s*:/u.test(options) &&
            !/\b(?:orderBy|sort)\s*:/u.test(options)
          )
            issues.push(issue(SPECS.paginationOrder, file, node, "pagination options", name));
        }
        if (isCacheSink(name)) analyzeCacheCall(issues, file, node, name, functions);
        if (isObjectLookup(name) && requestControlled) {
          if (!hasObjectAuthorization(node, file, taint))
            issues.push(issue(SPECS.objectAuth, file, node, flowSource(flow, argumentText), name));
        }
        if (
          isQuerySink(name) &&
          /(?:tenant|organization)(?:Id|_id)?\s*:\s*req\.(?:params|query|body)/u.test(argumentText)
        ) {
          issues.push(issue(SPECS.tenantInput, file, node, flowSource(flow, argumentText), name));
          issues.push(issue(SPECS.tenantScope, file, node, flowSource(flow, argumentText), name));
        }
        const queryContext = isQuerySink(name) ? enclosingText(node, file, functions) : "";
        if (
          isQuerySink(name) &&
          /\b(?:tenant|organization)(?:Id|_id)?\b/u.test(queryContext) &&
          !/(?:tenant|organization)(?:Id|_id)?\s*:/u.test(argumentText)
        ) {
          issues.push(issue(SPECS.tenantScope, file, node, "tenant-owned query context", name));
        }
        if (
          isQuerySink(name) &&
          isBackgroundExecutionContext(node, file) &&
          !/(?:tenant|organization)(?:Id|_id)?\s*:/u.test(argumentText)
        )
          issues.push(issue(SPECS.tenantBackground, file, node, "background/export context", name));
        if (
          isModelSink(name) &&
          requestControlled &&
          /invoice|document|attachment|ocr|text/iu.test(argumentText)
        )
          issues.push(issue(SPECS.aiPrompt, file, node, flowSource(flow, argumentText), name));
        if (
          isPaymentSink(name) &&
          /req\.(?:body|query|params).*\b(?:amount|price|currency)|(?:amount|price|currency).*req\.(?:body|query|params)/isu.test(
            argumentText
          )
        )
          issues.push(issue(SPECS.clientAmount, file, node, flowSource(flow, argumentText), name));
        if (isHttpClientSink(name)) {
          const targetNode = node.arguments[0];
          const target = targetNode?.getText(file.sourceFile) ?? "";
          const targetFlow = targetNode === undefined ? undefined : taint.resolve(targetNode);
          if (
            (targetFlow !== undefined || containsRequestData(target)) &&
            !isNetworkConstrainedTarget(node, targetNode, file, taint)
          )
            issues.push(
              issue(SPECS.ssrf, file, node, flowSource(targetFlow ?? flow, target), name)
            );
        }
        if (isDeserializationSink(name) && requestControlled)
          issues.push(issue(SPECS.deserialize, file, node, flowSource(flow, argumentText), name));
        if (
          isModelWriteSink(name) &&
          node.arguments.some((argument) =>
            referencesWholeRequestBody(argument, file.sourceFile)
          ) &&
          !validated
        )
          issues.push(issue(SPECS.massAssign, file, node, "entire request body", name));
        if (/(?:^|\.)(?:cookie|setCookie)$/u.test(name) && node.arguments.length >= 2) {
          const cookieName = node.arguments[0]?.getText(file.sourceFile) ?? "";
          const cookieValue = node.arguments[1]?.getText(file.sourceFile) ?? "";
          const cookieOptions = node.arguments[2]?.getText(file.sourceFile) ?? "";
          if (/session|token|auth|sid|jwt|remember/iu.test(cookieName)) {
            const weakened = ["httpOnly", "secure"].filter((flag) =>
              new RegExp(`\\b${flag}\\s*:\\s*false`, "u").test(cookieOptions)
            );
            if (weakened.length > 0)
              issues.push(
                issue(SPECS.authCookie, file, node, `${weakened.join(" and ")} set to false`, name)
              );
            if (containsRequestData(cookieValue))
              issues.push(
                issue(SPECS.authSessionValue, file, node, flowSource(flow, cookieValue), name)
              );
          }
        }
      }
      if (
        ts.isNewExpression(node) &&
        node.expression.getText(file.sourceFile) === "Function" &&
        containsRequestData(
          (node.arguments ?? []).map((argument) => argument.getText(file.sourceFile)).join(", ")
        )
      )
        issues.push(
          issue(
            SPECS.deserialize,
            file,
            node,
            requestSource(
              (node.arguments ?? []).map((argument) => argument.getText(file.sourceFile)).join(", ")
            ),
            "new Function"
          )
        );
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined &&
        ts.isStringLiteralLike(node.initializer)
      ) {
        const variable = node.name.text;
        const value = node.initializer.text;
        if (
          /(?:api[_-]?key|secret|token|password|credential)/iu.test(variable) &&
          looksLikeSecret(value)
        )
          issues.push(
            issue(SPECS.credential, file, node, variable, "source constant (value redacted)")
          );
      }
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tag = node.tagName.getText(file.sourceFile).toLowerCase();
        if (["input", "select", "textarea"].includes(tag) && !hasAccessibleName(node, labelIds))
          issues.push(
            issue(SPECS.missingLabel, file, node, `<${tag}>`, "accessible-name computation")
          );
        if (tag === "a" && hasJsxAttribute(node, "target", "_blank") && !hasRelTokens(node))
          issues.push(
            issue(SPECS.blankRel, file, node, 'target="_blank"', "browser link navigation")
          );
      }
    });
    analyzeUploadFile(issues, file);
    analyzeAiFile(issues, file);
    analyzeWebhookFile(issues, file);
    analyzeCsvExport(issues, file);
  }
  return {
    analyzer_id: "js-ts-boundaries",
    supported_files: files.length,
    findings: mergeIssues(issues)
  };
}

async function analyzeStructuredFiles(root: string, scope?: AnalyzerScope): Promise<AnalyzerRun> {
  const issues: Issue[] = [];
  let supported = 0;
  const files = await walkFiles(root, {
    exclude: EXCLUDED,
    maxBytes: 768 * 1024,
    maxFiles: 10_000,
    maxTotalBytes: 128 * 1024 * 1024,
    maxDepth: 64
  });
  for (const absolute of files) {
    const path = toPosix(relative(root, absolute));
    if (scope !== undefined && !scope.has(path)) continue;
    const content = await readTextIfPresent(absolute);
    if (content === undefined) continue;
    const record = syntheticRecord(absolute, path, content);
    if (isEnvironmentTemplate(path)) {
      supported += 1;
      for (const [index, line] of content.split(/\r?\n/u).entries()) {
        const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u.exec(line);
        if (match === null) continue;
        const value = (match[2] ?? "").trim().replace(/^['"]|['"]$/gu, "");
        if (looksLikeSecret(value)) {
          issues.push({
            spec: SPECS.envTemplate,
            file: record,
            start: offsetForLine(content, index + 1),
            evidence: `${match[1]} has a non-placeholder credential-like value; value redacted.`,
            source: `${path}:${index + 1} environment template value`,
            sink: "published environment template"
          });
        }
      }
    }
    if (path.toLowerCase().endsWith("vercel.json")) {
      supported += 1;
      try {
        const parsed = JSON.parse(content) as unknown;
        if (isRecord(parsed) && Array.isArray(parsed.headers)) {
          for (const rule of parsed.headers) {
            if (!isRecord(rule) || typeof rule.source !== "string" || !Array.isArray(rule.headers))
              continue;
            if (!isGlobalHeaderSource(rule.source)) continue;
            const hasHeader = rule.headers.some(
              (header) =>
                isRecord(header) &&
                typeof header.key === "string" &&
                header.key.toLowerCase() === "x-content-type-options"
            );
            if (!hasHeader) {
              const index = content.indexOf(`"source"`);
              issues.push({
                spec: SPECS.secureHeader,
                file: record,
                start: Math.max(0, index),
                evidence: `The existing global header rule ${rule.source} has no X-Content-Type-Options entry.`,
                source: `${path} parsed headers array`,
                sink: `Vercel global response header rule ${rule.source}`
              });
            }
          }
        }
      } catch {
        // Invalid configuration is handled by the configuration/deployment audit, not this safe fix.
      }
    }
  }
  return {
    analyzer_id: "structured-config-safety",
    supported_files: supported,
    findings: mergeIssues(issues)
  };
}

async function loadSources(root: string, scope?: AnalyzerScope): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];
  for (const absolute of await walkFiles(root, {
    exclude: EXCLUDED,
    maxBytes: 768 * 1024,
    maxFiles: 10_000,
    maxTotalBytes: 128 * 1024 * 1024,
    maxDepth: 64
  })) {
    const extension = extname(absolute).toLowerCase();
    if (!SCRIPT_EXTENSIONS.has(extension)) continue;
    const path = toPosix(relative(root, absolute));
    if (scope !== undefined && !scope.has(path)) continue;
    const content = await readTextIfPresent(absolute);
    if (content === undefined) continue;
    const kind = scriptKind(extension);
    records.push({
      absolute,
      path,
      content,
      hash: sha256(content),
      sourceFile: ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind)
    });
  }
  return records;
}

function analyzeUploadFile(issues: Issue[], file: SourceRecord): void {
  const content = file.content;
  if (!/upload\.(?:any|array|fields|single)\s*\(/u.test(content)) return;
  const extension = /(?:originalname|filename)[^\n;]*\.endsWith\s*\(/u.exec(content);
  if (extension !== null)
    issues.push(
      textIssue(
        SPECS.uploadExtension,
        file,
        extension.index,
        "original filename extension",
        "upload acceptance branch"
      )
    );
  const mime = /\b(?:mimetype|contentType|content-type)\b/iu.exec(content);
  if (mime !== null && !/magic|signature|fileTypeFromBuffer|decode|sniff/iu.test(content))
    issues.push(
      textIssue(
        SPECS.uploadMime,
        file,
        mime.index,
        "client-provided MIME",
        "upload acceptance branch"
      )
    );
  const publicStorage =
    /(?:save|put|writeFile|upload)\s*\([^\n;]*(?:public[\\/]|public\/|publicPath)/iu.exec(content);
  const scan = /\b(?:scanner\.)?scan\s*\(/iu.exec(content);
  if (publicStorage !== null && (scan === null || publicStorage.index < scan.index))
    issues.push(
      textIssue(
        SPECS.uploadPublic,
        file,
        publicStorage.index,
        "untrusted upload bytes",
        "public storage before approval"
      )
    );
  if (scan === null)
    issues.push(
      textIssue(
        SPECS.uploadScan,
        file,
        content.search(/upload\./u),
        "upload middleware",
        "durable/released storage"
      )
    );
  const failOpen = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\n\s*)?\}/u.exec(content);
  if (
    scan !== null &&
    failOpen !== null &&
    /(?:res\.|send|url|release|extract)/u.test(content.slice(failOpen.index + failOpen[0].length))
  )
    issues.push(
      textIssue(
        SPECS.uploadFailOpen,
        file,
        failOpen.index,
        "scanner error",
        "continued release path"
      )
    );
  const originalPath = /(?:save|put|writeFile|upload)\s*\([^\n;]*(?:originalname|filename)/iu.exec(
    content
  );
  if (originalPath !== null)
    issues.push(
      textIssue(
        SPECS.uploadFilename,
        file,
        originalPath.index,
        "client original filename",
        "storage object path"
      )
    );
  if (
    !/\b(?:limits|fileSize|maxFiles|maxBytes|maxEntries|maxDepth|maxRatio|timeout)\b/u.test(content)
  )
    issues.push(
      textIssue(
        SPECS.uploadLimits,
        file,
        content.search(/upload\./u),
        "multipart/archive input",
        "parser and storage resources"
      )
    );
}

function analyzeAiFile(issues: Issue[], file: SourceRecord): void {
  const content = file.content;
  const model =
    /\b(?:model|openai|anthropic|llm)\s*\.\s*(?:run|generate|complete|create|invoke)\s*\(/iu.exec(
      content
    );
  if (model === null) return;
  const irreversible =
    /\b(?:pay|charge|refund|adjustStock|applyAdjustment|createDebt|postLedger|grantPermission|inventory\.|accounting\.)\s*\(/iu.exec(
      content
    );
  if (irreversible === null) return;
  issues.push(
    textIssue(
      SPECS.aiIrreversible,
      file,
      irreversible.index,
      "model-selected tool arguments",
      "irreversible business operation"
    )
  );
  if (!/\b(?:zod|safeParse|parse|schema|validate)\b/iu.test(content))
    issues.push(
      textIssue(
        SPECS.aiValidation,
        file,
        irreversible.index,
        "model output",
        "sensitive tool arguments"
      )
    );
  if (!/\b(?:confirm|approve|reviewedBy|humanApproval|recordedIntent)\b/iu.test(content))
    issues.push(
      textIssue(
        SPECS.aiConfirmation,
        file,
        irreversible.index,
        "model output",
        "irreversible commit"
      )
    );
}

function analyzeWebhookFile(issues: Issue[], file: SourceRecord): void {
  const content = file.content;
  const webhook = /(?:app|router)\.(?:post|use)\s*\(\s*["'][^"']*webhooks?[^"']*["']/iu.exec(
    content
  );
  if (webhook === null) return;
  const sideEffect =
    /\b(?:charge|pay|grant|fulfill|refund|sendReceipt|entitlement|ledger|invoice)\w*\s*\(/iu.exec(
      content
    );
  const verify = /\b(?:constructEvent|verifySignature|verifyWebhook|webhooks?\.verify)\s*\(/iu.exec(
    content
  );
  if (sideEffect !== null && (verify === null || verify.index > sideEffect.index))
    issues.push(
      textIssue(
        SPECS.webhookSignature,
        file,
        sideEffect.index,
        "unverified webhook payload",
        "payment/entitlement side effect"
      )
    );
  if (verify !== null && /req\.body/u.test(content.slice(verify.index, verify.index + 240)))
    issues.push(
      textIssue(
        SPECS.webhookRaw,
        file,
        verify.index,
        "parsed req.body",
        "provider signature verification"
      )
    );
  if (
    sideEffect !== null &&
    !/\b(?:eventId|event\.id|idempoten|unique|upsert|insert.*event)\b/isu.test(content)
  ) {
    issues.push(
      textIssue(
        SPECS.webhookIdempotency,
        file,
        sideEffect.index,
        "provider delivery",
        "durable side-effect boundary"
      )
    );
    issues.push(
      textIssue(
        SPECS.webhookDuplicate,
        file,
        sideEffect.index,
        "duplicate provider event",
        "repeatable side effect"
      )
    );
  }
}

function analyzeCsvExport(issues: Issue[], file: SourceRecord): void {
  const content = file.content;
  const marker = /text\/csv|\.csv["'`]|attachment\s*\([^)]*\.csv/iu.exec(content);
  if (marker === null) return;
  const assembled = /\.join\s*\(/u.test(content) || /`[^`]*\$\{/u.test(content);
  if (!assembled) return;
  const untrusted =
    containsRequestData(content) ||
    /\b(?:db|prisma|pool|knex|repository|models?)\s*\.\s*\w+/u.test(content);
  if (!untrusted) return;
  const guarded =
    /escapeCsv|escapeFormula|sanitizeCsv|csv-stringify|papaparse|fast-csv|json2csv/iu.test(
      content
    ) || /(?:startsWith|replace|test)\s*\(\s*(?:["']|\/)\^?\[?[=+@-]/u.test(content);
  if (guarded) return;
  issues.push(
    textIssue(
      SPECS.csvFormula,
      file,
      marker.index,
      "untrusted field values",
      "spreadsheet-interpreted CSV output"
    )
  );
}

function analyzeCacheCall(
  issues: Issue[],
  file: SourceRecord,
  node: ts.CallExpression,
  name: string,
  functions: Array<{ start: number; end: number; text: string }>
): void {
  const context = enclosingText(node, file, functions);
  const first = node.arguments[0]?.getText(file.sourceFile) ?? "";
  if (/\buserId\b/u.test(context) && !/userId|user\.id|session\.user/u.test(first))
    issues.push(issue(SPECS.cacheUser, file, node, "authenticated user-specific data", name));
  if (/\btenantId\b|\borganizationId\b/u.test(context) && !/tenantId|organizationId/u.test(first))
    issues.push(issue(SPECS.cacheTenant, file, node, "tenant-specific data", name));
}

function mergeIssues(issues: Issue[]): Finding[] {
  const findings = new Map<string, Finding>();
  const identities = structuralIdentities(issues);
  for (const candidate of issues) {
    const line = lineNumber(candidate.file.content, candidate.start);
    const endLine =
      candidate.end === undefined ? line : lineNumber(candidate.file.content, candidate.end);
    const location: FindingLocation =
      endLine === line
        ? { path: candidate.file.path, line }
        : { path: candidate.file.path, line, end_line: endLine };
    const snapshot: EvidenceSnapshot = {
      path: candidate.file.path,
      sha256: candidate.file.hash,
      line,
      excerpt_hash: sha256(lineText(candidate.file.content, line))
    };
    const trace: TraceEvidence = {
      source: candidate.source,
      sink: candidate.sink,
      description: candidate.evidence
    };
    const identity = identities.get(candidate);
    if (identity === undefined) throw new Error("Analyzer issue lacks structural identity.");
    const instanceId = structuralFindingInstanceId(candidate, identity);
    const current = findings.get(instanceId);
    if (current === undefined) {
      findings.set(instanceId, {
        id: candidate.spec.id,
        instance_id: instanceId,
        section: candidate.spec.section,
        title: candidate.spec.title,
        severity: candidate.spec.severity,
        confidence: candidate.spec.confidence,
        status: "FAIL",
        location: [location],
        evidence: [candidate.evidence],
        impact: candidate.spec.impact,
        recommendation: candidate.spec.recommendation,
        safe_fix: candidate.spec.safeFix,
        verification: candidate.spec.verification,
        standards: candidate.spec.standards,
        analyzer_id: candidate.spec.analyzer,
        trace: [trace],
        evidence_snapshot: [snapshot],
        verification_plan: {
          actions: [
            {
              type: "analyzer",
              analyzer_id: candidate.spec.analyzer,
              finding_id: candidate.spec.id,
              instance_id: instanceId,
              scope_paths: [candidate.file.path],
              absence_proves_resolution: candidate.spec.absenceProvesResolution
            }
          ]
        }
      });
      continue;
    }
    if (
      !current.location.some((item) => item.path === location.path && item.line === location.line)
    )
      current.location.push(location);
    if (!current.evidence.includes(candidate.evidence)) current.evidence.push(candidate.evidence);
    current.trace?.push(trace);
    if (
      !current.evidence_snapshot?.some(
        (item) => item.path === snapshot.path && item.line === snapshot.line
      )
    )
      current.evidence_snapshot?.push(snapshot);
  }
  return [...findings.values()].sort(
    (a, b) => a.id.localeCompare(b.id) || (a.instance_id ?? "").localeCompare(b.instance_id ?? "")
  );
}

/**
 * Stable per-occurrence identity for a rule. Derived from the rule ID, the repository-relative
 * path, and the sink symbol so that it survives unrelated edits to the same file.
 */
export function findingInstanceId(ruleId: string, path: string, sink: string): string {
  const digest = sha256(`${ruleId} ${path} ${sink}`).slice(0, 16);
  return `${ruleId}:${digest}`;
}

type StructuralIdentity = {
  scope: string;
  receiver: string;
  fingerprint: string;
  ordinal: number;
};

function structuralFindingInstanceId(candidate: Issue, identity: StructuralIdentity): string {
  const digest = sha256(
    [
      candidate.spec.id,
      toPosix(candidate.file.path),
      identity.scope,
      identity.receiver,
      sinkFromName(candidate.sink),
      identity.fingerprint,
      String(identity.ordinal)
    ].join("\u0000")
  ).slice(0, 16);
  return `${candidate.spec.id}:${digest}`;
}

function structuralIdentities(issues: Issue[]): Map<Issue, StructuralIdentity> {
  const bases = new Map<string, Issue[]>();
  const parts = new Map<Issue, Omit<StructuralIdentity, "ordinal">>();
  for (const candidate of issues) {
    const scope = containingScope(candidate);
    const receiver = receiverFromSink(candidate.sink);
    const fingerprint = structuralFingerprint(candidate);
    const value = { scope, receiver, fingerprint };
    parts.set(candidate, value);
    const base = [
      candidate.spec.id,
      candidate.file.path,
      scope,
      receiver,
      sinkFromName(candidate.sink),
      fingerprint
    ].join("\u0000");
    const values = bases.get(base) ?? [];
    values.push(candidate);
    bases.set(base, values);
  }
  const result = new Map<Issue, StructuralIdentity>();
  for (const values of bases.values()) {
    const positions = [
      ...new Set(values.map((candidate) => `${candidate.start}:${candidate.end ?? ""}`))
    ].sort((left, right) => {
      const [leftStart = "0", leftEnd = "0"] = left.split(":");
      const [rightStart = "0", rightEnd = "0"] = right.split(":");
      return Number(leftStart) - Number(rightStart) || Number(leftEnd) - Number(rightEnd);
    });
    for (const candidate of values) {
      const part = parts.get(candidate);
      if (part === undefined) continue;
      const key = `${candidate.start}:${candidate.end ?? ""}`;
      result.set(candidate, {
        ...part,
        ordinal: structuralOccurrenceOrdinal(candidate) ?? positions.indexOf(key) + 1
      });
    }
  }
  return result;
}

/**
 * Counts all matching sink nodes in the containing scope, including already-safe peers. This keeps
 * an unresolved peer's identity stable when another occurrence is fixed and disappears from the
 * issue set.
 */
function structuralOccurrenceOrdinal(candidate: Issue): number | undefined {
  const target = candidate.node;
  if (target === undefined) return undefined;
  let scope: ts.Node = candidate.file.sourceFile;
  let parent: ts.Node = target;
  while (!ts.isSourceFile(parent)) {
    if (ts.isFunctionLike(parent)) {
      scope = parent;
      break;
    }
    parent = parent.parent;
  }
  let ordinal = 0;
  const walkScope = (node: ts.Node): number | undefined => {
    if (node !== scope && ts.isFunctionLike(node)) return undefined;
    if (sameStructuralSinkNode(node, target, candidate.file.sourceFile)) {
      ordinal += 1;
      if (node === target) return ordinal;
    }
    return node.forEachChild(walkScope);
  };
  return walkScope(scope);
}

function sameStructuralSinkNode(
  node: ts.Node,
  target: ts.Node,
  sourceFile: ts.SourceFile
): boolean {
  if (ts.isCallExpression(target))
    return ts.isCallExpression(node) && callName(node.expression) === callName(target.expression);
  if (ts.isNewExpression(target))
    return (
      ts.isNewExpression(node) &&
      node.expression.getText(sourceFile) === target.expression.getText(sourceFile)
    );
  if (ts.isJsxOpeningElement(target) || ts.isJsxSelfClosingElement(target)) {
    return (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === target.tagName.getText(sourceFile) &&
      jsxAttributeValue(node, "target") === jsxAttributeValue(target, "target")
    );
  }
  return node.kind === target.kind;
}

function containingScope(candidate: Issue): string {
  let current = candidate.node;
  while (current !== undefined) {
    if (ts.isFunctionLike(current)) {
      const name = functionNodeName(current, candidate.file.sourceFile);
      if (name !== undefined) return `${ts.SyntaxKind[current.kind]}:${name}`;
      if (ts.isCallExpression(current.parent)) {
        const route = routeScopeName(current.parent, candidate.file.sourceFile);
        if (route !== undefined) return route;
      }
      return `${ts.SyntaxKind[current.kind]}:anonymous`;
    }
    current = current.parent;
  }
  const anchor = closestNodeAt(candidate.file.sourceFile, candidate.start);
  return anchor === undefined ? "source-file" : `top-level:${ts.SyntaxKind[anchor.kind]}`;
}

function routeScopeName(node: ts.CallExpression, sourceFile: ts.SourceFile): string | undefined {
  void sourceFile;
  const name = callName(node.expression);
  if (!/(?:^|\.)(?:get|post|put|patch|delete|use)$/u.test(name)) return undefined;
  const route = node.arguments[0];
  return route !== undefined && ts.isStringLiteralLike(route)
    ? `route:${name}:${route.text}`
    : `route:${name}:dynamic`;
}

function structuralFingerprint(candidate: Issue): string {
  const node = candidate.node ?? closestNodeAt(candidate.file.sourceFile, candidate.start);
  if (node !== undefined) return sha256(astShape(node)).slice(0, 20);
  const line = lineText(
    candidate.file.content,
    lineNumber(candidate.file.content, candidate.start)
  );
  return sha256(
    line
      .replace(/["'`][^"'`]*["'`]/gu, "<literal>")
      .replace(/\s+/gu, " ")
      .trim()
  ).slice(0, 20);
}

function astShape(node: ts.Node): string {
  if (ts.isIdentifier(node)) return `Identifier:${node.text}`;
  if (ts.isStringLiteralLike(node)) return `StringLiteral:${sha256(node.text).slice(0, 8)}`;
  if (ts.isNumericLiteral(node)) return `NumericLiteral:${node.text}`;
  const children: string[] = [];
  node.forEachChild((child) => children.push(astShape(child)));
  return `${ts.SyntaxKind[node.kind]}(${children.join(",")})`;
}

function closestNodeAt(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
  let best: ts.Node | undefined;
  const search = (node: ts.Node): void => {
    if (position < node.getFullStart() || position > node.getEnd()) return;
    best = node;
    node.forEachChild(search);
  };
  search(sourceFile);
  return best;
}

function receiverFromSink(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : "<direct>";
}

function sinkFromName(name: string): string {
  return name.split(".").at(-1) ?? name;
}

function spec(
  id: string,
  analyzer: string,
  section: string,
  title: string,
  severity: Severity,
  impact: string,
  recommendation: string,
  safeFix: boolean,
  absenceProvesResolution: boolean,
  verification: string[],
  standards: string[],
  confidence: Confidence = "MEDIUM"
): IssueSpec {
  return {
    id,
    analyzer,
    section,
    title,
    severity,
    confidence,
    impact,
    recommendation,
    safeFix,
    absenceProvesResolution,
    verification,
    standards
  };
}

function issue(
  specValue: IssueSpec,
  file: SourceRecord,
  node: ts.Node,
  source: string,
  sink: string
): Issue {
  return {
    spec: specValue,
    file,
    node,
    start: node.getStart(file.sourceFile),
    end: node.getEnd(),
    evidence: `${source} reaches ${sink} at ${file.path}:${lineNumber(file.content, node.getStart(file.sourceFile))}.`,
    source,
    sink
  };
}

function textIssue(
  specValue: IssueSpec,
  file: SourceRecord,
  start: number,
  source: string,
  sink: string
): Issue {
  const node = closestNodeAt(file.sourceFile, Math.max(0, start));
  return {
    spec: specValue,
    file,
    ...(node === undefined ? {} : { node }),
    start: Math.max(0, start),
    evidence: `${source} reaches ${sink} at ${file.path}:${lineNumber(file.content, Math.max(0, start))}.`,
    source,
    sink
  };
}

function syntheticRecord(absolute: string, path: string, content: string): SourceRecord {
  return {
    absolute,
    path,
    content,
    hash: sha256(content),
    sourceFile: ts.createSourceFile(path, "", ts.ScriptTarget.Latest)
  };
}

function visit(
  node: ts.Node,
  ancestors: ts.Node[],
  callback: (node: ts.Node, ancestors: ts.Node[]) => void
): void {
  callback(node, ancestors);
  node.forEachChild((child) => visit(child, [...ancestors, node], callback));
}

function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression))
    return `${callName(expression.expression)}.${expression.name.text}`;
  if (ts.isElementAccessExpression(expression))
    return `${callName(expression.expression)}.${expression.argumentExpression.getText()}`;
  return expression.getText();
}

function hasInterpolation(
  argumentsValue: ts.NodeArray<ts.Expression>,
  sourceFile: ts.SourceFile
): boolean {
  return argumentsValue.some(
    (argument) =>
      ts.isTemplateExpression(argument) ||
      (ts.isBinaryExpression(argument) &&
        argument.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
      /\$\{|\+\s*req\./u.test(argument.getText(sourceFile))
  );
}

function isSqlSink(name: string): boolean {
  return /(?:^|\.)(?:query|execute|raw|\$queryRawUnsafe|\$executeRawUnsafe)$/u.test(name);
}

function isNoSqlSink(name: string): boolean {
  // Unambiguous ORM/driver methods: the name alone identifies a data-access call.
  if (/(?:^|\.)(?:findMany|aggregate|updateMany|deleteMany)$/u.test(name)) return true;
  // `find` and `findOne` collide with Array.prototype.find and similar collection helpers, so
  // they only count as query sinks when the receiver looks like a data accessor. Without this
  // the analyzer reports every array search as a database query.
  return /(?:^|\.)(?:find|findOne)$/u.test(name) && hasDataAccessReceiver(name);
}

/** Receiver vocabulary that indicates a database, ORM, collection, or repository handle. */
function hasDataAccessReceiver(name: string): boolean {
  const segments = name.split(".");
  if (segments.length < 2) return false;
  return segments
    .slice(0, -1)
    .some(
      (segment) =>
        /^(?:db|database|prisma|knex|sequelize|mongoose|mongo|client|conn|connection|pool|collection|repository|repo|models?|table|store|dataSource|entityManager|em|orm|tx|trx|session)$/iu.test(
          segment
        ) || /(?:Repository|Collection|Model|Table|Store|Dao)$/u.test(segment)
    );
}

function isQuerySink(name: string): boolean {
  return (
    isSqlSink(name) || isNoSqlSink(name) || /(?:^|\.)(?:findUnique|findFirst|findById)$/u.test(name)
  );
}

function isShellSink(name: string): boolean {
  return /(?:^|\.)(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|system)$/u.test(name);
}

function isLogSink(name: string): boolean {
  return /(?:^|\.)(?:log|info|warn|error|debug|trace)$/u.test(name);
}

function isCacheSink(name: string): boolean {
  return /(?:^|\.)(?:get|set|mget|mset|del|invalidate)$/u.test(name) && /redis|cache/u.test(name);
}

function isObjectLookup(name: string): boolean {
  return /(?:^|\.)(?:findUnique|findFirst|findOne|findById)$/u.test(name);
}

function isHttpClientSink(name: string): boolean {
  if (name === "fetch") return true;
  if (/^https?\.(?:get|request)$/u.test(name)) return true;
  return /^(?:axios|got|superagent|undici|needle)(?:\.(?:get|post|put|patch|delete|head|request|fetch|stream))?$/u.test(
    name
  );
}

function isDeserializationSink(name: string): boolean {
  if (name === "eval") return true;
  if (
    /(?:^|\.)(?:unserialize|deserialize|runInContext|runInNewContext|runInThisContext)$/u.test(name)
  )
    return true;
  return /(?:^|\.)load$/u.test(name) && /yaml/iu.test(name);
}

function isModelWriteSink(name: string): boolean {
  // Unambiguous persistence methods.
  if (/(?:^|\.)(?:updateOne|insertOne)$/u.test(name)) return true;
  // `create`, `update`, `insert`, `save`, and `assign` are common on non-persistence objects
  // (Object.assign, factory helpers), so they require a data-access receiver.
  return /(?:^|\.)(?:create|update|insert|save|assign)$/u.test(name) && hasDataAccessReceiver(name);
}

function referencesWholeRequestBody(argument: ts.Expression, sourceFile: ts.SourceFile): boolean {
  let found = false;
  const check = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(node) &&
      /^(?:req|request)\.body$/u.test(node.getText(sourceFile)) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) &&
      !(ts.isElementAccessExpression(node.parent) && node.parent.expression === node)
    ) {
      found = true;
      return;
    }
    node.forEachChild(check);
  };
  check(argument);
  return found;
}

function isModelSink(name: string): boolean {
  return /(?:model|openai|anthropic|llm).*(?:run|generate|complete|create|invoke)$/iu.test(name);
}

function isPaymentSink(name: string): boolean {
  return /(?:payment|stripe|charge|invoice|checkout).*(?:create|pay|charge|confirm)|(?:createPaymentIntent|charge)$/iu.test(
    name
  );
}

function containsRequestData(text: string): boolean {
  return /\b(?:req|request)\.(?:body|params|query|headers|file|files)\b/u.test(text);
}

function containsSensitiveLogData(text: string): boolean {
  return /(?:req|request)\.(?:body|headers)|\b(?:password|secret|token|authorization|creditCard|ssn)\b/iu.test(
    text
  );
}

/** Resolves the strongest taint origin across a call's arguments. */
function resolveArgumentTaint(
  node: ts.CallExpression,
  file: SourceRecord,
  taint: TaintModel
): TaintOrigin | undefined {
  for (const argument of node.arguments) {
    const origin = taint.resolve(argument);
    if (origin !== undefined) return origin;
  }
  void file;
  return undefined;
}

/**
 * True only when every request-controlled value reaching this call carries one of the requested
 * typed protections. A protection on a neighbouring value or unrelated call proves nothing.
 */
function argumentsHaveProtection(
  node: ts.CallExpression,
  file: SourceRecord,
  taint: TaintModel,
  kinds: ProtectionKind[]
): boolean {
  const relevant = node.arguments.flatMap((argument) =>
    collectTaintedValueExpressions(argument, file.sourceFile, taint)
  );
  if (relevant.length === 0) return false;
  return relevant.every((expression) =>
    kinds.some((kind) => taint.hasProtection(expression, kind))
  );
}

function collectTaintedValueExpressions(
  node: ts.Expression,
  sourceFile: ts.SourceFile,
  taint: TaintModel
): ts.Expression[] {
  const values: ts.Expression[] = [];
  const collect = (candidate: ts.Node): void => {
    if (!ts.isExpression(candidate)) {
      candidate.forEachChild(collect);
      return;
    }
    const origin = taint.resolve(candidate);
    if (origin !== undefined) {
      const directRequest = containsRequestData(candidate.getText(sourceFile));
      const transformed =
        (ts.isCallExpression(candidate) || ts.isNewExpression(candidate)) &&
        taint.protections(candidate).length > 0;
      if (ts.isIdentifier(candidate) || directRequest || transformed) {
        values.push(candidate);
        return;
      }
    }
    candidate.forEachChild(collect);
  };
  collect(node);
  return values;
}

/** Fixed executable + argument array + no shell + validated/allowlisted untrusted arguments. */
function isShellSeparatedCall(
  node: ts.CallExpression,
  file: SourceRecord,
  taint: TaintModel
): boolean {
  const name = callName(node.expression);
  if (!/(?:^|\.)(?:spawn|spawnSync|execFile|execFileSync)$/u.test(name)) return false;
  const executable = node.arguments[0];
  if (
    executable === undefined ||
    !(ts.isStringLiteralLike(executable) || ts.isNoSubstitutionTemplateLiteral(executable))
  )
    return false;
  const options = node.arguments.find(ts.isObjectLiteralExpression);
  if (
    options?.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(file.sourceFile) === "shell" &&
        property.initializer.kind === ts.SyntaxKind.TrueKeyword
    )
  )
    return false;
  const argumentValue = node.arguments[1];
  if (argumentValue === undefined) return false;
  const argumentArray = ts.isArrayLiteralExpression(argumentValue)
    ? argumentValue
    : ts.isIdentifier(argumentValue)
      ? findArrayInitializer(argumentValue, node, file.sourceFile)
      : undefined;
  if (argumentArray === undefined) return false;
  const untrusted = argumentArray.elements.flatMap((element) =>
    ts.isExpression(element) ? collectTaintedValueExpressions(element, file.sourceFile, taint) : []
  );
  return (
    untrusted.length > 0 &&
    untrusted.every(
      (expression) =>
        taint.hasProtection(expression, "validated") ||
        taint.hasProtection(expression, "allowlisted")
    )
  );
}

function findArrayInitializer(
  identifier: ts.Identifier,
  before: ts.Node,
  sourceFile: ts.SourceFile
): ts.ArrayLiteralExpression | undefined {
  let best: ts.VariableDeclaration | undefined;
  visit(sourceFile, [], (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === identifier.text &&
      node.initializer !== undefined &&
      ts.isArrayLiteralExpression(node.initializer) &&
      node.getStart(sourceFile) < before.getStart(sourceFile) &&
      (best === undefined || node.getStart(sourceFile) > best.getStart(sourceFile))
    )
      best = node;
  });
  return best?.initializer !== undefined && ts.isArrayLiteralExpression(best.initializer)
    ? best.initializer
    : undefined;
}

function isConstrainedRedirect(
  node: ts.CallExpression,
  file: SourceRecord,
  taint: TaintModel
): boolean {
  const target = node.arguments[0];
  if (target === undefined) return false;
  if (taint.hasProtection(target, "allowlisted", "destination")) return true;
  return hasDominatingGuard(node, file.sourceFile, (call) => {
    // The guard must be an actual membership operation on a collection. A receiver named
    // `allowedRedirects` is a discovery hint; `.has`/`.includes` is the structural evidence.
    if (!isMembershipCheck(call)) return undefined;
    const argument = call.arguments[0];
    return argument !== undefined && sameTaintedValue(argument, target, taint)
      ? "deny-when-false"
      : undefined;
  });
}

/** `<collection>.has(value)` or `<collection>.includes(value)` — a real membership operation. */
function isMembershipCheck(call: ts.CallExpression): boolean {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  return callee.name.text === "has" || callee.name.text === "includes";
}

function isNetworkConstrainedTarget(
  sink: ts.CallExpression,
  target: ts.Expression | undefined,
  file: SourceRecord,
  taint: TaintModel
): boolean {
  if (target === undefined) return false;
  const redirectConstrained = hasExplicitRedirectConstraint(sink, file.sourceFile);
  if (
    taint.hasProtection(target, "trusted-origin", "network") &&
    taint.hasProtection(target, "network-constrained", "network")
  )
    return redirectConstrained;
  const allowlisted = hasDominatingGuard(sink, file.sourceFile, (call) => {
    if (!isMembershipCheck(call)) return undefined;
    const argument = call.arguments[0];
    return argument !== undefined && sameTaintedValue(argument, target, taint)
      ? "deny-when-false"
      : undefined;
  });
  const privateBlocked = hasDominatingGuard(sink, file.sourceFile, (call) => {
    const name = callName(call.expression);
    if (!/(?:isPrivate|isLinkLocal|isInternal|privateAddress|linkLocal)/iu.test(name))
      return undefined;
    const argument = call.arguments[0];
    return argument !== undefined && sameTaintedValue(argument, target, taint)
      ? "deny-when-true"
      : undefined;
  });
  return allowlisted && privateBlocked && redirectConstrained;
}

function hasExplicitRedirectConstraint(
  sink: ts.CallExpression,
  sourceFile: ts.SourceFile
): boolean {
  return sink.arguments.some(
    (argument) =>
      ts.isObjectLiteralExpression(argument) &&
      argument.properties.some((property) => {
        if (!ts.isPropertyAssignment(property)) return false;
        const key = property.name.getText(sourceFile).replace(/["']/gu, "");
        if (key === "redirect" && ts.isStringLiteralLike(property.initializer))
          return ["manual", "error"].includes(property.initializer.text.toLowerCase());
        return key === "maxRedirects" && property.initializer.getText(sourceFile) === "0";
      })
  );
}

function hasObjectAuthorization(
  sink: ts.CallExpression,
  file: SourceRecord,
  taint: TaintModel
): boolean {
  if (queryEmbedsTrustedScope(sink, file.sourceFile)) return true;
  const objectSources = new Set(
    sink.arguments
      .flatMap((argument) => collectTaintedValueExpressions(argument, file.sourceFile, taint))
      .map((expression) => taint.resolve(expression)?.source)
      .filter((source): source is string => source !== undefined)
  );
  if (objectSources.size === 0) return false;

  const connected = (call: ts.CallExpression): boolean => {
    const argumentsValue = [...call.arguments];
    const hasSubject = argumentsValue.some((argument) =>
      isTrustedSubjectExpression(argument, file.sourceFile)
    );
    const hasObject = argumentsValue.some((argument) => {
      const source = taint.resolve(argument)?.source;
      return source !== undefined && objectSources.has(source);
    });
    return hasSubject && hasObject;
  };

  for (const statement of precedingStatements(sink)) {
    const candidate = unconditionalExpressionCall(statement);
    if (candidate === undefined || !connected(candidate)) continue;
    const name = callName(candidate.expression);
    if (
      /(?:^|\.)(?:authorize|assertCanAccess|requireAccess|enforcePolicy|authorizeObject)$/iu.test(
        name
      )
    )
      return true;
  }

  return hasDominatingGuard(sink, file.sourceFile, (call) => {
    const name = callName(call.expression);
    if (!/(?:canAccess|isAuthorized|policy|permit|allowed)/iu.test(name) || !connected(call))
      return undefined;
    return "deny-when-false";
  });
}

function unconditionalExpressionCall(statement: ts.Statement): ts.CallExpression | undefined {
  if (!ts.isExpressionStatement(statement)) return undefined;
  let expression = statement.expression;
  while (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression))
    expression = expression.expression;
  return ts.isCallExpression(expression) ? expression : undefined;
}

function queryEmbedsTrustedScope(node: ts.CallExpression, sourceFile: ts.SourceFile): boolean {
  let connected = false;
  for (const argument of node.arguments) {
    visit(argument, [], (candidate) => {
      if (connected || !ts.isPropertyAssignment(candidate)) return;
      if (!isQueryPredicateProperty(candidate, argument, sourceFile)) return;
      const key = candidate.name.getText(sourceFile).replace(/["']/gu, "");
      if (/^(?:ownerId|userId|subjectId|createdById)$/iu.test(key))
        connected = isTrustedSubjectExpression(candidate.initializer, sourceFile);
      if (/^(?:tenantId|organizationId|workspaceId)$/iu.test(key))
        connected = isTrustedTenantExpression(candidate.initializer, sourceFile);
    });
  }
  return connected;
}

function isQueryPredicateProperty(
  property: ts.PropertyAssignment,
  argument: ts.Expression,
  sourceFile: ts.SourceFile
): boolean {
  let current: ts.Node = property.parent;
  while (current !== argument) {
    if (ts.isPropertyAssignment(current)) {
      const key = current.name.getText(sourceFile).replace(/["']/gu, "");
      if (/^(?:where|filter|query|match)$/iu.test(key)) return true;
      if (/^(?:data|select|include|create|update|projection)$/iu.test(key)) return false;
    }
    if (ts.isSourceFile(current)) return false;
    current = current.parent;
  }
  return ts.isObjectLiteralExpression(argument) && property.parent === argument;
}

function isTrustedSubjectExpression(node: ts.Expression, sourceFile: ts.SourceFile): boolean {
  const text = node.getText(sourceFile).replace(/\s+/gu, "");
  return /^(?:req|request)\.(?:user|auth(?:\.user)?)(?:\.(?:id|userId|subjectId))?|^(?:session|auth|ctx\.state|context|locals)\.user(?:\.(?:id|userId|subjectId))?|^(?:currentUser|authenticatedUser|subject)\.(?:id|userId|subjectId)$/u.test(
    text
  );
}

function isTrustedTenantExpression(node: ts.Expression, sourceFile: ts.SourceFile): boolean {
  const text = node.getText(sourceFile).replace(/\s+/gu, "");
  return /^(?:req|request)\.(?:auth|user)\.(?:tenantId|organizationId|workspaceId)|^(?:session\.user|auth\.user|ctx\.state|context)\.(?:tenantId|organizationId|workspaceId)|^(?:trustedTenant|tenantContext)\.(?:id|tenantId|organizationId)$/u.test(
    text
  );
}

type GuardMeaning = "deny-when-true" | "deny-when-false";

function hasDominatingGuard(
  sink: ts.Node,
  sourceFile: ts.SourceFile,
  classify: (call: ts.CallExpression) => GuardMeaning | undefined
): boolean {
  for (const statement of precedingStatements(sink)) {
    if (!ts.isIfStatement(statement) || !abruptlyExits(statement.thenStatement)) continue;
    const calls: ts.CallExpression[] = [];
    visit(statement.expression, [], (candidate) => {
      if (ts.isCallExpression(candidate)) calls.push(candidate);
    });
    for (const candidate of calls) {
      const meaning = classify(candidate);
      if (meaning === undefined) continue;
      const negated = isWithinNegation(candidate, statement.expression);
      if ((meaning === "deny-when-true" && !negated) || (meaning === "deny-when-false" && negated))
        return true;
    }
  }
  void sourceFile;
  return false;
}

function precedingStatements(node: ts.Node): ts.Statement[] {
  let statement: ts.Node = node;
  while (!ts.isStatement(statement)) {
    if (ts.isSourceFile(statement)) return [];
    statement = statement.parent;
  }
  const parent = statement.parent;
  const statements = ts.isBlock(parent) || ts.isSourceFile(parent) ? [...parent.statements] : [];
  const position = statements.indexOf(statement);
  return position < 0 ? [] : statements.slice(0, position);
}

function abruptlyExits(node: ts.Statement): boolean {
  if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true;
  if (ts.isBlock(node)) {
    const last = node.statements.at(-1);
    return last !== undefined && abruptlyExits(last);
  }
  if (ts.isIfStatement(node))
    return (
      node.elseStatement !== undefined &&
      abruptlyExits(node.thenStatement) &&
      abruptlyExits(node.elseStatement)
    );
  return false;
}

function isWithinNegation(node: ts.Node, boundary: ts.Node): boolean {
  let current = node.parent;
  let negated = false;
  for (;;) {
    if (ts.isPrefixUnaryExpression(current) && current.operator === ts.SyntaxKind.ExclamationToken)
      negated = !negated;
    if (current === boundary || ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return negated;
}

function sameTaintedValue(left: ts.Expression, right: ts.Expression, taint: TaintModel): boolean {
  const leftSource = taint.resolve(left)?.source;
  const rightSource = taint.resolve(right)?.source;
  return leftSource !== undefined && leftSource === rightSource;
}

function isBackgroundExecutionContext(node: ts.Node, file: SourceRecord): boolean {
  if (/(?:^|\/)(?:jobs?|workers?|queues?|exports?)(?:\/|\.|-)/iu.test(file.path)) return true;
  let current: ts.Node = node;
  for (;;) {
    const name = functionNodeName(current, file.sourceFile);
    if (name !== undefined && /(?:job|worker|queue|export)/iu.test(name)) return true;
    if (ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return false;
}

function functionNodeName(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node)
  )
    return node.name?.getText(sourceFile);
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  )
    return node.parent.name.text;
  return undefined;
}

/**
 * True when the resolved flow reached the sink through string interpolation or concatenation,
 * even though the sink argument itself is a plain identifier.
 */
function flowPassedThroughInterpolation(flow: TaintOrigin | undefined): boolean {
  return (
    flow?.steps.some(
      (step) => step.includes("template literal") || step.includes("string concatenation")
    ) ?? false
  );
}

/** Renders the source for evidence, preferring a resolved data-flow origin over raw text. */
function flowSource(flow: TaintOrigin | undefined, text: string): string {
  if (flow === undefined) return requestSource(text);
  return flow.steps.length === 0 ? flow.source : `${flow.source} (${flow.steps.join(" -> ")})`;
}

function requestSource(text: string): string {
  return (
    /(?:req|request)\.(?:body|params|query|headers|file|files)(?:\.[A-Za-z0-9_$]+)?/u.exec(
      text
    )?.[0] ?? "request-controlled data"
  );
}

function collectFunctionRanges(
  sourceFile: ts.SourceFile
): Array<{ start: number; end: number; text: string }> {
  const ranges: Array<{ start: number; end: number; text: string }> = [];
  visit(sourceFile, [], (node) => {
    if (ts.isFunctionLike(node))
      ranges.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: node.getText(sourceFile)
      });
  });
  return ranges.sort((a, b) => a.end - a.start - (b.end - b.start));
}

function enclosingText(
  node: ts.Node,
  file: SourceRecord,
  functions: Array<{ start: number; end: number; text: string }>
): string {
  const start = node.getStart(file.sourceFile);
  return (
    functions.find((range) => range.start <= start && range.end >= node.getEnd())?.text ??
    file.content
  );
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function collectLabelIds(sourceFile: ts.SourceFile): Set<string> {
  const ids = new Set<string>();
  visit(sourceFile, [], (node) => {
    if (
      (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) ||
      node.tagName.getText(sourceFile).toLowerCase() !== "label"
    )
      return;
    const value = jsxAttributeValue(node, "htmlFor");
    if (value !== undefined) ids.add(value);
  });
  return ids;
}

function hasAccessibleName(node: ts.JsxOpeningLikeElement, labelIds: Set<string>): boolean {
  if (
    jsxAttributeValue(node, "aria-label") !== undefined ||
    jsxAttributeValue(node, "aria-labelledby") !== undefined ||
    jsxAttributeValue(node, "title") !== undefined
  )
    return true;
  const id = jsxAttributeValue(node, "id");
  return id !== undefined && labelIds.has(id);
}

function hasJsxAttribute(node: ts.JsxOpeningLikeElement, name: string, expected: string): boolean {
  return jsxAttributeValue(node, name)?.toLowerCase() === expected;
}

function hasRelTokens(node: ts.JsxOpeningLikeElement): boolean {
  const rel = jsxAttributeValue(node, "rel")?.toLowerCase().split(/\s+/u) ?? [];
  return rel.includes("noopener") && rel.includes("noreferrer");
}

function jsxAttributeValue(node: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attribute = node.attributes.properties.find(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) && candidate.name.getText() === name
  );
  if (attribute?.initializer === undefined) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression !== undefined &&
    ts.isStringLiteralLike(attribute.initializer.expression)
  )
    return attribute.initializer.expression.text;
  return undefined;
}

function isEnvironmentTemplate(path: string): boolean {
  return (
    /(?:^|\/)\.env\.(?:example|sample|template|defaults)$/iu.test(path) ||
    /(?:^|\/)(?:env\.example|environment\.example)$/iu.test(path)
  );
}

function looksLikeSecret(value: string): boolean {
  return (
    value.length >= 12 && !isPlaceholder(value) && /[A-Za-z]/u.test(value) && /[0-9_-]/u.test(value)
  );
}

function isPlaceholder(value: string): boolean {
  return (
    value.length === 0 ||
    /^(?:your[-_ ]|example|sample|test|dummy|placeholder|changeme|xxx|<|\$\{|\*+)/iu.test(value) ||
    /example\.com/iu.test(value)
  );
}

function isGlobalHeaderSource(source: string): boolean {
  return ["/(.*)", "/(.*)?", "/*", "/:path*"].includes(source);
}

function scriptKind(extension: string): ts.ScriptKind {
  if ([".tsx", ".jsx"].includes(extension)) return ts.ScriptKind.TSX;
  if ([".js", ".mjs", ".cjs"].includes(extension)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function lineText(content: string, line: number): string {
  return content.split(/\r?\n/u)[line - 1] ?? "";
}

function offsetForLine(content: string, line: number): number {
  let offset = 0;
  const lines = content.split(/(?<=\n)/u);
  for (let index = 0; index < line - 1; index += 1) offset += lines[index]?.length ?? 0;
  return offset;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
