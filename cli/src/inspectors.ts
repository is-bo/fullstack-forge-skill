import { readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { runAnalyzers, type AnalyzerScope } from "./analyzers.js";
import { MODULE_SLUGS, SECTION_CAPABILITY, type ModuleSlug, type ToolName } from "./constants.js";
import type {
  Finding,
  GateEvidence,
  GateEvidenceType,
  InspectionResult,
  Observation,
  ProjectProfile
} from "./types.js";
import {
  isTestSourcePath,
  lineNumber,
  readTextIfPresent,
  toPosix,
  utcNow,
  walkFiles
} from "./utils.js";

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

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".graphql",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mjs",
  ".php",
  ".prisma",
  ".py",
  ".rb",
  ".rs",
  ".sql",
  ".svelte",
  ".tf",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".xml",
  ".yaml",
  ".yml"
]);

type Pattern = { category: string; regex: RegExp; detail: string };

const TOOL_PATTERNS: Partial<Record<ToolName, Pattern[]>> = {
  "inspect-routes": [
    {
      category: "route",
      regex: /\b(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(/gu,
      detail: "Router declaration"
    },
    {
      category: "route",
      regex: /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)\b/gu,
      detail: "File-based HTTP handler"
    },
    {
      category: "route",
      regex: /@(?:Get|Post|Put|Patch|Delete)\s*\(/gu,
      detail: "Decorated HTTP handler"
    }
  ],
  "inspect-auth-boundaries": [
    {
      category: "authentication",
      regex:
        /\b(?:authenticate|requireAuth|authMiddleware|getServerSession|verifyToken|session)\b/giu,
      detail: "Authentication boundary signal"
    },
    {
      category: "session-cookie",
      regex: /\b(?:httpOnly|sameSite|secure|maxAge)\b/gu,
      detail: "Session or cookie control"
    }
  ],
  "inspect-authorization": [
    {
      category: "authorization",
      regex:
        /\b(?:authorize|permission|policy|canAccess|requireRole|isAdmin|tenantId|organizationId)\b/giu,
      detail: "Authorization or scope signal"
    }
  ],
  "inspect-upload-pipeline": [
    {
      category: "upload",
      regex: /\b(?:multipart|multer|formidable|upload|presigned|content-type|mime|fileSize)\b/giu,
      detail: "Upload pipeline signal"
    }
  ],
  "inspect-database-schema": [
    {
      category: "schema",
      regex:
        /\b(?:CREATE\s+TABLE|ALTER\s+TABLE|model\s+\w+\s*\{|Schema\s*\(|createTable|addColumn)\b/giu,
      detail: "Schema or migration declaration"
    },
    {
      category: "constraint",
      regex: /\b(?:FOREIGN\s+KEY|UNIQUE|CHECK|NOT\s+NULL|@@index|@@unique)\b/giu,
      detail: "Database constraint or index"
    }
  ],
  "inspect-query-patterns": [
    {
      category: "query",
      regex: /\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^;\n]*/giu,
      detail: "SQL statement"
    },
    {
      category: "query",
      regex: /\.(?:findMany|findOne|findUnique|query|execute|raw)\s*\(/giu,
      detail: "Data-access call"
    }
  ],
  "inspect-cache-usage": [
    {
      category: "cache",
      regex: /\b(?:cache|redis|memoize|revalidate|stale-while-revalidate|ttl)\b/giu,
      detail: "Cache signal"
    }
  ],
  "inspect-deployment-config": [
    {
      category: "deployment",
      regex: /\b(?:readiness|liveness|replicas|healthcheck|deploy|rollback|migration)\b/giu,
      detail: "Deployment control signal"
    }
  ]
};

const SECTION_KEYWORDS: Partial<Record<ModuleSlug, RegExp>> = {
  requirements: /acceptance|invariant|business rule|duplicate|recovery/giu,
  architecture: /boundary|service|adapter|repository|domain|architecture/giu,
  code: /TODO|FIXME|unknown\b|any\b|catch\s*\(/gu,
  ui: /className|stylesheet|@media|viewport|theme|design token/giu,
  ux: /loading|empty|error|success|retry|cancel|undo|confirm/giu,
  accessibility: /aria-|role=|alt=|label|focus|tabindex/giu,
  i18n: /i18n|locale|translate|formatMessage|Intl\./gu,
  seo: /canonical|robots|sitemap|metadata|schema\.org/giu,
  frontend: /hydrate|suspense|errorBoundary|useEffect|fetch\s*\(/giu,
  api: /openapi|router|controller|endpoint|status\s*\(/giu,
  jobs: /queue|worker|cron|retry|dead.?letter|idempoten/giu,
  integrations: /webhook|third.?party|timeout|circuit|signature/giu,
  auth: /login|logout|session|password|oauth|mfa|token/giu,
  authorization: /authorize|permission|policy|role|owner|tenant/giu,
  security: /sanitize|escape|csrf|cors|secret|encrypt|allowlist/giu,
  privacy: /personal|consent|retention|deletion|export|privacy/giu,
  tenancy: /tenant|organization|workspaceId/giu,
  uploads: /upload|multipart|mime|fileSize|presigned/giu,
  database: /migration|schema|foreign key|unique|transaction/giu,
  queries: /select|findMany|query|execute|pagination|limit/giu,
  cache: /cache|redis|ttl|invalidate|revalidate/giu,
  storage: /bucket|object|blob|signed.?url|storage/giu,
  testing: /describe\s*\(|test\s*\(|it\s*\(|pytest|assert/giu,
  performance: /performance|latency|bundle|profile|benchmark/giu,
  scale: /autoscal|backpressure|partition|quota|concurrency/giu,
  observability: /trace|metric|span|logger|sentry|opentelemetry/giu,
  reliability: /timeout|retry|circuit|health|graceful|fallback/giu,
  recovery: /backup|restore|rpo|rto|disaster/giu,
  deployment: /deploy|rollback|readiness|production|environment/giu,
  infrastructure: /terraform|pulumi|cloudformation|kubernetes|iam/giu,
  "supply-chain": /lockfile|provenance|sbom|checksum|dependency/giu,
  cost: /cost|budget|billing|retention|egress/giu,
  docs: /README|documentation|runbook|architecture decision/giu,
  analytics: /analytics|track\s*\(|event|experiment/giu,
  notifications: /email|sms|push|notification|unsubscribe/giu,
  ai: /openai|anthropic|prompt|embedding|model|tool call/giu,
  payments: /stripe|payment|invoice|refund|subscription|currency/giu,
  realtime: /websocket|socket\.io|eventsource|presence|subscribe/giu,
  offline: /service.?worker|indexeddb|offline|sync|conflict/giu
};

export async function inspectWithTool(
  tool: ToolName,
  root: string,
  scope?: AnalyzerScope
): Promise<InspectionResult> {
  if (tool === "inspect-env-template") return inspectEnvTemplates(root, scope);
  if (tool === "scan-secret-patterns") return scanSecretPatterns(root, scope);
  if (tool === "inspect-dependencies") return inspectDependencies(root);
  if (tool === "inspect-ci")
    return inspectNamedFiles(root, tool, isCiFile, "CI configuration", scope);
  if (tool === "inspect-platform-skills") return inspectPlatformSkills(root, scope);
  const patterns = TOOL_PATTERNS[tool];
  if (patterns !== undefined) return scanPatterns(root, tool, patterns, scope);
  return emptyResult(tool, root);
}

export async function inspectSection(
  section: ModuleSlug,
  root: string,
  profile: ProjectProfile,
  scope?: AnalyzerScope
): Promise<InspectionResult> {
  const capability = SECTION_CAPABILITY[section];
  if (capability !== undefined && profile.capabilities[capability] === undefined) {
    return {
      ...emptyResult(`inspect-${section}`, root),
      findings: [notApplicableFinding(section, capability)]
    };
  }
  const analyzerSections = new Set<ModuleSlug>([
    "accessibility",
    "ai",
    "auth",
    "authorization",
    "cache",
    "deployment",
    "frontend",
    "integrations",
    "payments",
    "queries",
    "security",
    "tenancy",
    "uploads"
  ]);
  const analyzerRuns = analyzerSections.has(section)
    ? await runAnalyzers(section, root, scope)
    : [];
  const analyzerFindings = analyzerRuns.flatMap((run) => run.findings);
  const analyzerObservations: Observation[] = analyzerRuns
    .filter((run) => run.supported_files > 0)
    .map((run) => ({
      category: "bounded-analyzer",
      path: ".forge/project-profile.json",
      detail: `${run.analyzer_id} parsed ${run.supported_files} supported file(s)`,
      confidence: "HIGH"
    }));
  const specialized = sectionTool(section);
  if (specialized !== undefined) {
    const inventory = await inspectWithTool(specialized, root, scope);
    return result(
      `inspect-${section}`,
      root,
      [...analyzerObservations, ...inventory.observations],
      [...analyzerFindings, ...inventory.findings],
      inventory.gate_evidence,
      inventory.input_paths
    );
  }
  const regex = SECTION_KEYWORDS[section];
  if (regex === undefined) {
    const base = result(`inspect-${section}`, root, analyzerObservations, analyzerFindings);
    return section === "security"
      ? mergeInspectionResults(base, await scanSecretPatterns(root, scope))
      : base;
  }
  const inventory = await scanPatterns(
    root,
    `inspect-${section}`,
    [{ category: section, regex, detail: `${section} implementation signal` }],
    scope
  );
  const base = result(
    `inspect-${section}`,
    root,
    [...analyzerObservations, ...inventory.observations],
    [...analyzerFindings, ...inventory.findings],
    [],
    inventory.input_paths
  );
  return section === "security"
    ? mergeInspectionResults(base, await scanSecretPatterns(root, scope))
    : base;
}

async function scanPatterns(
  root: string,
  tool: string,
  patterns: Pattern[],
  scope?: AnalyzerScope
): Promise<InspectionResult> {
  const observations: Observation[] = [];
  const files = await sourceFiles(root, scope);
  const inputPaths: string[] = [];
  for (const file of files) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    inputPaths.push(toPosix(relative(root, file)));
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      for (const match of content.matchAll(pattern.regex)) {
        observations.push({
          category: pattern.category,
          path: toPosix(relative(root, file)),
          line: lineNumber(content, match.index),
          detail: pattern.detail,
          confidence: "MEDIUM"
        });
        if (observations.length >= 500) return result(tool, root, observations, [], [], inputPaths);
      }
    }
  }
  return result(tool, root, observations, [], [], inputPaths);
}

async function inspectEnvTemplates(root: string, scope?: AnalyzerScope): Promise<InspectionResult> {
  const observations: Observation[] = [];
  const findings: Finding[] = [];
  const inputPaths: string[] = [];
  const files = (await sourceFiles(root, scope)).filter((file) =>
    /(?:^|[\\/])\.env(?:\.(?:example|sample|template|defaults))?$|\.env\.example$/iu.test(file)
  );
  for (const file of files) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    inputPaths.push(toPosix(relative(root, file)));
    for (const [index, line] of content.split(/\r?\n/u).entries()) {
      const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u.exec(line);
      if (match === null) continue;
      const value = (match[2] ?? "").trim().replace(/^['"]|['"]$/gu, "");
      observations.push({
        category: "environment-variable",
        path: toPosix(relative(root, file)),
        line: index + 1,
        detail: `${match[1]} is declared (value redacted)`,
        confidence: "HIGH"
      });
      if (looksLikeSecret(value)) {
        findings.push(
          finding(
            "ENV",
            findings.length + 1,
            "security",
            "Template contains an actual-looking secret value",
            "HIGH",
            "MEDIUM",
            "FAIL",
            toPosix(relative(root, file)),
            index + 1,
            "A non-placeholder credential-like value appears in an environment template; the value is intentionally redacted.",
            "Published templates can disclose credentials.",
            "Replace it with a clear placeholder and rotate the value if it was ever valid.",
            true,
            ["Re-scan templates and confirm the credential is revoked where applicable"],
            ["OWASP Secrets Management Cheat Sheet"]
          )
        );
      }
    }
  }
  return result("inspect-env-template", root, observations, findings, [], inputPaths);
}

async function scanSecretPatterns(root: string, scope?: AnalyzerScope): Promise<InspectionResult> {
  const observations: Observation[] = [];
  const findings: Finding[] = [];
  const inputPaths: string[] = [];
  const patterns = [
    {
      name: "private key header",
      regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
      severity: "CRITICAL" as const,
      confidence: "HIGH" as const
    },
    {
      name: "AWS access key identifier",
      regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
      severity: "HIGH" as const,
      confidence: "HIGH" as const
    },
    {
      name: "credential assignment",
      regex:
        /\b(?:[a-z0-9_]*(?:api[_-]?key|secret|token|password))\s*[:=]\s*["']([^"'\r\n]{12,})["']/giu,
      severity: "HIGH" as const,
      confidence: "LOW" as const
    }
  ];
  const files = await sourceFiles(root, scope);
  for (const file of files) {
    const content = await readTextIfPresent(file);
    if (content === undefined) continue;
    inputPaths.push(toPosix(relative(root, file)));
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      for (const match of content.matchAll(pattern.regex)) {
        const candidate = match[1] ?? match[0];
        const path = toPosix(relative(root, file));
        if (
          isPlaceholder(candidate) ||
          isExplicitlySyntheticTestValue(candidate, path) ||
          (pattern.confidence === "LOW" && isTestSourcePath(path))
        )
          continue;
        const line = lineNumber(content, match.index);
        observations.push({
          category: "secret-pattern",
          path,
          line,
          detail: `${pattern.name} detected; value redacted`,
          confidence: pattern.confidence
        });
        findings.push(
          finding(
            "SECRET",
            findings.length + 1,
            "security",
            `Potential ${pattern.name} in source`,
            pattern.severity,
            pattern.confidence,
            "FAIL",
            path,
            line,
            `Pattern matched at ${path}:${line}; value redacted.`,
            "A committed credential may enable unauthorized access.",
            "Triage without exposing the value, remove it from distributable content, and rotate if valid.",
            false,
            [
              "Re-run secret scanning",
              "Verify revocation through the provider without logging the credential"
            ],
            ["OWASP Secrets Management Cheat Sheet", "NIST SSDF"]
          )
        );
      }
    }
  }
  return result("scan-secret-patterns", root, observations, findings, [], inputPaths);
}

async function inspectDependencies(root: string): Promise<InspectionResult> {
  const observations: Observation[] = [];
  const inputPaths: string[] = [];
  const manifestPath = join(root, "package.json");
  const content = await readTextIfPresent(manifestPath);
  if (content !== undefined) {
    inputPaths.push("package.json");
    try {
      const manifest = JSON.parse(content) as Record<string, unknown>;
      observations.push({
        category: "dependency-manifest",
        path: "package.json",
        detail: "Root package manifest parsed",
        confidence: "HIGH"
      });
      for (const group of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies"
      ]) {
        const dependencies = manifest[group];
        if (
          typeof dependencies !== "object" ||
          dependencies === null ||
          Array.isArray(dependencies)
        )
          continue;
        for (const [name, version] of Object.entries(dependencies)) {
          observations.push({
            category: group,
            path: "package.json",
            detail: `${name}@${String(version)}`,
            confidence: "HIGH"
          });
        }
      }
    } catch {
      return result(
        "inspect-dependencies",
        root,
        observations,
        [
          finding(
            "DEPS",
            1,
            "supply-chain",
            "package.json is invalid JSON",
            "HIGH",
            "HIGH",
            "FAIL",
            "package.json",
            1,
            "JSON parsing failed.",
            "Dependency installation and tooling are unreliable.",
            "Correct the manifest without changing dependency intent.",
            true,
            ["Parse package.json and run the package manager's frozen install"],
            ["NIST SSDF"]
          )
        ],
        [],
        inputPaths
      );
    }
  }
  for (const lock of [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "uv.lock",
    "poetry.lock",
    "Cargo.lock",
    "go.sum"
  ]) {
    if ((await readTextIfPresent(join(root, lock))) !== undefined) {
      inputPaths.push(lock);
      observations.push({
        category: "lockfile",
        path: lock,
        detail: "Lockfile detected",
        confidence: "HIGH"
      });
    }
  }
  return result("inspect-dependencies", root, observations, [], [], inputPaths);
}

async function inspectNamedFiles(
  root: string,
  tool: string,
  predicate: (relativePath: string) => boolean,
  detail: string,
  scope?: AnalyzerScope
): Promise<InspectionResult> {
  const files = await sourceFiles(root, scope);
  const observations = files
    .map((file) => toPosix(relative(root, file)))
    .filter(predicate)
    .map((path): Observation => ({ category: tool, path, detail, confidence: "HIGH" }));
  return result(tool, root, observations, [], [], relativePaths(root, files));
}

async function inspectPlatformSkills(
  root: string,
  scope?: AnalyzerScope
): Promise<InspectionResult> {
  const observations: Observation[] = [];
  const findings: Finding[] = [];
  const inputPaths: string[] = [];
  const roots = [
    ".agents/skills",
    ".claude/skills",
    ".cursor/skills",
    ".gemini/skills",
    ".github/skills",
    ".windsurf/skills"
  ];
  for (const relRoot of roots) {
    const absolute = join(root, ...relRoot.split("/"));
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(absolute, entry.name, "SKILL.md");
      const content = await readTextIfPresent(skillPath);
      if (content === undefined) continue;
      const path = toPosix(relative(root, skillPath));
      if (scope !== undefined && !scope.has(path)) continue;
      inputPaths.push(path);
      observations.push({
        category: "agent-skill",
        path,
        detail: `Skill directory ${entry.name}`,
        confidence: "HIGH"
      });
      if (
        !/^---\r?\n[\s\S]*?\r?\n---\r?\n/u.test(content) ||
        !/^name:\s*[a-z0-9-]+\s*$/mu.test(content) ||
        !/^description:\s*\S+/mu.test(content)
      ) {
        findings.push(
          finding(
            "SKILL",
            findings.length + 1,
            "docs",
            "Agent Skill frontmatter is incomplete",
            "MEDIUM",
            "HIGH",
            "FAIL",
            path,
            1,
            "SKILL.md lacks a valid frontmatter block with name and description.",
            "Agents may not discover or activate the skill.",
            "Add standards-compliant name and description frontmatter.",
            true,
            ["Run validate-skill"],
            ["Agent Skills Specification"]
          )
        );
      }
    }
  }
  return result("inspect-platform-skills", root, observations, findings, [], inputPaths);
}

async function sourceFiles(root: string, scope?: AnalyzerScope): Promise<string[]> {
  return (
    await walkFiles(root, {
      exclude: EXCLUDED,
      maxBytes: 768 * 1024,
      maxFiles: 10_000,
      maxTotalBytes: 128 * 1024 * 1024,
      maxDepth: 64
    })
  ).filter((file) => {
    const extension = extname(file).toLowerCase();
    const name = basename(file);
    const path = toPosix(relative(root, file));
    return (
      (scope === undefined || scope.has(path)) &&
      (TEXT_EXTENSIONS.has(extension) ||
        /^(?:Dockerfile|Makefile|Procfile|Jenkinsfile|\.env(?:\..+)?)$/u.test(name))
    );
  });
}

function sectionTool(section: ModuleSlug): ToolName | undefined {
  const map: Partial<Record<ModuleSlug, ToolName>> = {
    api: "inspect-routes",
    auth: "inspect-auth-boundaries",
    authorization: "inspect-authorization",
    uploads: "inspect-upload-pipeline",
    database: "inspect-database-schema",
    queries: "inspect-query-patterns",
    cache: "inspect-cache-usage",
    deployment: "inspect-deployment-config",
    "supply-chain": "inspect-dependencies"
  };
  return map[section];
}

function isCiFile(path: string): boolean {
  return /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.yml|\.circleci\/config\.yml|azure-pipelines\.yml|Jenkinsfile)$/iu.test(
    path
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

function isExplicitlySyntheticTestValue(value: string, path: string): boolean {
  if (!isTestSourcePath(path)) return false;
  const normalized = value.toLowerCase();
  return ["example", "fake", "fixture", "placeholder", "redacted", "sentinel", "test"].some(
    (marker) => normalized.includes(marker)
  );
}

function notApplicableFinding(section: ModuleSlug, capability: string): Finding {
  return {
    id: `FF-${section.toUpperCase()}-001`,
    section,
    title: `${section} module is not applicable to detected scope`,
    severity: "INFO",
    confidence: "MEDIUM",
    status: "NOT_APPLICABLE",
    location: [{ path: ".forge/project-profile.json" }],
    evidence: [`Discovery did not detect the ${capability} capability.`],
    impact: "No audit impact within the detected scope.",
    recommendation: "Re-run discovery if the repository or runtime boundary changes.",
    safe_fix: false,
    verification: [`Add direct ${capability} evidence and re-run forge ${section} audit.`],
    standards: ["Fullstack Forge evidence protocol"]
  };
}

function finding(
  prefix: string,
  number: number,
  section: string,
  title: string,
  severity: Finding["severity"],
  confidence: Finding["confidence"],
  status: Finding["status"],
  path: string,
  line: number,
  evidence: string,
  impact: string,
  recommendation: string,
  safeFix: boolean,
  verification: string[],
  standards: string[]
): Finding {
  return {
    id: `FF-${prefix}-${String(number).padStart(3, "0")}`,
    section,
    title,
    severity,
    confidence,
    status,
    location: [{ path, line }],
    evidence: [evidence],
    impact,
    recommendation,
    safe_fix: safeFix,
    verification,
    standards
  };
}

function result(
  tool: string,
  root: string,
  observations: Observation[],
  findings: Finding[],
  inheritedEvidence: GateEvidence[] = [],
  inputPaths: string[] = []
): InspectionResult {
  return {
    tool,
    root,
    generated_at: utcNow(),
    input_paths: [...new Set(inputPaths)].sort(),
    observations,
    findings,
    gate_evidence: [...inheritedEvidence, ...evidenceForResult(tool, observations, findings)],
    analyzer_coverage: []
  };
}

function mergeInspectionResults(
  primary: InspectionResult,
  additional: InspectionResult
): InspectionResult {
  return {
    ...primary,
    input_paths: [...new Set([...primary.input_paths, ...additional.input_paths])].sort(),
    observations: [...primary.observations, ...additional.observations],
    findings: [...primary.findings, ...additional.findings],
    gate_evidence: [...primary.gate_evidence, ...additional.gate_evidence],
    analyzer_coverage: [...primary.analyzer_coverage, ...additional.analyzer_coverage]
  };
}

function relativePaths(root: string, files: string[]): string[] {
  return files.map((file) => toPosix(relative(root, file)));
}

function evidenceForResult(
  tool: string,
  observations: Observation[],
  findings: Finding[]
): GateEvidence[] {
  const types: GateEvidenceType[] = [];
  if (tool === "scan-secret-patterns") types.push("secret-scan");
  if (tool === "inspect-dependencies") types.push("dependency-audit", "lockfile-inspection");
  if (tool === "inspect-authorization") types.push("authorization-evaluation");
  if (tool === "inspect-tenancy") types.push("tenant-isolation-evaluation");
  if (tool === "inspect-uploads") types.push("upload-security-evaluation");
  if (tool === "inspect-security") types.push("application-security-static-analysis");
  if (["inspect-database", "inspect-deployment"].includes(tool)) types.push("migration-validation");
  return types.map((evidenceType) => {
    const relevant = findings.filter((finding) => evidenceMatchesSection(evidenceType, finding));
    const failed = relevant.some((finding) => ["FAIL", "WARNING"].includes(finding.status));
    const absenceProvesSuccess = ["secret-scan", "lockfile-inspection"].includes(evidenceType);
    const hasRequiredInput =
      evidenceType === "secret-scan"
        ? true
        : evidenceType === "lockfile-inspection"
          ? observations.some((observation) => observation.category === "lockfile")
          : evidenceType === "dependency-audit"
            ? observations.some((observation) => observation.category === "dependency-manifest")
            : observations.length > 0 || relevant.length > 0;
    return {
      evidence_type: evidenceType,
      producer: tool,
      scope: evidenceScope(observations, relevant),
      timestamp: utcNow(),
      revision: "working-tree:pending",
      status: failed ? "FAIL" : absenceProvesSuccess && hasRequiredInput ? "PASS" : "NOT_VERIFIED",
      relevant_instance_ids: relevant.map((finding) => finding.instance_id ?? finding.id).sort(),
      absence_proves_success: absenceProvesSuccess,
      limitations: evidenceLimitations(evidenceType, hasRequiredInput)
    };
  });
}

function evidenceScope(observations: Observation[], findings: Finding[]): string[] {
  const paths = [
    ...new Set([
      ...observations.map((observation) => observation.path),
      ...findings.flatMap((finding) => finding.location.map((location) => location.path))
    ])
  ].sort();
  return paths.length > 0 ? paths : ["repository"];
}

function evidenceMatchesSection(type: GateEvidenceType, finding: Finding): boolean {
  const section: Partial<Record<GateEvidenceType, string[]>> = {
    "secret-scan": ["security"],
    "dependency-audit": ["supply-chain"],
    "lockfile-inspection": ["supply-chain"],
    "authorization-evaluation": ["authorization"],
    "tenant-isolation-evaluation": ["tenancy"],
    "upload-security-evaluation": ["uploads"],
    "application-security-static-analysis": ["security"],
    "migration-validation": ["database", "deployment"]
  };
  return section[type]?.includes(finding.section) ?? false;
}

function evidenceLimitations(type: GateEvidenceType, hasInput: boolean): string[] {
  if (!hasInput) return [`No applicable input was found for ${type}.`];
  if (type === "secret-scan")
    return [
      "Pattern scanning cannot prove provider-side validity, history cleanup, or runtime rotation."
    ];
  if (type === "dependency-audit")
    return [
      "Manifest inventory is not a vulnerability-database query; execute the project audit command."
    ];
  if (type === "lockfile-inspection")
    return ["Lockfile presence does not prove dependency safety or reproducible installation."];
  return [
    "Bounded static analysis does not prove runtime, cross-file, provider, or operator behavior."
  ];
}

function emptyResult(tool: string, root: string): InspectionResult {
  return result(tool, root, [], []);
}

export function isModuleSlug(value: string): value is ModuleSlug {
  return (MODULE_SLUGS as readonly string[]).includes(value);
}
