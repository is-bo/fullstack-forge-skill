import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { install, readInstallManifest, uninstall } from "../src/installer.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
async function exists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
}
async function walk(directory) {
    const out = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory())
            out.push(...(await walk(full)));
        else
            out.push(full);
    }
    return out;
}
function canonicalCompositionCommand(playbook, playbookPath, repositoryRoot) {
    const pointer = /Resolve `([^`]*composition-entry\.js)` relative to this `SKILL\.md`/u.exec(playbook);
    const command = /^`node "<resolved-absolute-runner-path>" ([a-z-]+) compose --workflow ([a-z]+) --root "<repository-root>" --dry-run --json`$/mu.exec(playbook);
    assert.ok(pointer?.[1] !== undefined &&
        command !== null &&
        command[1] !== undefined &&
        command[2] !== undefined, "canonical playbook must contain one location-aware composition command");
    return {
        runner: resolve(dirname(playbookPath), pointer[1]),
        args: [
            command[1],
            "compose",
            "--workflow",
            command[2],
            "--root",
            repositoryRoot,
            "--dry-run",
            "--json"
        ]
    };
}
async function runAdapterCompositionCommand(command, cwd) {
    const result = await runFile(process.execPath, [command.runner, ...command.args], cwd, 60_000);
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
}
test("installation delivers the compiled upstream tree and the composition manifests", async () => {
    await withTemporaryProject("upstream-install", async (root) => {
        await install(root, "claude", { global: false, dryRun: false });
        const manifests = join(root, ".fullstack-forge", "manifests");
        assert.ok(await exists(join(manifests, "upstream-registry.json")));
        assert.ok(await exists(join(manifests, "module-composition.json")));
        assert.ok(await exists(join(manifests, "upstream-transforms.json")));
        assert.ok(await exists(join(root, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js")));
        const registry = JSON.parse(await readFile(join(manifests, "upstream-registry.json"), "utf8"));
        assert.equal(registry.providers.length, 8);
        for (const provider of registry.providers) {
            assert.ok(await exists(join(root, ".fullstack-forge", "upstream", provider.id)), `${provider.id} content is missing from the installation`);
        }
    });
});
test("every composition source resolves inside a freshly installed project", async () => {
    await withTemporaryProject("upstream-install-sources", async (root) => {
        await install(root, "claude", { global: false, dryRun: false });
        const composition = JSON.parse(await readFile(join(root, ".fullstack-forge", "manifests", "module-composition.json"), "utf8"));
        assert.equal(composition.modules.length, 42);
        for (const module of composition.modules) {
            for (const source of module.resolvedSources) {
                assert.ok(await exists(join(root, source.runtimePath)), `${module.module} references ${source.runtimePath}, which is not installed`);
            }
        }
    });
});
test("the installed automatic host path reaches the deterministic composition runner", async () => {
    await withTemporaryProject("upstream-install-runtime-chain", async (root) => {
        await install(root, "claude", { global: false, dryRun: false });
        const orchestrator = await readFile(join(root, ".fullstack-forge", "skills", "fullstack-forge", "SKILL.md"), "utf8");
        const modulePath = join(root, ".fullstack-forge", "skills", "forge-observability", "SKILL.md");
        const module = await readFile(modulePath, "utf8");
        const adapterPath = join(root, ".claude", "skills", "forge-observability", "SKILL.md");
        const adapter = await readFile(adapterPath, "utf8");
        assert.match(orchestrator, /\.\.\/forge-<module>\/SKILL\.md/u, "the automatic orchestrator must name the location-relative canonical module path");
        assert.match(orchestrator, /plugin cache/u);
        assert.match(module, /Resolve `\.\.\/\.\.\/runtime\/cli\/src\/composition-entry\.js`/u);
        assert.match(module, /^`node "<resolved-absolute-runner-path>" observability compose --workflow audit --root "<repository-root>" --dry-run --json`$/mu);
        assert.match(adapter, /canonical playbook owns any deterministic composition step/u);
        assert.doesNotMatch(adapter, /composition-entry\.js/u);
        assert.match(module, /Read `eager\[\]\.runtimePath`[\s\S]*load only `deferred\[\]\.runtimePath`/u);
        const command = canonicalCompositionCommand(module, modulePath, root);
        const nested = join(root, "packages", "nested");
        await mkdir(nested, { recursive: true });
        for (const cwd of [root, nested]) {
            const output = (await runAdapterCompositionCommand(command, cwd));
            assert.equal(output.dry_run, true);
            assert.equal(resolve(output.runtime_root ?? ""), resolve(root));
            assert.equal(output.composition_artifact, undefined);
            const composition = output.compositions?.[0];
            assert.ok(composition !== undefined);
            assert.equal(composition.module, "observability");
            assert.equal(composition.workflow, "audit");
            assert.ok(composition.eager?.every((source) => typeof source.runtimePath === "string"));
            assert.ok(composition.deferred?.every((source) => typeof source.runtimePath === "string"));
            assert.deepEqual(composition.missing, []);
            assert.equal(await exists(join(cwd, ".forge")), false, "dry-run composition must not write");
        }
    });
});
test("no installed upstream file is discoverable as a skill by any host", async () => {
    await withTemporaryProject("upstream-install-discovery", async (root) => {
        await install(root, "all", { global: false, dryRun: false });
        const upstream = join(root, ".fullstack-forge", "upstream");
        for (const file of await walk(upstream)) {
            assert.notEqual(file.split(/[\\/]/u).pop(), "SKILL.md", `${file} would be discoverable by an agent host`);
        }
        // Host skill roots must contain only Forge's own skills.
        for (const host of [".claude", ".agents", ".cursor", ".gemini", ".github", ".windsurf"]) {
            const skillsRoot = join(root, host, "skills");
            if (!(await exists(skillsRoot)))
                continue;
            for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
                assert.ok(entry.name === "fullstack-forge" || entry.name.startsWith("forge"), `${host}/skills/${entry.name} is not a Fullstack Forge skill`);
            }
        }
    });
});
test("upstream content is installed once, not duplicated per host", async () => {
    await withTemporaryProject("upstream-install-once", async (root) => {
        await install(root, "all", { global: false, dryRun: false });
        const manifest = await readInstallManifest(root);
        assert.ok(manifest !== undefined);
        const upstreamRecords = Object.keys(manifest.files).filter((path) => path.replace(/\\/gu, "/").startsWith(".fullstack-forge/upstream/"));
        assert.ok(upstreamRecords.length > 100);
        const outsideManaged = Object.keys(manifest.files).filter((path) => {
            const posix = path.replace(/\\/gu, "/");
            return posix.includes("/upstream/") && !posix.startsWith(".fullstack-forge/");
        });
        assert.deepEqual(outsideManaged, [], "upstream content must exist in exactly one managed root");
    });
});
test("uninstalling the final host removes the managed upstream tree", async () => {
    await withTemporaryProject("upstream-uninstall", async (root) => {
        await install(root, "claude", { global: false, dryRun: false });
        assert.ok(await exists(join(root, ".fullstack-forge", "upstream", "impeccable")));
        await uninstall(root, "claude", { global: false, dryRun: false });
        assert.equal(await exists(join(root, ".fullstack-forge", "upstream", "impeccable", "PLAYBOOK.md")), false, "managed upstream content must not be left behind after the last host is removed");
    });
});
test("installed upstream content contains no symlink and no host frontmatter", async () => {
    await withTemporaryProject("upstream-install-safety", async (root) => {
        await install(root, "claude", { global: false, dryRun: false });
        const upstream = join(root, ".fullstack-forge", "upstream");
        for (const file of await walk(upstream)) {
            if (!file.endsWith("PLAYBOOK.md"))
                continue;
            const text = await readFile(file, "utf8");
            assert.ok(!text.startsWith("---"), `${file} still carries activation frontmatter`);
        }
    });
});
