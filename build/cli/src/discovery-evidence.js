import { basename, relative } from "node:path";
import { canonicalDirectory, readTextIfPresent, toPosix, walkFiles } from "./utils.js";
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
/**
 * Activation weight per evidence class.
 *
 * Zero means "observed, but never sufficient to activate a production capability".
 * A capability activates at `ACTIVATION_THRESHOLD`; anything above zero but below the
 * threshold produces `UNKNOWN` so that a pile of weak signals cannot masquerade as proof.
 */
export const ACTIVATION_WEIGHTS = Object.freeze({
    manifest: 1,
    implementation: 1,
    route: 1,
    schema: 1,
    configuration: 0.5,
    example: 0.15,
    test: 0,
    documentation: 0,
    fixture: 0,
    generated: 0,
    unknown: 0.2
});
/** Score at which a capability is reported as `PRESENT`. */
export const ACTIVATION_THRESHOLD = 1;
/** Multiplier applied when a match sits inside a comment or a passive string literal. */
export const WEAK_CONTEXT_MULTIPLIER = 0.2;
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
    "src/fullstack-forge"
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
    "testdata"
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
const IMPLEMENTATION_EXTENSIONS = /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|kts|rb|php|cs|swift|scala|ex|exs)$/iu;
const DOCUMENTATION_EXTENSIONS = /\.(?:md|mdx|rst|adoc|txt)$/iu;
const CONFIGURATION_EXTENSIONS = /\.(?:ya?ml|toml|ini|json|jsonc|conf|properties|env)$/iu;
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
    if (documentationSegment !== undefined || DOCUMENTATION_EXTENSIONS.test(name))
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
/**
 * Independent capability signatures. These deliberately favour concrete provider names and
 * API shapes over generic vocabulary, because generic vocabulary is exactly what appears in
 * README prose and test fixtures.
 */
export const CAPABILITY_RULES = Object.freeze([
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
        content: /\bredis:\/\/|\bnew\s+Redis\s*\(|\bcache\.(?:get|set)\s*\(/u
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
const COMMENT_LINE = /^\s*(?:\/\/|#|\*|\/\*|<!--|--)/u;
/**
 * Reports whether a match sits inside a comment or a passive string literal. Manifests are
 * exempt because every JSON dependency name is legitimately a string literal.
 */
export function isWeakContext(content, index, evidenceClass) {
    if (evidenceClass === "manifest" || evidenceClass === "configuration")
        return false;
    const lineStart = content.lastIndexOf("\n", index - 1) + 1;
    const lineEndRaw = content.indexOf("\n", index);
    const lineEnd = lineEndRaw === -1 ? content.length : lineEndRaw;
    const line = content.slice(lineStart, lineEnd);
    if (COMMENT_LINE.test(line))
        return true;
    const before = content.slice(lineStart, index);
    for (const quote of ['"', "'", "`"]) {
        let count = 0;
        for (let position = 0; position < before.length; position += 1)
            if (before[position] === quote && before[position - 1] !== "\\")
                count += 1;
        if (count % 2 === 1)
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
    const base = activationWeightFor(evidence_class);
    const weak = options.weak === true;
    const weight = weak ? round(base * WEAK_CONTEXT_MULTIPLIER) : base;
    const confidence = weak
        ? weakerConfidence(CLASS_CONFIDENCE[evidence_class])
        : CLASS_CONFIDENCE[evidence_class];
    const suffix = weak ? "; match sits in a comment or passive string literal" : "";
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
            assessments.push(decide(capability, workspace, scoped));
        }
    return assessments;
}
/** Applies the activation policy to one capability in one workspace. */
export function decideCapability(capability, workspace, evidence) {
    return decide(capability, workspace, evidence);
}
function decide(capability, workspace, evidence) {
    const score = round(evidence.reduce((total, item) => total + item.activation_weight, 0));
    const classes = [...new Set(evidence.map((item) => item.evidence_class))].sort();
    const reasons = [];
    let status;
    if (evidence.length === 0) {
        status = "ABSENT";
        reasons.push("No signal for this capability was observed in this workspace.");
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
    return { capability, workspace, status, score, evidence: [...evidence], reasons };
}
function round(value) {
    return Math.round(value * 1000) / 1000;
}
const SCAN_EXCLUDED = new Set([".git", ".forge", ".fullstack-forge", "coverage", "node_modules"]);
/**
 * Scans a repository and returns one assessment per capability per workspace.
 *
 * Unlike the legacy detection walk, this scan deliberately descends into fixtures, examples,
 * generated output, and documentation so that those signals can be observed *and* neutralized
 * instead of being invisible.
 */
export async function assessProjectCapabilities(rootInput, workspaceRoots = []) {
    const root = await canonicalDirectory(rootInput);
    const files = await walkFiles(root, {
        exclude: SCAN_EXCLUDED,
        maxBytes: 768 * 1024,
        maxFiles: 15_000,
        maxTotalBytes: 128 * 1024 * 1024,
        maxDepth: 64
    });
    const roots = [...new Set([...workspaceRoots, ...inferWorkspaceRoots(root, files)])];
    const evidence = await collectEvidence(root, files, roots);
    return assessCapabilities(evidence, CAPABILITY_RULES.map((rule) => rule.capability), roots);
}
function inferWorkspaceRoots(root, files) {
    const roots = [];
    for (const file of files) {
        if (basename(file) !== "package.json")
            continue;
        const path = toPosix(relative(root, file));
        const { evidence_class } = classifyEvidencePath(path);
        if (evidence_class !== "manifest")
            continue;
        const directory = path.split("/").slice(0, -1).join("/");
        if (directory.length > 0)
            roots.push(directory);
    }
    return roots.sort();
}
/** Collects classified, capability-tagged evidence for a file list. Deterministic by path. */
export async function collectEvidence(root, files, workspaceRoots) {
    const evidence = [];
    for (const file of [...files].sort()) {
        const path = toPosix(relative(root, file));
        const { evidence_class } = classifyEvidencePath(path);
        const content = await readTextIfPresent(file);
        if (content === undefined)
            continue;
        for (const rule of CAPABILITY_RULES) {
            const pattern = evidence_class === "manifest" ? rule.manifest : rule.content;
            if (pattern === undefined)
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
//# sourceMappingURL=discovery-evidence.js.map