import type { CapabilityAssessment } from "./discovery-evidence.js";
import type { EvidenceArtifact, EvidenceEnvelope } from "./evidence-envelope.js";

export const STATUSES = [
  "PASS",
  "FAIL",
  "WARNING",
  "NOT_APPLICABLE",
  "NOT_VERIFIED",
  "BLOCKED"
] as const;
export type Status = (typeof STATUSES)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export type FindingLocation = {
  path: string;
  line?: number;
  end_line?: number;
};

export type EvidenceSnapshot = {
  path: string;
  sha256: string;
  line?: number;
  excerpt_hash?: string;
};

export type TraceEvidence = {
  source: string;
  sink: string;
  description: string;
};

export type VerificationAction =
  | {
      type: "analyzer";
      analyzer_id: string;
      finding_id: string;
      /** Optional for backwards compatibility with reports written before instance identity. */
      instance_id?: string;
      /** Repository-relative paths the original evidence came from; scopes re-analysis. */
      scope_paths?: string[];
      absence_proves_resolution: boolean;
    }
  | { type: "project-command"; command: string; required: boolean }
  | { type: "manual"; procedure: string };

export type VerificationPlan = {
  actions: VerificationAction[];
};

export const FIX_ATTEMPT_STATUSES = ["PLANNED", "APPLIED", "BLOCKED", "ROLLED_BACK"] as const;
export type FixAttemptStatus = (typeof FIX_ATTEMPT_STATUSES)[number];

/**
 * A fix attempt is recorded independently of the defect it targets. Refusing to fix a defect
 * never changes whether the defect was proven; it only records that remediation did not run.
 */
export type FixAttempt = {
  fix_id?: string;
  status: FixAttemptStatus;
  risk: "safe" | "risky" | "unsupported";
  reason: string;
  attempted_at: string;
  paths?: string[];
};

export type Finding = {
  id: string;
  section: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  status: Status;
  location: FindingLocation[];
  evidence: string[];
  impact: string;
  recommendation: string;
  safe_fix: boolean;
  verification: string[];
  standards: string[];
  analyzer_id?: string;
  /**
   * Stable per-occurrence identity: `<rule id>:<hash>`. The rule-level `id` is preserved for
   * backwards compatibility; `instance_id` distinguishes separate occurrences of one rule.
   */
  instance_id?: string;
  trace?: TraceEvidence[];
  evidence_snapshot?: EvidenceSnapshot[];
  verification_plan?: VerificationPlan;
  fix_attempts?: FixAttempt[];
};

export type Detection = {
  name: string;
  confidence: Confidence;
  evidence: string[];
};

export type ProfileRecord = {
  name: string;
  type: string;
  root?: string;
  location?: string;
  confidence: Confidence;
  evidence: string[];
};

export type RouteRecord = ProfileRecord & {
  visibility: "public" | "authenticated" | "admin" | "internal" | "unknown";
};

export type ProjectProfile = {
  schema_version: 2;
  root: string;
  generated_at: string;
  detections: Detection[];
  capabilities: Record<string, Detection>;
  /**
   * Classified discovery evidence with explicit activation weights. Optional for backwards
   * compatibility with profiles written before evidence classification existed.
   */
  capability_assessments?: CapabilityAssessment[];
  repository: ProfileRecord;
  workspaces: ProfileRecord[];
  applications: ProfileRecord[];
  languages: ProfileRecord[];
  frameworks: ProfileRecord[];
  package_managers: ProfileRecord[];
  databases: ProfileRecord[];
  orms: ProfileRecord[];
  authentication: ProfileRecord[];
  sessions: ProfileRecord[];
  authorization: ProfileRecord[];
  roles: ProfileRecord[];
  tenant_boundaries: ProfileRecord[];
  routes: RouteRecord[];
  storage: ProfileRecord[];
  upload_pipelines: ProfileRecord[];
  caches: ProfileRecord[];
  queues: ProfileRecord[];
  scheduled_jobs: ProfileRecord[];
  tests: ProfileRecord[];
  ci: ProfileRecord[];
  observability: ProfileRecord[];
  integrations: ProfileRecord[];
  ai_providers: ProfileRecord[];
  payment_providers: ProfileRecord[];
  hosting: ProfileRecord[];
  deployment: ProfileRecord[];
  environment_templates: ProfileRecord[];
  critical_workflows: ProfileRecord[];
};

export type CommandDefinition = {
  name: string;
  executable: string;
  args: string[];
  source: string;
  definition: string;
};

export type CliOptions = {
  cwd: string;
  json: boolean;
  dryRun: boolean;
  global: boolean;
  offline: boolean;
  allowRun: boolean;
  safe: boolean;
  scope?: string;
  base?: string;
  risk?: string;
  severity?: string;
  platform?: string;
  output?: string;
  /** `--url`: address of an already-running application to collect runtime evidence from. */
  url?: string;
  /** `--evidence-dir`: repository-relative directory for collected runtime evidence. */
  evidenceDir?: string;
  /** `--check`: repeatable planned-check selector. Empty means "every applicable check". */
  checks?: string[];
  /** `--skip-check`: repeatable planned-check exclusion. */
  skipChecks?: string[];
};

export const GATE_EVIDENCE_TYPES = [
  "secret-scan",
  "dependency-audit",
  "lockfile-inspection",
  "license-scan",
  "authorization-evaluation",
  "tenant-isolation-evaluation",
  "upload-security-evaluation",
  "application-security-static-analysis",
  "migration-validation",
  "project-test",
  "release-artifact-validation"
] as const;
export type GateEvidenceType = (typeof GATE_EVIDENCE_TYPES)[number];
export type GateEvidenceStatus = Extract<
  Status,
  "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED" | "NOT_APPLICABLE"
>;

/** Semantically typed evidence consumed by release gates. */
export type GateEvidence = {
  evidence_type: GateEvidenceType;
  producer: string;
  scope: string[];
  timestamp: string;
  revision: string;
  status: GateEvidenceStatus;
  relevant_instance_ids: string[];
  absence_proves_success: boolean;
  limitations: string[];
  /**
   * v0.3 trust boundary. Records without this envelope remain readable for history, but Ship
   * treats them as untrusted diagnostics rather than release evidence.
   */
  envelope?: EvidenceEnvelope;
};

/**
 * Module applicability is deliberately expressed as two independent axes.
 *
 * `capability_status` answers "does this capability exist in the project at all?" and is the ONLY
 * axis that may justify NOT_APPLICABLE. `selection_status` answers "did this run audit it?" and
 * never proves absence: a module skipped because its files did not change, or because a risk
 * filter narrowed the run, is unaudited — not inapplicable.
 */
export const MODULE_CAPABILITY_STATUSES = ["PRESENT", "ABSENT", "UNKNOWN"] as const;
export type ModuleCapabilityStatus = (typeof MODULE_CAPABILITY_STATUSES)[number];

export const MODULE_SELECTION_STATUSES = [
  "SELECTED",
  "OUT_OF_CHANGED_SCOPE",
  "EXCLUDED_BY_RISK",
  "NOT_REQUESTED"
] as const;
export type ModuleSelectionStatus = (typeof MODULE_SELECTION_STATUSES)[number];

export type ModuleDecision = {
  module: string;
  capability_status: ModuleCapabilityStatus;
  selection_status: ModuleSelectionStatus;
  reasons: string[];
  evidence: string[];
  /** True only when an operator named this module directly rather than through `all`. */
  explicitly_selected?: boolean;
};

export const PLANNED_CHECK_STATUSES = ["RUN", "NOT_RUN", "BLOCKED", "NOT_APPLICABLE"] as const;
export type PlannedCheckStatus = (typeof PLANNED_CHECK_STATUSES)[number];

export const NETWORK_POLICIES = ["OFFLINE_SAFE", "NETWORK_REQUIRED", "UNKNOWN"] as const;
export type NetworkPolicy = (typeof NETWORK_POLICIES)[number];

/**
 * A check that the audit intended to perform. Planning is recorded before execution so that a
 * check which never ran is visible as a gap instead of silently missing from the report.
 */
export type PlannedCheck = {
  check_id: string;
  module: string;
  command?: string[];
  source: string;
  status: PlannedCheckStatus;
  reason?: string;
  requires_authorization: boolean;
  network_policy: NetworkPolicy;
};

export const RUNTIME_EVIDENCE_STATUSES = ["PASS", "FAIL", "BLOCKED", "NOT_VERIFIED"] as const;
export type RuntimeEvidenceStatus = (typeof RUNTIME_EVIDENCE_STATUSES)[number];

/**
 * Evidence produced by observing the running system. `limitations` is mandatory for any
 * non-PASS status so that partial captures can never be read as a clean result.
 */
export type RuntimeEvidence = {
  evidence_id: string;
  evidence_type: string;
  status: RuntimeEvidenceStatus;
  revision: string;
  artifact_paths: string[];
  hashes: string[];
  /** v0.3 path/hash/media-type tuples. Legacy parallel lists remain available for migration. */
  artifacts?: EvidenceArtifact[];
  limitations: string[];
};

export const TOOL_OWNERSHIPS = ["forge-owned", "project-owned", "external"] as const;
export type ToolOwnership = (typeof TOOL_OWNERSHIPS)[number];

export const TOOL_TRUST_LEVELS = ["trusted", "untrusted", "unknown"] as const;
export type ToolTrustLevel = (typeof TOOL_TRUST_LEVELS)[number];

export const TOOL_VERSION_SOURCES = ["observed", "declared", "unknown"] as const;
export type ToolVersionSource = (typeof TOOL_VERSION_SOURCES)[number];

/**
 * Provenance of a tool whose output the report relies on. An unknown version is recorded as
 * `version_source: "unknown"` rather than guessed, because an unverifiable version cannot support
 * a claim about what the tool checked.
 */
export type ToolRecord = {
  tool_id: string;
  name: string;
  ownership: ToolOwnership;
  trust: ToolTrustLevel;
  version: string;
  version_source: ToolVersionSource;
  invocation?: string[];
  limitations: string[];
};

export type AnalyzerCoverage = {
  status: "PASS" | "NOT_VERIFIED";
  module: string;
  language: string;
  framework: string;
  analyzer_id: string;
  coverage: "executable" | "partial" | "none";
  supported_shapes: string[];
  unsupported_shapes: string[];
  required_adapter?: string;
};

export type InspectionResult = {
  tool: string;
  root: string;
  generated_at: string;
  observations: Observation[];
  findings: Finding[];
  gate_evidence: GateEvidence[];
  analyzer_coverage: AnalyzerCoverage[];
};

export type Observation = {
  category: string;
  path: string;
  line?: number;
  detail: string;
  confidence: Confidence;
};

export type InstallFile = {
  hash: string;
  platform: string;
  owned: boolean;
};

export type InstallManifest = {
  schemaVersion: 1;
  packageVersion: string;
  root: string;
  installedAt: string;
  files: Record<string, InstallFile>;
};
