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
  for (const node of ['node: "20.19.0"', 'node: "22.13.0"', "node: [20, 22, 24]"])
    if (!ci.includes(node)) errors.push(`ci.yml: missing supported Node coverage ${node}`);
  for (const artifact of ["dist/*.tgz", "dist/*.spdx.json"])
    if (!ci.includes(artifact)) errors.push(`ci.yml: release artifact upload omits ${artifact}`);
  if (!ci.includes(".windsurf/ skills/"))
    errors.push("ci.yml: stale generated-output gate omits the Codex plugin skills root");
  if (!ci.includes("actions/dependency-review-action@"))
    errors.push("ci.yml: dependency review is missing");

  const release = workflows["release.yml"] ?? "";
  for (const [pattern, message] of [
    [/^concurrency:/mu, "release concurrency guard is missing"],
    [/release-preflight\.mjs/iu, "release preflight is missing"],
    [/verify-required-workflows\.mjs/iu, "exact-SHA required-workflow gate is missing"],
    [/actions:\s*read/iu, "required-workflow lookup permission is missing"],
    [/--required CI/iu, "exact-SHA CI requirement is missing"],
    [/--required CodeQL/iu, "exact-SHA CodeQL requirement is missing"],
    [
      /dist\/fullstack-forge-skill-\$\{GITHUB_REF_NAME\}\.tgz/iu,
      "exact npm artifact smoke install is missing"
    ],
    [/--asset/iu, "candidate asset and attestation preflight is missing"],
    [/--draft/iu, "draft-first publication is missing"],
    [
      /secrets\.RELEASE_ADMIN_TOKEN/iu,
      "immutable-release preflight lacks an Administration-read token"
    ],
    [/gh release verify/iu, "immutable release verification is missing"],
    [/gh release verify-asset/iu, "asset attestation verification is missing"],
    [/isImmutable/iu, "direct immutable-state verification is missing"],
    [/subject-path:\s*dist\/\*/iu, "all initial release assets are not attested"],
    [
      /\$\{GITHUB_SERVER_URL\}\/\$\{GITHUB_REPOSITORY\}\/releases\/tag\/\$\{GITHUB_REF_NAME\}/u,
      "final evidence does not use the canonical post-publication release URL"
    ],
    [/--signer-workflow\s+"\$signer_workflow"/u, "attestation signer workflow is not pinned"]
  ])
    if (!pattern.test(release)) errors.push(`release.yml: ${message}`);
  if (!release.includes(".windsurf/ skills/"))
    errors.push("release.yml: stale generated-output gate omits the Codex plugin skills root");
  if (
    release.lastIndexOf("release-preflight.mjs") >
    release.indexOf("actions/attest-build-provenance@")
  )
    errors.push("release.yml: candidate attestation preflight must run before provenance creation");
  if (release.indexOf("verify-required-workflows.mjs") > release.indexOf("release-preflight.mjs"))
    errors.push("release.yml: exact-SHA checks must pass before release preflight");
  if (/--clobber/iu.test(release)) errors.push("release.yml: asset clobbering is forbidden");
  if ((release.match(/--signer-workflow\s+"\$signer_workflow"/gu) ?? []).length !== 2)
    errors.push("release.yml: candidate and final attestations must both pin the signer workflow");

  const codeql = workflows["codeql.yml"] ?? "";
  if (!codeql.includes("github/codeql-action/"))
    errors.push("codeql.yml: CodeQL action is missing");
  if (!/build-mode:\s*none/iu.test(codeql))
    errors.push("codeql.yml: no-build analysis mode is required");
  return errors;
}
