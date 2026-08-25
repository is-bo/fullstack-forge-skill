const WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9][A-Za-z0-9_.-]*\.ya?ml$/u;
const WORKFLOW_RUN_PATH =
  /^\.github\/workflows\/[A-Za-z0-9][A-Za-z0-9_.-]*\.ya?ml(?:@[A-Za-z0-9._/-]+)?$/u;

// These are repository identities, not merely display labels. A run called "CI" from a forked
// or renamed workflow must never satisfy the release gate.
export const REQUIRED_WORKFLOW_IDENTITIES = Object.freeze({
  CI: Object.freeze({ name: "CI", path: ".github/workflows/ci.yml" }),
  CodeQL: Object.freeze({ name: "CodeQL", path: ".github/workflows/codeql.yml" })
});

export function verifyRequiredWorkflowRuns(
  response,
  { sha, required, requiredPaths, workflowPaths } = {}
) {
  if (!/^[a-f0-9]{40}$/u.test(sha))
    throw new Error("Required-workflow verification needs a full commit SHA");
  const requirements = normalizeRequirements(required, requiredPaths ?? workflowPaths);
  const pages = normalizePages(response);
  const runs = [];
  const runIds = new Set();
  for (const page of pages) {
    if (!isRecord(page) || !Array.isArray(page.workflow_runs))
      throw new Error("GitHub Actions response is malformed; required checks are unproven");
    for (const run of page.workflow_runs) {
      if (
        !isRecord(run) ||
        !Number.isSafeInteger(run.id) ||
        typeof run.name !== "string" ||
        typeof run.head_sha !== "string" ||
        typeof run.event !== "string" ||
        typeof run.status !== "string" ||
        (run.conclusion !== null && typeof run.conclusion !== "string") ||
        (run.path !== undefined &&
          (typeof run.path !== "string" || !WORKFLOW_RUN_PATH.test(run.path))) ||
        (run.workflow_id !== undefined && !Number.isSafeInteger(run.workflow_id))
      )
        throw new Error("GitHub Actions response contains a malformed run; checks are unproven");
      if (runIds.has(run.id))
        throw new Error("GitHub Actions response contains duplicate run IDs; checks are unproven");
      runIds.add(run.id);
      if (run.head_sha !== sha || run.event !== "push")
        throw new Error("GitHub Actions returned a run outside the exact push SHA boundary");
      runs.push(run);
    }
  }
  const evidence = [];
  for (const requirement of requirements) {
    const named = runs.filter((run) => run.name === requirement.name);
    if (named.length === 0)
      throw new Error(`Required workflow ${requirement.name} has no exact-SHA push run`);
    if (
      requirement.path !== undefined &&
      named.some((run) => normalizeWorkflowPath(run.path) !== requirement.path)
    )
      throw new Error(
        `Required workflow ${requirement.name} has a run from the wrong workflow identity`
      );
    if (
      requirement.workflowId !== undefined &&
      named.some((run) => run.workflow_id !== requirement.workflowId)
    )
      throw new Error(
        `Required workflow ${requirement.name} has a run from the wrong workflow identity`
      );
    const matches = named.filter(
      (run) =>
        (requirement.path === undefined || normalizeWorkflowPath(run.path) === requirement.path) &&
        (requirement.workflowId === undefined || run.workflow_id === requirement.workflowId)
    );
    if (matches.length === 0)
      throw new Error(`Required workflow ${requirement.name} has no exact-SHA push run`);
    if (matches.some((run) => run.status !== "completed" || run.conclusion !== "success"))
      throw new Error(
        `Required workflow ${requirement.name} is not completed successfully for the exact SHA`
      );
    evidence.push({
      name: requirement.name,
      ...(requirement.path === undefined ? {} : { path: requirement.path }),
      ...(requirement.workflowId === undefined ? {} : { workflowId: requirement.workflowId }),
      runIds: matches.map((run) => run.id).sort((a, b) => a - b)
    });
  }
  return { sha, event: "push", workflows: evidence };
}

function normalizeWorkflowPath(value) {
  if (typeof value !== "string") return undefined;
  return value.split("@", 1)[0];
}

function normalizeRequirements(required, requiredPaths) {
  if (
    !Array.isArray(required) ||
    required.length === 0 ||
    new Set(
      required.map((requirement) =>
        typeof requirement === "string" ? requirement : requirement?.name
      )
    ).size !== required.length
  )
    throw new Error("Required-workflow names are invalid or duplicated");
  const pathOverrides = normalizePathOverrides(requiredPaths);
  const requiredNames = new Set(
    required.map((requirement) =>
      typeof requirement === "string" ? requirement : requirement?.name
    )
  );
  for (const name of pathOverrides.keys())
    if (!requiredNames.has(name))
      throw new Error(`Required workflow path override has no matching requirement: ${name}`);
  return required.map((requirement) => {
    const descriptor = typeof requirement === "string" ? { name: requirement } : requirement;
    if (
      !isRecord(descriptor) ||
      typeof descriptor.name !== "string" ||
      !/^[A-Za-z0-9 ._/-]+$/u.test(descriptor.name)
    )
      throw new Error("Required-workflow names are invalid or duplicated");
    const known = Object.hasOwn(REQUIRED_WORKFLOW_IDENTITIES, descriptor.name)
      ? REQUIRED_WORKFLOW_IDENTITIES[descriptor.name]
      : undefined;
    const path =
      descriptor.path ??
      descriptor.workflowPath ??
      pathOverrides.get(descriptor.name) ??
      known?.path;
    const workflowId = descriptor.workflowId ?? descriptor.workflow_id;
    if (path === undefined)
      throw new Error(`Required workflow ${descriptor.name} must declare an exact workflow path`);
    if (typeof path !== "string" || !WORKFLOW_PATH.test(path))
      throw new Error(`Required workflow ${descriptor.name} has an invalid workflow path`);
    if (workflowId !== undefined && !Number.isSafeInteger(workflowId))
      throw new Error(`Required workflow ${descriptor.name} has an invalid workflow identity`);
    return {
      name: descriptor.name,
      ...(path === undefined ? {} : { path }),
      ...(workflowId === undefined ? {} : { workflowId })
    };
  });
}

function normalizePathOverrides(value) {
  if (value === undefined) return new Map();
  if (!(value instanceof Map) && !isRecord(value))
    throw new Error("Required workflow path overrides are invalid");
  const output = new Map();
  const entries = value instanceof Map ? value.entries() : Object.entries(value);
  for (const [name, path] of entries) {
    if (
      typeof name !== "string" ||
      !/^[A-Za-z0-9 ._/-]+$/u.test(name) ||
      typeof path !== "string" ||
      !WORKFLOW_PATH.test(path)
    )
      throw new Error(`Required workflow ${name} has an invalid workflow path`);
    output.set(name, path);
  }
  return output;
}

function normalizePages(response) {
  if (!Array.isArray(response))
    throw new Error("GitHub Actions response is not a JSON array; required checks are unproven");
  if (response.length === 0) return [];
  return response.every((item) => Array.isArray(item)) ? response.flat() : response;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
