import { execFileSync } from "node:child_process";

const gitOptions = (root) => ({
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 20 * 1024 * 1024
});

/** Lists tracked and untracked files that still exist in the current Git worktree. */
export function listWorktreeFiles(root, run = execFileSync) {
  const listed = splitPaths(
    run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], gitOptions(root))
  );
  const deleted = new Set(
    splitPaths(run("git", ["ls-files", "--deleted", "-z"], gitOptions(root)))
  );
  return [...new Set(listed.filter((path) => !deleted.has(path)))].sort();
}

function splitPaths(value) {
  return value.split("\0").filter(Boolean);
}
