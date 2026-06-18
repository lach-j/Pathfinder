import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PathfinderError } from "@pathfinder/core";

import { PathfinderStore } from "./index.js";

import {
  createTempRepo,
  duplicateTitleStagePlan,
  sampleStagePlan,
  sortedFiles,
  structuredDiff,
  structuredDiffFile
} from "./state-test-helpers.js";

test("preserves existing Codex global instructions when installing managed block", async () => {
  const repo = await createTempRepo();
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const codexInstructionsPath = path.join(userHome, ".codex", "AGENTS.md");
  const store = new PathfinderStore(repo, { userHome });

  await mkdir(path.dirname(codexInstructionsPath), { recursive: true });
  await writeFile(codexInstructionsPath, "# Existing Codex rules\n\nKeep this rule.\n", "utf8");

  const installed = await store.installUserAgentIntegration({ tool: "codex" });
  const secondInstall = await store.installUserAgentIntegration({ tool: "codex" });
  const written = await readFile(codexInstructionsPath, "utf8");

  assert.equal(installed.files[0].managed, false);
  assert.equal(installed.files[0].changed, true);
  assert.equal(secondInstall.files[0].managed, true);
  assert.equal(secondInstall.files[0].changed, false);
  assert.match(written, /^# Existing Codex rules\n\nKeep this rule\.\n\n<!-- pathfinder-user-agent:start -->/);
  assert.equal((written.match(/<!-- pathfinder-user-agent:start -->/g) ?? []).length, 1);
});

test("reports manual user-level OpenCode instructions without guessing a path", async () => {
  const repo = await createTempRepo();
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const store = new PathfinderStore(repo, { userHome });

  const result = await store.installUserAgentIntegration({ tool: "opencode" });

  assert.equal(result.files.length, 0);
  assert.equal(result.manualInstructions[0].tool, "opencode");
  assert.match(result.manualInstructions[0].instructions.join("\n"), /OpenCode user-level rule and command locations vary/);
  await assert.rejects(() => readFile(path.join(repo, ".opencode", "commands", "pathfinder-plan.md"), "utf8"));
});

test("diagnoses missing agent integration setup without writing files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const result = await store.getAgentDoctor();

  assert.equal(result.ok, false);
  assert.equal(result.next.phase, "uninitialized");
  assert.equal(result.next.command, "pathfinder agent next --json");
  assert.deepEqual(
    result.checks.map((check) => [check.id, check.status, check.fixCommand]),
    [
      ["pathfinder-state", "missing", "pathfinder init"],
      ["agents-md", "missing", "pathfinder agent bootstrap"],
      ["claude-commands", "missing", "pathfinder agent commands install --tool claude"],
      ["opencode-commands", "missing", "pathfinder agent commands install --tool opencode"],
      ["agent-next", "pass", undefined]
    ]
  );
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
});

test("diagnoses fully installed agent integration setup", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  await store.initProject();
  await store.bootstrapAgentInstructions();
  await store.installAgentCommands();

  const result = await store.getAgentDoctor();

  assert.equal(result.ok, true);
  assert.equal(result.next.phase, "needs_workstream");
  assert.deepEqual(
    result.checks.map((check) => [check.id, check.status]),
    [
      ["pathfinder-state", "pass"],
      ["agents-md", "pass"],
      ["claude-commands", "pass"],
      ["opencode-commands", "pass"],
      ["agent-next", "pass"]
    ]
  );
});

test("diagnoses missing personal agent setup without writing files", async () => {
  const repo = await createTempRepo();
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const store = new PathfinderStore(repo, { configRoot, userHome });

  const result = await store.getAgentDoctor(undefined, { personal: true });

  assert.equal(result.ok, false);
  assert.equal(result.next.phase, "uninitialized");
  assert.deepEqual(
    result.checks.map((check) => [check.id, check.status, check.fixCommand]),
    [
      ["cli-command", "pass", undefined],
      ["state-mode", "missing", "pathfinder init --personal"],
      ["external-project-state", "missing", "pathfinder init --personal"],
      ["user-claude-instructions", "missing", "pathfinder agent install --user claude"],
      ["user-opencode-instructions", "pass", undefined],
      ["repo-footprint", "pass", undefined],
      ["agent-next", "pass", undefined]
    ]
  );
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"));
});

test("diagnoses fully installed personal agent setup", async () => {
  const repo = await createTempRepo();
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const store = new PathfinderStore(repo, { configRoot, userHome });

  await store.initProject({ personal: true });
  await store.installUserAgentIntegration({ tool: "claude" });

  const result = await store.getAgentDoctor(undefined, { personal: true });

  assert.equal(result.ok, true);
  assert.equal(result.next.phase, "needs_workstream");
  assert.deepEqual(
    result.checks.map((check) => [check.id, check.status]),
    [
      ["cli-command", "pass"],
      ["state-mode", "pass"],
      ["external-project-state", "pass"],
      ["user-claude-instructions", "pass"],
      ["user-opencode-instructions", "pass"],
      ["repo-footprint", "pass"],
      ["agent-next", "pass"]
    ]
  );
});

test("personal agent doctor reports repo-local Pathfinder footprint", async () => {
  const repo = await createTempRepo();
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const store = new PathfinderStore(repo, { configRoot, userHome });

  await store.initProject({ personal: true });
  await store.installUserAgentIntegration({ tool: "claude" });
  await store.bootstrapAgentInstructions();
  await store.installAgentCommands({ tool: "claude" });

  const result = await store.getAgentDoctor(undefined, { personal: true });
  const footprint = result.checks.find((check) => check.id === "repo-footprint");

  assert.equal(result.ok, false);
  assert.equal(footprint?.status, "error");
  assert.match(footprint?.message ?? "", /AGENTS\.md managed Pathfinder block/);
  assert.match(footprint?.message ?? "", /\.claude\/commands\/pathfinder-plan\.md/);
});
