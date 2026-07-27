import { extname } from "node:path";
import ts from "typescript";
import { buildTaintModel } from "./dataflow.js";
import { isTestSourcePath, lineNumber, sha256, toPosix } from "./utils.js";
import { inventoryRepository } from "./repository-inventory.js";
import { analyzeTransactionFile } from "./transactions.js";
import { createGuardResolver, functionDeniesAuthorization } from "./guard-resolution.js";
import { classifyAdministrativeAuthority, classifyResourcePartition, collectGlobalAdministratorRoles, decideObjectAuthorization, strongerAuthority } from "./authorization-policy.js";
const SCRIPT_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const NON_APPLICATION_SOURCE_CLASSES = new Set([
    "documentation",
    "example",
    "fixture",
    "generated",
    "test"
]);
const SPECS = {
    sql: spec("FF-SEC-SQL-001", "js-ts-security", "security", "Request-controlled data reaches an interpolated SQL execution sink", "HIGH", "Request input can alter the query structure and read or modify unintended data.", "Use the database driver's parameter binding and add a negative injection regression test.", false, false, ["Re-run the js-ts-security analyzer", "Run a hostile-input query regression test"], ["OWASP ASVS 5.0", "CWE-89"]),
    sqlUnresolved: spec("FF-SEC-SQL-NOT-VERIFIED-001", "js-ts-security", "security", "Database wrapper SQL argument shape could not be established", "MEDIUM", "Request-controlled data reaches a database-like wrapper whose SQL-text and values positions are unknown.", "Document or adapt the wrapper's parameterization contract, then rerun the analyzer.", false, false, ["Inspect the wrapper implementation", "Run a hostile-input query regression test"], ["OWASP ASVS 5.0", "CWE-89"]),
    nosql: spec("FF-SEC-NOSQL-001", "js-ts-security", "security", "Request-controlled object reaches a NoSQL filter sink", "HIGH", "Request-supplied operators can change query meaning or bypass intended filters.", "Validate an allowlisted scalar filter schema and construct the final query server-side.", false, false, ["Re-run the js-ts-security analyzer", "Run negative operator-injection tests"], ["OWASP ASVS 5.0", "CWE-943"]),
    shell: spec("FF-SEC-SHELL-001", "js-ts-security", "security", "Request-controlled data reaches shell execution", "CRITICAL", "An attacker may execute commands with the application process privileges.", "Remove the shell boundary or use an allowlisted executable with a validated argument array.", false, false, ["Re-run the js-ts-security analyzer", "Run hostile metacharacter regression tests"], ["OWASP ASVS 5.0", "CWE-78"]),
    redirect: spec("FF-SEC-REDIRECT-001", "js-ts-security", "security", "Request-controlled redirect target is not constrained", "HIGH", "An attacker can send users to an untrusted origin and support phishing or token leakage.", "Map redirect choices to server-owned relative destinations or an explicit origin allowlist.", false, false, ["Re-run the js-ts-security analyzer", "Test absolute, protocol-relative, and encoded targets"], ["OWASP Unvalidated Redirects and Forwards Cheat Sheet", "CWE-601"]),
    credential: spec("FF-SEC-CREDENTIAL-001", "js-ts-security", "security", "Obvious credential-like constant is hard-coded", "HIGH", "A committed credential can grant unauthorized access and persist in repository history.", "Move the value to an approved secret store and rotate it if it was ever valid.", false, false, [
        "Re-run the js-ts-security analyzer",
        "Verify provider-side revocation without logging the value"
    ], ["OWASP Secrets Management Cheat Sheet", "CWE-798"]),
    sensitiveLog: spec("FF-SEC-LOG-001", "js-ts-security", "security", "Sensitive request data reaches a logging sink", "HIGH", "Credentials or personal data can persist in logs beyond the request boundary.", "Log an allowlisted event shape and redact supported sensitive fields before serialization.", false, false, ["Re-run the js-ts-security analyzer", "Exercise the request and inspect captured logs"], ["OWASP Logging Cheat Sheet", "CWE-532"]),
    validation: spec("FF-SEC-VALIDATION-001", "js-ts-security", "security", "Supported high-risk sink lacks demonstrated server-side validation", "HIGH", "Malformed or hostile input reaches a boundary that depends on trusted shape or meaning.", "Validate and normalize the input immediately before constructing the supported sink input.", false, false, ["Re-run the js-ts-security analyzer", "Run schema rejection tests at the server boundary"], ["OWASP ASVS 5.0", "CWE-20"]),
    ssrf: spec("FF-SEC-SSRF-001", "js-ts-security", "security", "Request-controlled URL reaches a server-side HTTP client", "HIGH", "The server can be induced to reach internal services, metadata endpoints, or attacker infrastructure.", "Resolve the destination from a server-owned allowlist and block private and link-local ranges.", false, false, [
        "Re-run the js-ts-security analyzer",
        "Test internal, metadata, and redirect-based destinations"
    ], ["OWASP SSRF Prevention Cheat Sheet", "CWE-918"]),
    deserialize: spec("FF-SEC-DESERIALIZE-001", "js-ts-security", "security", "Request-controlled data reaches an unsafe deserialization or code-evaluation sink", "CRITICAL", "Deserializing attacker-controlled input can execute code or corrupt application state.", "Parse untrusted input with a safe data-only format and validate an explicit schema.", false, false, ["Re-run the js-ts-security analyzer", "Run hostile-payload tests against the boundary"], ["OWASP Deserialization Cheat Sheet", "CWE-502"]),
    csvFormula: spec("FF-SEC-CSV-001", "js-ts-security", "security", "CSV export assembles untrusted values without formula escaping", "MEDIUM", "Values beginning with =, +, -, or @ can execute as formulas in spreadsheet clients.", "Escape or prefix risky leading characters and quote fields before writing CSV output.", false, false, [
        "Re-run the js-ts-security analyzer",
        "Export a cell starting with = and inspect the escaping"
    ], ["OWASP CSV Injection guidance", "CWE-1236"]),
    massAssign: spec("FF-SEC-MASS-ASSIGN-001", "js-ts-security", "security", "Entire request body is written to a data model without field allowlisting", "HIGH", "A caller can set fields that were never intended to be writable, including roles or ownership.", "Copy an explicit allowlist of validated fields from the request into the write payload.", false, false, [
        "Re-run the js-ts-security analyzer",
        "Attempt to set a privileged field through the endpoint"
    ], ["OWASP Mass Assignment Cheat Sheet", "CWE-915"]),
    authCookie: spec("FF-AUTH-COOKIE-001", "js-ts-auth", "auth", "Session cookie is issued with weakened security attributes", "HIGH", "Disabling HttpOnly or Secure exposes the session credential to script access or cleartext transport.", "Set httpOnly and secure on session cookies and choose a SameSite value that fits the login flow.", false, false, ["Re-run the js-ts-auth analyzer", "Inspect Set-Cookie attributes in a real login response"], ["OWASP Session Management Cheat Sheet", "CWE-614", "CWE-1004"]),
    authSessionValue: spec("FF-AUTH-SESSION-001", "js-ts-auth", "auth", "Session identifier is derived from request-controlled input", "CRITICAL", "A caller can forge or predict another user's session credential and bypass authentication.", "Issue an opaque high-entropy server-generated session identifier bound to server-side state.", false, false, ["Re-run the js-ts-auth analyzer", "Prove a forged cookie value cannot authenticate"], ["OWASP Session Management Cheat Sheet", "CWE-384", "CWE-330"]),
    objectAuth: spec("FF-AUTHZ-OBJECT-001", "js-ts-authorization", "authorization", "Object lookup lacks a demonstrated subject/object authorization predicate", "HIGH", "An authenticated caller may read or modify another subject's object by changing its identifier.", "Bind the final lookup to the authenticated subject or enforce a per-object policy before release.", false, false, ["Re-run the js-ts-authorization analyzer", "Run negative tests with another user's object ID"], ["OWASP API Security Top 10 2023 API1", "CWE-639"]),
    objectAuthAdministrative: spec("FF-AUTHZ-OBJECT-ADMIN-001", "js-ts-authorization", "authorization", "Object operation relies on a platform-administrator role instead of an object policy", "LOW", "Authority rests entirely on a role grant, so any mis-assigned administrator reaches every object of this resource.", "Record the administrative policy for this resource and add a negative test for a non-administrator principal.", false, false, [
        "Re-run the js-ts-authorization analyzer",
        "Exercise the operation as a non-administrator principal"
    ], ["OWASP API Security Top 10 2023 API5", "CWE-639"]),
    objectAuthUnresolved: spec("FF-AUTHZ-OBJECT-NOT-VERIFIED-001", "js-ts-authorization", "authorization", "Object authorization depends on unresolved administrator scope", "MEDIUM", "An administrative gate was observed, but nothing proves that role reaches every object this operation can select.", "State the role's object scope explicitly, or bind the operation to an ownership or tenancy predicate.", false, false, [
        "Inspect the administrator role definition",
        "Run a cross-tenant object test with that administrator role"
    ], ["OWASP API Security Top 10 2023 API5", "CWE-639"]),
    authzRoute: spec("FF-AUTHZ-ROUTE-001", "js-ts-authorization", "authorization", "Sensitive route has no demonstrated authorization predicate", "HIGH", "A caller may reach an administrative, destructive, or protected mutation without the required permission.", "Enforce a resolvable authorization predicate on the route and add an unauthorized request regression test.", false, false, [
        "Re-run the js-ts-authorization analyzer",
        "Exercise the route with a minimally privileged principal"
    ], ["OWASP API Security Top 10 2023 API5", "CWE-862"]),
    authzUnresolved: spec("FF-AUTHZ-NOT-VERIFIED-001", "js-ts-authorization", "authorization", "Sensitive route authorization could not be resolved", "MEDIUM", "A middleware or handler boundary may enforce authorization, but bounded source analysis could not prove it.", "Trace the middleware and handler to the protected sink and add an explicit denied-principal test.", false, false, ["Inspect the middleware definition", "Run an unauthorized route test"], ["OWASP API Security Top 10 2023 API5", "CWE-862"]),
    tenantInput: spec("FF-TENANT-INPUT-001", "js-ts-tenancy", "tenancy", "Tenant context is accepted from untrusted request input", "CRITICAL", "A caller can select another tenant's data boundary.", "Derive tenant context from authenticated identity and pass it through trusted server context.", false, false, ["Re-run the js-ts-tenancy analyzer", "Run a negative cross-tenant identifier test"], ["OWASP Multi Tenant Security Cheat Sheet", "CWE-639"]),
    tenantScope: spec("FF-TENANT-SCOPE-001", "js-ts-tenancy", "tenancy", "Tenant-owned query is not scoped by authenticated tenant identity", "CRITICAL", "Records can cross tenant boundaries at the final data-access sink.", "Include the authenticated tenant predicate in the final query and enforce it in negative tests.", false, false, ["Re-run the js-ts-tenancy analyzer", "Run same-ID tests in two tenants"], ["OWASP Multi Tenant Security Cheat Sheet", "CWE-284"]),
    tenantScopeUnresolved: spec("FF-TENANT-SCOPE-NOT-VERIFIED-001", "js-ts-tenancy", "tenancy", "Tenant scope at the data sink could not be verified", "MEDIUM", "The query appears tenant-owned, but bounded analysis could not prove the placeholder or helper resolves to authenticated tenant context.", "Trace the tenant value to authenticated context or use a supported explicit tenant predicate.", false, false, ["Re-run the js-ts-tenancy analyzer", "Run same-ID tests in two tenants"], ["OWASP Multi Tenant Security Cheat Sheet", "CWE-284"]),
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
    cacheUnresolved: spec("FF-CACHE-KEY-NOT-VERIFIED-001", "js-ts-queries-cache", "cache", "Cache-key construction could not be verified", "MEDIUM", "Cache isolation cannot be established until the unresolved key construction is inspected.", "Inspect the local helper or dynamic assignment and add two-user and two-tenant isolation evidence.", false, false, [
        "Re-run the js-ts-queries-cache analyzer after making key construction locally resolvable",
        "Run two-user and two-tenant cache-isolation tests"
    ], ["OWASP ASVS 5.0", "OWASP Multi Tenant Security Cheat Sheet"], "LOW"),
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
    missingAlt: spec("FF-A11Y-ALT-001", "js-ts-accessibility", "accessibility", "Image has no structurally detectable text alternative", "HIGH", "Screen-reader users may miss content or purpose conveyed by the image.", "Provide contextual alt text, or explicitly mark a decorative image with empty alt, presentation role, or aria-hidden.", false, true, ["Re-run the js-ts-accessibility analyzer", "Inspect the browser accessibility tree"], ["WCAG 2.2 SC 1.1.1"]),
    clickableNonInteractive: spec("FF-A11Y-INTERACTION-001", "js-ts-accessibility", "accessibility", "Non-interactive element has pointer-only click behavior", "HIGH", "Keyboard and assistive-technology users may be unable to operate the control.", "Use a native button or link, or provide the complete role, focus, and keyboard interaction contract.", false, true, ["Re-run the js-ts-accessibility analyzer", "Complete the interaction using keyboard only"], ["WCAG 2.2 SC 2.1.1", "WCAG 2.2 SC 4.1.2"]),
    blankRel: spec("FF-FRONTEND-BLANK-001", "js-ts-frontend-safety", "frontend", "target=_blank link lacks noopener and noreferrer", "MEDIUM", "The opened page can retain opener access or receive referrer data.", 'Add rel="noopener noreferrer" to the proven target=_blank link.', true, true, ["Re-run the js-ts-frontend-safety analyzer", "Parse the link and confirm both rel tokens"], ["OWASP Reverse Tabnabbing guidance"]),
    envTemplate: spec("FF-ENV-TEMPLATE-001", "structured-config-safety", "security", "Environment template contains an actual-looking credential", "HIGH", "Published templates can disclose a credential.", "Replace the template value with an explicit placeholder and rotate it if it was ever valid.", true, false, ["Re-run the structured-config-safety analyzer", "Verify provider-side rotation manually"], ["OWASP Secrets Management Cheat Sheet"]),
    secureHeader: spec("FF-DEPLOY-HEADER-001", "structured-config-safety", "deployment", "Existing global Vercel header rule omits X-Content-Type-Options", "MEDIUM", "Browsers may MIME-sniff responses contrary to the declared content type.", "Add the deterministic nosniff header to the existing global rule.", true, true, [
        "Re-run the structured-config-safety analyzer",
        "Parse vercel.json and inspect the global header rule"
    ], ["OWASP HTTP Headers Cheat Sheet"])
};
export async function runAnalyzers(section, root, scope, repositoryInventory, tenantKeys) {
    const inventory = repositoryInventory ??
        (await inventoryRepository(root, {
            includeNeutralEvidence: true,
            applyDefaultExclusions: true
        }));
    const previousTenantKeys = inferredTenantKeys;
    inferredTenantKeys = tenantKeys ?? [];
    try {
        const records = loadSources(scope, inventory);
        const scriptRun = analyzeScripts(records);
        const configRun = analyzeStructuredFiles(scope, inventory);
        return [scriptRun, configRun].map((run) => ({
            ...run,
            findings: run.findings.filter((finding) => section === "all" || finding.section === section)
        }));
    }
    finally {
        inferredTenantKeys = previousTenantKeys;
    }
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
    // Built once over the whole corpus so an imported guard is resolved by reading the body it
    // actually names, rather than by trusting the identifier it was imported under.
    const guards = createGuardResolver(files);
    // A project may publish its own global-administrator role mapping; that declaration is the only
    // way an otherwise ambiguous role name becomes proof of platform-wide object scope.
    const globalAdminRoles = collectGlobalAdministratorRoles(files);
    for (const file of files) {
        const labelIds = collectLabelIds(file.sourceFile);
        const functions = collectFunctionRanges(file.sourceFile);
        const cacheKeys = createCacheKeyResolver(file.sourceFile);
        const taint = buildTaintModel(file.sourceFile);
        // Built on first use so files with no object sink never pay for route-guard resolution twice.
        let routeAuthorityIndex;
        const routeAuthority = (node) => {
            routeAuthorityIndex ??= buildRouteAuthorityIndex(file, guards, globalAdminRoles);
            return routeAuthorityIndex(node);
        };
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
                const sqlShape = sqlSinkShape(name, node);
                if (sqlShape !== undefined) {
                    const sqlText = sqlTextExpression(node, sqlShape);
                    const sqlFlow = sqlText === undefined ? undefined : resolveExpressionTaint(sqlText, file, taint);
                    const sqlTextValue = sqlText?.getText(file.sourceFile) ?? "";
                    if (sqlText !== undefined &&
                        (sqlFlow !== undefined || containsRequestData(sqlTextValue)) &&
                        (hasInterpolation(sqlText, file.sourceFile) || flowPassedThroughInterpolation(sqlFlow))) {
                        issues.push(issue(SPECS.sql, file, node, flowSource(sqlFlow, sqlTextValue), name));
                        if (!expressionHasProtection(sqlText, file, taint, ["validated", "allowlisted"]))
                            issues.push(issue(SPECS.validation, file, node, flowSource(sqlFlow, sqlTextValue), name));
                    }
                }
                else if (looksLikeUnknownSqlWrapper(node, requestControlled, file)) {
                    const unresolved = issue(SPECS.sqlUnresolved, file, node, flowSource(flow, argumentText), name);
                    unresolved.status = "NOT_VERIFIED";
                    unresolved.evidence +=
                        " The wrapper's SQL-text and bound-values argument positions are not registered; this is not a confirmed injection defect.";
                    issues.push(unresolved);
                }
                if (isNoSqlSink(name) &&
                    requestControlled &&
                    /[${}]|\$where|req\.(?:body|query)(?:\.|\b)/u.test(argumentText)) {
                    issues.push(issue(SPECS.nosql, file, node, flowSource(flow, argumentText), name));
                    if (!validated)
                        issues.push(issue(SPECS.validation, file, node, flowSource(flow, argumentText), name));
                }
                if (isShellSink(name) && requestControlled && !isShellSeparatedCall(node, file, taint)) {
                    issues.push(issue(SPECS.shell, file, node, flowSource(flow, argumentText), name));
                    if (!validated)
                        issues.push(issue(SPECS.validation, file, node, flowSource(flow, argumentText), name));
                }
                if (/\bredirect$/u.test(name) &&
                    requestControlled &&
                    !isConstrainedRedirect(node, file, taint)) {
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
                    if (/\b(?:skip|cursor|take|limit)\s*:/u.test(options) &&
                        !/\b(?:orderBy|sort)\s*:/u.test(options))
                        issues.push(issue(SPECS.paginationOrder, file, node, "pagination options", name));
                }
                if (isCacheSink(name))
                    analyzeCacheCall(issues, file, node, name, functions, cacheKeys);
                // A route registration shares verb names with data access (`delete`, `put`, `patch`);
                // registering a handler is not an object lookup and must never raise object-authorization.
                if (isObjectLookup(name) && requestControlled && !isRouteRegistrationCall(node)) {
                    // Role evidence never clears this rule on its own; `authorization-policy.ts` decides what
                    // an administrator gate is worth against the partition the object actually belongs to.
                    const decision = decideObjectAuthorization({
                        boundPredicate: hasObjectAuthorization(node, file, taint),
                        authority: strongerAuthority(routeAuthority(node), dominatingAdministrativeAuthority(node, file, globalAdminRoles)),
                        partition: classifyResourcePartition(`${enclosingText(node, file, functions)}\n${node.getText(file.sourceFile)}`, tenantKeyPattern("iu"))
                    });
                    if (decision.outcome !== "authorized") {
                        const objectIssue = issue(OBJECT_AUTHORIZATION_SPECS[decision.outcome], file, node, flowSource(flow, argumentText), name);
                        if (decision.outcome === "administrative")
                            objectIssue.status = "WARNING";
                        if (decision.outcome === "unresolved")
                            objectIssue.status = "NOT_VERIFIED";
                        if (decision.outcome !== "missing")
                            objectIssue.evidence += ` Object-authorization policy: ${decision.reason}.`;
                        issues.push(objectIssue);
                    }
                }
                if (isQuerySink(name) && requestSuppliesTenantKey(argumentText)) {
                    issues.push(issue(SPECS.tenantInput, file, node, flowSource(flow, argumentText), name));
                    issues.push(issue(SPECS.tenantScope, file, node, flowSource(flow, argumentText), name));
                }
                const queryContext = isQuerySink(name) ? enclosingText(node, file, functions) : "";
                if (isQuerySink(name) && !requestSuppliesTenantKey(argumentText)) {
                    const tenantScope = assessTenantScope(node, name, file, queryContext);
                    if (tenantScope === "MISSING")
                        issues.push(issue(SPECS.tenantScope, file, node, "tenant-owned query context", name));
                    else if (tenantScope === "UNRESOLVED") {
                        const unresolved = issue(SPECS.tenantScopeUnresolved, file, node, "unresolved tenant predicate value", name);
                        unresolved.status = "NOT_VERIFIED";
                        unresolved.evidence +=
                            " A tenant predicate was observed, but its value could not be bound to authenticated tenant context.";
                        issues.push(unresolved);
                    }
                }
                if (isQuerySink(name) &&
                    isBackgroundExecutionContext(node, file) &&
                    assessTenantScope(node, name, file, queryContext) !== "PROVEN")
                    issues.push(issue(SPECS.tenantBackground, file, node, "background/export context", name));
                if (isModelSink(name) &&
                    requestControlled &&
                    /invoice|document|attachment|ocr|text/iu.test(argumentText))
                    issues.push(issue(SPECS.aiPrompt, file, node, flowSource(flow, argumentText), name));
                if (isPaymentSink(name) &&
                    /req\.(?:body|query|params).*\b(?:amount|price|currency)|(?:amount|price|currency).*req\.(?:body|query|params)/isu.test(argumentText))
                    issues.push(issue(SPECS.clientAmount, file, node, flowSource(flow, argumentText), name));
                if (isHttpClientSink(name)) {
                    const targetNode = node.arguments[0];
                    const target = targetNode?.getText(file.sourceFile) ?? "";
                    const targetFlow = targetNode === undefined ? undefined : taint.resolve(targetNode);
                    if ((targetFlow !== undefined || containsRequestData(target)) &&
                        !isNetworkConstrainedTarget(node, targetNode, file, taint))
                        issues.push(issue(SPECS.ssrf, file, node, flowSource(targetFlow ?? flow, target), name));
                }
                if (isDeserializationSink(name) && requestControlled)
                    issues.push(issue(SPECS.deserialize, file, node, flowSource(flow, argumentText), name));
                if (isModelWriteSink(name) &&
                    node.arguments.some((argument) => referencesWholeRequestBody(argument, file.sourceFile)) &&
                    !validated)
                    issues.push(issue(SPECS.massAssign, file, node, "entire request body", name));
                if (/(?:^|\.)(?:cookie|setCookie)$/u.test(name) && node.arguments.length >= 2) {
                    const cookieName = node.arguments[0]?.getText(file.sourceFile) ?? "";
                    const cookieValue = node.arguments[1]?.getText(file.sourceFile) ?? "";
                    const cookieOptions = node.arguments[2]?.getText(file.sourceFile) ?? "";
                    if (/session|token|auth|sid|jwt|remember/iu.test(cookieName)) {
                        const weakened = ["httpOnly", "secure"].filter((flag) => new RegExp(`\\b${flag}\\s*:\\s*false`, "u").test(cookieOptions));
                        if (weakened.length > 0)
                            issues.push(issue(SPECS.authCookie, file, node, `${weakened.join(" and ")} set to false`, name));
                        if (containsRequestData(cookieValue))
                            issues.push(issue(SPECS.authSessionValue, file, node, flowSource(flow, cookieValue), name));
                    }
                }
            }
            if (ts.isNewExpression(node) &&
                node.expression.getText(file.sourceFile) === "Function" &&
                containsRequestData((node.arguments ?? []).map((argument) => argument.getText(file.sourceFile)).join(", ")))
                issues.push(issue(SPECS.deserialize, file, node, requestSource((node.arguments ?? []).map((argument) => argument.getText(file.sourceFile)).join(", ")), "new Function"));
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
                if (["img", "image"].includes(tag) &&
                    !hasJsxAttributeName(node, "alt") &&
                    !hasJsxAttribute(node, "role", "presentation") &&
                    !hasJsxAttribute(node, "aria-hidden", "true"))
                    issues.push(issue(SPECS.missingAlt, file, node, `<${tag}>`, "text alternative"));
                if (hasPointerOnlyClick(node, tag))
                    issues.push(issue(SPECS.clickableNonInteractive, file, node, `<${tag}> with onClick`, "keyboard-operable control semantics"));
            }
            if (ts.isTaggedTemplateExpression(node))
                analyzeTaggedSql(issues, file, node, taint);
        });
        analyzeAuthorizationRoutes(issues, file, guards);
        analyzeUploadFile(issues, file);
        analyzeAiFile(issues, file);
        analyzeWebhookFile(issues, file);
        analyzeCsvExport(issues, file);
        issues.push(...analyzeTransactionFile(file));
    }
    return {
        analyzer_id: "js-ts-boundaries",
        supported_files: files.length,
        findings: mergeIssues(issues)
    };
}
function analyzeStructuredFiles(scope, inventory) {
    const issues = [];
    let supported = 0;
    for (const entry of inventory.entries) {
        if (entry.status !== "INSPECTED" || entry.content === undefined)
            continue;
        if (NON_APPLICATION_SOURCE_CLASSES.has(entry.evidence_class))
            continue;
        const path = entry.path;
        if (scope !== undefined && !scope.has(path))
            continue;
        const content = entry.content;
        const record = syntheticRecord(entry.absolute_path, path, content);
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
function loadSources(scope, inventory) {
    const records = [];
    for (const entry of inventory.entries) {
        if (entry.status !== "INSPECTED" || entry.content === undefined)
            continue;
        if (NON_APPLICATION_SOURCE_CLASSES.has(entry.evidence_class))
            continue;
        const absolute = entry.absolute_path;
        const extension = extname(absolute).toLowerCase();
        if (!SCRIPT_EXTENSIONS.has(extension))
            continue;
        const path = entry.path;
        if (isTestSourcePath(path))
            continue;
        if (scope !== undefined && !scope.has(path))
            continue;
        const content = entry.content;
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
function analyzeTaggedSql(issues, file, node, taint) {
    const name = callName(node.tag);
    if (!/(?:^|\.)(?:\$queryRaw|\$executeRaw|sql)$/u.test(name))
        return;
    // These are known parameterizing tagged-template APIs. Interpolations are values, not SQL
    // structure, so they must not inherit the raw-call SQL or request-validation findings.
    if (!extractTenantKeys(node.template.getText(file.sourceFile)).length)
        return;
    if (!ts.isTemplateExpression(node.template))
        return;
    const trusted = node.template.templateSpans.some((span) => isTrustedTenantValue(span.expression, node, file.sourceFile));
    if (!trusted) {
        const unresolved = issue(SPECS.tenantScopeUnresolved, file, node, flowSource(taint.resolve(node.template.templateSpans[0]?.expression ?? node.template), node.getText(file.sourceFile)), name);
        unresolved.status = "NOT_VERIFIED";
        issues.push(unresolved);
    }
}
function analyzeAuthorizationRoutes(issues, file, guards) {
    const hasUnresolvedGlobalGuard = /\b(?:router|app)\.use\s*\(\s*[A-Za-z_$][\w$]*\s*\)/u.test(file.content);
    visit(file.sourceFile, [], (node) => {
        if (!ts.isCallExpression(node))
            return;
        if (!isRouteRegistrationCall(node))
            return;
        const name = callName(node.expression);
        const method = /\.(delete|put|patch|post|get)$/iu.exec(name)?.[1]?.toLowerCase();
        if (method === undefined)
            return;
        const route = node.arguments[0];
        if (route === undefined || !ts.isStringLiteralLike(route))
            return;
        const routePath = route.text;
        const sensitive = method === "delete" ||
            ["put", "patch"].includes(method) ||
            /(?:^|\/)(?:admin|internal|manage|ops|sudo)(?:\/|$)/iu.test(routePath) ||
            /patient|medical|record|account|invoice|payment|document/iu.test(routePath);
        if (!sensitive || /(?:^|\/)(?:health|status|ready|live)(?:\/|$)/iu.test(routePath))
            return;
        // Guard recognition is structural: a middleware argument counts when its resolved body
        // rejects the request before delegating, not because its identifier matched a name list.
        const guard = classifyRouteGuards(node, file, guards);
        if (guard.verdict === "proven")
            return;
        const inlineHandler = node.arguments
            .slice(1)
            .some((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
        const unresolved = guard.verdict === "unresolved" || !inlineHandler || hasUnresolvedGlobalGuard;
        const candidate = issue(unresolved ? SPECS.authzUnresolved : SPECS.authzRoute, file, node, `${method.toUpperCase()} ${routePath}`, name);
        if (unresolved) {
            candidate.status = "NOT_VERIFIED";
            candidate.evidence +=
                guard.evidence.length > 0
                    ? ` ${guard.evidence}`
                    : " Bounded analysis could not resolve the referenced handler or middleware to a route-specific permission predicate.";
        }
        issues.push(candidate);
    });
}
/**
 * True when a call registers an HTTP route rather than accessing data.
 *
 * Express-style registration is `<router>.<verb>(path, ...handlers)`: a string-literal path
 * followed by at least one handler. `router.delete("/x/:id", handler)` must never be classified
 * as a data-deletion sink, which is decided here by call shape rather than by the property name.
 */
function isRouteRegistrationCall(node) {
    if (!/\.(?:get|post|put|patch|delete|head|options|all|use)$/iu.test(callName(node.expression)))
        return false;
    const [path, ...handlers] = node.arguments;
    if (path === undefined || !ts.isStringLiteralLike(path))
        return false;
    return handlers.some((handler) => ts.isArrowFunction(handler) ||
        ts.isFunctionExpression(handler) ||
        ts.isIdentifier(handler) ||
        ts.isCallExpression(handler) ||
        ts.isArrayLiteralExpression(handler));
}
/**
 * Classifies the middleware arguments of a route registration.
 *
 * `proven` means at least one middleware resolves to a function that denies the request with an
 * authorization status before calling `next()`. `unresolved` means middleware is present but its
 * body could not be reached (imported, dynamically produced, or computed), which must degrade to
 * NOT_VERIFIED rather than a confident failure. `absent` means no middleware was supplied at all.
 */
function classifyRouteGuards(node, file, guards) {
    // A handler that denies the request itself is as much a guard as one mounted beside it, so the
    // final handler is examined before concluding that no control exists.
    const handler = node.arguments.at(-1);
    if (handler !== undefined &&
        (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
        functionDeniesAuthorization(handler, file))
        return { verdict: "proven", evidence: "", authority: { resolved: false, text: "" } };
    // Everything else is decided by the corpus resolver, which reads the body an import actually
    // names. A conventional identifier such as `requireRole` is no longer evidence of anything: an
    // import whose body cannot be reached is unresolved, not proven.
    return guards.classifyMiddlewareList(node.arguments.slice(1, -1), file);
}
/** Spec selected for each non-clean object-authorization outcome. */
const OBJECT_AUTHORIZATION_SPECS = {
    administrative: SPECS.objectAuthAdministrative,
    unresolved: SPECS.objectAuthUnresolved,
    missing: SPECS.objectAuth
};
/**
 * Maps every route handler in a file to what its guards prove about administrative reach.
 *
 * The index is built from the same resolver the route rule uses, so a role name only contributes
 * when a body was actually read. Router-level `use(...)` middleware applies to the whole file and
 * is combined with the per-route evidence, because a mounted platform-administrator gate is real
 * evidence for every handler below it.
 */
function buildRouteAuthorityIndex(file, guards, globalRoles) {
    const ranges = [];
    let mounted = "none";
    visit(file.sourceFile, [], (node) => {
        if (!ts.isCallExpression(node))
            return;
        if (/\.use$/u.test(callName(node.expression))) {
            const middleware = node.arguments.filter((argument) => !ts.isStringLiteralLike(argument));
            if (middleware.length === 0)
                return;
            mounted = strongerAuthority(mounted, classifyAdministrativeAuthority(guards.classifyMiddlewareList(middleware, file).authority, globalRoles));
            return;
        }
        if (!isRouteRegistrationCall(node))
            return;
        const authority = classifyAdministrativeAuthority(guards.classifyMiddlewareList(node.arguments.slice(1, -1), file).authority, globalRoles);
        if (authority === "none")
            return;
        for (const handler of node.arguments.slice(1))
            for (const range of handlerRanges(handler, file))
                ranges.push({ ...range, authority });
    });
    return (node) => {
        const start = node.getStart(file.sourceFile);
        const end = node.getEnd();
        let authority = mounted;
        for (const range of ranges)
            if (range.start <= start && range.end >= end)
                authority = strongerAuthority(authority, range.authority);
        return authority;
    };
}
/** The source range of a route handler argument, whether inline or named in the same file. */
function handlerRanges(handler, file) {
    if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))
        return [{ start: handler.getStart(file.sourceFile), end: handler.getEnd() }];
    if (!ts.isIdentifier(handler))
        return [];
    const name = handler.text;
    let found;
    visit(file.sourceFile, [], (node) => {
        if (found !== undefined)
            return;
        if (ts.isFunctionDeclaration(node) && node.name?.text === name)
            found = { start: node.getStart(file.sourceFile), end: node.getEnd() };
        else if (ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
            node.initializer !== undefined &&
            ts.isFunctionLike(node.initializer))
            found = { start: node.getStart(file.sourceFile), end: node.getEnd() };
    });
    return found === undefined ? [] : [found];
}
/**
 * Administrative reach proven by a dominating in-function role check.
 *
 * A service function that rejects before the sink — `if (user.role !== "superadmin") throw …` — is
 * the same evidence as a mounted guard, and is the only source available when the sink is nowhere
 * near a route registration.
 */
function dominatingAdministrativeAuthority(node, file, globalRoles) {
    let authority = "none";
    for (const statement of precedingStatements(node)) {
        if (!ts.isIfStatement(statement) || !abruptlyExits(statement.thenStatement))
            continue;
        authority = strongerAuthority(authority, classifyAdministrativeAuthority({ resolved: true, text: statement.expression.getText(file.sourceFile) }, globalRoles));
    }
    return authority;
}
/**
 * Names an imported function that the upload payload is passed to, when there is one.
 *
 * Signature and decoded-content validation is commonly factored into a shared helper. The in-file
 * regex cannot see that body, so without this a hardened upload path is reported as a confident
 * HIGH failure purely because its validation lives in another module.
 */
function importedValidationDelegate(file) {
    const imported = new Set();
    for (const statement of file.sourceFile.statements) {
        if (!ts.isImportDeclaration(statement))
            continue;
        const clause = statement.importClause;
        if (clause === undefined)
            continue;
        if (clause.name !== undefined)
            imported.add(clause.name.text);
        const bindings = clause.namedBindings;
        if (bindings === undefined)
            continue;
        if (ts.isNamespaceImport(bindings))
            imported.add(bindings.name.text);
        else
            for (const element of bindings.elements)
                imported.add(element.name.text);
    }
    if (imported.size === 0)
        return undefined;
    let found;
    const walk = (node) => {
        if (found !== undefined)
            return;
        if (ts.isCallExpression(node)) {
            const callee = ts.isPropertyAccessExpression(node.expression)
                ? node.expression.expression
                : node.expression;
            if (ts.isIdentifier(callee) &&
                imported.has(callee.text) &&
                node.arguments.some((argument) => /\b(?:buffer|mimetype|originalname|file)\b/iu.test(argument.getText(file.sourceFile)))) {
                found = callee.text;
                return;
            }
        }
        ts.forEachChild(node, walk);
    };
    ts.forEachChild(file.sourceFile, walk);
    return found;
}
function analyzeUploadFile(issues, file) {
    const content = file.content;
    if (!/upload\.(?:any|array|fields|single)\s*\(/u.test(content))
        return;
    const extension = /(?:originalname|filename)[^\n;]*\.endsWith\s*\(/u.exec(content);
    if (extension !== null)
        issues.push(textIssue(SPECS.uploadExtension, file, extension.index, "original filename extension", "upload acceptance branch"));
    const mime = /\b(?:mimetype|contentType|content-type)\b/iu.exec(content);
    if (mime !== null && !/magic|signature|fileTypeFromBuffer|decode|sniff/iu.test(content)) {
        const candidate = textIssue(SPECS.uploadMime, file, mime.index, "client-provided MIME", "upload acceptance branch");
        // Type validation is often factored into a shared helper. The in-file signature check cannot
        // read that body, so this is unresolved indirection rather than proof of a missing control and
        // must not be published as a confident HIGH failure.
        const delegate = importedValidationDelegate(file);
        if (delegate !== undefined) {
            candidate.status = "NOT_VERIFIED";
            candidate.evidence += ` The upload payload is passed to imported \`${delegate}\`, declared outside this file, so decoded/signature validation is neither proven nor disproven.`;
        }
        issues.push(candidate);
    }
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
function analyzeCsvExport(issues, file) {
    const content = file.content;
    const marker = /text\/csv|\.csv["'`]|attachment\s*\([^)]*\.csv/iu.exec(content);
    if (marker === null)
        return;
    const assembled = /\.join\s*\(/u.test(content) || /`[^`]*\$\{/u.test(content);
    if (!assembled)
        return;
    const untrusted = containsRequestData(content) ||
        /\b(?:db|prisma|pool|knex|repository|models?)\s*\.\s*\w+/u.test(content);
    if (!untrusted)
        return;
    const guarded = /escapeCsv|escapeFormula|sanitizeCsv|csv-stringify|papaparse|fast-csv|json2csv/iu.test(content) || /(?:startsWith|replace|test)\s*\(\s*(?:["']|\/)\^?\[?[=+@-]/u.test(content);
    if (guarded)
        return;
    issues.push(textIssue(SPECS.csvFormula, file, marker.index, "untrusted field values", "spreadsheet-interpreted CSV output"));
}
function analyzeCacheCall(issues, file, node, name, functions, cacheKeys) {
    const context = enclosingText(node, file, functions);
    const first = node.arguments[0];
    if (first === undefined)
        return;
    const requiresUser = /\buserId\b/u.test(context);
    const requiresTenant = /\btenantId\b|\borganizationId\b/u.test(context);
    if (!requiresUser && !requiresTenant)
        return;
    const resolved = cacheKeys.resolve(first);
    const hasUser = /\buserId\b|\buser\.id\b|\bsession\.user\b/u.test(resolved.text);
    const hasTenant = /\btenantId\b|\borganizationId\b/u.test(resolved.text);
    const missingUser = requiresUser && !hasUser;
    const missingTenant = requiresTenant && !hasTenant;
    if (!missingUser && !missingTenant)
        return;
    if (!resolved.complete) {
        const unresolved = [...new Set(resolved.identifiers)].join(", ") || first.getText(file.sourceFile);
        const reason = [...new Set(resolved.reasons)].join("; ") || "the reaching value is dynamic";
        const candidate = issue(SPECS.cacheUnresolved, file, node, unresolved, name);
        candidate.status = "NOT_VERIFIED";
        candidate.evidence = `Cache sink ${name} uses unresolved key input '${unresolved}' at ${file.path}:${lineNumber(file.content, node.getStart(file.sourceFile))}; scope could not be proven because ${reason}. Inspect the reaching definition or helper and run two-user and two-tenant isolation tests. This is not a confirmed cross-user or cross-tenant leak.`;
        issues.push(candidate);
        return;
    }
    if (missingUser)
        issues.push(issue(SPECS.cacheUser, file, node, "authenticated user-specific data", name));
    if (missingTenant)
        issues.push(issue(SPECS.cacheTenant, file, node, "tenant-specific data", name));
}
const CACHE_ALIAS_DEPTH = 12;
function createCacheKeyResolver(sourceFile) {
    const bindingsByName = new Map();
    let nextBindingId = 1;
    visit(sourceFile, [], (node) => {
        if (!ts.isVariableDeclaration(node))
            return;
        const declarationList = node.parent;
        if (!ts.isVariableDeclarationList(declarationList))
            return;
        const mutable = (declarationList.flags & ts.NodeFlags.Const) === 0;
        const scope = lexicalScope(node, sourceFile);
        if (ts.isIdentifier(node.name)) {
            addBinding({
                id: nextBindingId++,
                name: node.name.text,
                declaration: node,
                readyAt: node.getEnd(),
                scope,
                mutable,
                ...(node.initializer === undefined ? {} : { initializer: node.initializer }),
                assignments: []
            });
            return;
        }
        if (!ts.isObjectBindingPattern(node.name) || node.initializer === undefined)
            return;
        for (const element of node.name.elements) {
            if (!ts.isIdentifier(element.name) || element.dotDotDotToken !== undefined)
                continue;
            const property = bindingPropertyName(element);
            if (property === undefined)
                continue;
            addBinding({
                id: nextBindingId++,
                name: element.name.text,
                declaration: element,
                readyAt: node.getEnd(),
                scope,
                mutable,
                initializer: node.initializer,
                destructuredProperty: property,
                assignments: []
            });
        }
    });
    visit(sourceFile, [], (node) => {
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const root = assignmentRootIdentifier(node.left);
            if (root === undefined)
                return;
            const binding = visibleBinding(root.text, root.getStart(sourceFile));
            if (binding === undefined)
                return;
            binding.assignments.push({
                position: node.getStart(sourceFile),
                ...(ts.isIdentifier(node.left) ? { expression: node.right } : {}),
                linear: isLinearAssignment(node, binding.scope),
                propertyMutation: !ts.isIdentifier(node.left)
            });
            return;
        }
        if (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) {
            if (node.operator !== ts.SyntaxKind.PlusPlusToken &&
                node.operator !== ts.SyntaxKind.MinusMinusToken)
                return;
            const root = assignmentRootIdentifier(node.operand);
            if (root === undefined)
                return;
            const binding = visibleBinding(root.text, root.getStart(sourceFile));
            binding?.assignments.push({
                position: node.getStart(sourceFile),
                linear: false,
                propertyMutation: true
            });
        }
    });
    for (const entries of bindingsByName.values())
        for (const binding of entries)
            binding.assignments.sort((left, right) => left.position - right.position);
    return {
        resolve(expression) {
            return resolveExpression(expression, 0, new Set());
        }
    };
    function addBinding(binding) {
        const current = bindingsByName.get(binding.name) ?? [];
        current.push(binding);
        bindingsByName.set(binding.name, current);
    }
    function visibleBinding(name, position) {
        return (bindingsByName.get(name) ?? [])
            .filter((binding) => binding.readyAt < position &&
            binding.scope.pos <= position &&
            binding.scope.end >= position)
            .sort((left, right) => left.scope.end - left.scope.pos - (right.scope.end - right.scope.pos) ||
            right.readyAt - left.readyAt)[0];
    }
    function resolveExpression(expression, depth, visited) {
        if (depth > CACHE_ALIAS_DEPTH)
            return unresolved(expression, "the local alias-depth limit was exceeded");
        const value = unwrapCacheExpression(expression);
        if (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value))
            return resolved(value.text);
        if (ts.isIdentifier(value)) {
            if (isCacheScopeComponent(value.text))
                return resolved(value.text);
            const binding = visibleBinding(value.text, value.getStart(sourceFile));
            if (binding === undefined)
                return unresolved(value, `identifier '${value.text}' has no supported local reaching definition`);
            if (visited.has(binding.id))
                return unresolved(value, `identifier '${value.text}' participates in an alias cycle`);
            const nextVisited = new Set(visited);
            nextVisited.add(binding.id);
            return resolveBinding(binding, value.getStart(sourceFile), depth + 1, nextVisited);
        }
        if (ts.isPropertyAccessExpression(value)) {
            const direct = value.getText(sourceFile);
            if (/^(?:user\.id|session\.user(?:\.id)?)$/u.test(direct))
                return resolved(direct);
            return resolveStaticProperty(value.expression, value.name.text, value.getStart(sourceFile), depth + 1, visited);
        }
        if (ts.isElementAccessExpression(value)) {
            const property = staticElementName(value.argumentExpression);
            if (property === undefined)
                return unresolved(value, "the cache-key object uses a dynamic computed property");
            return resolveStaticProperty(value.expression, property, value.getStart(sourceFile), depth + 1, visited);
        }
        if (ts.isTemplateExpression(value)) {
            const parts = [resolved(value.head.text)];
            for (const span of value.templateSpans) {
                parts.push(resolveExpression(span.expression, depth + 1, visited));
                parts.push(resolved(span.literal.text));
            }
            return combine(parts);
        }
        if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.PlusToken)
            return combine([
                resolveExpression(value.left, depth + 1, visited),
                resolveExpression(value.right, depth + 1, visited)
            ]);
        if (ts.isCallExpression(value)) {
            const helper = value.expression.getText(sourceFile);
            return unresolved(value, `helper '${helper}' is outside bounded local analysis`, helper);
        }
        return unresolved(value, `expression kind '${ts.SyntaxKind[value.kind]}' is outside bounded cache-key analysis`);
    }
    function resolveBinding(binding, usagePosition, depth, visited) {
        const priorAssignments = binding.assignments.filter((assignment) => assignment.position < usagePosition);
        if (priorAssignments.some((assignment) => !assignment.linear || assignment.propertyMutation))
            return unresolved(binding.declaration, `identifier '${binding.name}' is mutated through dynamic control flow or an object property`, binding.name);
        if (!binding.mutable && priorAssignments.length > 0)
            return unresolved(binding.declaration, `immutable identifier '${binding.name}' has an unexpected reassignment`, binding.name);
        const latest = priorAssignments.at(-1)?.expression;
        const reaching = latest ?? binding.initializer;
        if (reaching === undefined)
            return unresolved(binding.declaration, `identifier '${binding.name}' has no initialized reaching value`, binding.name);
        if (binding.destructuredProperty !== undefined)
            return resolveStaticProperty(reaching, binding.destructuredProperty, usagePosition, depth + 1, visited);
        return resolveExpression(reaching, depth + 1, visited);
    }
    function resolveStaticProperty(objectExpression, property, usagePosition, depth, visited) {
        if (depth > CACHE_ALIAS_DEPTH)
            return unresolved(objectExpression, "the local alias-depth limit was exceeded");
        const object = unwrapCacheExpression(objectExpression);
        if (ts.isIdentifier(object)) {
            const binding = visibleBinding(object.text, object.getStart(sourceFile));
            if (binding === undefined)
                return unresolved(object, `object '${object.text}' has no supported local reaching definition`, object.text);
            if (visited.has(binding.id))
                return unresolved(object, `object '${object.text}' participates in an alias cycle`, object.text);
            const nextVisited = new Set(visited);
            nextVisited.add(binding.id);
            const priorAssignments = binding.assignments.filter((assignment) => assignment.position < usagePosition);
            if (priorAssignments.some((assignment) => !assignment.linear || assignment.propertyMutation))
                return unresolved(object, `object '${object.text}' is reassigned or mutated before the cache sink`, object.text);
            const reaching = priorAssignments.at(-1)?.expression ?? binding.initializer;
            if (reaching === undefined)
                return unresolved(object, `object '${object.text}' has no initialized value`, object.text);
            return resolveStaticProperty(reaching, property, usagePosition, depth + 1, nextVisited);
        }
        if (!ts.isObjectLiteralExpression(object))
            return unresolved(object, "the cache-key property does not come from a local object literal");
        for (const member of object.properties) {
            const name = objectPropertyName(member.name);
            if (name !== property)
                continue;
            if (ts.isPropertyAssignment(member))
                return resolveExpression(member.initializer, depth + 1, visited);
            if (ts.isShorthandPropertyAssignment(member))
                return resolveExpression(member.name, depth + 1, visited);
            return unresolved(member, `object property '${property}' is not a static value`);
        }
        return unresolved(object, `object property '${property}' is not statically present`);
    }
}
function lexicalScope(node, sourceFile) {
    let current = node.parent;
    while (!ts.isSourceFile(current)) {
        if (ts.isBlock(current) ||
            ts.isCaseBlock(current) ||
            ts.isForStatement(current) ||
            ts.isForInStatement(current) ||
            ts.isForOfStatement(current))
            return current;
        current = current.parent;
    }
    return sourceFile;
}
function isLinearAssignment(node, scope) {
    return ts.isExpressionStatement(node.parent) && node.parent.parent === scope;
}
function assignmentRootIdentifier(expression) {
    let current = unwrapCacheExpression(expression);
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
        current = unwrapCacheExpression(current.expression);
    return ts.isIdentifier(current) ? current : undefined;
}
function unwrapCacheExpression(expression) {
    let current = expression;
    while (ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isNonNullExpression(current) ||
        ts.isSatisfiesExpression(current))
        current = current.expression;
    return current;
}
function bindingPropertyName(element) {
    if (element.propertyName === undefined)
        return ts.isIdentifier(element.name) ? element.name.text : undefined;
    return staticPropertyName(element.propertyName);
}
function objectPropertyName(name) {
    if (name === undefined)
        return undefined;
    if (ts.isComputedPropertyName(name))
        return staticElementName(name.expression);
    return staticPropertyName(name);
}
function staticPropertyName(name) {
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name))
        return name.text;
    if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name))
        return name.text;
    return undefined;
}
function staticElementName(expression) {
    if (expression === undefined)
        return undefined;
    const value = unwrapCacheExpression(expression);
    return ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) ? value.text : undefined;
}
function isCacheScopeComponent(value) {
    return /^(?:userId|tenantId|organizationId)$/u.test(value);
}
function resolved(text) {
    return { complete: true, text, identifiers: [], reasons: [] };
}
function unresolved(node, reason, identifier) {
    return {
        complete: false,
        text: "",
        identifiers: [identifier ?? (ts.isIdentifier(node) ? node.text : node.getText())],
        reasons: [reason]
    };
}
function combine(parts) {
    return {
        complete: parts.every((part) => part.complete),
        text: parts
            .map((part) => part.text)
            .join("")
            .slice(0, 4096),
        identifiers: parts.flatMap((part) => part.identifiers),
        reasons: parts.flatMap((part) => part.reasons)
    };
}
function mergeIssues(issues) {
    const findings = new Map();
    const identities = structuralIdentities(issues);
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
        const identity = identities.get(candidate);
        if (identity === undefined)
            throw new Error("Analyzer issue lacks structural identity.");
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
                status: candidate.status ?? "FAIL",
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
        if (!current.location.some((item) => item.path === location.path && item.line === location.line))
            current.location.push(location);
        if (!current.evidence.includes(candidate.evidence))
            current.evidence.push(candidate.evidence);
        current.trace?.push(trace);
        if (!current.evidence_snapshot?.some((item) => item.path === snapshot.path && item.line === snapshot.line))
            current.evidence_snapshot?.push(snapshot);
    }
    return [...findings.values()].sort((a, b) => a.id.localeCompare(b.id) || (a.instance_id ?? "").localeCompare(b.instance_id ?? ""));
}
/**
 * Stable per-occurrence identity for a rule. Derived from the rule ID, the repository-relative
 * path, and the sink symbol so that it survives unrelated edits to the same file.
 */
export function findingInstanceId(ruleId, path, sink) {
    const digest = sha256(`${ruleId} ${path} ${sink}`).slice(0, 16);
    return `${ruleId}:${digest}`;
}
function structuralFindingInstanceId(candidate, identity) {
    const digest = sha256([
        candidate.spec.id,
        toPosix(candidate.file.path),
        identity.scope,
        identity.receiver,
        sinkFromName(candidate.sink),
        identity.fingerprint,
        String(identity.ordinal)
    ].join("\u0000")).slice(0, 16);
    return `${candidate.spec.id}:${digest}`;
}
function structuralIdentities(issues) {
    const bases = new Map();
    const parts = new Map();
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
    const result = new Map();
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
            if (part === undefined)
                continue;
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
function structuralOccurrenceOrdinal(candidate) {
    const target = candidate.node;
    if (target === undefined)
        return undefined;
    let scope = candidate.file.sourceFile;
    let parent = target;
    while (!ts.isSourceFile(parent)) {
        if (ts.isFunctionLike(parent)) {
            scope = parent;
            break;
        }
        parent = parent.parent;
    }
    let ordinal = 0;
    const walkScope = (node) => {
        if (node !== scope && ts.isFunctionLike(node))
            return undefined;
        if (sameStructuralSinkNode(node, target, candidate.file.sourceFile)) {
            ordinal += 1;
            if (node === target)
                return ordinal;
        }
        return node.forEachChild(walkScope);
    };
    return walkScope(scope);
}
function sameStructuralSinkNode(node, target, sourceFile) {
    if (ts.isCallExpression(target))
        return ts.isCallExpression(node) && callName(node.expression) === callName(target.expression);
    if (ts.isNewExpression(target))
        return (ts.isNewExpression(node) &&
            node.expression.getText(sourceFile) === target.expression.getText(sourceFile));
    if (ts.isJsxOpeningElement(target) || ts.isJsxSelfClosingElement(target)) {
        return ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
            node.tagName.getText(sourceFile) === target.tagName.getText(sourceFile) &&
            jsxAttributeValue(node, "target") === jsxAttributeValue(target, "target"));
    }
    return node.kind === target.kind;
}
function containingScope(candidate) {
    let current = candidate.node;
    while (current !== undefined) {
        if (ts.isFunctionLike(current)) {
            const name = functionNodeName(current, candidate.file.sourceFile);
            if (name !== undefined)
                return `${ts.SyntaxKind[current.kind]}:${name}`;
            if (ts.isCallExpression(current.parent)) {
                const route = routeScopeName(current.parent, candidate.file.sourceFile);
                if (route !== undefined)
                    return route;
            }
            return `${ts.SyntaxKind[current.kind]}:anonymous`;
        }
        current = current.parent;
    }
    const anchor = closestNodeAt(candidate.file.sourceFile, candidate.start);
    return anchor === undefined ? "source-file" : `top-level:${ts.SyntaxKind[anchor.kind]}`;
}
function routeScopeName(node, sourceFile) {
    void sourceFile;
    const name = callName(node.expression);
    if (!/(?:^|\.)(?:get|post|put|patch|delete|use)$/u.test(name))
        return undefined;
    const route = node.arguments[0];
    return route !== undefined && ts.isStringLiteralLike(route)
        ? `route:${name}:${route.text}`
        : `route:${name}:dynamic`;
}
function structuralFingerprint(candidate) {
    const node = candidate.node ?? closestNodeAt(candidate.file.sourceFile, candidate.start);
    if (node !== undefined)
        return sha256(astShape(node)).slice(0, 20);
    const line = lineText(candidate.file.content, lineNumber(candidate.file.content, candidate.start));
    return sha256(line
        .replace(/["'`][^"'`]*["'`]/gu, "<literal>")
        .replace(/\s+/gu, " ")
        .trim()).slice(0, 20);
}
function astShape(node) {
    if (ts.isIdentifier(node))
        return `Identifier:${node.text}`;
    if (ts.isStringLiteralLike(node))
        return `StringLiteral:${sha256(node.text).slice(0, 8)}`;
    if (ts.isNumericLiteral(node))
        return `NumericLiteral:${node.text}`;
    const children = [];
    node.forEachChild((child) => children.push(astShape(child)));
    return `${ts.SyntaxKind[node.kind]}(${children.join(",")})`;
}
function closestNodeAt(sourceFile, position) {
    let best;
    const search = (node) => {
        if (position < node.getFullStart() || position > node.getEnd())
            return;
        best = node;
        node.forEachChild(search);
    };
    search(sourceFile);
    return best;
}
function receiverFromSink(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.slice(0, -1).join(".") : "<direct>";
}
function sinkFromName(name) {
    return name.split(".").at(-1) ?? name;
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
        node,
        start: node.getStart(file.sourceFile),
        end: node.getEnd(),
        evidence: `${source} reaches ${sink} at ${file.path}:${lineNumber(file.content, node.getStart(file.sourceFile))}.`,
        source,
        sink
    };
}
function textIssue(specValue, file, start, source, sink) {
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
function hasInterpolation(argument, sourceFile) {
    return (ts.isTemplateExpression(argument) ||
        (ts.isBinaryExpression(argument) && argument.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
        /\$\{|\+\s*(?:req|request)\./u.test(argument.getText(sourceFile)));
}
function sqlSinkShape(name, node) {
    if (/(?:^|\.)(?:\$queryRawUnsafe|\$executeRawUnsafe)$/u.test(name))
        return { textArgument: 0 };
    if (/(?:^|\.)knex\.raw$|^knex\.raw$/iu.test(name))
        return { textArgument: 0, valuesArgument: 1 };
    if (/(?:^|\.)(?:pool|client|connection|conn|db|database|sqlite|knex|trx|tx)\.(?:query|execute|all|get|run|raw)$/iu.test(name)) {
        const first = node.arguments[0];
        return first !== undefined && ts.isObjectLiteralExpression(first)
            ? { textArgument: 0, objectTextProperty: "text" }
            : { textArgument: 0, valuesArgument: 1 };
    }
    return undefined;
}
function sqlTextExpression(node, shape) {
    const argument = node.arguments[shape.textArgument];
    if (argument === undefined || shape.objectTextProperty === undefined)
        return argument;
    if (!ts.isObjectLiteralExpression(argument))
        return undefined;
    for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property))
            continue;
        if (property.name.getText(node.getSourceFile()).replace(/["']/gu, "") === shape.objectTextProperty)
            return property.initializer;
    }
    return undefined;
}
function isSqlSink(name) {
    return (/(?:^|\.)(?:\$queryRawUnsafe|\$executeRawUnsafe)$/u.test(name) ||
        /(?:^|\.)(?:pool|client|connection|conn|db|database|sqlite|knex|trx|tx)\.(?:query|execute|all|get|run|raw)$/iu.test(name));
}
/**
 * True when a call is probably an unregistered SQL wrapper.
 *
 * Suffix conventions alone are unreliable: `runSql(text, values)` never matched the old rule and
 * stayed silent. Evidence is therefore taken from the call itself — an argument that reads as SQL
 * text, or a same-file body that delegates to a registered SQL sink — with the name treated as a
 * weaker supporting signal. Arbitrary `(string, array)` helpers must not qualify, so at least one
 * of the two structural signals is always required.
 */
function looksLikeUnknownSqlWrapper(node, requestControlled, file) {
    if (!requestControlled || node.arguments.length === 0)
        return false;
    const first = node.arguments[0];
    const carriesSqlText = first !== undefined &&
        (ts.isStringLiteralLike(first) || ts.isTemplateExpression(first)) &&
        SQL_TEXT_PATTERN.test(first.getText(file?.sourceFile ?? first.getSourceFile()));
    const delegates = file !== undefined && wrapperDelegatesToSqlSink(node, file);
    if (!carriesSqlText && !delegates)
        return false;
    return true;
}
const SQL_TEXT_PATTERN = /\b(?:select|insert\s+into|update|delete\s+from|with|merge)\b[\s\S]*\b(?:from|into|set|values|where)\b/iu;
/** True when the callee resolves to a same-file function whose body reaches a registered SQL sink. */
function wrapperDelegatesToSqlSink(node, file) {
    if (!ts.isIdentifier(node.expression))
        return false;
    const declaration = findLocalFunction(node.expression.text, file.sourceFile);
    if (declaration?.body === undefined)
        return false;
    let delegates = false;
    const walk = (current) => {
        if (delegates)
            return;
        if (ts.isCallExpression(current) && sqlSinkShape(callName(current.expression), current))
            delegates = true;
        else
            ts.forEachChild(current, walk);
    };
    ts.forEachChild(declaration.body, walk);
    return delegates;
}
function isNoSqlSink(name) {
    // Unambiguous ORM/driver methods: the name alone identifies a data-access call.
    if (/(?:^|\.)(?:findMany|aggregate|updateMany|deleteMany)$/u.test(name))
        return true;
    // `find` and `findOne` collide with Array.prototype.find and similar collection helpers, so
    // they only count as query sinks when the receiver looks like a data accessor. Without this
    // the analyzer reports every array search as a database query.
    return /(?:^|\.)(?:find|findOne)$/u.test(name) && hasDataAccessReceiver(name);
}
/** Receiver vocabulary that indicates a database, ORM, collection, or repository handle. */
function hasDataAccessReceiver(name) {
    const segments = name.split(".");
    if (segments.length < 2)
        return false;
    return segments
        .slice(0, -1)
        .some((segment) => /^(?:db|database|prisma|knex|sequelize|mongoose|mongo|client|conn|connection|pool|collection|repository|repo|models?|table|store|dataSource|entityManager|em|orm|tx|trx|session)$/iu.test(segment) || /(?:Repository|Collection|Model|Table|Store|Dao)$/u.test(segment));
}
function isQuerySink(name) {
    return (isSqlSink(name) || isNoSqlSink(name) || /(?:^|\.)(?:findUnique|findFirst|findById)$/u.test(name));
}
function isShellSink(name) {
    return /(?:^|\.)(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|system)$/u.test(name);
}
function isLogSink(name) {
    return /(?:^|\.)(?:log|info|warn|error|debug|trace)$/u.test(name);
}
function isCacheSink(name) {
    return /(?:^|\.)(?:get|set|mget|mset|del|invalidate)$/u.test(name) && /redis|cache/u.test(name);
}
function isObjectLookup(name) {
    return /(?:^|\.)(?:findUnique|findFirst|findOne|findById|delete|deleteMany|update|updateMany)$/u.test(name);
}
function isHttpClientSink(name) {
    if (name === "fetch")
        return true;
    if (/^https?\.(?:get|request)$/u.test(name))
        return true;
    return /^(?:axios|got|superagent|undici|needle)(?:\.(?:get|post|put|patch|delete|head|request|fetch|stream))?$/u.test(name);
}
function isDeserializationSink(name) {
    if (name === "eval")
        return true;
    if (/(?:^|\.)(?:unserialize|deserialize|runInContext|runInNewContext|runInThisContext)$/u.test(name))
        return true;
    return /(?:^|\.)load$/u.test(name) && /yaml/iu.test(name);
}
function isModelWriteSink(name) {
    // Unambiguous persistence methods.
    if (/(?:^|\.)(?:updateOne|insertOne)$/u.test(name))
        return true;
    // `create`, `update`, `insert`, `save`, and `assign` are common on non-persistence objects
    // (Object.assign, factory helpers), so they require a data-access receiver.
    return /(?:^|\.)(?:create|update|insert|save|assign)$/u.test(name) && hasDataAccessReceiver(name);
}
function referencesWholeRequestBody(argument, sourceFile) {
    let found = false;
    const check = (node) => {
        if (found)
            return;
        if (ts.isPropertyAccessExpression(node) &&
            /^(?:req|request)\.body$/u.test(node.getText(sourceFile)) &&
            !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) &&
            !(ts.isElementAccessExpression(node.parent) && node.parent.expression === node)) {
            found = true;
            return;
        }
        node.forEachChild(check);
    };
    check(argument);
    return found;
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
/** Resolves the strongest taint origin across a call's arguments. */
function resolveArgumentTaint(node, file, taint) {
    for (const argument of node.arguments) {
        const origin = taint.resolve(argument);
        if (origin !== undefined)
            return origin;
    }
    void file;
    return undefined;
}
function resolveExpressionTaint(expression, file, taint) {
    void file;
    return taint.resolve(expression);
}
function expressionHasProtection(expression, file, taint, kinds) {
    const relevant = collectTaintedValueExpressions(expression, file.sourceFile, taint);
    if (relevant.length === 0)
        return false;
    return relevant.every((value) => kinds.some((kind) => taint.hasProtection(value, kind)));
}
/**
 * True only when every request-controlled value reaching this call carries one of the requested
 * typed protections. A protection on a neighbouring value or unrelated call proves nothing.
 */
function argumentsHaveProtection(node, file, taint, kinds) {
    const relevant = node.arguments.flatMap((argument) => collectTaintedValueExpressions(argument, file.sourceFile, taint));
    if (relevant.length === 0)
        return false;
    return relevant.every((expression) => kinds.some((kind) => taint.hasProtection(expression, kind)));
}
function collectTaintedValueExpressions(node, sourceFile, taint) {
    const values = [];
    const collect = (candidate) => {
        if (!ts.isExpression(candidate)) {
            candidate.forEachChild(collect);
            return;
        }
        const origin = taint.resolve(candidate);
        if (origin !== undefined) {
            const directRequest = containsRequestData(candidate.getText(sourceFile));
            const transformed = (ts.isCallExpression(candidate) || ts.isNewExpression(candidate)) &&
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
function isShellSeparatedCall(node, file, taint) {
    const name = callName(node.expression);
    if (!/(?:^|\.)(?:spawn|spawnSync|execFile|execFileSync)$/u.test(name))
        return false;
    const executable = node.arguments[0];
    if (executable === undefined ||
        !(ts.isStringLiteralLike(executable) || ts.isNoSubstitutionTemplateLiteral(executable)))
        return false;
    const options = node.arguments.find(ts.isObjectLiteralExpression);
    if (options?.properties.some((property) => ts.isPropertyAssignment(property) &&
        property.name.getText(file.sourceFile) === "shell" &&
        property.initializer.kind === ts.SyntaxKind.TrueKeyword))
        return false;
    const argumentValue = node.arguments[1];
    if (argumentValue === undefined)
        return false;
    const argumentArray = ts.isArrayLiteralExpression(argumentValue)
        ? argumentValue
        : ts.isIdentifier(argumentValue)
            ? findArrayInitializer(argumentValue, node, file.sourceFile)
            : undefined;
    if (argumentArray === undefined)
        return false;
    const untrusted = argumentArray.elements.flatMap((element) => ts.isExpression(element) ? collectTaintedValueExpressions(element, file.sourceFile, taint) : []);
    return (untrusted.length > 0 &&
        untrusted.every((expression) => taint.hasProtection(expression, "validated") ||
            taint.hasProtection(expression, "allowlisted")));
}
function findArrayInitializer(identifier, before, sourceFile) {
    let best;
    visit(sourceFile, [], (node) => {
        if (ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === identifier.text &&
            node.initializer !== undefined &&
            ts.isArrayLiteralExpression(node.initializer) &&
            node.getStart(sourceFile) < before.getStart(sourceFile) &&
            (best === undefined || node.getStart(sourceFile) > best.getStart(sourceFile)))
            best = node;
    });
    return best?.initializer !== undefined && ts.isArrayLiteralExpression(best.initializer)
        ? best.initializer
        : undefined;
}
function isConstrainedRedirect(node, file, taint) {
    const target = node.arguments[0];
    if (target === undefined)
        return false;
    if (taint.hasProtection(target, "allowlisted", "destination"))
        return true;
    return hasDominatingGuard(node, file.sourceFile, (call) => {
        // The guard must be an actual membership operation on a collection. A receiver named
        // `allowedRedirects` is a discovery hint; `.has`/`.includes` is the structural evidence.
        if (!isMembershipCheck(call))
            return undefined;
        const argument = call.arguments[0];
        return argument !== undefined && sameTaintedValue(argument, target, taint)
            ? "deny-when-false"
            : undefined;
    });
}
/** `<collection>.has(value)` or `<collection>.includes(value)` — a real membership operation. */
function isMembershipCheck(call) {
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee))
        return false;
    return callee.name.text === "has" || callee.name.text === "includes";
}
/**
 * Literals that show a function body is genuinely reasoning about non-public address space:
 * loopback, RFC 1918, link-local (including the cloud metadata address), and IPv6 equivalents.
 */
const ADDRESS_RANGE_LITERAL = /(?:\b(?:10|127)\.|\b169\.254\.|\b172\.(?:1[6-9]|2\d|3[01])\.|\b192\.168\.|::1\b|\bfc00|\bfd00|\bfe80|\blocalhost\b|\b0x7f)/iu;
/** The simple callee identifier, ignoring any receiver. */
function simpleCalleeName(expression) {
    if (ts.isIdentifier(expression))
        return expression.text;
    if (ts.isPropertyAccessExpression(expression))
        return expression.name.text;
    return undefined;
}
/** A same-file `function f() {}` or `const f = () => {}` declaration for `name`. */
function findLocalFunction(name, sourceFile) {
    let found;
    visit(sourceFile, [], (node) => {
        if (found !== undefined)
            return;
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
            found = node;
            return;
        }
        if (!ts.isVariableDeclaration(node))
            return;
        if (!ts.isIdentifier(node.name) || node.name.text !== name)
            return;
        const initializer = node.initializer;
        if (initializer === undefined)
            return;
        if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            found = initializer;
    });
    return found;
}
/**
 * An address guard is credited only when a supported same-file implementation actually models
 * address classification. The name alone proves nothing — `function isPrivate() { return false; }`
 * reads as a guard and blocks nothing, so name recognition credits a mitigation that does not
 * exist. The implementation must take the value under test, reference it, and decide against
 * concrete non-public address evidence.
 *
 * Limitation: a guard imported from another module or a package is not modeled here. That
 * mitigation stays *unverified* rather than credited, so the finding is reported.
 */
function isModeledAddressGuard(call, sourceFile) {
    const name = simpleCalleeName(call.expression);
    if (name === undefined)
        return false;
    const declaration = findLocalFunction(name, sourceFile);
    if (declaration === undefined)
        return false;
    const parameter = declaration.parameters[0];
    if (parameter === undefined || !ts.isIdentifier(parameter.name))
        return false;
    const parameterName = parameter.name.text;
    const body = declaration.body;
    if (body === undefined)
        return false;
    // A constant-returning body decides nothing about its argument.
    if (!ts.isBlock(body)) {
        if (isConstantExpression(body))
            return false;
    }
    else {
        const statements = body.statements.filter((statement) => !ts.isEmptyStatement(statement));
        const only = statements[0];
        if (statements.length === 1 &&
            only !== undefined &&
            ts.isReturnStatement(only) &&
            (only.expression === undefined || isConstantExpression(only.expression)))
            return false;
    }
    // The body must both use the value under test and weigh it against real address evidence.
    const nodes = [];
    visit(body, [], (node) => {
        nodes.push(node);
    });
    const referencesParameter = nodes.some((node) => ts.isIdentifier(node) && node.text === parameterName);
    const hasAddressEvidence = nodes.some((node) => (ts.isStringLiteralLike(node) || ts.isRegularExpressionLiteral(node)) &&
        ADDRESS_RANGE_LITERAL.test(node.getText(sourceFile)));
    return referencesParameter && hasAddressEvidence;
}
/** `true`, `false`, `null`, a number, or a string — nothing derived from an argument. */
function isConstantExpression(node) {
    return (node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword ||
        ts.isNumericLiteral(node) ||
        ts.isStringLiteralLike(node));
}
function isNetworkConstrainedTarget(sink, target, file, taint) {
    if (target === undefined)
        return false;
    const redirectConstrained = hasExplicitRedirectConstraint(sink, file.sourceFile);
    if (taint.hasProtection(target, "trusted-origin", "network") &&
        taint.hasProtection(target, "network-constrained", "network"))
        return redirectConstrained;
    const allowlisted = hasDominatingGuard(sink, file.sourceFile, (call) => {
        if (!isMembershipCheck(call))
            return undefined;
        const argument = call.arguments[0];
        return argument !== undefined && sameTaintedValue(argument, target, taint)
            ? "deny-when-false"
            : undefined;
    });
    const privateBlocked = hasDominatingGuard(sink, file.sourceFile, (call) => {
        if (!isModeledAddressGuard(call, file.sourceFile))
            return undefined;
        const argument = call.arguments[0];
        return argument !== undefined && sameTaintedValue(argument, target, taint)
            ? "deny-when-true"
            : undefined;
    });
    return allowlisted && privateBlocked && redirectConstrained;
}
function hasExplicitRedirectConstraint(sink, sourceFile) {
    return sink.arguments.some((argument) => ts.isObjectLiteralExpression(argument) &&
        argument.properties.some((property) => {
            if (!ts.isPropertyAssignment(property))
                return false;
            const key = property.name.getText(sourceFile).replace(/["']/gu, "");
            if (key === "redirect" && ts.isStringLiteralLike(property.initializer))
                return ["manual", "error"].includes(property.initializer.text.toLowerCase());
            return key === "maxRedirects" && property.initializer.getText(sourceFile) === "0";
        }));
}
function hasObjectAuthorization(sink, file, taint) {
    if (queryEmbedsTrustedScope(sink, file.sourceFile))
        return true;
    const objectSources = new Set(sink.arguments
        .flatMap((argument) => collectTaintedValueExpressions(argument, file.sourceFile, taint))
        .map((expression) => taint.resolve(expression)?.source)
        .filter((source) => source !== undefined));
    if (objectSources.size === 0)
        return false;
    const connected = (call) => {
        const argumentsValue = [...call.arguments];
        const hasSubject = argumentsValue.some((argument) => isTrustedSubjectExpression(argument, file.sourceFile));
        const hasObject = argumentsValue.some((argument) => {
            const source = taint.resolve(argument)?.source;
            return source !== undefined && objectSources.has(source);
        });
        return hasSubject && hasObject;
    };
    for (const statement of precedingStatements(sink)) {
        const candidate = unconditionalExpressionCall(statement);
        if (candidate === undefined || !connected(candidate))
            continue;
        const name = callName(candidate.expression);
        if (/(?:^|\.)(?:authorize|assertCanAccess|requireAccess|enforcePolicy|authorizeObject)$/iu.test(name))
            return true;
    }
    return hasDominatingGuard(sink, file.sourceFile, (call) => {
        const name = callName(call.expression);
        if (!/(?:canAccess|isAuthorized|policy|permit|allowed)/iu.test(name) || !connected(call))
            return undefined;
        return "deny-when-false";
    });
}
function unconditionalExpressionCall(statement) {
    if (!ts.isExpressionStatement(statement))
        return undefined;
    let expression = statement.expression;
    while (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression))
        expression = expression.expression;
    return ts.isCallExpression(expression) ? expression : undefined;
}
const TENANT_KEYS = [
    "tenantId",
    "clinicId",
    "cabinetId",
    "practiceId",
    "hospitalId",
    "accountId",
    "merchantId",
    "schoolId",
    "workspaceId",
    "orgId",
    "organizationId",
    "companyId",
    "siteId",
    "storeId",
    "projectId"
];
/**
 * Ownership keys discovered structurally for the current run.
 *
 * Discovery infers the project's real ownership boundary (which may be `clinicId`, `franchiseId`,
 * or any other domain name) and hands it to `runAnalyzers`. The built-in list below remains a
 * default so analysis still works when no profile is supplied, but it is never the only mechanism.
 */
let inferredTenantKeys = [];
function activeTenantKeys() {
    return [...new Set([...TENANT_KEYS, ...inferredTenantKeys])];
}
function tenantKeySource() {
    return activeTenantKeys()
        .map((key) => escapeRegExp(key).replace(/Id$/u, "(?:Id|_id)"))
        .join("|");
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function tenantKeyPattern(flags = "u") {
    return new RegExp(`\\b(?:${tenantKeySource()})\\b`, flags);
}
function requestSuppliesTenantKey(text) {
    return new RegExp(`(?:${tenantKeySource()})\\s*:\\s*(?:req|request)\\.(?:params|query|body)`, "u").test(text);
}
function assessTenantScope(node, name, file, context) {
    const contextKeys = extractTenantKeys(context);
    const background = isBackgroundExecutionContext(node, file);
    if (contextKeys.length === 0 && !background)
        return "NOT_RELEVANT";
    if (queryEmbedsTrustedScope(node, file.sourceFile))
        return "PROVEN";
    const shape = sqlSinkShape(name, node);
    if (shape !== undefined) {
        const textExpression = sqlTextExpression(node, shape);
        const sql = staticStringValue(textExpression);
        if (sql === undefined)
            return "UNRESOLVED";
        const keys = [...new Set([...contextKeys, ...extractTenantKeys(sql)])];
        const predicate = findTenantSqlPredicate(sql, keys);
        if (predicate === undefined)
            return "MISSING";
        const value = sqlBoundValue(node, shape, predicate);
        if (value === undefined)
            return "UNRESOLVED";
        return isTrustedTenantValue(value, node, file.sourceFile) ? "PROVEN" : "UNRESOLVED";
    }
    if (containsTenantPredicate(node, file.sourceFile))
        return "UNRESOLVED";
    return "MISSING";
}
function extractTenantKeys(text) {
    const matches = text.match(new RegExp(tenantKeySource(), "giu")) ?? [];
    return [...new Set(matches.map((key) => key.toLowerCase()))];
}
function findTenantSqlPredicate(sql, keys) {
    for (const key of keys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/id$/iu, "(?:id|_id)");
        const match = new RegExp(`\\b${escaped}\\b\\s*=\\s*(\\$\\d+|\\?|:[A-Za-z_$][\\w$]*)`, "iu").exec(sql);
        if (match === null || match[1] === undefined)
            continue;
        const placeholder = match[1];
        if (placeholder.startsWith("$"))
            return { placeholder, positionalIndex: Number.parseInt(placeholder.slice(1), 10) - 1 };
        if (placeholder === "?") {
            const before = sql.slice(0, match.index + match[0].lastIndexOf("?"));
            return { placeholder, positionalIndex: Math.max(0, (before.match(/\?/gu) ?? []).length - 1) };
        }
        return { placeholder, namedKey: placeholder.slice(1) };
    }
    return undefined;
}
function sqlBoundValue(node, shape, predicate) {
    const first = node.arguments[shape.textArgument];
    let values = shape.valuesArgument === undefined ? undefined : node.arguments[shape.valuesArgument];
    if (shape.objectTextProperty !== undefined &&
        first !== undefined &&
        ts.isObjectLiteralExpression(first)) {
        values = objectPropertyInitializer(first, "values") ?? values;
    }
    if (values === undefined)
        return undefined;
    if (predicate.positionalIndex !== undefined && ts.isArrayLiteralExpression(values))
        return values.elements[predicate.positionalIndex];
    if (predicate.namedKey !== undefined && ts.isObjectLiteralExpression(values))
        return objectPropertyInitializer(values, predicate.namedKey);
    return undefined;
}
function objectPropertyInitializer(object, name) {
    for (const property of object.properties) {
        if (ts.isPropertyAssignment(property) && property.name.getText().replace(/["']/gu, "") === name)
            return property.initializer;
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === name)
            return property.name;
    }
    return undefined;
}
function staticStringValue(expression) {
    if (expression === undefined)
        return undefined;
    return ts.isStringLiteralLike(expression) ? expression.text : undefined;
}
function isTrustedTenantValue(expression, sink, sourceFile) {
    if (isTrustedTenantExpression(expression, sourceFile))
        return true;
    if (!ts.isIdentifier(expression))
        return false;
    let initializer;
    visit(sourceFile, [], (candidate) => {
        if (initializer === undefined &&
            ts.isVariableDeclaration(candidate) &&
            ts.isIdentifier(candidate.name) &&
            candidate.name.text === expression.text &&
            candidate.initializer !== undefined &&
            candidate.getStart(sourceFile) < sink.getStart(sourceFile))
            initializer = candidate.initializer;
    });
    return initializer !== undefined && isTrustedTenantExpression(initializer, sourceFile);
}
function containsTenantPredicate(node, sourceFile) {
    return tenantKeyPattern().test(node.getText(sourceFile));
}
function queryEmbedsTrustedScope(node, sourceFile) {
    let connected = false;
    for (const argument of node.arguments) {
        visit(argument, [], (candidate) => {
            if (connected || !ts.isPropertyAssignment(candidate))
                return;
            if (!isQueryPredicateProperty(candidate, argument, sourceFile))
                return;
            const key = candidate.name.getText(sourceFile).replace(/["']/gu, "");
            if (/^(?:ownerId|userId|subjectId|createdById)$/iu.test(key))
                connected = isTrustedSubjectExpression(candidate.initializer, sourceFile);
            if (tenantKeyPattern().test(key))
                connected = isTrustedTenantExpression(candidate.initializer, sourceFile);
        });
    }
    return connected;
}
function isQueryPredicateProperty(property, argument, sourceFile) {
    let current = property.parent;
    while (current !== argument) {
        if (ts.isPropertyAssignment(current)) {
            const key = current.name.getText(sourceFile).replace(/["']/gu, "");
            if (/^(?:where|filter|query|match)$/iu.test(key))
                return true;
            if (/^(?:data|select|include|create|update|projection)$/iu.test(key))
                return false;
        }
        if (ts.isSourceFile(current))
            return false;
        current = current.parent;
    }
    return ts.isObjectLiteralExpression(argument) && property.parent === argument;
}
function isTrustedSubjectExpression(node, sourceFile) {
    return expandTrustedAliases(node, sourceFile).some((text) => /^(?:req|request)\.(?:user|auth(?:\.user)?)(?:\.(?:id|userId|subjectId))?|^(?:session|auth|ctx\.state|context|locals)\.user(?:\.(?:id|userId|subjectId))?|^(?:currentUser|authenticatedUser|subject)\.(?:id|userId|subjectId)$/u.test(text));
}
/**
 * Returns the expression text plus any same-scope alias expansions.
 *
 * `const user = req.user; … ownerId: user.id` must read as an ownership predicate. Each leading
 * identifier is substituted with its `const`/`let` initializer, bounded to three hops so a chain
 * cannot loop or grow without limit. The original text is always included so direct matches keep
 * working unchanged.
 */
function expandTrustedAliases(node, sourceFile) {
    const seen = new Set();
    let frontier = [node.getText(sourceFile).replace(/\s+/gu, "")];
    for (const text of frontier)
        seen.add(text);
    for (let hop = 0; hop < 3; hop += 1) {
        const next = [];
        for (const text of frontier) {
            const head = /^([A-Za-z_$][\w$]*)/u.exec(text)?.[1];
            if (head === undefined)
                continue;
            const initializer = findLocalConstInitializer(sourceFile, head);
            if (initializer === undefined)
                continue;
            const expanded = initializer + text.slice(head.length);
            if (seen.has(expanded))
                continue;
            seen.add(expanded);
            next.push(expanded);
        }
        if (next.length === 0)
            break;
        frontier = next;
    }
    return [...seen];
}
/** Finds the initializer text of a same-file `const`/`let` binding with the given name. */
function findLocalConstInitializer(sourceFile, name) {
    let initializer;
    const walk = (node) => {
        if (initializer !== undefined)
            return;
        if (ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
            node.initializer !== undefined &&
            !ts.isArrowFunction(node.initializer) &&
            !ts.isFunctionExpression(node.initializer)) {
            initializer = node.initializer.getText(sourceFile).replace(/\s+/gu, "");
            return;
        }
        ts.forEachChild(node, walk);
    };
    ts.forEachChild(sourceFile, walk);
    return initializer;
}
function isTrustedTenantExpression(node, sourceFile) {
    const key = `(?:${tenantKeySource()})`;
    const pattern = new RegExp(`^(?:req|request)\\.(?:session\\.user|auth(?:\\.user)?|user)\\.${key}$|^(?:session\\.user|auth\\.user|ctx\\.state(?:\\.user)?|context(?:\\.user)?)\\.${key}$|^(?:trustedTenant|tenantContext)\\.(?:id|${key})$`, "iu");
    return expandTrustedAliases(node, sourceFile).some((text) => pattern.test(text));
}
function hasDominatingGuard(sink, sourceFile, classify) {
    for (const statement of precedingStatements(sink)) {
        if (!ts.isIfStatement(statement) || !abruptlyExits(statement.thenStatement))
            continue;
        const calls = [];
        visit(statement.expression, [], (candidate) => {
            if (ts.isCallExpression(candidate))
                calls.push(candidate);
        });
        for (const candidate of calls) {
            const meaning = classify(candidate);
            if (meaning === undefined)
                continue;
            const negated = isWithinNegation(candidate, statement.expression);
            if ((meaning === "deny-when-true" && !negated) || (meaning === "deny-when-false" && negated))
                return true;
        }
    }
    void sourceFile;
    return false;
}
function precedingStatements(node) {
    let statement = node;
    while (!ts.isStatement(statement)) {
        if (ts.isSourceFile(statement))
            return [];
        statement = statement.parent;
    }
    const parent = statement.parent;
    const statements = ts.isBlock(parent) || ts.isSourceFile(parent) ? [...parent.statements] : [];
    const position = statements.indexOf(statement);
    return position < 0 ? [] : statements.slice(0, position);
}
function abruptlyExits(node) {
    if (ts.isReturnStatement(node) || ts.isThrowStatement(node))
        return true;
    if (ts.isBlock(node)) {
        const last = node.statements.at(-1);
        return last !== undefined && abruptlyExits(last);
    }
    if (ts.isIfStatement(node))
        return (node.elseStatement !== undefined &&
            abruptlyExits(node.thenStatement) &&
            abruptlyExits(node.elseStatement));
    return false;
}
function isWithinNegation(node, boundary) {
    let current = node.parent;
    let negated = false;
    for (;;) {
        if (ts.isPrefixUnaryExpression(current) && current.operator === ts.SyntaxKind.ExclamationToken)
            negated = !negated;
        if (current === boundary || ts.isSourceFile(current))
            break;
        current = current.parent;
    }
    return negated;
}
function sameTaintedValue(left, right, taint) {
    const leftSource = taint.resolve(left)?.source;
    const rightSource = taint.resolve(right)?.source;
    return leftSource !== undefined && leftSource === rightSource;
}
function isBackgroundExecutionContext(node, file) {
    if (/(?:^|\/)(?:jobs?|workers?|queues?|exports?)(?:\/|\.|-)/iu.test(file.path))
        return true;
    let current = node;
    for (;;) {
        const name = functionNodeName(current, file.sourceFile);
        if (name !== undefined && /(?:job|worker|queue|export)/iu.test(name))
            return true;
        if (ts.isSourceFile(current))
            break;
        current = current.parent;
    }
    return false;
}
function functionNodeName(node, sourceFile) {
    if (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isFunctionExpression(node))
        return node.name?.getText(sourceFile);
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
        ts.isVariableDeclaration(node.parent) &&
        ts.isIdentifier(node.parent.name))
        return node.parent.name.text;
    return undefined;
}
/**
 * True when the resolved flow reached the sink through string interpolation or concatenation,
 * even though the sink argument itself is a plain identifier.
 */
function flowPassedThroughInterpolation(flow) {
    return (flow?.steps.some((step) => step.includes("template literal") || step.includes("string concatenation")) ?? false);
}
/** Renders the source for evidence, preferring a resolved data-flow origin over raw text. */
function flowSource(flow, text) {
    if (flow === undefined)
        return requestSource(text);
    return flow.steps.length === 0 ? flow.source : `${flow.source} (${flow.steps.join(" -> ")})`;
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
function hasJsxAttributeName(node, name) {
    return node.attributes.properties.some((candidate) => ts.isJsxAttribute(candidate) && candidate.name.getText() === name);
}
function hasPointerOnlyClick(node, tag) {
    if (!["div", "span", "li", "section", "article"].includes(tag))
        return false;
    if (!hasJsxAttributeName(node, "onClick"))
        return false;
    const semanticRole = ["button", "link"].includes(jsxAttributeValue(node, "role") ?? "");
    const focusable = hasJsxAttributeName(node, "tabIndex");
    const keyboard = ["onKeyDown", "onKeyUp", "onKeyPress"].some((name) => hasJsxAttributeName(node, name));
    return !(semanticRole && focusable && keyboard);
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