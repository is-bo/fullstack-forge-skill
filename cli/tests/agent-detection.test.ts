import assert from "node:assert/strict";
import { chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import test from "node:test";
import { detectAgentRecommendations } from "../src/agent-detection.js";
import { withTemporaryProject } from "./helpers.js";

test("agent recommendations use finite project and user configuration markers", async () => {
  await withTemporaryProject("agent-detection", async (root) => {
    const project = join(root, "project");
    const user = join(root, "user");
    await mkdir(join(project, ".cursor"), { recursive: true });
    await mkdir(join(user, ".claude"), { recursive: true });
    await mkdir(join(project, ".github", "instructions"), { recursive: true });

    const recommendations = await detectAgentRecommendations(project, user, "");
    assert.deepEqual(
      recommendations.map((item) => item.selector),
      ["claude", "cursor", "github"]
    );
    assert.deepEqual(recommendations.find((item) => item.selector === "cursor")?.evidence, [
      "project:.cursor"
    ]);
    assert.deepEqual(recommendations.find((item) => item.selector === "claude")?.evidence, [
      "user:.claude"
    ]);
  });
});

test("agent detection makes no recommendation without direct marker evidence", async () => {
  await withTemporaryProject("agent-detection-empty", async (root) => {
    const project = join(root, "project");
    const user = join(root, "user");
    await mkdir(project);
    await mkdir(user);
    assert.deepEqual(await detectAgentRecommendations(project, user, ""), []);
  });
});

test("agent detection does not follow a marker symlink", async (t) => {
  await withTemporaryProject("agent-detection-link", async (root) => {
    const project = join(root, "project");
    const user = join(root, "user");
    const outside = join(root, "outside");
    await mkdir(project);
    await mkdir(user);
    await mkdir(outside);
    try {
      await symlink(
        outside,
        join(project, ".cursor"),
        process.platform === "win32" ? "junction" : "dir"
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("Creating a test symlink requires OS privilege");
        return;
      }
      throw error;
    }
    assert.deepEqual(await detectAgentRecommendations(project, user, ""), []);
  });
});

test("agent detection treats finite PATH matches as hints without executing them", async () => {
  await withTemporaryProject("agent-detection-path", async (root) => {
    const project = join(root, "project");
    const user = join(root, "user");
    const bin = join(root, "bin");
    const executable = join(bin, process.platform === "win32" ? "codex.cmd" : "codex");
    await mkdir(project);
    await mkdir(user);
    await mkdir(bin);
    await writeFile(executable, "not executed\n", "utf8");
    if (process.platform !== "win32") await chmod(executable, 0o755);

    const recommendations = await detectAgentRecommendations(
      project,
      user,
      ["relative", bin].join(delimiter)
    );
    assert.deepEqual(
      recommendations.map((item) => item.selector),
      ["codex"]
    );
    assert.deepEqual(recommendations[0]?.evidence, ["path:codex"]);
  });
});
