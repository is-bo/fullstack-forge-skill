export function validateWorkflowPolicies(workflows) {
  const errors = [];
  for (const [name, source] of Object.entries(workflows)) {
    if (/\bpull_request_target\b/mu.test(source))
      errors.push(`${name}: pull_request_target is forbidden`);
    const uses = [...source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)].map(
      (match) => match[1]
    );
    for (const action of uses) {
      if (action.startsWith("./")) continue;
      if (!/@[a-f0-9]{40}$/u.test(action))
        errors.push(`${name}: action is not pinned to a full commit SHA: ${action}`);
    }
    const checkoutCount = uses.filter((action) => action.startsWith("actions/checkout@")).length;
    const credentialCount = (source.match(/persist-credentials:\s*false/gu) ?? []).length;
    if (credentialCount < checkoutCount)
      errors.push(`${name}: every checkout must set persist-credentials: false`);
  }

  const ci = workflows["ci.yml"] ?? "";
  if (/continue-on-error/iu.test(ci))
    errors.push("ci.yml: required checks cannot continue on error");
  for (const os of ["ubuntu-latest", "windows-latest", "macos-latest"])
    if (!ci.includes(os)) errors.push(`ci.yml: missing ${os} verification`);
  if (!ci.includes("actions/dependency-review-action@"))
    errors.push("ci.yml: dependency review is missing");

  const release = workflows["release.yml"] ?? "";
  for (const [pattern, message] of [
    [/^concurrency:/mu, "release concurrency guard is missing"],
    [/release-preflight\.mjs/iu, "release preflight is missing"],
    [/--draft/iu, "draft-first publication is missing"],
    [/gh release verify/iu, "immutable release verification is missing"],
    [/gh release verify-asset/iu, "asset attestation verification is missing"],
    [/isImmutable/iu, "direct immutable-state verification is missing"],
    [/subject-path:\s*dist\/\*/iu, "all initial release assets are not attested"],
    [
      /\$\{GITHUB_SERVER_URL\}\/\$\{GITHUB_REPOSITORY\}\/releases\/tag\/\$\{GITHUB_REF_NAME\}/u,
      "final evidence does not use the canonical post-publication release URL"
    ]
  ])
    if (!pattern.test(release)) errors.push(`release.yml: ${message}`);
  if (/--clobber/iu.test(release)) errors.push("release.yml: asset clobbering is forbidden");

  const codeql = workflows["codeql.yml"] ?? "";
  if (!codeql.includes("github/codeql-action/"))
    errors.push("codeql.yml: CodeQL action is missing");
  if (!/build-mode:\s*none/iu.test(codeql))
    errors.push("codeql.yml: no-build analysis mode is required");
  return errors;
}
