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
      absence_proves_resolution: boolean;
    }
  | { type: "project-command"; command: string; required: boolean }
  | { type: "manual"; procedure: string };

export type VerificationPlan = {
  actions: VerificationAction[];
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
  trace?: TraceEvidence[];
  evidence_snapshot?: EvidenceSnapshot[];
  verification_plan?: VerificationPlan;
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
};

export type InspectionResult = {
  tool: string;
  root: string;
  generated_at: string;
  observations: Observation[];
  findings: Finding[];
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
