import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import type {
  CommandDefinition,
  Confidence,
  Detection,
  ProfileRecord,
  ProjectProfile,
  RouteRecord
} from "./types.js";
import {
  assertNoSymlinkPath,
  canonicalDirectory,
  readTextIfPresent,
  runFile,
  toPosix,
  utcNow,
  walkFiles
} from "./utils.js";

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

type Rule = {
  category: string;
  name: string;
  confidence: Confidence;
  fileNames?: RegExp;
  content?: RegExp;
  capability?: string;
};

const RULES: Rule[] = [
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
    fileNames:
      /^(?:Dockerfile|compose\.ya?ml|vercel\.json|netlify\.toml|fly\.toml|render\.yaml|Procfile)$/iu,
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

export async function discoverProject(rootInput: string): Promise<ProjectProfile> {
  const root = await canonicalDirectory(rootInput);
  const files = await walkFiles(root, {
    exclude: EXCLUDED,
    maxBytes: 768 * 1024,
    maxFiles: 15_000,
    maxTotalBytes: 128 * 1024 * 1024,
    maxDepth: 64
  });
  const evidenceByRule = new Map<Rule, string[]>();
  for (const file of files) {
    const rel = toPosix(relative(root, file));
    const name = basename(file);
    const candidateRules = RULES.filter((rule) => rule.fileNames?.test(name));
    for (const rule of candidateRules) addEvidence(evidenceByRule, rule, rel);
    const text = await readTextIfPresent(file);
    if (text === undefined) continue;
    for (const rule of RULES) {
      if (rule.content?.test(text)) addEvidence(evidenceByRule, rule, rel);
    }
  }

  const detections: Detection[] = [];
  const capabilities: Record<string, Detection> = {};
  for (const rule of RULES) {
    const evidence = evidenceByRule.get(rule);
    if (evidence === undefined || evidence.length === 0) continue;
    const detection: Detection = {
      name: rule.name,
      confidence: rule.confidence,
      evidence: evidence.slice(0, 12)
    };
    detections.push(detection);
    if (rule.capability !== undefined) {
      const current = capabilities[rule.capability];
      if (current === undefined) capabilities[rule.capability] = detection;
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
  if (
    capabilities.ai !== undefined ||
    capabilities.payments !== undefined ||
    capabilities.integrations !== undefined ||
    capabilities.deployment !== undefined
  ) {
    capabilities["paid-services"] = {
      name: "Potential paid external services",
      confidence: "LOW",
      evidence: ["One or more external runtime providers were detected"]
    };
  }

  const structured = await buildStructuredProfile(root, files, capabilities);
  return {
    schema_version: 2,
    root,
    generated_at: utcNow(),
    detections: deduplicateDetections(detections),
    capabilities,
    ...structured
  };
}

export async function writeProjectArtifacts(
  profile: ProjectProfile,
  dryRun = false
): Promise<string[]> {
  const root = await canonicalDirectory(profile.root);
  const forgeRoot = join(root, ".forge");
  const profilePath = join(forgeRoot, "project-profile.json");
  const mapPath = join(forgeRoot, "architecture-map.md");
  if (!dryRun) {
    await assertNoSymlinkPath(root, forgeRoot);
    await mkdir(forgeRoot, { recursive: true });
    await assertNoSymlinkPath(root, profilePath);
    await assertNoSymlinkPath(root, mapPath);
    await preserveLegacyProfile(
      profile,
      profilePath,
      join(forgeRoot, "project-profile.schema-v1.json")
    );
    await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    await writeFile(mapPath, renderArchitectureMap(profile), "utf8");
  }
  return [profilePath, mapPath];
}

async function preserveLegacyProfile(
  profile: ProjectProfile,
  profilePath: string,
  backupPath: string
): Promise<void> {
  let existing: string;
  try {
    existing = await readFile(profilePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (existing.includes("\0")) throw new Error("Refusing to replace a binary project profile.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(existing) as unknown;
  } catch {
    throw new Error("Refusing to replace an invalid existing project profile.");
  }
  if (!isRecord(parsed))
    throw new Error("Refusing to replace a malformed existing project profile.");
  if (parsed.schema_version === 2) return;
  if (parsed.schema_version !== 1)
    throw new Error(
      `Refusing to replace unsupported project-profile schema ${String(parsed.schema_version)}.`
    );
  await assertNoSymlinkPath(profile.root, backupPath);
  try {
    await writeFile(backupPath, existing, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if ((await readFile(backupPath, "utf8")) !== existing)
      throw new Error(
        "A different schema-v1 profile backup already exists; refusing to overwrite it.",
        { cause: error }
      );
  }
  const evidence =
    "Regenerated schema-v1 profile; preserved original at .forge/project-profile.schema-v1.json";
  if (!profile.repository.evidence.includes(evidence)) profile.repository.evidence.push(evidence);
}

export async function detectProjectCommands(rootInput: string): Promise<CommandDefinition[]> {
  const root = await canonicalDirectory(rootInput);
  const packagePath = join(root, "package.json");
  const packageText = await readTextIfPresent(packagePath);
  if (packageText === undefined) return [];
  let manifest: { scripts?: Record<string, unknown>; packageManager?: string };
  try {
    manifest = JSON.parse(packageText) as typeof manifest;
  } catch {
    return [];
  }
  const scripts = manifest.scripts ?? {};
  const packageManager = await choosePackageManager(root, manifest.packageManager);
  return Object.entries(scripts)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, definition]) => ({
      name,
      executable: packageManager.executable,
      args: [...packageManager.runArgs, name],
      source: toPosix(relative(root, packagePath)),
      definition
    }));
}

async function choosePackageManager(
  root: string,
  declared: string | undefined
): Promise<{ executable: string; runArgs: string[] }> {
  const declaredName = declared?.split("@")[0];
  if (declaredName === "pnpm") return packageManagerCommand("pnpm", ["run"]);
  if (declaredName === "yarn") return packageManagerCommand("yarn", []);
  if (declaredName === "bun") return packageManagerCommand("bun", ["run"]);
  for (const [lock, result] of [
    ["pnpm-lock.yaml", { executable: "pnpm", runArgs: ["run"] }],
    ["yarn.lock", { executable: "yarn", runArgs: [] }],
    ["bun.lock", { executable: "bun", runArgs: ["run"] }],
    ["bun.lockb", { executable: "bun", runArgs: ["run"] }]
  ] as const) {
    try {
      await readFile(join(root, lock));
      return packageManagerCommand(result.executable, [...result.runArgs]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return packageManagerCommand("npm", ["run"]);
}

async function packageManagerCommand(
  name: string,
  runArgs: string[]
): Promise<{ executable: string; runArgs: string[] }> {
  const configured = process.env.npm_execpath;
  const executableDirectory = dirname(process.execPath);
  const entryNames: Record<string, Set<string>> = {
    npm: new Set(["npm-cli.js"]),
    pnpm: new Set(["pnpm.cjs", "pnpm.js"]),
    yarn: new Set(["yarn.cjs", "yarn.js"])
  };
  const allowedEntries = entryNames[name];
  if (allowedEntries === undefined) return { executable: name, runArgs };
  const packageCandidates =
    name === "npm"
      ? [
          join(executableDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
          join(executableDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
        ]
      : [
          join(executableDirectory, "node_modules", "corepack", "dist", `${name}.js`),
          join(executableDirectory, "..", "lib", "node_modules", "corepack", "dist", `${name}.js`)
        ];
  const candidates = [configured, ...packageCandidates].filter(
    (candidate): candidate is string => typeof candidate === "string"
  );
  for (const candidate of candidates) {
    if (!allowedEntries.has(basename(candidate).toLowerCase())) continue;
    try {
      if ((await stat(candidate)).isFile())
        return { executable: process.execPath, runArgs: [candidate, ...runArgs] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return { executable: process.platform === "win32" ? `${name}.cmd` : name, runArgs };
}

function addEvidence(map: Map<Rule, string[]>, rule: Rule, evidence: string): void {
  const current = map.get(rule) ?? [];
  if (!current.includes(evidence)) current.push(evidence);
  map.set(rule, current);
}

function deduplicateDetections(detections: Detection[]): Detection[] {
  const byName = new Map<string, Detection>();
  for (const detection of detections) {
    const current = byName.get(detection.name);
    if (current === undefined) byName.set(detection.name, detection);
    else current.evidence = [...new Set([...current.evidence, ...detection.evidence])].slice(0, 12);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function buildStructuredProfile(
  root: string,
  files: string[],
  capabilities: Record<string, Detection>
): Promise<
  Omit<ProjectProfile, "schema_version" | "root" | "generated_at" | "detections" | "capabilities">
> {
  const relativeFiles = files.map((file) => toPosix(relative(root, file)));
  const manifests = await loadPackageManifests(root, files);
  const repositoryName =
    manifests.find((manifest) => manifest.path === "package.json")?.name ?? basename(root);
  // `.git` is excluded from the walked file set, so it can never appear in `relativeFiles`.
  // Ask Git directly instead of testing a path that is guaranteed absent.
  const insideWorkTree = await isInsideGitWorkTree(root);
  const repository: ProfileRecord = record(repositoryName, "git-repository", {
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
  const declaredWorkspaces = await loadDeclaredWorkspaces(root, manifests);
  const workspaces = manifests
    .filter((manifest) => manifest.path !== "package.json")
    .map((manifest) => {
      const declaration = declaredWorkspaces.get(manifest.directory);
      // An undeclared nested manifest (a fixture, an example, a vendored sample) is not an
      // active workspace. It is still reported, at reduced confidence, as a candidate only.
      return record(
        manifest.name,
        declaration === undefined ? "nested-package" : "package-workspace",
        {
          root: manifest.directory,
          confidence: declaration === undefined ? "LOW" : "HIGH",
          evidence:
            declaration === undefined
              ? [manifest.path, "not declared by any root workspace configuration"]
              : [manifest.path, declaration]
        }
      );
    });
  const applications = manifests.map((manifest) => applicationRecord(manifest));
  const languages = languageRecords(root, files);
  const frameworks = capabilityRecords(capabilities, [
    ["frontend", "frontend-framework"],
    ["api", "backend-framework"],
    ["realtime", "realtime-framework"]
  ]);
  const packageManagers = packageManagerRecords(relativeFiles);
  const databases = capabilityRecords(capabilities, [["database", "database"]]);
  const orms = await contentRecords(root, files, [
    ["Prisma", "orm", /@prisma\/client|schema\.prisma/iu],
    ["Drizzle", "orm", /drizzle-orm/iu],
    ["TypeORM", "orm", /typeorm/iu],
    ["Sequelize", "orm", /sequelize/iu],
    ["Mongoose", "odm", /mongoose/iu]
  ]);
  const authentication = capabilityRecords(capabilities, [
    ["authentication", "authentication-boundary"]
  ]);
  const sessions = await contentRecords(root, files, [
    ["Session handling", "session", /\b(?:session|cookie|refreshToken|accessToken)\b/iu]
  ]);
  const authorization = capabilityRecords(capabilities, [
    ["authorization", "authorization-policy"]
  ]);
  const roles = await detectNamedValues(
    root,
    files,
    "role",
    /\b(?:role|roles)\b[^\n]{0,80}["'`]([A-Za-z][A-Za-z0-9_-]{1,30})["'`]/giu
  );
  const tenantBoundaries = capabilityRecords(capabilities, [["tenancy", "tenant-boundary"]]);
  const routes = await routeRecords(root, files);
  const storage = capabilityRecords(capabilities, [["storage", "object-storage"]]);
  const uploadPipelines = capabilityRecords(capabilities, [["uploads", "upload-pipeline"]]);
  const caches = capabilityRecords(capabilities, [["cache", "cache"]]);
  const queues = capabilityRecords(capabilities, [["jobs", "queue"]]);
  const scheduledJobs = await contentRecords(root, files, [
    ["Scheduled job", "scheduled-job", /\b(?:cron|schedule|scheduled)\b/iu]
  ]);
  const tests = relativeFiles
    .filter((path) => /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[^.]+$/iu.test(path))
    .slice(0, 80)
    .map((path) =>
      record(basename(path), "test-file", { location: path, confidence: "HIGH", evidence: [path] })
    );
  const ci = relativeFiles
    .filter((path) =>
      /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.yml|\.circleci\/config\.yml|azure-pipelines\.yml|Jenkinsfile)$/iu.test(
        path
      )
    )
    .map((path) =>
      record(basename(path), "ci-workflow", {
        location: path,
        confidence: "HIGH",
        evidence: [path]
      })
    );
  const observability = capabilityRecords(capabilities, [["observability", "observability"]]);
  const integrations = capabilityRecords(capabilities, [["integrations", "external-integration"]]);
  const aiProviders = capabilityRecords(capabilities, [["ai", "ai-provider"]]);
  const paymentProviders = capabilityRecords(capabilities, [["payments", "payment-provider"]]);
  const hosting = await contentRecords(
    root,
    files,
    [
      ["Vercel", "hosting", /(?:^|\/)vercel\.json$|\bvercel\b/iu],
      ["Cloudflare", "hosting", /wrangler\.(?:jsonc?|toml)|cloudflare/iu],
      ["Netlify", "hosting", /netlify\.toml|\bnetlify\b/iu],
      ["Container", "hosting", /(?:^|\/)Dockerfile$|\bcontainer\b/iu]
    ],
    true
  );
  const deployment = capabilityRecords(capabilities, [["deployment", "deployment-config"]]);
  const environmentTemplates = relativeFiles
    .filter((path) => /(?:^|\/)\.env\.(?:example|sample|template|defaults)$/iu.test(path))
    .map((path) =>
      record(basename(path), "environment-template", {
        location: path,
        confidence: "HIGH",
        evidence: [path]
      })
    );
  const criticalWorkflows = await contentRecords(root, files, [
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

type PackageManifestRecord = {
  path: string;
  directory: string;
  name: string;
  manifest: Record<string, unknown>;
};

async function isInsideGitWorkTree(root: string): Promise<boolean> {
  try {
    const result = await runFile("git", ["rev-parse", "--is-inside-work-tree"], root, 10_000);
    return result.exitCode === 0 && result.stdout.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Resolves workspace directories declared by the root project. Supports npm/yarn/bun
 * `package.json` workspaces, pnpm-workspace.yaml, lerna.json, nx.json, and turbo.json.
 * Returns a map of workspace directory to the evidence that declared it.
 */
async function loadDeclaredWorkspaces(
  root: string,
  manifests: PackageManifestRecord[]
): Promise<Map<string, string>> {
  const declared = new Map<string, string>();
  const patterns: Array<{ pattern: string; evidence: string }> = [];
  const rootManifest = manifests.find((manifest) => manifest.path === "package.json");
  const rootWorkspaces = rootManifest?.manifest.workspaces;
  const rootPatterns = Array.isArray(rootWorkspaces)
    ? rootWorkspaces
    : isRecord(rootWorkspaces) && Array.isArray(rootWorkspaces.packages)
      ? rootWorkspaces.packages
      : [];
  for (const pattern of rootPatterns)
    if (typeof pattern === "string")
      patterns.push({ pattern, evidence: "package.json workspaces" });

  const pnpm = await readTextIfPresent(join(root, "pnpm-workspace.yaml"));
  if (pnpm !== undefined) {
    for (const match of pnpm.matchAll(/^\s*-\s*["']?([^"'\n#]+?)["']?\s*$/gmu))
      patterns.push({ pattern: (match[1] ?? "").trim(), evidence: "pnpm-workspace.yaml" });
  }
  for (const [file, key] of [
    ["lerna.json", "packages"],
    ["nx.json", "projects"],
    ["turbo.json", "workspaces"]
  ] as const) {
    const content = await readTextIfPresent(join(root, file));
    if (content === undefined) continue;
    try {
      const parsed = JSON.parse(content) as unknown;
      if (!isRecord(parsed)) continue;
      const values = parsed[key];
      if (Array.isArray(values))
        for (const value of values)
          if (typeof value === "string") patterns.push({ pattern: value, evidence: file });
          else if (isRecord(values))
            for (const value of Object.keys(values))
              patterns.push({ pattern: value, evidence: file });
    } catch {
      // A malformed workspace declaration is evidence for other analyzers, not a crash here.
    }
  }

  for (const manifest of manifests) {
    if (manifest.directory === ".") continue;
    for (const { pattern, evidence } of patterns) {
      if (matchesWorkspacePattern(manifest.directory, pattern)) {
        declared.set(manifest.directory, `declared by ${evidence} pattern '${pattern}'`);
        break;
      }
    }
  }
  return declared;
}

function matchesWorkspacePattern(directory: string, pattern: string): boolean {
  const normalized = pattern.replace(/^\.\//u, "").replace(/\/+$/u, "");
  if (normalized.length === 0) return false;
  const expression = normalized
    .split("/")
    .map((segment) =>
      segment === "**"
        ? "[^\\0]*"
        : segment.replace(/[.+^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, "[^/]*")
    )
    .join("/");
  return new RegExp(`^${expression}$`, "u").test(directory);
}

async function loadPackageManifests(
  root: string,
  files: string[]
): Promise<PackageManifestRecord[]> {
  const output: PackageManifestRecord[] = [];
  for (const file of files.filter((candidate) => basename(candidate) === "package.json")) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    try {
      const manifest = JSON.parse(content) as unknown;
      if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) continue;
      const candidate = manifest as Record<string, unknown>;
      const path = toPosix(relative(root, file));
      output.push({
        path,
        directory: toPosix(relative(root, dirname(file))) || ".",
        name: typeof candidate.name === "string" ? candidate.name : basename(dirname(file)),
        manifest: candidate
      });
    } catch {
      // Invalid manifests remain evidence for the dependency analyzer.
    }
  }
  return output.sort((a, b) => a.path.localeCompare(b.path));
}

function applicationRecord(manifest: PackageManifestRecord): ProfileRecord {
  const dependencies = {
    ...(isRecord(manifest.manifest.dependencies) ? manifest.manifest.dependencies : {}),
    ...(isRecord(manifest.manifest.devDependencies) ? manifest.manifest.devDependencies : {})
  };
  const names = new Set(Object.keys(dependencies));
  let type = "library";
  if (["react-native", "expo"].some((name) => names.has(name))) type = "mobile";
  else if (["electron", "@tauri-apps/api"].some((name) => names.has(name))) type = "desktop";
  else if (["wrangler", "@cloudflare/workers-types"].some((name) => names.has(name)))
    type = "worker";
  else if (["express", "fastify", "@nestjs/core", "hono"].some((name) => names.has(name)))
    type = "backend";
  else if (["next", "react", "vue", "svelte"].some((name) => names.has(name))) type = "frontend";
  else if (
    /docs?|website/iu.test(manifest.name) ||
    /(?:^|\/)docs?(?:\/|$)/iu.test(manifest.directory)
  )
    type = "documentation";
  return record(manifest.name, type, {
    root: manifest.directory,
    confidence: "HIGH",
    evidence: [manifest.path]
  });
}

function languageRecords(root: string, files: string[]): ProfileRecord[] {
  const mapping: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mts": "TypeScript",
    ".cts": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin"
  };
  const evidence = new Map<string, string[]>();
  for (const file of files) {
    const language = mapping[extname(file).toLowerCase()];
    if (language === undefined) continue;
    const current = evidence.get(language) ?? [];
    if (current.length < 12) current.push(toPosix(relative(root, file)));
    evidence.set(language, current);
  }
  return [...evidence.entries()].map(([name, paths]) =>
    record(name, "language", { confidence: "HIGH", evidence: paths })
  );
}

function capabilityRecords(
  capabilities: Record<string, Detection>,
  mappings: Array<[string, string]>
): ProfileRecord[] {
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

function packageManagerRecords(files: string[]): ProfileRecord[] {
  const mapping: Array<[string, string]> = [
    ["package-lock.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"]
  ];
  return mapping.flatMap(([path, name]) =>
    files.includes(path)
      ? [record(name, "package-manager", { confidence: "HIGH", evidence: [path] })]
      : []
  );
}

async function contentRecords(
  root: string,
  files: string[],
  patterns: Array<[string, string, RegExp]>,
  matchPath = false
): Promise<ProfileRecord[]> {
  const output: ProfileRecord[] = [];
  for (const [name, type, pattern] of patterns) {
    const evidence: string[] = [];
    for (const file of files) {
      const path = toPosix(relative(root, file));
      const content = matchPath ? path : await readTextIfPresent(file);
      pattern.lastIndex = 0;
      if (content !== undefined && pattern.test(content) && evidence.length < 12)
        evidence.push(path);
    }
    if (evidence.length > 0) output.push(record(name, type, { confidence: "MEDIUM", evidence }));
  }
  return output;
}

async function detectNamedValues(
  root: string,
  files: string[],
  type: string,
  pattern: RegExp
): Promise<ProfileRecord[]> {
  const values = new Map<string, string[]>();
  for (const file of files) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const name = match[1];
      if (name === undefined) continue;
      const path = toPosix(relative(root, file));
      const current = values.get(name) ?? [];
      if (!current.includes(path)) current.push(path);
      values.set(name, current.slice(0, 12));
    }
  }
  return [...values.entries()].map(([name, evidence]) =>
    record(name, type, { confidence: "MEDIUM", evidence })
  );
}

async function routeRecords(root: string, files: string[]): Promise<RouteRecord[]> {
  const output: RouteRecord[] = [];
  const pattern = /\b(?:app|router)\.(get|post|put|patch|delete|use)\s*\(\s*["'`]([^"'`]+)["'`]/giu;
  for (const file of files.filter((candidate) => /\.(?:[cm]?[jt]sx?)$/iu.test(candidate))) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const method = match[1]?.toUpperCase() ?? "ROUTE";
      const route = match[2] ?? "unknown";
      const path = toPosix(relative(root, file));
      const afterDeclaration = content.slice(match.index + match[0].length);
      const nextRoute = afterDeclaration.search(
        /\b(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/u
      );
      const contextEnd =
        nextRoute === -1
          ? Math.min(content.length, match.index + 900)
          : match.index + match[0].length + nextRoute;
      const context = content.slice(match.index, contextEnd);
      let visibility: RouteRecord["visibility"] = "unknown";
      if (/\b(?:requireRole\s*\(\s*["']admin|isAdmin|role\s*===?\s*["']admin)/iu.test(context))
        visibility = "admin";
      else if (
        /\b(?:requireAuth|authenticate|getServerSession|session\.user|auth\.user)/u.test(context)
      )
        visibility = "authenticated";
      // Name-based visibility is an explicit low-confidence heuristic, never proof. A route is
      // not public merely because its path contains "login", "health", or "public".
      let nameHeuristic = false;
      if (visibility === "unknown" && /\/(?:internal|cron|webhooks?)(?:\/|$)/iu.test(route)) {
        visibility = "internal";
        nameHeuristic = true;
      } else if (
        visibility === "unknown" &&
        /\/(?:health|login|signup|public)(?:\/|$)/iu.test(route)
      ) {
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
  output.push(...(await frameworkRouteRecords(root, files)));
  return output;
}

/**
 * Bounded route adapters for frameworks whose routes are not literal Express registrations.
 * Each adapter states which adapter produced the record so coverage is auditable. Middleware
 * inheritance is not resolved, so visibility stays `unknown` unless a guard is directly visible.
 */
async function frameworkRouteRecords(root: string, files: string[]): Promise<RouteRecord[]> {
  const output: RouteRecord[] = [];
  const methods = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
  for (const file of files.filter((candidate) => /\.(?:[cm]?[jt]sx?)$/iu.test(candidate))) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    const path = toPosix(relative(root, file));

    // Next.js App Router: app/**/route.ts exporting HTTP method handlers.
    if (/(?:^|\/)app\/.*\/route\.[cm]?[jt]sx?$/iu.test(path)) {
      const segment = path
        .replace(/^.*?(?:^|\/)app\//iu, "/")
        .replace(/\/route\.[cm]?[jt]sx?$/iu, "")
        .replace(/\/\((?:[^/]+)\)/gu, "");
      for (const match of content.matchAll(
        new RegExp(`export\\s+(?:async\\s+)?function\\s+(${methods})\\b`, "gu")
      ))
        output.push(
          frameworkRoute(
            `${match[1]} ${segment || "/"}`,
            path,
            content,
            match.index,
            "nextjs-app-router"
          )
        );
    }

    // Next.js Pages Router: pages/api/**.ts default-exported handler.
    if (/(?:^|\/)pages\/api\/.*\.[cm]?[jt]sx?$/iu.test(path) && /export\s+default/u.test(content)) {
      const segment = path
        .replace(/^.*?(?:^|\/)pages\//iu, "/")
        .replace(/\.[cm]?[jt]sx?$/iu, "")
        .replace(/\/index$/u, "");
      output.push(
        frameworkRoute(`ROUTE ${segment || "/"}`, path, content, 0, "nextjs-pages-router")
      );
    }

    // NestJS controller decorators.
    const controller = /@Controller\s*\(\s*["'`]([^"'`]*)["'`]/u.exec(content);
    if (controller !== null) {
      const base = `/${(controller[1] ?? "").replace(/^\/+|\/+$/gu, "")}`;
      for (const match of content.matchAll(
        /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/gu
      )) {
        const suffix = (match[2] ?? "").replace(/^\/+/u, "");
        const route = `${base === "/" ? "" : base}/${suffix}`.replace(/\/+$/u, "") || "/";
        output.push(
          frameworkRoute(
            `${(match[1] ?? "ROUTE").toUpperCase()} ${route}`,
            path,
            content,
            match.index,
            "nestjs-decorators"
          )
        );
      }
    }

    // Fastify object-form route registration.
    for (const match of content.matchAll(
      /\.route\s*\(\s*\{[^}]*?method\s*:\s*["'`]([A-Za-z]+)["'`][^}]*?url\s*:\s*["'`]([^"'`]+)["'`]/gsu
    ))
      output.push(
        frameworkRoute(
          `${(match[1] ?? "ROUTE").toUpperCase()} ${match[2] ?? "unknown"}`,
          path,
          content,
          match.index,
          "fastify-route-object"
        )
      );
  }
  return output;
}

function frameworkRoute(
  name: string,
  path: string,
  content: string,
  index: number,
  adapter: string
): RouteRecord {
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

function record(
  name: string,
  type: string,
  options: {
    root?: string;
    location?: string;
    confidence: Confidence;
    evidence: string[];
  }
): ProfileRecord {
  return {
    name,
    type,
    ...(options.root === undefined ? {} : { root: options.root }),
    ...(options.location === undefined ? {} : { location: options.location }),
    confidence: options.confidence,
    evidence: options.evidence
  };
}

function uniqueRecords<T extends ProfileRecord>(records: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of records) {
    const key = `${item.name}\u0000${item.type}\u0000${item.root ?? item.location ?? ""}`;
    const current = byKey.get(key);
    if (current === undefined) byKey.set(key, item);
    else current.evidence = [...new Set([...current.evidence, ...item.evidence])].slice(0, 12);
  }
  return [...byKey.values()];
}

function lineForIndex(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderArchitectureMap(profile: ProjectProfile): string {
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
    .map(
      (application, index) =>
        `  A${index}["${escapeMermaid(application.name)} (${escapeMermaid(application.type)})"]`
    )
    .join("\n");
  const boundaryNodes = boundaries
    .map(
      (boundary, index) =>
        `  B${index}["${escapeMermaid(boundary.name)} (${escapeMermaid(boundary.type)})"]`
    )
    .join("\n");
  const edges = applications
    .flatMap((_application, appIndex) =>
      boundaries.map(
        (_boundary, boundaryIndex) =>
          `  A${appIndex} -. "evidence requires trace" .-> B${boundaryIndex}`
      )
    )
    .slice(0, 24)
    .join("\n");
  const evidence = [
    ...profile.applications,
    ...profile.routes,
    ...boundaries,
    ...profile.critical_workflows
  ]
    .map(
      (item) => `- **${item.name}** (${item.type}, ${item.confidence}): ${item.evidence.join(", ")}`
    )
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

function escapeMermaid(value: string): string {
  return value.replaceAll('"', "'");
}
