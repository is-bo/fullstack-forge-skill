import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { canonicalDirectory, readTextIfPresent, toPosix, utcNow, walkFiles } from "./utils.js";
const EXCLUDED = new Set([
    ".git",
    ".forge",
    ".fullstack-forge",
    ".next",
    ".nuxt",
    ".output",
    ".tmp",
    "build",
    "coverage",
    "dist",
    "fixtures",
    "node_modules",
    "target",
    "vendor"
]);
const RULES = [
    {
        category: "language",
        name: "TypeScript",
        confidence: "HIGH",
        fileNames: /\.(?:ts|tsx|mts|cts)$/u
    },
    {
        category: "language",
        name: "JavaScript",
        confidence: "HIGH",
        fileNames: /\.(?:js|jsx|mjs|cjs)$/u
    },
    { category: "language", name: "Python", confidence: "HIGH", fileNames: /\.py$/u },
    { category: "language", name: "Go", confidence: "HIGH", fileNames: /\.go$/u },
    { category: "language", name: "Rust", confidence: "HIGH", fileNames: /\.rs$/u },
    {
        category: "language",
        name: "Java/Kotlin",
        confidence: "HIGH",
        fileNames: /\.(?:java|kt|kts)$/u
    },
    {
        category: "framework",
        name: "Next.js",
        confidence: "HIGH",
        content: /["']next["']\s*:/u,
        capability: "frontend"
    },
    {
        category: "framework",
        name: "React",
        confidence: "HIGH",
        content: /["']react["']\s*:/u,
        capability: "frontend"
    },
    {
        category: "framework",
        name: "Vue",
        confidence: "HIGH",
        content: /["']vue["']\s*:/u,
        capability: "frontend"
    },
    {
        category: "framework",
        name: "Svelte",
        confidence: "HIGH",
        content: /["']svelte["']\s*:/u,
        capability: "frontend"
    },
    {
        category: "framework",
        name: "Express",
        confidence: "HIGH",
        content: /["']express["']\s*:/u,
        capability: "api"
    },
    {
        category: "framework",
        name: "FastAPI",
        confidence: "HIGH",
        content: /(?:from|import)\s+fastapi/u,
        capability: "api"
    },
    {
        category: "database",
        name: "PostgreSQL",
        confidence: "MEDIUM",
        content: /postgres(?:ql)?|@prisma\/client/iu,
        capability: "database"
    },
    {
        category: "database",
        name: "MySQL",
        confidence: "MEDIUM",
        content: /mysql|mariadb/iu,
        capability: "database"
    },
    {
        category: "database",
        name: "SQLite",
        confidence: "MEDIUM",
        content: /sqlite/iu,
        capability: "database"
    },
    {
        category: "cache",
        name: "Redis",
        confidence: "HIGH",
        content: /["'](?:ioredis|redis)["']\s*:|redis:\/\//iu,
        capability: "cache"
    },
    {
        category: "queue",
        name: "Background jobs",
        confidence: "MEDIUM",
        content: /bullmq|celery|sidekiq|agenda|inngest|temporal|queue/iu,
        capability: "jobs"
    },
    {
        category: "auth",
        name: "Authentication",
        confidence: "MEDIUM",
        content: /next-auth|auth0|clerk|passport|lucia|session|oauth|openid/iu,
        capability: "authentication"
    },
    {
        category: "authorization",
        name: "Authorization policy",
        confidence: "MEDIUM",
        content: /authorize|permission|policy|roles?\b/iu,
        capability: "authorization"
    },
    {
        category: "upload",
        name: "File upload",
        confidence: "MEDIUM",
        content: /multipart|multer|formidable|upload|presigned/iu,
        capability: "uploads"
    },
    {
        category: "storage",
        name: "Object storage",
        confidence: "MEDIUM",
        content: /@aws-sdk\/client-s3|cloudinary|blob|bucket|object storage/iu,
        capability: "storage"
    },
    {
        category: "observability",
        name: "Observability",
        confidence: "MEDIUM",
        content: /opentelemetry|sentry|datadog|newrelic|prometheus/iu,
        capability: "observability"
    },
    {
        category: "integration",
        name: "External integrations",
        confidence: "MEDIUM",
        content: /webhook|axios|got\b|undici|fetch\s*\(/iu,
        capability: "integrations"
    },
    {
        category: "ai",
        name: "AI provider",
        confidence: "HIGH",
        content: /["'](?:openai|@anthropic-ai\/sdk|@google\/generative-ai)["']\s*:|langchain/iu,
        capability: "ai"
    },
    {
        category: "payment",
        name: "Payment provider",
        confidence: "HIGH",
        content: /["'](?:stripe|@paypal\/paypal-server-sdk|braintree)["']\s*:/iu,
        capability: "payments"
    },
    {
        category: "analytics",
        name: "Product analytics",
        confidence: "MEDIUM",
        content: /posthog|segment|mixpanel|analytics\.track/iu,
        capability: "analytics"
    },
    {
        category: "notification",
        name: "Notifications",
        confidence: "MEDIUM",
        content: /resend|sendgrid|twilio|nodemailer|web-push/iu,
        capability: "notifications"
    },
    {
        category: "realtime",
        name: "Realtime transport",
        confidence: "HIGH",
        content: /socket\.io|websocket|eventsource|server-sent/iu,
        capability: "realtime"
    },
    {
        category: "offline",
        name: "Offline support",
        confidence: "MEDIUM",
        content: /service-worker|serviceWorker|workbox|indexedDB/iu,
        capability: "offline"
    },
    {
        category: "i18n",
        name: "Internationalization",
        confidence: "MEDIUM",
        content: /i18next|next-intl|formatMessage|Intl\./u,
        capability: "internationalization"
    },
    {
        category: "privacy",
        name: "Personal data",
        confidence: "LOW",
        content: /\b(?:email|phone|address|date_of_birth|personal_data)\b/iu,
        capability: "personal-data"
    },
    {
        category: "tenancy",
        name: "Tenant boundary",
        confidence: "MEDIUM",
        content: /tenant(?:_id|Id)?|organization(?:_id|Id)/u,
        capability: "tenancy"
    },
    {
        category: "deployment",
        name: "Deployment configuration",
        confidence: "HIGH",
        fileNames: /^(?:Dockerfile|compose\.ya?ml|vercel\.json|netlify\.toml|fly\.toml|render\.yaml|Procfile)$/iu,
        capability: "deployment"
    },
    {
        category: "infrastructure",
        name: "Infrastructure as code",
        confidence: "HIGH",
        fileNames: /\.(?:tf|tfvars)$|^(?:Pulumi\.ya?ml|serverless\.ya?ml)$/iu,
        capability: "infrastructure"
    }
];
export async function discoverProject(rootInput) {
    const root = await canonicalDirectory(rootInput);
    const files = await walkFiles(root, { exclude: EXCLUDED, maxBytes: 768 * 1024 });
    const evidenceByRule = new Map();
    for (const file of files) {
        const rel = toPosix(relative(root, file));
        const name = basename(file);
        const candidateRules = RULES.filter((rule) => rule.fileNames?.test(name));
        for (const rule of candidateRules)
            addEvidence(evidenceByRule, rule, rel);
        const text = await readTextIfPresent(file);
        if (text === undefined)
            continue;
        for (const rule of RULES) {
            if (rule.content?.test(text))
                addEvidence(evidenceByRule, rule, rel);
        }
    }
    const detections = [];
    const capabilities = {};
    for (const rule of RULES) {
        const evidence = evidenceByRule.get(rule);
        if (evidence === undefined || evidence.length === 0)
            continue;
        const detection = {
            name: rule.name,
            confidence: rule.confidence,
            evidence: evidence.slice(0, 12)
        };
        detections.push(detection);
        if (rule.capability !== undefined) {
            const current = capabilities[rule.capability];
            if (current === undefined)
                capabilities[rule.capability] = detection;
            else
                current.evidence = [...new Set([...current.evidence, ...detection.evidence])].slice(0, 12);
        }
    }
    if (files.some((file) => /\.(?:ts|tsx|js|jsx|py|go|rs|java|kt)$/u.test(file))) {
        capabilities.runtime = {
            name: "Executable runtime",
            confidence: "HIGH",
            evidence: ["Executable source files detected"]
        };
    }
    if (capabilities.frontend !== undefined) {
        capabilities["public-web"] = {
            name: "Potential public web routes",
            confidence: "LOW",
            evidence: capabilities.frontend.evidence
        };
    }
    if (capabilities.ai !== undefined ||
        capabilities.payments !== undefined ||
        capabilities.integrations !== undefined ||
        capabilities.deployment !== undefined) {
        capabilities["paid-services"] = {
            name: "Potential paid external services",
            confidence: "LOW",
            evidence: ["One or more external runtime providers were detected"]
        };
    }
    return {
        schema_version: 1,
        root,
        generated_at: utcNow(),
        detections: deduplicateDetections(detections),
        capabilities
    };
}
export async function writeProjectArtifacts(profile, dryRun = false) {
    const forgeRoot = join(profile.root, ".forge");
    const profilePath = join(forgeRoot, "project-profile.json");
    const mapPath = join(forgeRoot, "architecture-map.md");
    if (!dryRun) {
        await mkdir(forgeRoot, { recursive: true });
        await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
        await writeFile(mapPath, renderArchitectureMap(profile), "utf8");
    }
    return [profilePath, mapPath];
}
export async function detectProjectCommands(rootInput) {
    const root = await canonicalDirectory(rootInput);
    const packagePath = join(root, "package.json");
    const packageText = await readTextIfPresent(packagePath);
    if (packageText === undefined)
        return [];
    let manifest;
    try {
        manifest = JSON.parse(packageText);
    }
    catch {
        return [];
    }
    const scripts = manifest.scripts ?? {};
    const packageManager = await choosePackageManager(root, manifest.packageManager);
    return Object.entries(scripts)
        .filter((entry) => typeof entry[1] === "string")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, definition]) => ({
        name,
        executable: packageManager.executable,
        args: [...packageManager.runArgs, name],
        source: toPosix(relative(root, packagePath)),
        definition
    }));
}
async function choosePackageManager(root, declared) {
    const declaredName = declared?.split("@")[0];
    if (declaredName === "pnpm")
        return packageManagerCommand("pnpm", ["run"]);
    if (declaredName === "yarn")
        return packageManagerCommand("yarn", []);
    if (declaredName === "bun")
        return packageManagerCommand("bun", ["run"]);
    for (const [lock, result] of [
        ["pnpm-lock.yaml", { executable: "pnpm", runArgs: ["run"] }],
        ["yarn.lock", { executable: "yarn", runArgs: [] }],
        ["bun.lock", { executable: "bun", runArgs: ["run"] }],
        ["bun.lockb", { executable: "bun", runArgs: ["run"] }]
    ]) {
        try {
            await readFile(join(root, lock));
            return packageManagerCommand(result.executable, [...result.runArgs]);
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
    }
    return packageManagerCommand("npm", ["run"]);
}
async function packageManagerCommand(name, runArgs) {
    const configured = process.env.npm_execpath;
    const executableDirectory = dirname(process.execPath);
    const entryNames = {
        npm: new Set(["npm-cli.js"]),
        pnpm: new Set(["pnpm.cjs", "pnpm.js"]),
        yarn: new Set(["yarn.cjs", "yarn.js"])
    };
    const allowedEntries = entryNames[name];
    if (allowedEntries === undefined)
        return { executable: name, runArgs };
    const packageCandidates = name === "npm"
        ? [
            join(executableDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
            join(executableDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
        ]
        : [
            join(executableDirectory, "node_modules", "corepack", "dist", `${name}.js`),
            join(executableDirectory, "..", "lib", "node_modules", "corepack", "dist", `${name}.js`)
        ];
    const candidates = [configured, ...packageCandidates].filter((candidate) => typeof candidate === "string");
    for (const candidate of candidates) {
        if (!allowedEntries.has(basename(candidate).toLowerCase()))
            continue;
        try {
            if ((await stat(candidate)).isFile())
                return { executable: process.execPath, runArgs: [candidate, ...runArgs] };
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
    }
    return { executable: process.platform === "win32" ? `${name}.cmd` : name, runArgs };
}
function addEvidence(map, rule, evidence) {
    const current = map.get(rule) ?? [];
    if (!current.includes(evidence))
        current.push(evidence);
    map.set(rule, current);
}
function deduplicateDetections(detections) {
    const byName = new Map();
    for (const detection of detections) {
        const current = byName.get(detection.name);
        if (current === undefined)
            byName.set(detection.name, detection);
        else
            current.evidence = [...new Set([...current.evidence, ...detection.evidence])].slice(0, 12);
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function renderArchitectureMap(profile) {
    const nodes = profile.detections
        .slice(0, 24)
        .map((detection, index) => `  N${index}["${escapeMermaid(detection.name)}"]`)
        .join("\n");
    const edges = profile.detections
        .slice(1, 24)
        .map((_detection, index) => `  N0 -. "detected with" .-> N${index + 1}`)
        .join("\n");
    const evidence = profile.detections
        .map((detection) => `- **${detection.name}** (${detection.confidence}): ${detection.evidence.join(", ")}`)
        .join("\n");
    return `# Architecture map

Generated from static repository evidence at ${profile.generated_at}. Dashed edges mean
co-detection, not a proven runtime call path. Trace critical flows manually before treating an edge
as architectural fact.

\`\`\`mermaid
flowchart LR
${nodes || '  Unknown["No technology detected"]'}
${edges}
\`\`\`

## Evidence

${evidence || "- No supported detections. Inspect the repository manually."}

## Unverified boundaries

Runtime topology, production configuration, user roles, tenant context, and provider-side controls
remain NOT_VERIFIED unless direct evidence is added.
`;
}
function escapeMermaid(value) {
    return value.replaceAll('"', "'");
}
//# sourceMappingURL=discovery.js.map