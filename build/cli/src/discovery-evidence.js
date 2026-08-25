import { basename, relative } from "node:path";
import { inventoryRepository } from "./repository-inventory.js";
import { canonicalDirectory, readTextIfPresent, toPosix } from "./utils.js";
/**
 * Discovery evidence classification.
 *
 * Detecting the word "payments" somewhere in a repository never proved that the audited
 * project processes payments. This module separates *where* a signal was observed from
 * *whether* that signal activates a production capability, so documentation, tests,
 * fixtures, examples, and Forge's own generated skill copies can no longer switch an
 * audit module on by themselves.
 */
export const EVIDENCE_CLASSES = [
    "manifest",
    "implementation",
    "configuration",
    "route",
    "schema",
    "test",
    "documentation",
    "fixture",
    "generated",
    "example",
    "unknown"
];
export const CAPABILITY_STATUSES = ["PRESENT", "ABSENT", "UNKNOWN"];
export const CAPABILITY_KINDS = ["control", "surface"];
const CONTROL_CAPABILITIES = new Set(["authentication", "authorization", "observability"]);
export function capabilityKindFor(capability) {
    return CONTROL_CAPABILITIES.has(capability) ? "control" : "surface";
}
/**
 * Activation weight per evidence class.
 *
 * Zero means "observed, but never sufficient to activate a production capability".
 * A capability activates at `ACTIVATION_THRESHOLD`; anything above zero but below the
 * threshold produces `UNKNOWN` so that a pile of weak signals cannot masquerade as proof.
 */
export const ACTIVATION_WEIGHTS = Object.freeze({
    manifest: 0,
    implementation: 1,
    route: 1,
    schema: 1,
    configuration: 0.5,
    example: 0,
    test: 0,
    documentation: 0,
    fixture: 0,
    generated: 0,
    unknown: 0
});
/** Score at which a capability is reported as `PRESENT`. */
export const ACTIVATION_THRESHOLD = 1;
/** Multiplier applied when a match sits inside a comment or a passive string literal. */
export const WEAK_CONTEXT_MULTIPLIER = 0;
const CLASS_CONFIDENCE = Object.freeze({
    manifest: "HIGH",
    implementation: "HIGH",
    route: "HIGH",
    schema: "HIGH",
    configuration: "MEDIUM",
    example: "LOW",
    test: "LOW",
    documentation: "LOW",
    fixture: "LOW",
    generated: "LOW",
    unknown: "LOW"
});
export function activationWeightFor(evidenceClass) {
    return ACTIVATION_WEIGHTS[evidenceClass];
}
const GENERATED_DIRECTORIES = [
    ".agents/skills",
    ".claude/skills",
    ".cursor/skills",
    ".gemini/skills",
    ".github/skills",
    ".windsurf/skills",
    "skills",
    ".fullstack-forge",
    "src/fullstack-forge",
    "third_party"
];
const GENERATED_SEGMENTS = new Set([
    "__generated__",
    ".next",
    ".nuxt",
    ".output",
    "build",
    "dist",
    "generated",
    "node_modules",
    "out",
    "target",
    "vendor"
]);
const FIXTURE_SEGMENTS = new Set([
    "__fixtures__",
    "__mocks__",
    "fixture",
    "fixtures",
    "mock",
    "mocks",
    "stubs",
    "test-data",
    "testdata",
    "eval",
    "evals"
]);
const TEST_SEGMENTS = new Set([
    "__tests__",
    "cypress",
    "e2e",
    "playwright",
    "spec",
    "specs",
    "test",
    "tests"
]);
const EXAMPLE_SEGMENTS = new Set([
    "demo",
    "demos",
    "example",
    "examples",
    "playground",
    "sample",
    "samples",
    "starter",
    "starters"
]);
const DOCUMENTATION_SEGMENTS = new Set(["doc", "docs", "documentation", "website"]);
const REPOSITORY_META_DIRECTORIES = [".github/ISSUE_TEMPLATE", ".github/PULL_REQUEST_TEMPLATE"];
const MANIFEST_FILES = new Set([
    "build.gradle",
    "build.gradle.kts",
    "cargo.toml",
    "composer.json",
    "gemfile",
    "go.mod",
    "package.json",
    "pom.xml",
    "pyproject.toml",
    "requirements.txt"
]);
const IMPLEMENTATION_EXTENSIONS = /\.(?:[cm]?[jt]sx?|c|cc|cpp|cxx|astro|html?|svelte|vue|py|go|rs|java|kt|kts|rb|php|cs|swift|scala|ex|exs)$/iu;
const DOCUMENTATION_EXTENSIONS = /\.(?:md|mdx|rst|adoc|txt)$/iu;
const CONFIGURATION_EXTENSIONS = /\.(?:ya?ml|toml|ini|json|jsonc|conf|properties|env|tf|tfvars)$/iu;
const CONCRETE_CONFIGURATION_FILES = /^(?:dockerfile|procfile|compose\.ya?ml|docker-compose\.ya?ml|vercel\.json|netlify\.toml|fly\.toml|render\.ya?ml|pulumi\.ya?ml|serverless\.ya?ml|robots\.txt|sitemap\.(?:xml|[cm]?[jt]s)|manifest\.webmanifest)$/iu;
/**
 * Classifies a repository-relative POSIX path into a single evidence class.
 *
 * Precedence matters: a `package.json` inside `fixtures/` is fixture evidence, not manifest
 * evidence, and a generated platform copy is never implementation evidence for the audited
 * project. Neutralizing classes are therefore tested before activating ones.
 */
export function classifyEvidencePath(path) {
    const normalized = toPosix(path).replace(/^\.\//u, "");
    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    const name = (segments.at(-1) ?? normalized).toLowerCase();
    const directorySegments = segments.slice(0, -1).map((segment) => segment.toLowerCase());
    for (const directory of GENERATED_DIRECTORIES)
        if (normalized === directory || normalized.startsWith(`${directory}/`))
            return {
                evidence_class: "generated",
                reason: `generated Forge or platform copy under '${directory}'`
            };
    for (const directory of REPOSITORY_META_DIRECTORIES)
        if (normalized === directory || normalized.startsWith(`${directory}/`))
            return {
                evidence_class: "documentation",
                reason: `repository collaboration metadata under '${directory}'`
            };
    const generatedSegment = directorySegments.find((segment) => GENERATED_SEGMENTS.has(segment));
    if (generatedSegment !== undefined)
        return {
            evidence_class: "generated",
            reason: `generated or vendored output directory '${generatedSegment}'`
        };
    if (/\.(?:generated|min)\.[^.]+$/iu.test(name) || name.endsWith(".d.ts"))
        return { evidence_class: "generated", reason: "generated or declaration artifact filename" };
    const fixtureSegment = directorySegments.find((segment) => FIXTURE_SEGMENTS.has(segment));
    if (fixtureSegment !== undefined || name.includes(".fixture"))
        return {
            evidence_class: "fixture",
            reason: `fixture material${fixtureSegment === undefined ? "" : ` under '${fixtureSegment}'`}`
        };
    const testSegment = directorySegments.find((segment) => TEST_SEGMENTS.has(segment));
    if (testSegment !== undefined || /\.(?:test|spec)\.[^.]+$/iu.test(name))
        return {
            evidence_class: "test",
            reason: `test material${testSegment === undefined ? "" : ` under '${testSegment}'`}`
        };
    const exampleSegment = directorySegments.find((segment) => EXAMPLE_SEGMENTS.has(segment));
    if (exampleSegment !== undefined)
        return { evidence_class: "example", reason: `example application under '${exampleSegment}'` };
    const documentationSegment = directorySegments.find((segment) => DOCUMENTATION_SEGMENTS.has(segment));
    if (documentationSegment !== undefined)
        return { evidence_class: "documentation", reason: "prose documentation, not executable code" };
    if (CONCRETE_CONFIGURATION_FILES.test(name))
        return {
            evidence_class: "configuration",
            reason: "recognized deployment, infrastructure, or public-web configuration file"
        };
    if (DOCUMENTATION_EXTENSIONS.test(name))
        return { evidence_class: "documentation", reason: "prose documentation, not executable code" };
    if (MANIFEST_FILES.has(name) || name === "pnpm-workspace.yaml")
        return { evidence_class: "manifest", reason: `declared dependency manifest '${name}'` };
    if (/\.(?:sql|prisma)$/iu.test(name) ||
        directorySegments.includes("migrations") ||
        directorySegments.includes("migration") ||
        /^schema\./iu.test(name))
        return { evidence_class: "schema", reason: "database schema or migration definition" };
    if (/(?:^|\/)app\/(?:.*\/)?route\.[cm]?[jt]sx?$/iu.test(normalized) ||
        /(?:^|\/)pages\/api\//iu.test(normalized) ||
        /(?:^|\/)urls\.py$/iu.test(normalized) ||
        directorySegments.includes("routes") ||
        directorySegments.includes("controllers") ||
        /\.(?:route|routes|controller)\.[cm]?[jt]sx?$/iu.test(name))
        return { evidence_class: "route", reason: "HTTP route or controller module" };
    if (IMPLEMENTATION_EXTENSIONS.test(name))
        return { evidence_class: "implementation", reason: "executable application source" };
    if (CONFIGURATION_EXTENSIONS.test(name) ||
        name.startsWith(".env") ||
        name === "dockerfile" ||
        /^(?:compose|docker-compose)\./iu.test(name) ||
        /\.config\.[^.]+$/iu.test(name))
        return { evidence_class: "configuration", reason: "deployment or runtime configuration" };
    return { evidence_class: "unknown", reason: "unrecognized file kind" };
}
/**
 * Resolves the workspace a path belongs to. `workspaceRoots` holds repository-relative
 * directories (`"."` for the repository root). The longest matching root wins so a nested
 * package is never attributed to its parent.
 */
export function workspaceForPath(path, workspaceRoots) {
    const normalized = toPosix(path).replace(/^\.\//u, "");
    let best = ".";
    for (const candidate of workspaceRoots) {
        const root = toPosix(candidate).replace(/^\.\//u, "").replace(/\/+$/u, "");
        if (root === "" || root === ".")
            continue;
        if (normalized === root || normalized.startsWith(`${root}/`))
            if (root.length > best.length || best === ".")
                best = root;
    }
    return best;
}
const DEFAULT_CONTENT_CLASSES = ["implementation", "route", "schema"];
const NEUTRAL_CONTENT_CLASSES = new Set([
    "documentation",
    "example",
    "fixture",
    "generated",
    "test",
    "unknown"
]);
/**
 * Independent capability signatures. These deliberately favour concrete provider names and
 * API shapes over generic vocabulary, because generic vocabulary is exactly what appears in
 * README prose and test fixtures.
 */
export const CAPABILITY_RULES = Object.freeze([
    {
        capability: "frontend",
        manifest: /["'](?:next|react|react-dom|vue|svelte|@angular\/core|solid-js|astro|@builder\.io\/qwik)["']\s*:/iu,
        content: /\b(?:ReactDOM\.createRoot|createApp|createRoot|hydrateRoot)\s*\(|<(?:a|html|main|nav|form|button|input|section)\b/iu
    },
    {
        capability: "public-web",
        fileNames: /^(?:robots\.txt|sitemap\.(?:xml|[cm]?[jt]s)|manifest\.webmanifest)$/iu,
        content: /\b(?:generateMetadata|metadataBase|schema\.org|rel=["']canonical["'])\b/iu
    },
    {
        capability: "api",
        manifest: /["'](?:express|fastify|@fastify\/[^"']+|@nestjs\/core|hono|koa|@koa\/router)["']\s*:/iu,
        content: /\b(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(|\b(?:FastAPI|APIRouter)\s*\(|@(?:Get|Post|Put|Patch|Delete)\s*\(|(?:from\s+django(?:\.|\s+import\b)|import\s+django\b)/u
    },
    {
        capability: "integrations",
        manifest: /["'](?:axios|got|undici|@supabase\/[^"']+|firebase|firebase-admin|@octokit\/[^"']+)["']\s*:/iu,
        content: /\b(?:fetch|axios\.(?:get|post|put|patch|delete)|request)\s*\(|\b(?:app|router)\.(?:post|put)\s*\(\s*["'`][^"'`]*(?:webhooks?|callbacks?)[^"'`]*["'`]/iu
    },
    {
        capability: "personal-data",
        content: /\b(?:email|phone|address|dateOfBirth|date_of_birth|diagnosis|prescription|medicalRecord|nationalId|personal_data)\b/iu
    },
    {
        capability: "runtime",
        fileNames: /\.(?:[cm]?[jt]sx?|c|cc|cpp|cxx|astro|html?|svelte|vue|py|go|rs|java|kt|kts|rb|php|cs|swift|scala|ex|exs)$/iu
    },
    {
        capability: "deployment",
        fileNames: /^(?:Dockerfile|compose\.ya?ml|docker-compose\.ya?ml|vercel\.json|netlify\.toml|fly\.toml|render\.ya?ml|Procfile)$/iu,
        content: /\b(?:apiVersion:\s*(?:apps\/v1|v1)|services:|builds:|deploy(?:ment)?\s*:)/iu,
        contentClasses: ["configuration"]
    },
    {
        capability: "infrastructure",
        fileNames: /\.(?:tf|tfvars)$|^(?:Pulumi\.ya?ml|serverless\.ya?ml)$/iu,
        content: /\b(?:resource|module)\s+["'][^"']+["']\s+["'][^"']+["']\s*\{/u,
        contentClasses: ["configuration"]
    },
    {
        capability: "paid-services",
        manifest: /["'](?:stripe|@stripe\/[^"']+|braintree|@paypal\/[^"']+|openai|@anthropic-ai\/sdk|@google\/gener\w+-ai|@sentry\/[^"']+|dd-trace|newrelic)["']\s*:/iu,
        content: /\b(?:stripe\.(?:checkout|paymentIntents|subscriptions)|openai\.(?:chat|responses)|anthropic\.messages|Sentry\.init)\b/u
    },
    {
        capability: "authentication",
        manifest: /["'](?:next-auth|@auth\/core|passport|lucia|@clerk\/[\w-]+|auth0|@auth0\/[\w-]+|bcrypt|bcryptjs|argon2|jsonwebtoken|iron-session|express-session)["']\s*:/iu,
        content: /\b(?:signIn|signOut|getServerSession|requireAuth|authenticate|verifyPassword|hashPassword|createSession|refreshToken)\s*\(|\bpassport\.(?:use|authenticate)\b/u
    },
    {
        capability: "authorization",
        content: /\b(?:requireRole|hasPermission|checkPermission|authorize|can|enforcePolicy)\s*\(|\brole\s*===?\s*["'`]admin["'`]/u
    },
    {
        capability: "uploads",
        manifest: /["'](?:multer|formidable|busboy|@fastify\/multipart|express-fileupload|uppy)["']\s*:/iu,
        content: /\bmultipart\/form-data\b|\bmulter\s*\(|\bformidable\s*\(|\bcreatePresignedPost\b|\bgetSignedUrl\s*\(/u
    },
    {
        capability: "payments",
        manifest: /["'](?:stripe|@stripe\/[\w-]+|braintree|@paypal\/[\w-]+|square|adyen)["']\s*:/iu,
        content: /\bstripe\.(?:checkout|paymentIntents|subscriptions|webhooks)\b|\bconstructEvent\s*\(/u
    },
    {
        capability: "database",
        manifest: /["'](?:pg|postgres|mysql2?|sqlite3|better-sqlite3|mongodb|mongoose|@prisma\/client|drizzle-orm|typeorm|sequelize|knex)["']\s*:/iu,
        content: /\bmodel\s+\w+\s*\{|\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|\bnew\s+(?:Pool|Client)\s*\(|\bprisma\.\w+\.(?:findMany|create|update|delete)\b/iu
    },
    {
        capability: "tenancy",
        content: /\b(?:tenant_id|tenantId|organization_id|organizationId|workspace_id|workspaceId)\b|\bwhere\s*:\s*\{[^}]*\btenantId\b/u
    },
    {
        capability: "cache",
        manifest: /["'](?:redis|ioredis|@upstash\/redis|memcached|node-cache|lru-cache)["']\s*:/iu,
        content: /\bredis:\/\/|\bnew\s+Redis\s*\(|\bcache\.(?:get|set)\s*\(/u,
        contentClasses: [...DEFAULT_CONTENT_CLASSES, "configuration"]
    },
    {
        capability: "jobs",
        manifest: /["'](?:bullmq|bull|agenda|inngest|@temporalio\/[\w-]+|node-cron|graphile-worker)["']\s*:/iu,
        content: /\bnew\s+(?:Queue|Worker)\s*\(|\bcron\.schedule\s*\(|\bdefineJob\s*\(/u
    },
    {
        capability: "storage",
        manifest: /["'](?:@aws-sdk\/client-s3|@google-cloud\/storage|@azure\/storage-blob|cloudinary|minio)["']\s*:/iu,
        content: /\bnew\s+S3Client\s*\(|\bPutObjectCommand\b|\bgetBucket\s*\(/u
    },
    {
        capability: "ai",
        manifest: /["'](?:openai|@anthropic-ai\/sdk|@google\/gener\w+-ai|langchain|@langchain\/[\w-]+|ollama)["']\s*:/iu,
        content: /\b(?:openai|anthropic)\.(?:chat|messages|completions|responses)\b|\bchat\.completions\.create\s*\(/u
    },
    {
        capability: "realtime",
        manifest: /["'](?:socket\.io|socket\.io-client|ws|@supabase\/realtime-js|pusher|ably)["']\s*:/iu,
        content: /\bnew\s+WebSocketServer\s*\(|\bio\.on\s*\(\s*["'`]connection|\bnew\s+EventSource\s*\(/u
    },
    {
        capability: "notifications",
        manifest: /["'](?:resend|@sendgrid\/mail|nodemailer|twilio|web-push|postmark)["']\s*:/iu,
        content: /\bsendMail\s*\(|\bmessages\.create\s*\(|\bwebpush\.sendNotification\s*\(/u
    },
    {
        capability: "analytics",
        manifest: /["'](?:posthog-js|posthog-node|@segment\/[\w-]+|mixpanel|amplitude-js)["']\s*:/iu,
        content: /\banalytics\.track\s*\(|\bposthog\.capture\s*\(/u
    },
    {
        capability: "observability",
        manifest: /["'](?:@opentelemetry\/[\w-]+|@sentry\/[\w-]+|dd-trace|newrelic|prom-client)["']\s*:/iu,
        content: /\bSentry\.init\s*\(|\btrace\.getTracer\s*\(|\bnew\s+Registry\s*\(/u
    },
    {
        capability: "offline",
        manifest: /["'](?:workbox-\w+|idb|dexie|localforage)["']\s*:/iu,
        content: /\bnavigator\.serviceWorker\.register\s*\(|\bindexedDB\.open\s*\(/u
    },
    {
        capability: "internationalization",
        manifest: /["'](?:i18next|react-i18next|next-intl|vue-i18n|@formatjs\/[\w-]+)["']\s*:/iu,
        content: /\bformatMessage\s*\(|\bnew\s+Intl\.(?:NumberFormat|DateTimeFormat)\s*\(/u
    }
]);
/**
 * Reports whether a match sits inside a comment, passive string/template literal, or JavaScript
 * regular-expression literal. Manifests are exempt because JSON dependency names are legitimate
 * strings. Configuration strings are active values, but comments in configuration remain weak.
 *
 * This intentionally scans from the start of the bounded file rather than reasoning from a whole
 * line. That preserves real calls after inline comments, closed multiline examples, and detector
 * regex declarations without requiring a language-specific parser for every supported runtime.
 */
export function isWeakContext(content, index, evidenceClass) {
    if (evidenceClass === "manifest")
        return false;
    const context = lexicalContextAt(content, index);
    return evidenceClass === "configuration" ? context === "comment" : context !== "code";
}
function lexicalContextAt(content, index) {
    let context = "code";
    let delimiter = "";
    let escaped = false;
    let regexCharacterClass = false;
    for (let position = 0; position < index && position < content.length; position += 1) {
        const character = content[position] ?? "";
        const next = content[position + 1] ?? "";
        if (context === "comment") {
            if (delimiter === "\n" && character === "\n") {
                context = "code";
                delimiter = "";
            }
            else if (delimiter === "*/" && character === "*" && next === "/") {
                context = "code";
                delimiter = "";
                position += 1;
            }
            else if (delimiter === "-->" && content.startsWith("-->", position)) {
                context = "code";
                delimiter = "";
                position += 2;
            }
            continue;
        }
        if (context === "string" || context === "template") {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (character === "\\") {
                escaped = true;
                continue;
            }
            if (delimiter.length === 3 && content.startsWith(delimiter, position)) {
                context = "code";
                position += 2;
            }
            else if (delimiter.length === 1 && character === delimiter) {
                context = "code";
            }
            continue;
        }
        if (context === "regex") {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (character === "\\") {
                escaped = true;
                continue;
            }
            if (character === "[")
                regexCharacterClass = true;
            else if (character === "]")
                regexCharacterClass = false;
            else if (character === "/" && !regexCharacterClass)
                context = "code";
            continue;
        }
        if (character === "/" && next === "/") {
            context = "comment";
            delimiter = "\n";
            position += 1;
            continue;
        }
        if (character === "/" && next === "*") {
            context = "comment";
            delimiter = "*/";
            position += 1;
            continue;
        }
        if (content.startsWith("<!--", position)) {
            context = "comment";
            delimiter = "-->";
            position += 3;
            continue;
        }
        const previous = content[position - 1];
        if ((character === "#" || (character === "-" && next === "-")) &&
            (previous === undefined || previous === "\n" || /\s/u.test(previous))) {
            context = "comment";
            delimiter = "\n";
            if (character === "-")
                position += 1;
            continue;
        }
        if (character === '"' || character === "'") {
            const triple = content.startsWith(character.repeat(3), position);
            context = "string";
            delimiter = triple ? character.repeat(3) : character;
            if (triple)
                position += 2;
            continue;
        }
        if (character === "`") {
            context = "template";
            delimiter = "`";
            continue;
        }
        if (character === "/" && isRegexLiteralStart(content, position)) {
            context = "regex";
            regexCharacterClass = false;
        }
    }
    return context;
}
function isRegexLiteralStart(content, opening) {
    const lineStart = content.lastIndexOf("\n", opening - 1) + 1;
    const prefix = content.slice(lineStart, opening).trimEnd();
    if (prefix.length > 0 &&
        !/[=(:,!&|?{[;>]$/u.test(prefix) &&
        !/(?:^|\s)(?:return|case|throw|yield)\s*$/u.test(prefix))
        return false;
    let characterClass = false;
    for (let closing = opening + 1; closing < content.length; closing += 1) {
        const character = content[closing];
        if (character === "\n" || character === "\r")
            return false;
        if (character === "\\")
            closing += 1;
        else if (character === "[")
            characterClass = true;
        else if (character === "]")
            characterClass = false;
        else if (character === "/" && !characterClass)
            return true;
    }
    return false;
}
function lineForIndex(content, index) {
    return content.slice(0, index).split("\n").length;
}
function weakerConfidence(confidence) {
    return confidence === "HIGH" ? "MEDIUM" : "LOW";
}
/**
 * Builds a single classified evidence record. Exported so callers can classify signals that
 * were produced by other analyzers without duplicating the weighting policy.
 */
export function buildEvidence(options) {
    const path = toPosix(options.path).replace(/^\.\//u, "");
    const { evidence_class, reason } = classifyEvidencePath(path);
    const base = options.activationWeight ?? activationWeightFor(evidence_class);
    const weak = options.weak === true;
    const weight = weak ? round(base * WEAK_CONTEXT_MULTIPLIER) : base;
    const confidence = weak
        ? weakerConfidence(CLASS_CONFIDENCE[evidence_class])
        : CLASS_CONFIDENCE[evidence_class];
    const suffix = weak
        ? "; match sits in a comment, passive string or template literal, or regular-expression literal"
        : "";
    return {
        evidence_class,
        path,
        ...(options.line === undefined ? {} : { line: options.line }),
        confidence,
        activation_weight: weight,
        reason: `${reason}${options.detail === undefined ? "" : `; ${options.detail}`}${suffix}`,
        workspace: workspaceForPath(path, options.workspaceRoots ?? [])
    };
}
/**
 * Turns classified evidence into a per-workspace capability decision.
 *
 * `capabilities` names every capability that must receive an assessment, so a capability with
 * no evidence at all is reported as `ABSENT` rather than silently omitted.
 */
export function assessCapabilities(tagged, capabilities, workspaces = ["."]) {
    const workspaceList = [...new Set([".", ...workspaces])].sort();
    const assessments = [];
    for (const capability of [...new Set(capabilities)].sort())
        for (const workspace of workspaceList) {
            const scoped = tagged
                .filter((item) => item.capability === capability && item.evidence.workspace === workspace)
                .map((item) => item.evidence)
                .sort((a, b) => a.path.localeCompare(b.path) ||
                (a.line ?? 0) - (b.line ?? 0) ||
                a.evidence_class.localeCompare(b.evidence_class));
            assessments.push(decide(capability, capabilityKindFor(capability), workspace, scoped));
        }
    return assessments;
}
/** Applies the activation policy to one capability in one workspace. */
export function decideCapability(capability, workspace, evidence, kind = capabilityKindFor(capability)) {
    return decide(capability, kind, workspace, evidence);
}
function decide(capability, kind, workspace, evidence) {
    const score = round(evidence.reduce((total, item) => total + item.activation_weight, 0));
    const classes = [...new Set(evidence.map((item) => item.evidence_class))].sort();
    const reasons = [];
    let status;
    if (evidence.length === 0) {
        status = kind === "control" ? "UNKNOWN" : "ABSENT";
        reasons.push(kind === "control"
            ? "No matching control was observed in the bounded scanned source; control presence remains unknown."
            : "No matching risk surface was observed in the bounded scanned source for this workspace.");
    }
    else if (score >= ACTIVATION_THRESHOLD) {
        status = "PRESENT";
        reasons.push(`Activating evidence reached ${score} (threshold ${ACTIVATION_THRESHOLD}) from ${classes.join(", ")}.`);
    }
    else if (score === 0) {
        status = "UNKNOWN";
        reasons.push(`Only non-activating evidence was observed (${classes.join(", ")}); this never proves a production capability.`);
    }
    else {
        status = "UNKNOWN";
        reasons.push(`Weak evidence totalling ${score} stayed below the activation threshold ${ACTIVATION_THRESHOLD}.`);
    }
    for (const neutralized of ["documentation", "test", "fixture", "generated"])
        if (classes.includes(neutralized))
            reasons.push(`${neutralized} evidence carries zero activation weight by policy.`);
    if (classes.includes("example"))
        reasons.push("Example applications are separated from active applications.");
    if (classes.includes("manifest"))
        reasons.push("Dependency declarations identify available packages, not active runtime use.");
    return { capability, kind, workspace, status, score, evidence: [...evidence], reasons };
}
function round(value) {
    return Math.round(value * 1000) / 1000;
}
/**
 * Scans a repository and returns one assessment per capability per workspace.
 *
 * Unlike the legacy detection walk, this scan deliberately descends into fixtures, examples,
 * generated output, and documentation so that those signals can be observed *and* neutralized
 * instead of being invisible.
 */
export async function assessProjectCapabilities(rootInput, workspaceRoots = [], sharedInventory) {
    const root = await canonicalDirectory(rootInput);
    const inventory = sharedInventory ??
        (await inventoryRepository(root, {
            maxFileBytes: 768 * 1024,
            maxEntries: 15_000,
            maxDepth: 64,
            includeNeutralEvidence: true,
            applyDefaultExclusions: true
        }));
    const inspectedEntries = inventory.entries.filter((entry) => entry.status === "INSPECTED" && entry.content !== undefined);
    const files = inspectedEntries.map((entry) => entry.absolute_path);
    const contentByFile = new Map(inspectedEntries.map((entry) => [entry.absolute_path, entry.content]));
    const scope = capabilityWorkspaceScope(root, files, contentByFile, workspaceRoots);
    const scopedFiles = files.filter((file) => scope.includes(toPosix(relative(root, file))));
    const evidence = await collectEvidence(root, scopedFiles, scope.roots, contentByFile);
    return assessCapabilities(evidence, CAPABILITY_RULES.map((rule) => rule.capability), scope.roots);
}
function capabilityWorkspaceScope(root, files, contentByFile, explicitRoots) {
    const relativeContent = new Map(files.map((file) => [toPosix(relative(root, file)), contentByFile.get(file) ?? ""]));
    const packageRoots = [...relativeContent.keys()]
        .filter((path) => basename(path).toLowerCase() === "package.json" &&
        classifyEvidencePath(path).evidence_class === "manifest")
        .map((path) => path.split("/").slice(0, -1).join("/") || ".");
    const nestedRoots = packageRoots
        .filter((directory) => directory !== ".")
        .sort((left, right) => right.length - left.length || left.localeCompare(right));
    const active = new Set(explicitRoots
        .map((directory) => toPosix(directory).replace(/^\.\//u, "").replace(/\/+$/u, ""))
        .filter((directory) => directory.length > 0 && directory !== "."));
    if (!packageRoots.includes("."))
        for (const directory of nestedRoots)
            active.add(directory);
    else {
        const patterns = declaredWorkspacePatterns(relativeContent);
        for (const directory of nestedRoots) {
            let included = active.has(directory);
            for (const pattern of patterns)
                if (matchesWorkspaceDeclaration(directory, pattern.pattern))
                    included = pattern.include;
            if (included)
                active.add(directory);
            else
                active.delete(directory);
        }
    }
    return {
        roots: [...active].sort(),
        includes: (path) => {
            const normalized = toPosix(path).replace(/^\.\//u, "");
            const nearest = nestedRoots.find((directory) => normalized === directory || normalized.startsWith(`${directory}/`));
            return nearest === undefined || active.has(nearest);
        }
    };
}
function declaredWorkspacePatterns(contentByPath) {
    const patterns = [];
    const add = (value) => {
        const normalized = value.trim();
        const include = !normalized.startsWith("!");
        const pattern = include ? normalized : normalized.slice(1);
        if (pattern.length > 0)
            patterns.push({ pattern, include });
    };
    const rootManifest = contentByPath.get("package.json");
    if (rootManifest !== undefined)
        try {
            const parsed = JSON.parse(rootManifest);
            if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                const workspaces = parsed.workspaces;
                const values = Array.isArray(workspaces)
                    ? workspaces
                    : typeof workspaces === "object" &&
                        workspaces !== null &&
                        !Array.isArray(workspaces) &&
                        Array.isArray(workspaces.packages)
                        ? workspaces.packages
                        : [];
                for (const value of values)
                    if (typeof value === "string")
                        add(value);
            }
        }
        catch {
            // Invalid manifests cannot declare an active nested workspace.
        }
    const pnpm = contentByPath.get("pnpm-workspace.yaml");
    if (pnpm !== undefined)
        for (const match of pnpm.matchAll(/^\s*-\s*["']?([^"'\n#]+?)["']?\s*$/gmu))
            add(match[1] ?? "");
    for (const [path, key] of [
        ["lerna.json", "packages"],
        ["nx.json", "projects"],
        ["turbo.json", "workspaces"]
    ]) {
        const content = contentByPath.get(path);
        if (content === undefined)
            continue;
        try {
            const parsed = JSON.parse(content);
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
                continue;
            const values = parsed[key];
            if (Array.isArray(values)) {
                for (const value of values)
                    if (typeof value === "string")
                        add(value);
            }
            else if (typeof values === "object" && values !== null)
                for (const value of Object.keys(values))
                    add(value);
        }
        catch {
            // Malformed workspace configuration contributes no activation authority.
        }
    }
    return patterns;
}
function matchesWorkspaceDeclaration(directory, pattern) {
    const normalized = pattern.replace(/^\.\//u, "").replace(/\/+$/u, "");
    if (normalized.length === 0)
        return false;
    const expression = normalized
        .split("/")
        .map((segment) => segment === "**"
        ? "[^\\0]*"
        : segment.replace(/[.+^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, "[^/]*"))
        .join("/");
    return new RegExp(`^${expression}$`, "u").test(directory);
}
/** Collects classified, capability-tagged evidence for a file list. Deterministic by path. */
export async function collectEvidence(root, files, workspaceRoots, contentByFile) {
    const evidence = [];
    for (const file of [...files].sort()) {
        const path = toPosix(relative(root, file));
        const { evidence_class } = classifyEvidencePath(path);
        const content = contentByFile?.get(file) ?? (await readTextIfPresent(file));
        if (content === undefined)
            continue;
        for (const rule of CAPABILITY_RULES) {
            if (rule.fileNames !== undefined)
                rule.fileNames.lastIndex = 0;
            if (rule.fileNames?.test(basename(path))) {
                const activeFileShape = ["configuration", "implementation", "route", "schema"].includes(evidence_class);
                evidence.push({
                    capability: rule.capability,
                    evidence: buildEvidence({
                        path,
                        workspaceRoots,
                        line: 1,
                        detail: `capability '${rule.capability}' from a concrete file shape`,
                        ...(activeFileShape ? { activationWeight: ACTIVATION_THRESHOLD } : {})
                    })
                });
            }
            const pattern = evidence_class === "manifest" ? rule.manifest : rule.content;
            if (pattern === undefined)
                continue;
            if (evidence_class !== "manifest" &&
                !NEUTRAL_CONTENT_CLASSES.has(evidence_class) &&
                !(rule.contentClasses ?? DEFAULT_CONTENT_CLASSES).includes(evidence_class))
                continue;
            const global = new RegExp(pattern.source, `${pattern.flags.replace(/g/gu, "")}g`);
            let seenWeak = false;
            let seenStrong = false;
            for (const match of content.matchAll(global)) {
                const weak = isWeakContext(content, match.index, evidence_class);
                if (weak ? seenWeak : seenStrong)
                    continue;
                if (weak)
                    seenWeak = true;
                else
                    seenStrong = true;
                evidence.push({
                    capability: rule.capability,
                    evidence: buildEvidence({
                        path,
                        workspaceRoots,
                        line: lineForIndex(content, match.index),
                        weak,
                        detail: `capability '${rule.capability}'`
                    })
                });
            }
        }
    }
    return evidence.sort((a, b) => a.capability.localeCompare(b.capability) ||
        a.evidence.path.localeCompare(b.evidence.path) ||
        (a.evidence.line ?? 0) - (b.evidence.line ?? 0));
}
const FINANCIAL_BEHAVIOR_PATTERN = /\bstripe\.(?:checkout|paymentIntents|subscriptions|refunds|charges|invoices|webhooks\.constructEvent)\b|\b(?:createPayment|capturePayment|confirmPayment|refundPayment|voidPayment|createInvoice|createSubscription)\s*\(/iu;
const RISK_RULES = [
    {
        risk: "request-boundary",
        pattern: /\b(?:app|router)\.(?:get|post|put|patch|delete)\s*\(|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\//iu,
        modules: ["api", "security"],
        confidence: "HIGH",
        reason: "recognizable request-handling route"
    },
    {
        risk: "destructive-or-administrative-route",
        pattern: /\b(?:app|router)\.(?:delete|put|patch)\s*\(|["'`]\/(?:admin|internal|manage|ops|sudo)(?:\/|["'`])/iu,
        modules: ["authorization", "security", "observability"],
        confidence: "HIGH",
        reason: "destructive HTTP method or administrative route segment"
    },
    {
        risk: "identity-or-session-boundary",
        pattern: /\b(?:getServerSession|createSession|destroySession|refreshSession|verifySession|verifyPassword|hashPassword)\s*\(|\bpassport\.authenticate\s*\(|\b(?:req|request)\.(?:session|user)\b|\b(?:session|auth)\.user\b|\bjwt\.verify\s*\(/u,
        modules: ["auth", "security"],
        confidence: "HIGH",
        reason: "recognizable identity verification or session boundary"
    },
    {
        risk: "object-access",
        pattern: /:\w*[Ii]d\b[\s\S]{0,800}\.(?:findUnique|findFirst|findById|update|delete)\s*\(/u,
        modules: ["authorization", "security"],
        confidence: "MEDIUM",
        reason: "dynamic route identifier near a data access or mutation sink"
    },
    {
        risk: "personal-or-medical-data",
        pattern: /\b(?:email|phone|address|dateOfBirth|diagnosis|prescription|medicalRecord|nationalId)\b/iu,
        modules: ["privacy", "security"],
        confidence: "MEDIUM",
        reason: "personal or medical data field in application source or schema"
    },
    {
        risk: "upload-ingress",
        pattern: /\bmultipart\/form-data\b|\bupload\.(?:any|array|fields|single)\s*\(|\bcreatePresignedPost\b|<input[^>]+type=["']file["']/iu,
        modules: ["uploads", "storage", "authorization", "privacy", "security"],
        confidence: "HIGH",
        reason: "recognizable upload or presigned-ingress boundary"
    },
    {
        risk: "webhook-or-callback",
        pattern: /\b(?:app|router)\.(?:post|put)\s*\(\s*["'`][^"'`]*(?:webhooks?|callbacks?)[^"'`]*["'`]|\b(?:stripe\.)?webhooks?\.constructEvent\s*\(|\bverifyWebhookSignature\s*\(|\b(?:headers?\.get\s*\(\s*|req\.headers\s*\[\s*)["'](?:stripe-signature|x-signature|x-hub-signature(?:-256)?)["']/iu,
        modules: ["integrations", "security"],
        confidence: "HIGH",
        reason: "webhook, callback, or provider-signature boundary"
    },
    {
        risk: "financial-behaviour",
        pattern: FINANCIAL_BEHAVIOR_PATTERN,
        modules: ["payments", "security", "observability"],
        confidence: "MEDIUM",
        reason: "recognizable provider payment, refund, invoice, or subscription operation"
    },
    {
        risk: "background-execution",
        pattern: /\bnew\s+(?:Queue|Worker)\s*\(|\bcron\.schedule\s*\(|\bdefineJob\s*\(|\b(?:queue|worker)\.(?:add|process|consume)\s*\(|\bscheduleJob\s*\(|@(?:shared_task|app\.task)\b/iu,
        modules: ["jobs", "reliability"],
        confidence: "HIGH",
        reason: "queue, worker, cron, or scheduled execution boundary"
    },
    {
        risk: "realtime-channel",
        pattern: /\b(?:WebSocketServer|EventSource|socket\.io|io\.on\s*\([^)]*connection|text\/event-stream)\b/iu,
        modules: ["realtime", "authorization"],
        confidence: "HIGH",
        reason: "WebSocket, SSE, subscription, or channel boundary"
    },
    {
        risk: "ai-boundary",
        pattern: /\b(?:openai|anthropic)\.(?:chat|messages|completions|responses)|\bchat\.completions\.create\s*\(|\btool[_ -]?call\b/iu,
        modules: ["ai", "security", "cost"],
        confidence: "HIGH",
        reason: "model inference, prompt construction, or tool-execution boundary"
    }
];
/** Derives bounded risk-surface evidence from inventory plus already-modeled framework routes. */
export function discoverRiskEvidence(inventory, structuredRoutes = []) {
    const evidence = [];
    for (const entry of inventory.entries) {
        if (entry.status !== "INSPECTED" || entry.content === undefined)
            continue;
        const { evidence_class } = classifyEvidencePath(entry.path);
        if (!["implementation", "route", "schema"].includes(evidence_class))
            continue;
        for (const rule of RISK_RULES) {
            const match = firstActiveMatch(rule.pattern, entry.content, evidence_class);
            if (match === undefined)
                continue;
            const modules = [...rule.modules];
            const hasTenant = hasActiveMatch(/\b(?:tenant|clinic|cabinet|practice|hospital|account|merchant|school|workspace|org|organization|company|site|store|project)(?:Id|_id)\b/iu, entry.content, evidence_class);
            const hasSensitive = hasActiveMatch(/\b(?:email|phone|address|dateOfBirth|diagnosis|prescription|medicalRecord|nationalId)\b/iu, entry.content, evidence_class);
            if (hasTenant &&
                [
                    "object-access",
                    "background-execution",
                    "realtime-channel",
                    "personal-or-medical-data"
                ].includes(rule.risk))
                modules.push("tenancy");
            if (hasSensitive && rule.risk === "ai-boundary")
                modules.push("privacy");
            if (rule.risk === "webhook-or-callback" &&
                hasActiveMatch(FINANCIAL_BEHAVIOR_PATTERN, entry.content, evidence_class))
                modules.push("payments");
            evidence.push({
                risk: rule.risk,
                modules: [...new Set(modules)].sort(),
                path: entry.path,
                line: lineForIndex(entry.content, match.index),
                confidence: rule.confidence,
                reason: rule.reason
            });
        }
    }
    evidence.push(...structuredRouteRiskEvidence(structuredRoutes));
    const deduplicated = new Map();
    for (const item of evidence) {
        const key = `${item.risk}\u0000${item.path}\u0000${item.line ?? 0}`;
        const existing = deduplicated.get(key);
        if (existing === undefined)
            deduplicated.set(key, item);
        else
            existing.modules = [...new Set([...existing.modules, ...item.modules])].sort();
    }
    return [...deduplicated.values()].sort((left, right) => left.path.localeCompare(right.path) ||
        (left.line ?? 0) - (right.line ?? 0) ||
        left.risk.localeCompare(right.risk));
}
function structuredRouteRiskEvidence(routes) {
    const evidence = [];
    for (const route of routes) {
        if (route.location === undefined)
            continue;
        const separator = route.name.indexOf(" ");
        const method = (separator === -1 ? route.name : route.name.slice(0, separator)).toUpperCase();
        const routePath = separator === -1 ? "" : route.name.slice(separator + 1);
        const lineMatch = route.evidence
            .map((item) => /:(\d+)$/u.exec(item))
            .find((match) => match !== null);
        const line = lineMatch === undefined ? undefined : Number(lineMatch[1] ?? Number.NaN);
        evidence.push({
            risk: "request-boundary",
            modules: ["api", "security"],
            path: route.location,
            ...(line === undefined || !Number.isSafeInteger(line) ? {} : { line }),
            confidence: route.confidence,
            reason: "structured route adapter modeled a request-handling boundary"
        });
        if (["DELETE", "PATCH", "PUT"].includes(method) ||
            /\/(?:admin|internal|manage|ops|sudo)(?:\/|$)/iu.test(routePath))
            evidence.push({
                risk: "destructive-or-administrative-route",
                modules: ["authorization", "observability", "security"],
                path: route.location,
                ...(line === undefined || !Number.isSafeInteger(line) ? {} : { line }),
                confidence: route.confidence,
                reason: "structured route adapter modeled a destructive method or administrative path"
            });
    }
    return evidence;
}
function firstActiveMatch(pattern, content, evidenceClass) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace(/g/gu, "")}g`);
    for (const match of content.matchAll(global))
        if (!isWeakContext(content, match.index, evidenceClass))
            return match;
    return undefined;
}
function hasActiveMatch(pattern, content, evidenceClass) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace(/g/gu, "")}g`);
    for (const match of content.matchAll(global))
        if (!isWeakContext(content, match.index, evidenceClass))
            return true;
    return false;
}
