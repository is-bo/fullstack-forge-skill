import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { assessProjectCapabilities, buildEvidence, classifyEvidencePath, decideCapability, discoverRiskEvidence, isWeakContext, workspaceForPath } from "./discovery-evidence.js";
import { inventoryRepository } from "./repository-inventory.js";
import { assertNoSymlinkPath, canonicalDirectory, readTextIfPresent, runFile, toPosix, utcNow } from "./utils.js";
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
        category: "language",
        name: "C/C++",
        confidence: "HIGH",
        fileNames: /\.(?:c|cc|cpp|cxx)$/iu
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
        category: "framework",
        name: "Django",
        confidence: "HIGH",
        content: /(?:from|import)\s+django|\bDjango\b|["']django["']\s*:/u,
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
        category: "seo",
        name: "Public web indexing surface",
        confidence: "HIGH",
        fileNames: /^(?:robots\.txt|sitemap\.(?:xml|js|ts)|manifest\.webmanifest)$/iu,
        content: /\b(?:generateMetadata|metadataBase|robots\s*:|sitemap\s*:|schema\.org)\b/u,
        capability: "public-web"
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
export async function discoverProject(rootInput, options = {}) {
    return (await discoverProjectWithInventory(rootInput, options)).profile;
}
export async function discoverProjectWithInventory(rootInput, options = {}) {
    const root = await canonicalDirectory(rootInput);
    const inventory = await inventoryRepository(root, {
        ...options,
        includeNeutralEvidence: true,
        applyDefaultExclusions: true
    });
    const inspectedEntries = inventory.entries.filter((entry) => entry.status === "INSPECTED" && entry.content !== undefined);
    const files = inspectedEntries.map((entry) => entry.absolute_path);
    const candidateActiveFiles = files.filter((file) => {
        const path = toPosix(relative(root, file));
        return ["manifest", "implementation", "configuration", "route", "schema"].includes(classifyEvidencePath(path).evidence_class);
    });
    const contentByFile = new Map(inspectedEntries.map((entry) => [entry.absolute_path, entry.content]));
    const manifestCandidates = loadPackageManifests(root, candidateActiveFiles, contentByFile);
    const declaredWorkspaces = loadDeclaredWorkspaces(root, manifestCandidates, contentByFile);
    const isCapabilityPath = capabilityPathPredicate(manifestCandidates, declaredWorkspaces);
    const activeFiles = candidateActiveFiles.filter((file) => isCapabilityPath(toPosix(relative(root, file))));
    const capabilityInventory = {
        ...inventory,
        entries: inventory.entries.filter((entry) => isCapabilityPath(entry.path))
    };
    const evidenceByRule = new Map();
    for (const file of activeFiles) {
        const rel = toPosix(relative(root, file));
        const name = basename(file);
        const candidateRules = RULES.filter((rule) => rule.fileNames?.test(name));
        for (const rule of candidateRules)
            addEvidence(evidenceByRule, rule, rel);
        const text = contentByFile.get(file);
        if (text === undefined)
            continue;
        for (const rule of RULES) {
            if (rule.content === undefined)
                continue;
            if (hasActiveContentMatch(rule.content, text, classifyEvidencePath(rel).evidence_class))
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
    if (activeFiles.some((file) => /\.(?:ts|tsx|js|jsx|c|cc|cpp|cxx|py|go|rs|java|kt)$/iu.test(file))) {
        capabilities.runtime = {
            name: "Executable runtime",
            confidence: "HIGH",
            evidence: ["Executable source files detected"]
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
    const structured = await buildStructuredProfile(root, activeFiles, capabilities, contentByFile, files, candidateActiveFiles);
    const structuredApiPaths = modeledApiPaths(structured);
    if (structuredApiPaths.length > 0) {
        const modeledApi = {
            name: "Modeled API boundary",
            confidence: "HIGH",
            evidence: structuredApiPaths.slice(0, 12)
        };
        detections.push(modeledApi);
        const current = capabilities.api;
        if (current === undefined)
            capabilities.api = modeledApi;
        else
            current.evidence = [...new Set([...current.evidence, ...modeledApi.evidence])].slice(0, 12);
    }
    // Capability weighting consumes the same bounded inventory as primary discovery. Neutral trees
    // are represented without a second repository walk.
    const workspaceRoots = structured.workspaces
        .filter((workspace) => workspace.type === "package-workspace")
        .map((workspace) => workspace.root ?? ".");
    const capabilityAssessments = reconcileModeledApiAssessment(await assessProjectCapabilities(root, workspaceRoots, capabilityInventory), structured, workspaceRoots);
    const profile = {
        schema_version: 2,
        root,
        generated_at: utcNow(),
        detections: deduplicateDetections(detections),
        capabilities,
        capability_assessments: capabilityAssessments,
        risk_evidence: discoverRiskEvidence(capabilityInventory, structured.routes),
        tenancy: inferTenancyProfile(capabilityInventory),
        inventory: inventory.diagnostics,
        ...structured
    };
    return { profile, inventory };
}
function modeledApiPaths(profile) {
    const paths = new Set();
    for (const route of profile.routes)
        if (route.location !== undefined)
            paths.add(route.location);
    for (const framework of profile.frameworks) {
        if (framework.type !== "backend-framework")
            continue;
        for (const path of framework.evidence) {
            const evidenceClass = classifyEvidencePath(path).evidence_class;
            if (["implementation", "route"].includes(evidenceClass))
                paths.add(path);
        }
    }
    return [...paths].sort();
}
function reconcileModeledApiAssessment(assessments, profile, workspaceRoots) {
    const byWorkspace = new Map();
    const add = (path, line, detail) => {
        const workspace = workspaceForPath(path, workspaceRoots);
        const current = byWorkspace.get(workspace) ?? [];
        current.push(buildEvidence({
            path,
            workspaceRoots,
            ...(line === undefined ? {} : { line }),
            detail
        }));
        byWorkspace.set(workspace, current);
    };
    for (const route of profile.routes) {
        if (route.location === undefined)
            continue;
        const line = route.evidence
            .map((item) => /:(\d+)$/u.exec(item))
            .find((match) => match !== null)?.[1];
        add(route.location, line === undefined ? undefined : Number(line), "API capability from a structured route adapter");
    }
    for (const framework of profile.frameworks) {
        if (framework.type !== "backend-framework")
            continue;
        for (const path of framework.evidence) {
            const evidenceClass = classifyEvidencePath(path).evidence_class;
            if (!["implementation", "route"].includes(evidenceClass))
                continue;
            add(path, 1, `API capability from modeled backend framework '${framework.name}'`);
        }
    }
    return assessments.map((assessment) => {
        if (assessment.capability !== "api")
            return assessment;
        const combined = [...assessment.evidence, ...(byWorkspace.get(assessment.workspace) ?? [])];
        const strongestByPathAndClass = new Map();
        for (const item of combined) {
            const key = `${item.path}\u0000${item.evidence_class}`;
            const current = strongestByPathAndClass.get(key);
            if (current === undefined ||
                item.activation_weight > current.activation_weight ||
                (item.activation_weight === current.activation_weight &&
                    (item.line ?? 0) < (current.line ?? 0)))
                strongestByPathAndClass.set(key, item);
        }
        return decideCapability("api", assessment.workspace, [...strongestByPathAndClass.values()]);
    });
}
const TENANCY_KEY_NAMES = [
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
 * Discovers ownership-key candidates structurally, without consulting any name list.
 *
 * A field shaped `<entity>Id` that appears on two or more declared models, and is not that
 * model's own primary key, is an ownership boundary regardless of what the domain calls it. This
 * is what lets `clinicId`, `cabinetId`, or an unforeseen `franchiseId` activate tenancy on equal
 * footing with `tenantId`.
 */
function structuralOwnershipCandidates(inventory) {
    const byKey = new Map();
    for (const entry of inventory.entries) {
        if (entry.status !== "INSPECTED" || entry.content === undefined)
            continue;
        if (classifyEvidencePath(entry.path).evidence_class !== "schema")
            continue;
        const models = [...entry.content.matchAll(/\bmodel\s+([A-Za-z_$][\w$]*)\s*\{([\s\S]*?)\}/gu)];
        for (const model of models) {
            const modelName = model[1] ?? "unknown";
            const body = model[2] ?? "";
            for (const field of body.matchAll(/^\s*([a-z][\w$]*)(?:Id|_id)\b/gimu)) {
                const prefix = field[1];
                if (prefix === undefined)
                    continue;
                const key = `${prefix}Id`;
                // The model's own identifier is not an ownership boundary.
                if (prefix.toLowerCase() === modelName.toLowerCase())
                    continue;
                if (!byKey.has(key))
                    byKey.set(key, new Set());
                byKey.get(key)?.add(modelName);
            }
        }
    }
    for (const [key, models] of byKey)
        if (models.size < 2)
            byKey.delete(key);
    return byKey;
}
function inferTenancyProfile(inventory) {
    const scores = new Map();
    const structural = structuralOwnershipCandidates(inventory);
    const candidateKeys = [...new Set([...TENANCY_KEY_NAMES, ...structural.keys()])];
    for (const [key, models] of structural) {
        const current = scores.get(key) ?? { score: 0, evidence: [], models: new Set() };
        for (const model of models)
            current.models.add(model);
        current.score += models.size * 2;
        current.evidence.push(`schema: '${key}' is a shared ownership field on ${[...models].sort().join(", ")}`);
        scores.set(key, current);
    }
    for (const entry of inventory.entries) {
        if (entry.status !== "INSPECTED" || entry.content === undefined)
            continue;
        const evidenceClass = classifyEvidencePath(entry.path).evidence_class;
        if (!["implementation", "route", "schema"].includes(evidenceClass))
            continue;
        for (const key of candidateKeys) {
            const snake = key.replace(/Id$/u, "_id");
            const pattern = new RegExp(`\\b(?:${key}|${snake})\\b`, "gu");
            const matches = [...entry.content.matchAll(pattern)].filter((match) => !isWeakContext(entry.content, match.index, evidenceClass));
            if (matches.length === 0)
                continue;
            const current = scores.get(key) ?? { score: 0, evidence: [], models: new Set() };
            if (/\.prisma$/u.test(entry.path) || /\bmodel\s+[A-Za-z_$][\w$]*\s*\{/u.test(entry.content)) {
                const modelPattern = /\bmodel\s+([A-Za-z_$][\w$]*)\s*\{([\s\S]*?)\}/gu;
                for (const model of entry.content.matchAll(modelPattern))
                    if (new RegExp(`\\b(?:${key}|${snake})\\b`, "u").test(model[2] ?? ""))
                        current.models.add(model[1] ?? "unknown");
                current.score += current.models.size * 2;
            }
            else {
                current.score += Math.min(3, matches.length);
                if (hasActiveContentMatch(new RegExp(`(?:session\\.user|auth\\.user|req\\.(?:session\\.user|auth|user))\\.${key}`, "u"), entry.content, evidenceClass))
                    current.score += 3;
            }
            current.evidence.push(`${entry.path}: observed ${key} ownership/session evidence`);
            scores.set(key, current);
        }
    }
    const ranked = [...scores.entries()]
        .map(([key, value]) => ({
        key,
        score: value.score,
        evidence: value.evidence,
        models: value.models.size
    }))
        .sort((left, right) => right.score - left.score || right.models - left.models || left.key.localeCompare(right.key));
    if (ranked.length === 0)
        return {
            status: inventory.diagnostics.status === "COMPLETE" ? "ABSENT" : "UNKNOWN",
            candidates: [],
            confidence: inventory.diagnostics.status === "COMPLETE" ? "MEDIUM" : "LOW",
            evidence: ["No supported ownership key was observed in the bounded scanned scope."]
        };
    const best = ranked[0];
    if (best === undefined)
        throw new Error("Tenancy ranking unexpectedly empty");
    const tied = ranked.filter((candidate) => candidate.score === best.score);
    if (tied.length > 1)
        return {
            status: "UNKNOWN",
            candidates: tied.map((candidate) => candidate.key),
            confidence: "LOW",
            evidence: tied.flatMap((candidate) => candidate.evidence).slice(0, 12)
        };
    return {
        status: "PRESENT",
        key: best.key,
        candidates: ranked.map((candidate) => candidate.key),
        confidence: best.models >= 2 || best.score >= 5 ? "HIGH" : "MEDIUM",
        evidence: best.evidence.slice(0, 12)
    };
}
export async function writeProjectArtifacts(profile, dryRun = false) {
    const root = await canonicalDirectory(profile.root);
    const forgeRoot = join(root, ".forge");
    const profilePath = join(forgeRoot, "project-profile.json");
    const mapPath = join(forgeRoot, "architecture-map.md");
    if (!dryRun) {
        await assertNoSymlinkPath(root, forgeRoot);
        await mkdir(forgeRoot, { recursive: true });
        await assertNoSymlinkPath(root, profilePath);
        await assertNoSymlinkPath(root, mapPath);
        await preserveLegacyProfile(profile, profilePath, join(forgeRoot, "project-profile.schema-v1.json"));
        await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
        await writeFile(mapPath, renderArchitectureMap(profile), "utf8");
    }
    return [profilePath, mapPath];
}
async function preserveLegacyProfile(profile, profilePath, backupPath) {
    let existing;
    try {
        existing = await readFile(profilePath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return;
        throw error;
    }
    if (existing.includes("\0"))
        throw new Error("Refusing to replace a binary project profile.");
    let parsed;
    try {
        parsed = JSON.parse(existing);
    }
    catch {
        throw new Error("Refusing to replace an invalid existing project profile.");
    }
    if (!isRecord(parsed))
        throw new Error("Refusing to replace a malformed existing project profile.");
    if (parsed.schema_version === 2)
        return;
    if (parsed.schema_version !== 1)
        throw new Error(`Refusing to replace unsupported project-profile schema ${String(parsed.schema_version)}.`);
    await assertNoSymlinkPath(profile.root, backupPath);
    try {
        await writeFile(backupPath, existing, { encoding: "utf8", flag: "wx" });
    }
    catch (error) {
        if (error.code !== "EEXIST")
            throw error;
        if ((await readFile(backupPath, "utf8")) !== existing)
            throw new Error("A different schema-v1 profile backup already exists; refusing to overwrite it.", { cause: error });
    }
    const evidence = "Regenerated schema-v1 profile; preserved original at .forge/project-profile.schema-v1.json";
    if (!profile.repository.evidence.includes(evidence))
        profile.repository.evidence.push(evidence);
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
async function buildStructuredProfile(root, files, capabilities, contentByFile, allFiles = files, manifestFiles = files) {
    const relativeFiles = allFiles.map((file) => toPosix(relative(root, file)));
    const manifests = loadPackageManifests(root, manifestFiles, contentByFile);
    const repositoryName = manifests.find((manifest) => manifest.path === "package.json")?.name ?? basename(root);
    // `.git` is excluded from the walked file set, so it can never appear in `relativeFiles`.
    // Ask Git directly instead of testing a path that is guaranteed absent.
    const insideWorkTree = await isInsideGitWorkTree(root);
    const repository = record(repositoryName, "git-repository", {
        root: ".",
        confidence: insideWorkTree ? "HIGH" : "MEDIUM",
        evidence: [
            insideWorkTree
                ? "git rev-parse --is-inside-work-tree"
                : relativeFiles.includes("package.json")
                    ? "package.json"
                    : "repository root"
        ]
    });
    const declaredWorkspaces = loadDeclaredWorkspaces(root, manifests, contentByFile);
    const workspaces = manifests
        .filter((manifest) => manifest.path !== "package.json")
        .map((manifest) => {
        const declaration = declaredWorkspaces.get(manifest.directory);
        // An undeclared nested manifest (a fixture, an example, a vendored sample) is not an
        // active workspace. It is still reported, at reduced confidence, as a candidate only.
        return record(manifest.name, declaration === undefined ? "nested-package" : "package-workspace", {
            root: manifest.directory,
            confidence: declaration === undefined ? "LOW" : "HIGH",
            evidence: declaration === undefined
                ? [manifest.path, "not declared by any root workspace configuration"]
                : [manifest.path, declaration]
        });
    });
    const applications = manifests
        .filter((manifest) => manifest.directory === "." || declaredWorkspaces.has(manifest.directory))
        .map((manifest) => applicationRecord(manifest));
    const languages = languageRecords(root, files);
    const frameworks = contentRecords(root, files, contentByFile, [
        ["Next.js", "frontend-framework", /["']next["']\s*:/u],
        ["React", "frontend-framework", /["']react["']\s*:/u],
        ["Vue", "frontend-framework", /["']vue["']\s*:/u],
        ["Svelte", "frontend-framework", /["']svelte["']\s*:/u],
        ["Express", "backend-framework", /(?:from\s+|require\s*\(\s*)["']express["']\s*\)?/u],
        ["FastAPI", "backend-framework", /(?:from|import)\s+fastapi/u],
        ["Django", "backend-framework", /(?:from\s+django(?:\.|\s+import\b)|import\s+django\b)/u],
        ["WebSocket", "realtime-framework", /\b(?:WebSocket|socket\.io|EventSource)\b/u]
    ], false, ["implementation", "route"]);
    const packageManagers = packageManagerRecords(relativeFiles);
    const databases = capabilityRecords(capabilities, [["database", "database"]]);
    const orms = contentRecords(root, files, contentByFile, [
        ["Prisma", "orm", /@prisma\/client|schema\.prisma/iu],
        ["Drizzle", "orm", /drizzle-orm/iu],
        ["TypeORM", "orm", /typeorm/iu],
        ["Sequelize", "orm", /sequelize/iu],
        ["Mongoose", "odm", /mongoose/iu]
    ]);
    const authentication = capabilityRecords(capabilities, [
        ["authentication", "authentication-boundary"]
    ]);
    const sessions = contentRecords(root, files, contentByFile, [
        ["Session handling", "session", /\b(?:session|cookie|refreshToken|accessToken)\b/iu]
    ]);
    const authorization = capabilityRecords(capabilities, [
        ["authorization", "authorization-policy"]
    ]);
    const roles = detectNamedValues(root, files, contentByFile, "role", /\b(?:role|roles)\b[^\n]{0,80}["'`]([A-Za-z][A-Za-z0-9_-]{1,30})["'`]/giu);
    const tenantBoundaries = capabilityRecords(capabilities, [["tenancy", "tenant-boundary"]]);
    const routes = routeRecords(root, files, contentByFile);
    const storage = capabilityRecords(capabilities, [["storage", "object-storage"]]);
    const uploadPipelines = capabilityRecords(capabilities, [["uploads", "upload-pipeline"]]);
    const caches = capabilityRecords(capabilities, [["cache", "cache"]]);
    const queues = capabilityRecords(capabilities, [["jobs", "queue"]]);
    const scheduledJobs = contentRecords(root, files, contentByFile, [
        ["Scheduled job", "scheduled-job", /\b(?:cron|schedule|scheduled)\b/iu]
    ]);
    const tests = relativeFiles
        .filter((path) => /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[^.]+$/iu.test(path))
        .slice(0, 80)
        .map((path) => record(basename(path), "test-file", { location: path, confidence: "HIGH", evidence: [path] }));
    const ci = relativeFiles
        .filter((path) => /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.yml|\.circleci\/config\.yml|azure-pipelines\.yml|Jenkinsfile)$/iu.test(path))
        .map((path) => record(basename(path), "ci-workflow", {
        location: path,
        confidence: "HIGH",
        evidence: [path]
    }));
    const observability = contentRecords(root, files, contentByFile, [
        ["Sentry", "observability-provider", /@sentry\/|\bsentry[-_]sdk\b/iu],
        ["OpenTelemetry", "observability-provider", /@opentelemetry\/|\bopentelemetry\b/iu],
        ["Datadog", "observability-provider", /\b(?:datadog|dd-trace)\b/iu],
        ["New Relic", "observability-provider", /\b(?:newrelic|new-relic)\b/iu],
        ["Prometheus", "observability-provider", /\bprometheus\b/iu]
    ]);
    const integrations = contentRecords(root, files, contentByFile, [
        ["Supabase", "external-integration", /@supabase\/|\bsupabase\b/iu],
        ["Firebase", "external-integration", /\b(?:firebase-admin|firebase\/app|firebase)\b/iu]
    ]);
    const aiProviders = contentRecords(root, files, contentByFile, [
        ["OpenAI", "ai-provider", /@openai\/|\bopenai\b/iu],
        ["Anthropic", "ai-provider", /@anthropic-ai\/sdk|\banthropic\b/iu],
        ["Gemini", "ai-provider", /@google\/generative-ai|\bgemini\b/iu],
        ["Google AI", "ai-provider", /\b(?:vertexai|vertex-ai|google-genai)\b/iu]
    ]);
    const paymentProviders = contentRecords(root, files, contentByFile, [
        ["Stripe", "payment-provider", /@stripe\/|\bstripe\b/iu],
        ["PayPal", "payment-provider", /@paypal\/|\b(?:paypal-server-sdk|paypal)\b/iu],
        ["Braintree", "payment-provider", /\bbraintree\b/iu]
    ]);
    const hosting = contentRecords(root, files, contentByFile, [
        ["Vercel", "hosting", /(?:^|\/)vercel\.json$|\bvercel\b/iu],
        ["Cloudflare", "hosting", /wrangler\.(?:jsonc?|toml)|cloudflare/iu],
        ["Google Cloud", "hosting", /\b(?:google cloud|google_cloud|gcp)\b/iu],
        ["GKE", "hosting", /\b(?:google_container_cluster|gke)\b/iu],
        ["Kubernetes", "hosting", /\b(?:apiVersion:\s*(?:apps\/v1|v1)|kubernetes)\b/iu],
        ["Supabase", "hosting", /@supabase\/|\bsupabase\b/iu],
        ["Netlify", "hosting", /netlify\.toml|\bnetlify\b/iu],
        ["Container", "hosting", /(?:^|\/)Dockerfile$|\bcontainer\b/iu]
    ], true);
    const deployment = capabilityRecords(capabilities, [["deployment", "deployment-config"]]);
    const environmentTemplates = relativeFiles
        .filter((path) => /(?:^|\/)\.env\.(?:example|sample|template|defaults)$/iu.test(path))
        .map((path) => record(basename(path), "environment-template", {
        location: path,
        confidence: "HIGH",
        evidence: [path]
    }));
    const criticalWorkflows = contentRecords(root, files, contentByFile, [
        ["Authentication workflow", "critical-workflow", /\b(?:login|signIn|authenticate)\s*\(/u],
        ["Upload workflow", "critical-workflow", /\b(?:upload|multipart)\b/iu],
        ["Payment workflow", "critical-workflow", /\b(?:payment|checkout|invoice|charge)\b/iu],
        [
            "AI irreversible-action boundary",
            "critical-workflow",
            /\b(?:model|openai|anthropic)\b[\s\S]{0,500}\b(?:pay|charge|adjustStock|grantPermission)\s*\(/iu
        ]
    ]);
    return {
        repository,
        workspaces: uniqueRecords(workspaces),
        applications: uniqueRecords(applications),
        languages,
        frameworks,
        package_managers: packageManagers,
        databases,
        orms,
        authentication,
        sessions,
        authorization,
        roles,
        tenant_boundaries: tenantBoundaries,
        routes,
        storage,
        upload_pipelines: uploadPipelines,
        caches,
        queues,
        scheduled_jobs: scheduledJobs,
        tests,
        ci,
        observability,
        integrations,
        ai_providers: aiProviders,
        payment_providers: paymentProviders,
        hosting,
        deployment,
        environment_templates: environmentTemplates,
        critical_workflows: criticalWorkflows
    };
}
/**
 * Treats the nearest nested package boundary as active only when the root project declares it.
 * Repositories without a root package manifest keep their nested packages, because no parent
 * workspace contract exists against which those roots could be undeclared.
 */
function capabilityPathPredicate(manifests, declaredWorkspaces) {
    if (!manifests.some((manifest) => manifest.path === "package.json"))
        return () => true;
    const nestedRoots = manifests
        .filter((manifest) => manifest.directory !== ".")
        .map((manifest) => manifest.directory)
        .sort((left, right) => right.length - left.length || left.localeCompare(right));
    return (path) => {
        const normalized = toPosix(path).replace(/^\.\//u, "");
        const nearest = nestedRoots.find((root) => normalized === root || normalized.startsWith(`${root}/`));
        return nearest === undefined || declaredWorkspaces.has(nearest);
    };
}
async function isInsideGitWorkTree(root) {
    try {
        const result = await runFile("git", ["rev-parse", "--is-inside-work-tree"], root, 10_000);
        return result.exitCode === 0 && result.stdout.trim() === "true";
    }
    catch {
        return false;
    }
}
/**
 * Resolves workspace directories declared by the root project. Supports npm/yarn/bun
 * `package.json` workspaces, pnpm-workspace.yaml, lerna.json, nx.json, and turbo.json.
 * Returns a map of workspace directory to the evidence that declared it.
 */
function loadDeclaredWorkspaces(root, manifests, contentByFile) {
    const declared = new Map();
    const patterns = [];
    const rootManifest = manifests.find((manifest) => manifest.path === "package.json");
    const rootWorkspaces = rootManifest?.manifest.workspaces;
    const rootPatterns = Array.isArray(rootWorkspaces)
        ? rootWorkspaces
        : isRecord(rootWorkspaces) && Array.isArray(rootWorkspaces.packages)
            ? rootWorkspaces.packages
            : [];
    for (const pattern of rootPatterns)
        if (typeof pattern === "string")
            patterns.push({ pattern, evidence: "package.json workspaces", include: true });
    const pnpm = contentByFile.get(join(root, "pnpm-workspace.yaml"));
    if (pnpm !== undefined) {
        for (const match of pnpm.matchAll(/^\s*-\s*["']?([^"'\n#]+?)["']?\s*$/gmu)) {
            const raw = (match[1] ?? "").trim();
            const include = !raw.startsWith("!");
            const pattern = include ? raw : raw.slice(1);
            if (pattern.length > 0)
                patterns.push({ pattern, evidence: "pnpm-workspace.yaml", include });
        }
    }
    for (const [file, key] of [
        ["lerna.json", "packages"],
        ["nx.json", "projects"],
        ["turbo.json", "workspaces"]
    ]) {
        const content = contentByFile.get(join(root, file));
        if (content === undefined)
            continue;
        try {
            const parsed = JSON.parse(content);
            if (!isRecord(parsed))
                continue;
            const values = parsed[key];
            if (Array.isArray(values)) {
                for (const value of values)
                    if (typeof value === "string")
                        patterns.push({ pattern: value, evidence: file, include: true });
            }
            else if (isRecord(values))
                for (const value of Object.keys(values))
                    patterns.push({ pattern: value, evidence: file, include: true });
        }
        catch {
            // A malformed workspace declaration is evidence for other analyzers, not a crash here.
        }
    }
    for (const manifest of manifests) {
        if (manifest.directory === ".")
            continue;
        let matchedEvidence;
        for (const { pattern, evidence, include } of patterns) {
            if (matchesWorkspacePattern(manifest.directory, pattern)) {
                matchedEvidence = include ? `declared by ${evidence} pattern '${pattern}'` : undefined;
            }
        }
        if (matchedEvidence !== undefined)
            declared.set(manifest.directory, matchedEvidence);
    }
    return declared;
}
function matchesWorkspacePattern(directory, pattern) {
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
function loadPackageManifests(root, files, contentByFile) {
    const output = [];
    for (const file of files.filter((candidate) => basename(candidate) === "package.json")) {
        const content = contentByFile.get(file);
        if (content === undefined)
            continue;
        try {
            const manifest = JSON.parse(content);
            if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest))
                continue;
            const candidate = manifest;
            const path = toPosix(relative(root, file));
            output.push({
                path,
                directory: toPosix(relative(root, dirname(file))) || ".",
                name: typeof candidate.name === "string" ? candidate.name : basename(dirname(file)),
                manifest: candidate
            });
        }
        catch {
            // Invalid manifests remain evidence for the dependency analyzer.
        }
    }
    return output.sort((a, b) => a.path.localeCompare(b.path));
}
function applicationRecord(manifest) {
    const dependencies = {
        ...(isRecord(manifest.manifest.dependencies) ? manifest.manifest.dependencies : {}),
        ...(isRecord(manifest.manifest.devDependencies) ? manifest.manifest.devDependencies : {})
    };
    const names = new Set(Object.keys(dependencies));
    let type = "library";
    if (["react-native", "expo"].some((name) => names.has(name)))
        type = "mobile";
    else if (["electron", "@tauri-apps/api"].some((name) => names.has(name)))
        type = "desktop";
    else if (["wrangler", "@cloudflare/workers-types"].some((name) => names.has(name)))
        type = "worker";
    else if (["express", "fastify", "@nestjs/core", "hono"].some((name) => names.has(name)))
        type = "backend";
    else if (["next", "react", "vue", "svelte"].some((name) => names.has(name)))
        type = "frontend";
    else if (/docs?|website/iu.test(manifest.name) ||
        /(?:^|\/)docs?(?:\/|$)/iu.test(manifest.directory))
        type = "documentation";
    return record(manifest.name, type, {
        root: manifest.directory,
        confidence: "HIGH",
        evidence: [manifest.path]
    });
}
function languageRecords(root, files) {
    const mapping = {
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".mts": "TypeScript",
        ".cts": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".mjs": "JavaScript",
        ".cjs": "JavaScript",
        ".c": "C",
        ".cc": "C++",
        ".cpp": "C++",
        ".cxx": "C++",
        ".py": "Python",
        ".go": "Go",
        ".rs": "Rust",
        ".java": "Java",
        ".kt": "Kotlin"
    };
    const evidence = new Map();
    for (const file of files) {
        const language = mapping[extname(file).toLowerCase()];
        if (language === undefined)
            continue;
        const current = evidence.get(language) ?? [];
        if (current.length < 12)
            current.push(toPosix(relative(root, file)));
        evidence.set(language, current);
    }
    return [...evidence.entries()].map(([name, paths]) => record(name, "language", { confidence: "HIGH", evidence: paths }));
}
function capabilityRecords(capabilities, mappings) {
    return mappings.flatMap(([capability, type]) => {
        const detection = capabilities[capability];
        return detection === undefined
            ? []
            : [
                record(detection.name, type, {
                    confidence: detection.confidence,
                    evidence: detection.evidence
                })
            ];
    });
}
function packageManagerRecords(files) {
    const mapping = [
        ["package-lock.json", "npm"],
        ["pnpm-lock.yaml", "pnpm"],
        ["yarn.lock", "yarn"],
        ["bun.lock", "bun"]
    ];
    return mapping.flatMap(([path, name]) => files.includes(path)
        ? [record(name, "package-manager", { confidence: "HIGH", evidence: [path] })]
        : []);
}
function contentRecords(root, files, contentByFile, patterns, matchPath = false, evidenceClasses) {
    const output = [];
    for (const [name, type, pattern] of patterns) {
        const evidence = [];
        for (const file of files) {
            const path = toPosix(relative(root, file));
            const evidenceClass = classifyEvidencePath(path).evidence_class;
            if (!matchPath && evidenceClasses !== undefined && !evidenceClasses.includes(evidenceClass))
                continue;
            const content = matchPath ? path : contentByFile.get(file);
            const matched = content !== undefined &&
                (matchPath
                    ? new RegExp(pattern.source, pattern.flags.replace(/g/gu, "")).test(content)
                    : hasActiveContentMatch(pattern, content, evidenceClass));
            if (matched && evidence.length < 12)
                evidence.push(path);
        }
        if (evidence.length > 0)
            output.push(record(name, type, { confidence: "MEDIUM", evidence }));
    }
    return output;
}
function detectNamedValues(root, files, contentByFile, type, pattern) {
    const values = new Map();
    for (const file of files) {
        const content = contentByFile.get(file);
        if (content === undefined)
            continue;
        pattern.lastIndex = 0;
        for (const match of content.matchAll(pattern)) {
            const path = toPosix(relative(root, file));
            if (isWeakContext(content, match.index, classifyEvidencePath(path).evidence_class))
                continue;
            const name = match[1];
            if (name === undefined)
                continue;
            const current = values.get(name) ?? [];
            if (!current.includes(path))
                current.push(path);
            values.set(name, current.slice(0, 12));
        }
    }
    return [...values.entries()].map(([name, evidence]) => record(name, type, { confidence: "MEDIUM", evidence }));
}
function routeRecords(root, files, contentByFile) {
    const output = [];
    const pattern = /\b(?:app|router)\.(get|post|put|patch|delete|use)\s*\(\s*["'`]([^"'`]+)["'`]/giu;
    for (const file of files.filter((candidate) => /\.(?:[cm]?[jt]sx?)$/iu.test(candidate))) {
        const content = contentByFile.get(file);
        if (content === undefined)
            continue;
        pattern.lastIndex = 0;
        for (const match of content.matchAll(pattern)) {
            const path = toPosix(relative(root, file));
            if (isWeakContext(content, match.index, classifyEvidencePath(path).evidence_class))
                continue;
            const method = match[1]?.toUpperCase() ?? "ROUTE";
            const route = match[2] ?? "unknown";
            const afterDeclaration = content.slice(match.index + match[0].length);
            const nextRoute = afterDeclaration.search(/\b(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/u);
            const contextEnd = nextRoute === -1
                ? Math.min(content.length, match.index + 900)
                : match.index + match[0].length + nextRoute;
            const context = content.slice(match.index, contextEnd);
            let visibility = "unknown";
            if (hasActiveContentMatch(/\b(?:requireRole\s*\(\s*["']admin|isAdmin|role\s*===?\s*["']admin)/iu, context, classifyEvidencePath(path).evidence_class))
                visibility = "admin";
            else if (hasActiveContentMatch(/\b(?:requireAuth|authenticate|getServerSession|session\.user|auth\.user)/u, context, classifyEvidencePath(path).evidence_class))
                visibility = "authenticated";
            // Name-based visibility is an explicit low-confidence heuristic, never proof. A route is
            // not public merely because its path contains "login", "health", or "public".
            let nameHeuristic = false;
            if (visibility === "unknown" && /\/(?:internal|cron|webhooks?)(?:\/|$)/iu.test(route)) {
                visibility = "internal";
                nameHeuristic = true;
            }
            else if (visibility === "unknown" &&
                /\/(?:health|login|signup|public)(?:\/|$)/iu.test(route)) {
                visibility = "public";
                nameHeuristic = true;
            }
            output.push({
                name: `${method} ${route}`,
                type: "http-route",
                location: path,
                confidence: nameHeuristic ? "LOW" : "HIGH",
                evidence: [
                    `${path}:${lineForIndex(content, match.index)}`,
                    "adapter: express-like",
                    ...(nameHeuristic
                        ? ["visibility inferred from the route name only; not proven by a guard"]
                        : [])
                ],
                visibility
            });
        }
    }
    output.push(...frameworkRouteRecords(root, files, contentByFile));
    return output;
}
function hasActiveContentMatch(pattern, content, evidenceClass) {
    return firstActiveContentMatch(pattern, content, evidenceClass) !== undefined;
}
function firstActiveContentMatch(pattern, content, evidenceClass) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace(/g/gu, "")}g`);
    for (const match of content.matchAll(global))
        if (!isWeakContext(content, match.index, evidenceClass))
            return match;
    return undefined;
}
/**
 * Bounded route adapters for frameworks whose routes are not literal Express registrations.
 * Each adapter states which adapter produced the record so coverage is auditable. Middleware
 * inheritance is not resolved, so visibility stays `unknown` unless a guard is directly visible.
 */
function frameworkRouteRecords(root, files, contentByFile) {
    const output = [];
    const methods = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
    for (const file of files.filter((candidate) => /\.(?:[cm]?[jt]sx?)$/iu.test(candidate))) {
        const content = contentByFile.get(file);
        if (content === undefined)
            continue;
        const path = toPosix(relative(root, file));
        const evidenceClass = classifyEvidencePath(path).evidence_class;
        // Next.js App Router: app/**/route.ts exporting HTTP method handlers.
        if (/(?:^|\/)app\/(?:.*\/)?route\.[cm]?[jt]sx?$/iu.test(path)) {
            const segment = path
                .replace(/^.*?(?:^|\/)app\//iu, "/")
                .replace(/\/route\.[cm]?[jt]sx?$/iu, "")
                .replace(/\/\((?:[^/]+)\)/gu, "");
            for (const match of content.matchAll(new RegExp(`export\\s+(?:(?:async\\s+)?function\\s+|const\\s+)(${methods})\\b`, "gu"))) {
                if (isWeakContext(content, match.index, evidenceClass))
                    continue;
                output.push(frameworkRoute(`${match[1]} ${segment || "/"}`, path, content, match.index, "nextjs-app-router"));
            }
        }
        // Next.js Pages Router: pages/api/**.ts default-exported handler.
        const pagesExport = firstActiveContentMatch(/export\s+default/u, content, evidenceClass);
        if (/(?:^|\/)pages\/api\/.*\.[cm]?[jt]sx?$/iu.test(path) && pagesExport !== undefined) {
            const segment = path
                .replace(/^.*?(?:^|\/)pages\//iu, "/")
                .replace(/\.[cm]?[jt]sx?$/iu, "")
                .replace(/\/index$/u, "");
            output.push(frameworkRoute(`ROUTE ${segment || "/"}`, path, content, pagesExport.index, "nextjs-pages-router"));
        }
        // NestJS controller decorators.
        const controller = firstActiveContentMatch(/@Controller\s*\(\s*["'`]([^"'`]*)["'`]/u, content, evidenceClass);
        if (controller !== undefined) {
            const base = `/${(controller[1] ?? "").replace(/^\/+|\/+$/gu, "")}`;
            for (const match of content.matchAll(/@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/gu)) {
                if (isWeakContext(content, match.index, evidenceClass))
                    continue;
                const suffix = (match[2] ?? "").replace(/^\/+/u, "");
                const route = `${base === "/" ? "" : base}/${suffix}`.replace(/\/+$/u, "") || "/";
                output.push(frameworkRoute(`${(match[1] ?? "ROUTE").toUpperCase()} ${route}`, path, content, match.index, "nestjs-decorators"));
            }
        }
        // Fastify object-form route registration.
        for (const match of content.matchAll(/\.route\s*\(\s*\{[^}]*?method\s*:\s*["'`]([A-Za-z]+)["'`][^}]*?url\s*:\s*["'`]([^"'`]+)["'`]/gsu)) {
            if (isWeakContext(content, match.index, evidenceClass))
                continue;
            output.push(frameworkRoute(`${(match[1] ?? "ROUTE").toUpperCase()} ${match[2] ?? "unknown"}`, path, content, match.index, "fastify-route-object"));
        }
    }
    // Django URLconfs expose request boundaries even though HTTP methods live in the target view.
    for (const file of files.filter((candidate) => /\.py$/iu.test(candidate))) {
        const content = contentByFile.get(file);
        if (content === undefined)
            continue;
        const path = toPosix(relative(root, file));
        if (!/(?:^|\/)urls\.py$/iu.test(path))
            continue;
        const evidenceClass = classifyEvidencePath(path).evidence_class;
        for (const match of content.matchAll(/\b(?:path|re_path)\s*\(\s*r?["']([^"']+)["']/gu)) {
            if (isWeakContext(content, match.index, evidenceClass))
                continue;
            const declared = (match[1] ?? "").replace(/^\^/u, "").replace(/\$$/u, "");
            const route = `/${declared}`.replace(/\/{2,}/gu, "/") || "/";
            output.push(frameworkRoute("ROUTE " + route, path, content, match.index, "django-urlconf"));
        }
    }
    return output;
}
function frameworkRoute(name, path, content, index, adapter) {
    return {
        name,
        type: "http-route",
        location: path,
        confidence: "HIGH",
        evidence: [
            `${path}:${lineForIndex(content, index)}`,
            `adapter: ${adapter}`,
            "middleware-inherited visibility is not resolved by this adapter"
        ],
        // Visibility is unknown unless a guard is directly observed. Framework middleware and
        // decorator-level guards applied elsewhere are deliberately not treated as proof.
        visibility: "unknown"
    };
}
function record(name, type, options) {
    return {
        name,
        type,
        ...(options.root === undefined ? {} : { root: options.root }),
        ...(options.location === undefined ? {} : { location: options.location }),
        confidence: options.confidence,
        evidence: options.evidence
    };
}
function uniqueRecords(records) {
    const byKey = new Map();
    for (const item of records) {
        const key = `${item.name}\u0000${item.type}\u0000${item.root ?? item.location ?? ""}`;
        const current = byKey.get(key);
        if (current === undefined)
            byKey.set(key, item);
        else
            current.evidence = [...new Set([...current.evidence, ...item.evidence])].slice(0, 12);
    }
    return [...byKey.values()];
}
function lineForIndex(content, index) {
    return content.slice(0, index).split("\n").length;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function renderArchitectureMap(profile) {
    const applications = profile.applications.slice(0, 12);
    const boundaries = [
        ...profile.databases,
        ...profile.storage,
        ...profile.caches,
        ...profile.queues,
        ...profile.integrations,
        ...profile.ai_providers,
        ...profile.payment_providers
    ].slice(0, 16);
    const appNodes = applications
        .map((application, index) => `  A${index}["${escapeMermaid(application.name)} (${escapeMermaid(application.type)})"]`)
        .join("\n");
    const boundaryNodes = boundaries
        .map((boundary, index) => `  B${index}["${escapeMermaid(boundary.name)} (${escapeMermaid(boundary.type)})"]`)
        .join("\n");
    const edges = applications
        .flatMap((_application, appIndex) => boundaries.map((_boundary, boundaryIndex) => `  A${appIndex} -. "evidence requires trace" .-> B${boundaryIndex}`))
        .slice(0, 24)
        .join("\n");
    const evidence = [
        ...profile.applications,
        ...profile.routes,
        ...boundaries,
        ...profile.critical_workflows
    ]
        .map((item) => `- **${item.name}** (${item.type}, ${item.confidence}): ${item.evidence.join(", ")}`)
        .join("\n");
    return `# Architecture map

Generated from project-profile schema v2 evidence at ${profile.generated_at}. Dashed edges are
candidate trust-boundary traces, not proven runtime calls. Route visibility remains unknown unless
the supported handler contains direct authentication or role evidence.

\`\`\`mermaid
flowchart LR
${appNodes || '  Unknown["No application boundary detected"]'}
${boundaryNodes}
${edges}
\`\`\`

## Applications, routes, and boundaries

${evidence || "- No supported structured records. Inspect the repository manually."}

## Unverified boundaries

Runtime topology, unknown route visibility, production configuration, permission enforcement,
tenant propagation, storage release, payment/AI confirmation, and provider-side controls remain
NOT_VERIFIED unless direct evidence is added.
`;
}
function escapeMermaid(value) {
    return value.replaceAll('"', "'");
}
