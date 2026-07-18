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
};

export type Detection = {
  name: string;
  confidence: Confidence;
  evidence: string[];
};

export type ProjectProfile = {
  schema_version: 1;
  root: string;
  generated_at: string;
  detections: Detection[];
  capabilities: Record<string, Detection>;
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
