export function parseSkillFrontmatter(content) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(content)?.[1];
  if (block === undefined) return null;
  const lines = block.split(/\r?\n/u);
  const name = /^name:\s*(\S.*)$/u.exec(lines[0] ?? "")?.[1]?.trim();
  const descriptionStart = /^description:\s*(.*)$/u.exec(lines[1] ?? "")?.[1] ?? null;
  const continuation = lines.slice(2);
  if (
    name === undefined ||
    descriptionStart === null ||
    continuation.some((line) => line.length > 0 && !/^\s+/u.test(line))
  )
    return null;
  const description = [descriptionStart, ...continuation.map((line) => line.trim())]
    .filter(Boolean)
    .join(" ")
    .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/u, "$1$2")
    .trim();
  return { name, description };
}

/**
 * Pure, filesystem-free skill-content validation shared by module and build command skills. Given
 * already-read text content, returns the list of error strings a caller should surface; never
 * reads or writes anything itself so it is safe to unit test with synthetic content.
 */
export function collectSkillErrors(
  path,
  content,
  { expectedName, command, criteria = [], headings }
) {
  const errors = [];
  const lines = content.split(/\r?\n/u);
  if (lines.length > 500)
    errors.push(`${path}: ${lines.length} lines exceeds the 500-line guidance`);
  const frontmatter = parseSkillFrontmatter(content);
  if (frontmatter === null)
    errors.push(`${path}: frontmatter must contain only ordered name and description fields`);
  else {
    if (frontmatter.name !== expectedName) errors.push(`${path}: expected name ${expectedName}`);
    if (frontmatter.description.length === 0 || frontmatter.description.length > 1024)
      errors.push(`${path}: description must be 1-1024 characters`);
  }
  if (/\[TODO\]|(?:^|\n)\s*(?:[-*]\s*)?TODO(?:\s*:|\s*$)/iu.test(content))
    errors.push(`${path}: unresolved TODO placeholder`);
  if (!content.includes("Never hide failed checks or claim that an operation ran when it did not."))
    errors.push(`${path}: missing completion contract`);
  if (command)
    for (const heading of headings ?? [])
      if (!content.includes(heading)) errors.push(`${path}: missing ${heading}`);
  if (command)
    for (const criterion of criteria)
      if (!content.includes(`- ${criterion}`))
        errors.push(`${path}: missing inspection criterion ${criterion}`);
  return errors;
}
