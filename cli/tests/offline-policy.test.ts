import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { runShipGates, type ShipGate } from "../src/gates.js";
import {
  classifyCommandNetworkPolicy,
  decideCommandExecution,
  isUnreachableRegistry
} from "../src/offline-policy.js";
import { createReport } from "../src/report.js";
import { runTool } from "../src/tools.js";
import type { CliOptions, CommandDefinition } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

/**
 * Every case here encodes a way `--offline` used to be silently ignored: the flag reached the
 * rendered-UI driver only, while `run-project-command` and every ship gate spawned the audited
 * project's own scripts with unrestricted network access.
 */

const OFFLINE = { offline: true, forgeOwned: false };
const ONLINE = { offline: false, forgeOwned: false };

function projectCommand(name: string, definition: string): CommandDefinition {
  return {
    name,
    executable: "npm",
    args: ["run", name],
    source: "package.json",
    definition
  };
}

test("a project script that fetches over the network is UNKNOWN and blocked offline", () => {
  const command = projectCommand("verify", "node -e \"fetch('https://example.test/')\"");
  assert.equal(classifyCommandNetworkPolicy(command, OFFLINE), "UNKNOWN");
  const decision = decideCommandExecution(command, OFFLINE);
  assert.equal(decision.permitted, false);
  assert.equal(decision.sandbox, "none");
  assert.match(decision.reason, /UNKNOWN network policy/u);
});

test("a project script that shells out to curl is UNKNOWN and blocked offline", () => {
  const command = projectCommand("sync", "curl -sSL https://example.test/data.json -o data.json");
  assert.equal(classifyCommandNetworkPolicy(command, OFFLINE), "UNKNOWN");
  assert.equal(decideCommandExecution(command, OFFLINE).permitted, false);
});

test("an ordinary package installation script is UNKNOWN and blocked offline", () => {
  const command = projectCommand("bootstrap", "npm install --ignore-scripts");
  assert.equal(classifyCommandNetworkPolicy(command, OFFLINE), "UNKNOWN");
  assert.equal(decideCommandExecution(command, OFFLINE).permitted, false);
});

test("a protective-sounding script name never earns an offline exemption", () => {
  for (const name of ["offline", "verify:offline", "test:offline", "safe-check"]) {
    const command = projectCommand(name, "node scripts/whatever-the-project-wants.js");
    assert.equal(
      classifyCommandNetworkPolicy(command, OFFLINE),
      "UNKNOWN",
      `${name} must be classified from its definition, not its name`
    );
  }
});

test("an explicitly designed cache-only installation check is permitted offline", () => {
  const command = projectCommand(
    "offline:install",
    "npm install --offline --ignore-scripts --registry=http://127.0.0.1:9/ ./package.tgz"
  );
  assert.equal(classifyCommandNetworkPolicy(command, OFFLINE), "cache-only-installation");
  assert.equal(decideCommandExecution(command, OFFLINE).permitted, true);
});

test("a cache-only claim requires both the offline flag and an unreachable registry", () => {
  const withoutRegistry = projectCommand("a", "npm install --offline ./package.tgz");
  const withoutOffline = projectCommand(
    "b",
    "npm install --registry=http://127.0.0.1:9/ ./package.tgz"
  );
  const reachableRegistry = projectCommand(
    "c",
    "npm install --offline --registry=https://registry.npmjs.org/ ./package.tgz"
  );
  for (const command of [withoutRegistry, withoutOffline, reachableRegistry])
    assert.equal(classifyCommandNetworkPolicy(command, OFFLINE), "UNKNOWN");
});

test("unreachable registry classification accepts only addresses that cannot serve packages", () => {
  assert.equal(isUnreachableRegistry("http://127.0.0.1:9/"), true);
  assert.equal(isUnreachableRegistry("http://localhost:4873"), true);
  assert.equal(isUnreachableRegistry("http://0.0.0.0/"), true);
  assert.equal(isUnreachableRegistry("https://registry.npmjs.org/"), false);
  assert.equal(isUnreachableRegistry("file:///tmp/registry"), false);
  assert.equal(isUnreachableRegistry("not a url"), false);
});

test("Forge-owned repository scripts are offline-safe only inside the Forge package root", () => {
  const command = projectCommand("validate", "node scripts/validate-skill.mjs");
  assert.equal(
    classifyCommandNetworkPolicy(command, { offline: true, forgeOwned: true }),
    "forge-internal-offline-safe"
  );
  assert.equal(
    classifyCommandNetworkPolicy(command, OFFLINE),
    "UNKNOWN",
    "an audited project reusing the script name inherits no exemption"
  );
  assert.equal(
    decideCommandExecution(command, { offline: true, forgeOwned: true }).permitted,
    true
  );
});

test("offline classification stays UNKNOWN even when execution is permitted online", () => {
  const command = projectCommand("test", "vitest run");
  const decision = decideCommandExecution(command, ONLINE);
  assert.equal(decision.permitted, true);
  assert.equal(decision.network_policy, "UNKNOWN");
  assert.match(decision.reason, /network behaviour remains UNKNOWN/u);
});

test("run-project-command --offline --allow-run blocks an unknown script and never executes it", async () => {
  await withTemporaryProject("offline-run-project-command", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "ordinary-project",
          private: true,
          scripts: {
            leak: `node -e "require('node:fs').writeFileSync('ran.txt','ran')"`
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const response = await runTool("run-project-command", ["leak"], options(root, true, true));
    const value = response.value as {
      status?: string;
      ledger: Array<{ disposition: string; network_policy: string; sandbox: string }>;
    };
    const record = value.ledger[0];
    assert.ok(record);
    assert.equal(response.exitCode, 2);
    assert.equal(value.status, "BLOCKED");
    assert.equal(record.disposition, "BLOCKED");
    assert.equal(record.network_policy, "UNKNOWN");
    assert.equal(
      record.sandbox,
      "none",
      "no operating-system network isolation exists, so none may be claimed"
    );
    await assert.rejects(readFile(join(root, "ran.txt"), "utf8"), "the script must not have run");
  });
});

test("run-project-command records why an online execution ran", async () => {
  await withTemporaryProject("online-run-project-command", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify(
        { name: "ordinary-project", private: true, scripts: { noop: 'node -e "0"' } },
        null,
        2
      )}\n`,
      "utf8"
    );
    const response = await runTool("run-project-command", ["noop"], options(root, false, true));
    const value = response.value as { ledger: Array<{ disposition: string; offline: boolean }> };
    const record = value.ledger[0];
    assert.ok(record);
    assert.equal(record.disposition, "RAN");
    assert.equal(record.offline, false);
  });
});

test("run-project-command without --allow-run records NOT_RUN rather than a policy block", async () => {
  await withTemporaryProject("no-allow-run-project-command", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify(
        { name: "ordinary-project", private: true, scripts: { noop: 'node -e "0"' } },
        null,
        2
      )}\n`,
      "utf8"
    );
    const response = await runTool("run-project-command", ["noop"], options(root, true, false));
    const value = response.value as { ledger: Array<{ disposition: string }> };
    const record = value.ledger[0];
    assert.ok(record);
    assert.equal(response.exitCode, 2);
    assert.equal(record.disposition, "NOT_RUN");
  });
});

test("ship --offline --allow-run blocks unknown project commands and cannot pass", async () => {
  await withTemporaryProject("offline-ship", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "ordinary-project", private: true }, null, 2)}\n`,
      "utf8"
    );
    const profile = await discoverProject(root);
    const previous = createReport(root, profile, [], "audit");
    const command: CommandDefinition = {
      name: "test",
      executable: process.execPath,
      args: ["-e", "require('node:fs').writeFileSync('should-not-run.txt', 'ran')"],
      source: "package.json",
      definition: "node -e \"require('node:fs').writeFileSync('should-not-run.txt','ran')\""
    };
    const result = await runShipGates(root, profile, previous, [command], true, {
      offline: true,
      forgeOwned: false
    });
    await assert.rejects(
      readFile(join(root, "should-not-run.txt"), "utf8"),
      "an offline-blocked command must never be spawned"
    );
    const blocked = result.command_ledger.find((record) => record.name === "test");
    assert.ok(blocked);
    assert.equal(blocked.disposition, "BLOCKED");
    assert.equal(blocked.network_policy, "UNKNOWN");
    const gate = gateById(result.gates, "FF-GATE-PROJECT-TEST");
    assert.equal(gate.status, "BLOCKED", "a blocked command must never satisfy a release gate");
    assert.equal(gate.evidence_records.length, 0, "a blocked command produces no typed evidence");
    assert.match(gate.evidence.join(" "), /blocked by offline network policy/u);
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.execution.length, 0);
  });
});

test("the same ship command runs and passes when offline mode is not requested", async () => {
  await withTemporaryProject("online-ship", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "ordinary-project", private: true }, null, 2)}\n`,
      "utf8"
    );
    const profile = await discoverProject(root);
    const previous = createReport(root, profile, [], "audit");
    const command: CommandDefinition = {
      name: "test",
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      source: "package.json",
      definition: 'node -e "process.exit(0)"'
    };
    const result = await runShipGates(root, profile, previous, [command], true);
    assert.equal(gateById(result.gates, "FF-GATE-PROJECT-TEST").status, "PASS");
    assert.equal(
      result.command_ledger.find((record) => record.name === "test")?.disposition,
      "RAN"
    );
  });
});

test("a blocked secret-scan command produces no Ship-command PASS evidence", async () => {
  await withTemporaryProject("offline-ship-evidence", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "ordinary-project", private: true }, null, 2)}\n`,
      "utf8"
    );
    const profile = await discoverProject(root);
    const previous = createReport(root, profile, [], "audit");
    const commands: CommandDefinition[] = [
      {
        name: "scan:secrets",
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        source: "package.json",
        definition: 'node -e "process.exit(0)"'
      }
    ];
    const result = await runShipGates(root, profile, previous, commands, true, {
      offline: true,
      forgeOwned: false
    });
    const gate = gateById(result.gates, "FF-GATE-SECRETS");
    assert.equal(gate.status, "PASS", "the independently re-run static inspector still applies");
    assert.equal(
      gate.evidence_records.some(
        (record) => record.status === "PASS" && record.producer === "fullstack-forge/ship-command"
      ),
      false,
      "an unexecuted command must not yield PASS secret-scan evidence"
    );
    assert.ok(
      result.evidence.some(
        (record) => record.status === "PASS" && record.producer === "fullstack-forge/ship-inspector"
      )
    );
  });
});

test("commands that did not run for ordering or authorization reasons are recorded separately", async () => {
  await withTemporaryProject("ship-ledger-not-run", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "ordinary-project", private: true }, null, 2)}\n`,
      "utf8"
    );
    const profile = await discoverProject(root);
    const commands: CommandDefinition[] = [
      {
        name: "lint",
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        source: "package.json",
        definition: 'node -e "process.exit(0)"'
      }
    ];
    const result = await runShipGates(root, profile, undefined, commands, false);
    const record = result.command_ledger.find((entry) => entry.name === "lint");
    assert.ok(record);
    assert.equal(record.disposition, "NOT_RUN");
    assert.ok(record.reason.length > 0, "the ledger must record a reason");
  });
});

function options(root: string, offline: boolean, allowRun: boolean): CliOptions {
  return {
    cwd: root,
    json: true,
    dryRun: false,
    global: false,
    offline,
    allowRun,
    safe: false
  };
}

function gateById(gates: ShipGate[], id: string): ShipGate {
  const gate = gates.find((candidate) => candidate.gate_id === id);
  assert.ok(gate, `expected ${id}`);
  return gate;
}
