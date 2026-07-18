import { extname, relative } from "node:path";
import ts from "typescript";
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
const SPECS = {
    sql: spec("FF-SEC-SQL-001", "js-ts-security", "security", "Request-controlled data reaches an interpolated SQL execution sink", "HIGH", "Request input can alter the query structure and read or modify unintended data.", "Use the database driver's parameter binding and add a negative injection regression test.", false, false, ["Re-run the js-ts-security analyzer", "Run a hostile-input query regression test"], ["OWASP ASVS 5.0", "CWE-89"]),
    nosql: spec("FF-SEC-NOSQL-001", "js-ts-security", "security", "Request-controlled object reaches a NoSQL filter sink", "HIGH", "Request-supplied operators can change query meaning or bypass intended filters.", "Validate an allowlisted scalar filter schema and construct the final query server-side.", false, false, ["Re-run the js-ts-security analyzer", "Run negative operator-injection tests"], ["OWASP ASVS 5.0", "CWE-943"]),
    shell: spec("FF-SEC-SHELL-001", "js-ts-security", "security", "Request-controlled data reaches shell execution", "CRITICAL", "An attacker may execute commands with the application process privileges.", "Remove the shell boundary or use an allowlisted executable with a validated argument array.", false, false, ["Re-run the js-ts-security analyzer", "Run hostile metacharacter regression tests"], ["OWASP ASVS 5.0", "CWE-78"]),
    redirect: spec("FF-SEC-REDIRECT-001", "js-ts-security", "security", "Request-controlled redirect target is not constrained", "HIGH", "An attacker can send users to an untrusted origin and support phishing or token leakage.", "Map redirect choices to server-owned relative destinations or an explicit origin allowlist.", false, false, ["Re-run the js-ts-security analyzer", "Test absolute, protocol-relative, and encoded targets"], ["OWASP Unvalidated Redirects and Forwards Cheat Sheet", "CWE-601"]),
    credential: spec("FF-SEC-CREDENTIAL-001", "js-ts-security", "security", "Obvious credential-like constant is hard-coded", "HIGH", "A committed credential can grant unauthorized access and persist in repository history.", "Move the value to an approved secret store and rotate it if it was ever valid.", false, false, [
        "Re-run the js-ts-security analyzer",
        "Verify provider-side revocation without logging the value"
    ], ["OWASP Secrets Management Cheat Sheet", "CWE-798"]),
    sensitiveLog: spec("FF-SEC-LOG-001", "js-ts-security", "security", "Sensitive request data reaches a logging sink", "HIGH", "Credentials or personal data can persist in logs beyond the request boundary.", "Log an allowlisted event shape and redact supported sensitive fields before serialization.", false, false, ["Re-run the js-ts-security analyzer", "Exercise the request and inspect captured logs"], ["OWASP Logging Cheat Sheet", "CWE-532"]),
    validation: spec("FF-SEC-VALIDATION-001", "js-ts-security", "security", "Supported high-risk sink lacks demonstrated server-side validation", "HIGH", "Malformed or hostile input reaches a boundary that depends on trusted shape or meaning.", "Validate and normalize the input immediately before constructing the supported sink input.", false, false, ["Re-run the js-ts-security analyzer", "Run schema rejection tests at the server boundary"], ["OWASP ASVS 5.0", "CWE-20"]),
    objectAuth: spec("FF-AUTHZ-OBJECT-001", "js-ts-authorization", "authorization", "Object lookup lacks a demonstrated subject/object authorization predicate", "HIGH", "An authenticated caller may read or modify another subject's object by changing its identifier.", "Bind the final lookup to the authenticated subject or enforce a per-object policy before release.", false, false, ["Re-run the js-ts-authorization analyzer", "Run negative tests with another user's object ID"], ["OWASP API Security Top 10 2023 API1", "CWE-639"]),
    tenantInput: spec("FF-TENANT-INPUT-001", "js-ts-tenancy", "tenancy", "Tenant context is accepted from untrusted request input", "CRITICAL", "A caller can select another tenant's data boundary.", "Derive tenant context from authenticated identity and pass it through trusted server context.", false, false, ["Re-run the js-ts-tenancy analyzer", "Run a negative cross-tenant identifier test"], ["OWASP Multi Tenant Security Cheat Sheet", "CWE-639"]),
    tenantScope: spec("FF-TENANT-SCOPE-001", "js-ts-tenancy", "tenancy", "Tenant-owned query is not scoped by authenticated tenant identity", "CRITICAL", "Records can cross tenant boundaries at the final data-access sink.", "Include the authenticated tenant predicate in the final query and enforce it in negative tests.", false, false, ["Re-run the js-ts-tenancy analyzer", "Run same-ID tests in two tenants"], ["OWASP Multi Tenant Security Cheat Sheet", "CWE-284"]),
    tenantBackground: spec("FF-TENANT-BACKGROUND-001", "js-ts-tenancy", "tenancy", "Background or export access is unscoped for tenant-owned data", "HIGH", "Asynchronous work can aggregate or disclose records across tenants.", "Persist trusted tenant context with the job/export and require it in every data query.", false, false, ["Re-run the js-ts-tenancy analyzer", "Run a multi-tenant job/export isolation test"], ["OWASP Multi Tenant Security Cheat Sheet"]),
    uploadAny: spec("FF-UPLOAD-ANY-001", "js-ts-uploads", "uploads", "Upload middleware accepts unrestricted file fields", "HIGH", "Attackers can submit unbounded file counts and unexpected file types.", "Replace upload.any() with explicit fields and existing policy-backed count and byte limits.", false, false, ["Re-run the js-ts-uploads analyzer", "Test excess fields, counts, and bytes"], ["OWASP File Upload Cheat Sheet", "CWE-434"]),
    uploadExtension: spec("FF-UPLOAD-EXTENSION-001", "js-ts-uploads", "uploads", "Upload acceptance relies on filename extension", "HIGH", "A renamed active or malformed file can pass the content policy.", "Validate decoded content and file signatures against an allowlisted type.", false, false, ["Re-run the js-ts-uploads analyzer", "Test extension/content mismatches"], ["OWASP File Upload Cheat Sheet"]),
    uploadMime: spec("FF-UPLOAD-MIME-001", "js-ts-uploads", "uploads", "Client MIME is trusted without decoded or signature validation", "HIGH", "A client can spoof Content-Type and submit unsupported active content.", "Treat client MIME as a hint and validate signature plus decoded output.", false, false, ["Re-run the js-ts-uploads analyzer", "Test MIME/signature mismatches"], ["OWASP File Upload Cheat Sheet", "CWE-434"]),
    uploadPublic: spec("FF-UPLOAD-PUBLIC-001", "js-ts-uploads", "uploads", "Untrusted upload is stored publicly before quarantine approval", "CRITICAL", "Hostile bytes can be fetched before security decisions complete.", "Write to private quarantine and publish only after every required scanner approves.", false, false, ["Re-run the js-ts-uploads analyzer", "Attempt access before and after scanner approval"], ["OWASP File Upload Cheat Sheet"]),
    uploadScan: spec("FF-UPLOAD-SCAN-001", "js-ts-uploads", "uploads", "Upload path has no demonstrated malware-scan boundary", "HIGH", "Untrusted content may reach durable or public storage without a security decision.", "Insert an approved scanner between private quarantine and release.", false, false, ["Re-run the js-ts-uploads analyzer", "Run clean, malicious, timeout, and scanner-error tests"], ["OWASP File Upload Cheat Sheet"]),
    uploadFailOpen: spec("FF-UPLOAD-SCAN-ERROR-001", "js-ts-uploads", "uploads", "Scanner error path can release an upload", "CRITICAL", "Scanner outages or malformed files can bypass quarantine.", "Fail closed on scanner error or timeout and keep the object private.", false, false, ["Re-run the js-ts-uploads analyzer", "Force scanner error and timeout paths"], ["OWASP File Upload Cheat Sheet", "CWE-636"]),
    uploadFilename: spec("FF-UPLOAD-FILENAME-001", "js-ts-uploads", "uploads", "Original filename is used in a storage path", "HIGH", "Traversal, collision, Unicode, and active-content naming can affect storage or delivery.", "Generate an opaque server-owned object key and store the original name only as sanitized metadata.", false, false, ["Re-run the js-ts-uploads analyzer", "Test traversal and collision filenames"], ["OWASP File Upload Cheat Sheet", "CWE-22"]),
    uploadLimits: spec("FF-UPLOAD-LIMITS-001", "js-ts-uploads", "uploads", "Supported upload path lacks bounded count, byte, archive, or parser limits", "HIGH", "An attacker can exhaust memory, storage, CPU, or parser resources.", "Enforce existing policy values for count, bytes, archive expansion, and parser time before processing.", false, false, ["Re-run the js-ts-uploads analyzer", "Exercise boundary and over-limit cases"], ["OWASP File Upload Cheat Sheet", "CWE-400"]),
    nPlusOne: spec("FF-QUERY-N1-001", "js-ts-queries-cache", "queries", "Data query executes inside a loop", "HIGH", "Query count grows with parent rows and can exhaust latency and connection budgets.", "Batch, join, or preload the child relation and assert a bounded query count.", false, false, ["Re-run the js-ts-queries-cache analyzer", "Run a representative query-count test"], ["OWASP ASVS 5.0", "CWE-400"]),
    unbounded: spec("FF-QUERY-UNBOUNDED-001", "js-ts-queries-cache", "queries", "Collection query has no enforced bound", "HIGH", "Large tables can cause excessive response size, memory use, and database load.", "Apply the existing application page-size policy and stable pagination at the query boundary.", false, false, ["Re-run the js-ts-queries-cache analyzer", "Test the maximum page boundary"], ["OWASP API Security Top 10 2023 API4"]),
    paginationOrder: spec("FF-QUERY-ORDER-001", "js-ts-queries-cache", "queries", "Paginated query lacks deterministic ordering", "MEDIUM", "Rows can be duplicated or skipped between pages.", "Add a stable order including a unique tie-breaker consistent with the existing API contract.", false, false, ["Re-run the js-ts-queries-cache analyzer", "Run insert-between-pages regression tests"], ["PostgreSQL 18 documentation"]),
    cacheUser: spec("FF-CACHE-USER-001", "js-ts-queries-cache", "cache", "User-specific cache key omits user identity", "CRITICAL", "Cached private data can be returned to another user.", "Include the authenticated user identity in the key and test two users against the same resource.", false, false, ["Re-run the js-ts-queries-cache analyzer", "Run a two-user isolation test"], ["OWASP ASVS 5.0"]),
    cacheTenant: spec("FF-CACHE-TENANT-001", "js-ts-queries-cache", "cache", "Tenant-specific cache key omits tenant identity", "CRITICAL", "Cached data or invalidation can cross tenant boundaries.", "Include authenticated tenant identity in keys and invalidation paths.", false, false, ["Re-run the js-ts-queries-cache analyzer", "Run same-ID tests in two tenants"], ["OWASP Multi Tenant Security Cheat Sheet"]),
    aiPrompt: spec("FF-AI-PROMPT-001", "js-ts-ai", "ai", "Untrusted document text is concatenated into model instructions", "HIGH", "Hostile document content can influence system or tool behavior.", "Keep document text in an isolated data field and enforce tool policy outside the model prompt.", false, false, ["Re-run the js-ts-ai analyzer", "Execute indirect prompt-injection evaluations"], ["OWASP LLM Prompt Injection Prevention Cheat Sheet"]),
    aiIrreversible: spec("FF-AI-IRREVERSIBLE-001", "js-ts-ai", "ai", "Model output can directly invoke an irreversible business action", "CRITICAL", "A probabilistic or manipulated output can commit financial, inventory, accounting, or permission changes.", "Require deterministic authorization, validated arguments, and a recorded confirmation before commit.", false, false, [
        "Re-run the js-ts-ai analyzer",
        "Test denial and confirmation paths with hostile model output"
    ], ["OWASP AI Agent Security Cheat Sheet"]),
    aiValidation: spec("FF-AI-OUTPUT-001", "js-ts-ai", "ai", "Model output lacks structured validation before a sensitive boundary", "HIGH", "Malformed or hallucinated identifiers and amounts can reach sensitive tools.", "Validate strict structured output and independently resolve identifiers and totals.", false, false, ["Re-run the js-ts-ai analyzer", "Run malformed-output and unknown-field evaluations"], ["OWASP AI Agent Security Cheat Sheet"]),
    aiConfirmation: spec("FF-AI-CONFIRM-001", "js-ts-ai", "ai", "Irreversible AI action has no demonstrated human or deterministic confirmation", "CRITICAL", "A single model response can cause irreversible harm without an independent decision boundary.", "Bind execution to a server-recorded approval or deterministic confirmation policy.", false, false, ["Re-run the js-ts-ai analyzer", "Prove an unconfirmed action cannot commit"], ["OWASP AI Agent Security Cheat Sheet"]),
    webhookSignature: spec("FF-PAY-WEBHOOK-SIGNATURE-001", "js-ts-payments", "payments", "Payment webhook side effects occur without prior signature verification", "CRITICAL", "Forged events can create financial or entitlement side effects.", "Verify the provider signature over raw bytes before parsing or performing side effects.", false, false, ["Re-run the js-ts-payments analyzer", "Send unsigned and invalid-signature events"], ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]),
    webhookRaw: spec("FF-PAY-WEBHOOK-RAW-001", "js-ts-payments", "payments", "Webhook signature verification uses a parsed payload", "HIGH", "Payload reserialization can invalidate or weaken provider signature verification.", "Preserve and verify the exact raw request bytes required by the provider.", false, false, ["Re-run the js-ts-payments analyzer", "Test byte-preserving signature verification"], ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]),
    webhookIdempotency: spec("FF-PAY-IDEMPOTENCY-001", "js-ts-payments", "payments", "Provider event lacks a durable idempotency boundary", "CRITICAL", "Retries or concurrent deliveries can repeat financial or entitlement effects.", "Atomically persist the provider event ID under a unique constraint before side effects.", false, false, ["Re-run the js-ts-payments analyzer", "Replay and concurrently deliver the same event"], ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]),
    webhookDuplicate: spec("FF-INTEGRATION-DUPLICATE-001", "js-ts-payments", "integrations", "Duplicate webhook delivery can repeat a side effect", "HIGH", "Provider retries can duplicate fulfillment, notification, ledger, or entitlement changes.", "Make side effects conditional on an atomically claimed durable event identifier.", false, false, ["Re-run the js-ts-payments analyzer", "Replay the same provider event"], ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]),
    clientAmount: spec("FF-PAY-AMOUNT-001", "js-ts-payments", "payments", "Client-controlled amount reaches a payment request", "CRITICAL", "A caller can alter the charged amount or currency outside server-owned pricing rules.", "Resolve the amount and currency from server-owned product or invoice records.", false, false, ["Re-run the js-ts-payments analyzer", "Tamper with amount and currency inputs"], ["OWASP Third Party Payment Gateway Integration Cheat Sheet"]),
    missingLabel: spec("FF-A11Y-LABEL-001", "js-ts-accessibility", "accessibility", "Form control has no structurally detectable accessible name", "HIGH", "Screen-reader and voice-control users may be unable to identify the field.", "Associate a visible label or an appropriate accessible name with the control.", false, true, ["Re-run the js-ts-accessibility analyzer", "Inspect the browser accessibility tree"], ["WCAG 2.2 SC 1.3.1", "WCAG 2.2 SC 4.1.2"]),
    blankRel: spec("FF-FRONTEND-BLANK-001", "js-ts-frontend-safety", "frontend", "target=_blank link lacks noopener and noreferrer", "MEDIUM", "The opened page can retain opener access or receive referrer data.", 'Add rel="noopener noreferrer" to the proven target=_blank link.', true, true, ["Re-run the js-ts-frontend-safety analyzer", "Parse the link and confirm both rel tokens"], ["OWASP Reverse Tabnabbing guidance"]),
    envTemplate: spec("FF-ENV-TEMPLATE-001", "structured-config-safety", "security", "Environment template contains an actual-looking credential", "HIGH", "Published templates can disclose a credential.", "Replace the template value with an explicit placeholder and rotate it if it was ever valid.", true, false, ["Re-run the structured-config-safety analyzer", "Verify provider-side rotation manually"], ["OWASP Secrets Management Cheat Sheet"]),
    secureHeader: spec("FF-DEPLOY-HEADER-001", "structured-config-safety", "deployment", "Existing global Vercel header rule omits X-Content-Type-Options", "MEDIUM", "Browsers may MIME-sniff responses contrary to the declared content type.", "Add the deterministic nosniff header to the existing global rule.", true, true, [
        "Re-run the structured-config-safety analyzer",
        "Parse vercel.json and inspect the global header rule"
    ], ["OWASP HTTP Headers Cheat Sheet"])
};
export async function runAnalyzers(section, root, scope) {
    const records = await loadSources(root, scope);
    const scriptRun = analyzeScripts(records);
    const configRun = await analyzeStructuredFiles(root, scope);
    return [scriptRun, configRun].map((run) => ({
        ...run,
        findings: run.findings.filter((finding) => section === "all" || finding.section === section)
    }));
}
export async function runNamedAnalyzer(analyzerId, root, scope) {
    const runs = await runAnalyzers("all", root, scope);
    const normalized = analyzerId.startsWith("js-ts-") ? "js-ts-boundaries" : analyzerId;
    const run = runs.find((candidate) => candidate.analyzer_id === normalized);
    if (run === undefined) {
        return { analyzer_id: analyzerId, supported_files: 0, findings: [] };
    }
    return run;
}
function analyzeScripts(files) {
    const issues = [];
    for (const file of files) {
        const labelIds = collectLabelIds(file.sourceFile);
        const functions = collectFunctionRanges(file.sourceFile);
        visit(file.sourceFile, [], (node, ancestors) => {
            if (ts.isCallExpression(node)) {
                const name = callName(node.expression);
                const argumentText = node.arguments
                    .map((argument) => argument.getText(file.sourceFile))
                    .join(", ");
                const requestControlled = containsRequestData(argumentText);
                if (isSqlSink(name) &&
                    requestControlled &&
                    hasInterpolation(node.arguments, file.sourceFile)) {
                    issues.push(issue(SPECS.sql, file, node, requestSource(argumentText), name));
                    if (!hasValidationNear(node, file, functions))
                        issues.push(issue(SPECS.validation, file, node, requestSource(argumentText), name));
                }
                if (isNoSqlSink(name) &&
                    requestControlled &&
                    /[${}]|\$where|req\.(?:body|query)(?:\.|\b)/u.test(argumentText)) {
                    issues.push(issue(SPECS.nosql, file, node, requestSource(argumentText), name));
                    if (!hasValidationNear(node, file, functions))
                        issues.push(issue(SPECS.validation, file, node, requestSource(argumentText), name));
                }
                if (isShellSink(name) && requestControlled) {
                    issues.push(issue(SPECS.shell, file, node, requestSource(argumentText), name));
                    if (!hasValidationNear(node, file, functions))
                        issues.push(issue(SPECS.validation, file, node, requestSource(argumentText), name));
                }
                if (/\bredirect$/u.test(name) &&
                    requestControlled &&
                    !/allowlist|allowedRedirect|safeRedirect/iu.test(enclosingText(node, file, functions))) {
                    issues.push(issue(SPECS.redirect, file, node, requestSource(argumentText), name));
                }
                if (isLogSink(name) && containsSensitiveLogData(argumentText))
                    issues.push(issue(SPECS.sensitiveLog, file, node, requestSource(argumentText), name));
                if (name.endsWith("upload.any"))
                    issues.push(issue(SPECS.uploadAny, file, node, "unrestricted multipart fields", name));
                if (isQuerySink(name) && ancestors.some(isLoop))
                    issues.push(issue(SPECS.nPlusOne, file, node, "loop iteration", name));
                if (/\bfindMany$/u.test(name)) {
                    const options = argumentText;
                    if (!/\b(?:take|limit|first|maxResults)\s*:/u.test(options))
                        issues.push(issue(SPECS.unbounded, file, node, "collection query", name));
                    if (/\b(?:skip|cursor|take|limit)\s*:/u.test(options) &&
                        !/\b(?:orderBy|sort)\s*:/u.test(options))
                        issues.push(issue(SPECS.paginationOrder, file, node, "pagination options", name));
                }
                if (isCacheSink(name))
                    analyzeCacheCall(issues, file, node, name, functions);
                if (isObjectLookup(name) && requestControlled) {
                    const context = enclosingText(node, file, functions);
                    if (!/\b(?:userId|ownerId|subjectId|session\.user|auth\.user|authorize|canAccess|policy)\b/u.test(context))
                        issues.push(issue(SPECS.objectAuth, file, node, requestSource(argumentText), name));
                }
                if (isQuerySink(name) &&
                    /(?:tenant|organization)(?:Id|_id)?\s*:\s*req\.(?:params|query|body)/u.test(argumentText)) {
                    issues.push(issue(SPECS.tenantInput, file, node, requestSource(argumentText), name));
                    issues.push(issue(SPECS.tenantScope, file, node, requestSource(argumentText), name));
                }
                const queryContext = isQuerySink(name) ? enclosingText(node, file, functions) : "";
                if (isQuerySink(name) &&
                    /\b(?:tenant|organization)(?:Id|_id)?\b/u.test(queryContext) &&
                    !/(?:tenant|organization)(?:Id|_id)?\s*:/u.test(argumentText)) {
                    issues.push(issue(SPECS.tenantScope, file, node, "tenant-owned query context", name));
                }
                if (isQuerySink(name) &&
                    /\b(?:job|export|worker|queue)\b/iu.test(enclosingText(node, file, functions)) &&
                    !/(?:tenant|organization)(?:Id|_id)?\s*:/u.test(argumentText))
                    issues.push(issue(SPECS.tenantBackground, file, node, "background/export context", name));
                if (isModelSink(name) &&
                    requestControlled &&
                    /invoice|document|attachment|ocr|text/iu.test(argumentText))
                    issues.push(issue(SPECS.aiPrompt, file, node, requestSource(argumentText), name));
                if (isPaymentSink(name) &&
                    /req\.(?:body|query|params).*\b(?:amount|price|currency)|(?:amount|price|currency).*req\.(?:body|query|params)/isu.test(argumentText))
                    issues.push(issue(SPECS.clientAmount, file, node, requestSource(argumentText), name));
            }
            if (ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.initializer !== undefined &&
                ts.isStringLiteralLike(node.initializer)) {
                const variable = node.name.text;
                const value = node.initializer.text;
                if (/(?:api[_-]?key|secret|token|password|credential)/iu.test(variable) &&
                    looksLikeSecret(value))
                    issues.push(issue(SPECS.credential, file, node, variable, "source constant (value redacted)"));
            }
            if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
                const tag = node.tagName.getText(file.sourceFile).toLowerCase();
                if (["input", "select", "textarea"].includes(tag) && !hasAccessibleName(node, labelIds))
                    issues.push(issue(SPECS.missingLabel, file, node, `<${tag}>`, "accessible-name computation"));
                if (tag === "a" && hasJsxAttribute(node, "target", "_blank") && !hasRelTokens(node))
                    issues.push(issue(SPECS.blankRel, file, node, 'target="_blank"', "browser link navigation"));
            }
        });
        analyzeUploadFile(issues, file);
        analyzeAiFile(issues, file);
        analyzeWebhookFile(issues, file);
    }
    return {
        analyzer_id: "js-ts-boundaries",
        supported_files: files.length,
        findings: mergeIssues(issues)
    };
}
async function analyzeStructuredFiles(root, scope) {
    const issues = [];
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
        if (scope !== undefined && !scope.has(path))
            continue;
        const content = await readTextIfPresent(absolute);
        if (content === undefined)
            continue;
        const record = syntheticRecord(absolute, path, content);
        if (isEnvironmentTemplate(path)) {
            supported += 1;
            for (const [index, line] of content.split(/\r?\n/u).entries()) {
                const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u.exec(line);
                if (match === null)
                    continue;
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
                const parsed = JSON.parse(content);
                if (isRecord(parsed) && Array.isArray(parsed.headers)) {
                    for (const rule of parsed.headers) {
                        if (!isRecord(rule) || typeof rule.source !== "string" || !Array.isArray(rule.headers))
                            continue;
                        if (!isGlobalHeaderSource(rule.source))
                            continue;
                        const hasHeader = rule.headers.some((header) => isRecord(header) &&
                            typeof header.key === "string" &&
                            header.key.toLowerCase() === "x-content-type-options");
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
            }
            catch {
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
async function loadSources(root, scope) {
    const records = [];
    for (const absolute of await walkFiles(root, {
        exclude: EXCLUDED,
        maxBytes: 768 * 1024,
        maxFiles: 10_000,
        maxTotalBytes: 128 * 1024 * 1024,
        maxDepth: 64
    })) {
        const extension = extname(absolute).toLowerCase();
        if (!SCRIPT_EXTENSIONS.has(extension))
            continue;
        const path = toPosix(relative(root, absolute));
        if (scope !== undefined && !scope.has(path))
            continue;
        const content = await readTextIfPresent(absolute);
        if (content === undefined)
            continue;
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
function analyzeUploadFile(issues, file) {
    const content = file.content;
    if (!/upload\.(?:any|array|fields|single)\s*\(/u.test(content))
        return;
    const extension = /(?:originalname|filename)[^\n;]*\.endsWith\s*\(/u.exec(content);
    if (extension !== null)
        issues.push(textIssue(SPECS.uploadExtension, file, extension.index, "original filename extension", "upload acceptance branch"));
    const mime = /\b(?:mimetype|contentType|content-type)\b/iu.exec(content);
    if (mime !== null && !/magic|signature|fileTypeFromBuffer|decode|sniff/iu.test(content))
        issues.push(textIssue(SPECS.uploadMime, file, mime.index, "client-provided MIME", "upload acceptance branch"));
    const publicStorage = /(?:save|put|writeFile|upload)\s*\([^\n;]*(?:public[\\/]|public\/|publicPath)/iu.exec(content);
    const scan = /\b(?:scanner\.)?scan\s*\(/iu.exec(content);
    if (publicStorage !== null && (scan === null || publicStorage.index < scan.index))
        issues.push(textIssue(SPECS.uploadPublic, file, publicStorage.index, "untrusted upload bytes", "public storage before approval"));
    if (scan === null)
        issues.push(textIssue(SPECS.uploadScan, file, content.search(/upload\./u), "upload middleware", "durable/released storage"));
    const failOpen = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\n\s*)?\}/u.exec(content);
    if (scan !== null &&
        failOpen !== null &&
        /(?:res\.|send|url|release|extract)/u.test(content.slice(failOpen.index + failOpen[0].length)))
        issues.push(textIssue(SPECS.uploadFailOpen, file, failOpen.index, "scanner error", "continued release path"));
    const originalPath = /(?:save|put|writeFile|upload)\s*\([^\n;]*(?:originalname|filename)/iu.exec(content);
    if (originalPath !== null)
        issues.push(textIssue(SPECS.uploadFilename, file, originalPath.index, "client original filename", "storage object path"));
    if (!/\b(?:limits|fileSize|maxFiles|maxBytes|maxEntries|maxDepth|maxRatio|timeout)\b/u.test(content))
        issues.push(textIssue(SPECS.uploadLimits, file, content.search(/upload\./u), "multipart/archive input", "parser and storage resources"));
}
function analyzeAiFile(issues, file) {
    const content = file.content;
    const model = /\b(?:model|openai|anthropic|llm)\s*\.\s*(?:run|generate|complete|create|invoke)\s*\(/iu.exec(content);
    if (model === null)
        return;
    const irreversible = /\b(?:pay|charge|refund|adjustStock|applyAdjustment|createDebt|postLedger|grantPermission|inventory\.|accounting\.)\s*\(/iu.exec(content);
    if (irreversible === null)
        return;
    issues.push(textIssue(SPECS.aiIrreversible, file, irreversible.index, "model-selected tool arguments", "irreversible business operation"));
    if (!/\b(?:zod|safeParse|parse|schema|validate)\b/iu.test(content))
        issues.push(textIssue(SPECS.aiValidation, file, irreversible.index, "model output", "sensitive tool arguments"));
    if (!/\b(?:confirm|approve|reviewedBy|humanApproval|recordedIntent)\b/iu.test(content))
        issues.push(textIssue(SPECS.aiConfirmation, file, irreversible.index, "model output", "irreversible commit"));
}
function analyzeWebhookFile(issues, file) {
    const content = file.content;
    const webhook = /(?:app|router)\.(?:post|use)\s*\(\s*["'][^"']*webhooks?[^"']*["']/iu.exec(content);
    if (webhook === null)
        return;
    const sideEffect = /\b(?:charge|pay|grant|fulfill|refund|sendReceipt|entitlement|ledger|invoice)\w*\s*\(/iu.exec(content);
    const verify = /\b(?:constructEvent|verifySignature|verifyWebhook|webhooks?\.verify)\s*\(/iu.exec(content);
    if (sideEffect !== null && (verify === null || verify.index > sideEffect.index))
        issues.push(textIssue(SPECS.webhookSignature, file, sideEffect.index, "unverified webhook payload", "payment/entitlement side effect"));
    if (verify !== null && /req\.body/u.test(content.slice(verify.index, verify.index + 240)))
        issues.push(textIssue(SPECS.webhookRaw, file, verify.index, "parsed req.body", "provider signature verification"));
    if (sideEffect !== null &&
        !/\b(?:eventId|event\.id|idempoten|unique|upsert|insert.*event)\b/isu.test(content)) {
        issues.push(textIssue(SPECS.webhookIdempotency, file, sideEffect.index, "provider delivery", "durable side-effect boundary"));
        issues.push(textIssue(SPECS.webhookDuplicate, file, sideEffect.index, "duplicate provider event", "repeatable side effect"));
    }
}
function analyzeCacheCall(issues, file, node, name, functions) {
    const context = enclosingText(node, file, functions);
    const first = node.arguments[0]?.getText(file.sourceFile) ?? "";
    if (/\buserId\b/u.test(context) && !/userId|user\.id|session\.user/u.test(first))
        issues.push(issue(SPECS.cacheUser, file, node, "authenticated user-specific data", name));
    if (/\btenantId\b|\borganizationId\b/u.test(context) && !/tenantId|organizationId/u.test(first))
        issues.push(issue(SPECS.cacheTenant, file, node, "tenant-specific data", name));
}
function mergeIssues(issues) {
    const findings = new Map();
    for (const candidate of issues) {
        const line = lineNumber(candidate.file.content, candidate.start);
        const endLine = candidate.end === undefined ? line : lineNumber(candidate.file.content, candidate.end);
        const location = endLine === line
            ? { path: candidate.file.path, line }
            : { path: candidate.file.path, line, end_line: endLine };
        const snapshot = {
            path: candidate.file.path,
            sha256: candidate.file.hash,
            line,
            excerpt_hash: sha256(lineText(candidate.file.content, line))
        };
        const trace = {
            source: candidate.source,
            sink: candidate.sink,
            description: candidate.evidence
        };
        const current = findings.get(candidate.spec.id);
        if (current === undefined) {
            findings.set(candidate.spec.id, {
                id: candidate.spec.id,
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
                            absence_proves_resolution: candidate.spec.absenceProvesResolution
                        }
                    ]
                }
            });
            continue;
        }
        if (!current.location.some((item) => item.path === location.path && item.line === location.line))
            current.location.push(location);
        if (!current.evidence.includes(candidate.evidence))
            current.evidence.push(candidate.evidence);
        current.trace?.push(trace);
        if (!current.evidence_snapshot?.some((item) => item.path === snapshot.path && item.line === snapshot.line))
            current.evidence_snapshot?.push(snapshot);
    }
    return [...findings.values()].sort((a, b) => a.id.localeCompare(b.id));
}
function spec(id, analyzer, section, title, severity, impact, recommendation, safeFix, absenceProvesResolution, verification, standards, confidence = "MEDIUM") {
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
function issue(specValue, file, node, source, sink) {
    return {
        spec: specValue,
        file,
        start: node.getStart(file.sourceFile),
        end: node.getEnd(),
        evidence: `${source} reaches ${sink} at ${file.path}:${lineNumber(file.content, node.getStart(file.sourceFile))}.`,
        source,
        sink
    };
}
function textIssue(specValue, file, start, source, sink) {
    return {
        spec: specValue,
        file,
        start: Math.max(0, start),
        evidence: `${source} reaches ${sink} at ${file.path}:${lineNumber(file.content, Math.max(0, start))}.`,
        source,
        sink
    };
}
function syntheticRecord(absolute, path, content) {
    return {
        absolute,
        path,
        content,
        hash: sha256(content),
        sourceFile: ts.createSourceFile(path, "", ts.ScriptTarget.Latest)
    };
}
function visit(node, ancestors, callback) {
    callback(node, ancestors);
    node.forEachChild((child) => visit(child, [...ancestors, node], callback));
}
function callName(expression) {
    if (ts.isIdentifier(expression))
        return expression.text;
    if (ts.isPropertyAccessExpression(expression))
        return `${callName(expression.expression)}.${expression.name.text}`;
    if (ts.isElementAccessExpression(expression))
        return `${callName(expression.expression)}.${expression.argumentExpression.getText()}`;
    return expression.getText();
}
function hasInterpolation(argumentsValue, sourceFile) {
    return argumentsValue.some((argument) => ts.isTemplateExpression(argument) ||
        (ts.isBinaryExpression(argument) &&
            argument.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
        /\$\{|\+\s*req\./u.test(argument.getText(sourceFile)));
}
function isSqlSink(name) {
    return /(?:^|\.)(?:query|execute|raw|\$queryRawUnsafe|\$executeRawUnsafe)$/u.test(name);
}
function isNoSqlSink(name) {
    return /(?:^|\.)(?:find|findOne|findMany|aggregate|updateMany|deleteMany)$/u.test(name);
}
function isQuerySink(name) {
    return (isSqlSink(name) || isNoSqlSink(name) || /(?:^|\.)(?:findUnique|findFirst|findById)$/u.test(name));
}
function isShellSink(name) {
    return /(?:^|\.)(?:exec|execSync|spawn|spawnSync|system)$/u.test(name);
}
function isLogSink(name) {
    return /(?:^|\.)(?:log|info|warn|error|debug|trace)$/u.test(name);
}
function isCacheSink(name) {
    return /(?:^|\.)(?:get|set|mget|mset|del|invalidate)$/u.test(name) && /redis|cache/u.test(name);
}
function isObjectLookup(name) {
    return /(?:^|\.)(?:findUnique|findFirst|findOne|findById|query)$/u.test(name);
}
function isModelSink(name) {
    return /(?:model|openai|anthropic|llm).*(?:run|generate|complete|create|invoke)$/iu.test(name);
}
function isPaymentSink(name) {
    return /(?:payment|stripe|charge|invoice|checkout).*(?:create|pay|charge|confirm)|(?:createPaymentIntent|charge)$/iu.test(name);
}
function containsRequestData(text) {
    return /\b(?:req|request)\.(?:body|params|query|headers|file|files)\b/u.test(text);
}
function containsSensitiveLogData(text) {
    return /(?:req|request)\.(?:body|headers)|\b(?:password|secret|token|authorization|creditCard|ssn)\b/iu.test(text);
}
function requestSource(text) {
    return (/(?:req|request)\.(?:body|params|query|headers|file|files)(?:\.[A-Za-z0-9_$]+)?/u.exec(text)?.[0] ?? "request-controlled data");
}
function collectFunctionRanges(sourceFile) {
    const ranges = [];
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
function enclosingText(node, file, functions) {
    const start = node.getStart(file.sourceFile);
    return (functions.find((range) => range.start <= start && range.end >= node.getEnd())?.text ??
        file.content);
}
function hasValidationNear(node, file, functions) {
    const context = enclosingText(node, file, functions);
    const before = context.slice(0, Math.max(0, context.indexOf(node.getText(file.sourceFile))));
    return /\b(?:safeParse|parse|validate|schema|allowlist|whitelist|assert[A-Z]|is[A-Z])\b/u.test(before);
}
function isLoop(node) {
    return (ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node));
}
function collectLabelIds(sourceFile) {
    const ids = new Set();
    visit(sourceFile, [], (node) => {
        if ((!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) ||
            node.tagName.getText(sourceFile).toLowerCase() !== "label")
            return;
        const value = jsxAttributeValue(node, "htmlFor");
        if (value !== undefined)
            ids.add(value);
    });
    return ids;
}
function hasAccessibleName(node, labelIds) {
    if (jsxAttributeValue(node, "aria-label") !== undefined ||
        jsxAttributeValue(node, "aria-labelledby") !== undefined ||
        jsxAttributeValue(node, "title") !== undefined)
        return true;
    const id = jsxAttributeValue(node, "id");
    return id !== undefined && labelIds.has(id);
}
function hasJsxAttribute(node, name, expected) {
    return jsxAttributeValue(node, name)?.toLowerCase() === expected;
}
function hasRelTokens(node) {
    const rel = jsxAttributeValue(node, "rel")?.toLowerCase().split(/\s+/u) ?? [];
    return rel.includes("noopener") && rel.includes("noreferrer");
}
function jsxAttributeValue(node, name) {
    const attribute = node.attributes.properties.find((candidate) => ts.isJsxAttribute(candidate) && candidate.name.getText() === name);
    if (attribute?.initializer === undefined)
        return undefined;
    if (ts.isStringLiteral(attribute.initializer))
        return attribute.initializer.text;
    if (ts.isJsxExpression(attribute.initializer) &&
        attribute.initializer.expression !== undefined &&
        ts.isStringLiteralLike(attribute.initializer.expression))
        return attribute.initializer.expression.text;
    return undefined;
}
function isEnvironmentTemplate(path) {
    return (/(?:^|\/)\.env\.(?:example|sample|template|defaults)$/iu.test(path) ||
        /(?:^|\/)(?:env\.example|environment\.example)$/iu.test(path));
}
function looksLikeSecret(value) {
    return (value.length >= 12 && !isPlaceholder(value) && /[A-Za-z]/u.test(value) && /[0-9_-]/u.test(value));
}
function isPlaceholder(value) {
    return (value.length === 0 ||
        /^(?:your[-_ ]|example|sample|test|dummy|placeholder|changeme|xxx|<|\$\{|\*+)/iu.test(value) ||
        /example\.com/iu.test(value));
}
function isGlobalHeaderSource(source) {
    return ["/(.*)", "/(.*)?", "/*", "/:path*"].includes(source);
}
function scriptKind(extension) {
    if ([".tsx", ".jsx"].includes(extension))
        return ts.ScriptKind.TSX;
    if ([".js", ".mjs", ".cjs"].includes(extension))
        return ts.ScriptKind.JS;
    return ts.ScriptKind.TS;
}
function lineText(content, line) {
    return content.split(/\r?\n/u)[line - 1] ?? "";
}
function offsetForLine(content, line) {
    let offset = 0;
    const lines = content.split(/(?<=\n)/u);
    for (let index = 0; index < line - 1; index += 1)
        offset += lines[index]?.length ?? 0;
    return offset;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=analyzers.js.map