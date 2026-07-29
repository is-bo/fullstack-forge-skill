const repository = "is-bo/fullstack-forge-skill";

export function publicReleaseArchive(tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(tag))
    throw new Error(`Release archive tag must be a stable semantic version: ${tag}`);
  return `https://codeload.github.com/${repository}/tar.gz/refs/tags/${encodeURIComponent(tag)}`;
}
