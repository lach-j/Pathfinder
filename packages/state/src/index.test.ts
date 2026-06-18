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

test("initialises Pathfinder state inside a Git repository", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const project = await store.initProject();

  assert.equal(project.name, path.basename(repo));
  assert.equal(project.schemaVersion, 1);
  assert.match(await readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"), /"schemaVersion": 1/);
});

test("initialises external Pathfinder state without writing repo state", async () => {
  const repo = await createTempRepo();
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const store = new PathfinderStore(repo, { configRoot });

  const project = await store.initProject({ personal: true });
  const workstream = await store.createWorkstream("Personal State");
  const metadataPath = path.join(configRoot, "projects");
  const projectIds = await sortedFiles(metadataPath);
  const projectRoot = path.join(metadataPath, projectIds[0]);
  const metadata = JSON.parse(await readFile(path.join(projectRoot, "project-metadata.json"), "utf8"));

  assert.equal(project.name, path.basename(repo));
  assert.equal(workstream.id, "personal-state");
  assert.equal(projectIds.length, 1);
  assert.equal(metadata.gitRoot, repo);
  assert.equal(metadata.identitySource, "path");
  await assert.rejects(() => readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"));
});

test("derives deterministic external project ids from Git remote URL", async () => {
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const firstRepo = await createTempRepo();
  const secondRepo = await createTempRepo();
  const remoteUrl = "https://example.invalid/acme/project.git";
  await writeFile(path.join(firstRepo, ".git", "config"), `[remote "origin"]\n\turl = ${remoteUrl}\n`, "utf8");
  await writeFile(path.join(secondRepo, ".git", "config"), `[remote "origin"]\n\turl = ${remoteUrl}\n`, "utf8");

  const firstStore = new PathfinderStore(firstRepo, { configRoot });
  await firstStore.initProject({ personal: true });
  const projectIdsAfterFirst = await sortedFiles(path.join(configRoot, "projects"));
  const metadata = JSON.parse(
    await readFile(path.join(configRoot, "projects", projectIdsAfterFirst[0], "project-metadata.json"), "utf8")
  );

  assert.equal(projectIdsAfterFirst.length, 1);
  assert.equal(metadata.identitySource, "remote");
  assert.equal(metadata.remoteUrl, remoteUrl);

  const secondStore = new PathfinderStore(secondRepo, { configRoot });
  await assert.rejects(
    () => secondStore.initProject({ personal: true }),
    /External Pathfinder state already exists for this repository\./
  );
  assert.deepEqual(await sortedFiles(path.join(configRoot, "projects")), projectIdsAfterFirst);
});

test("discovers repo-local state without global mode", async () => {
  const repo = await createTempRepo();
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const repoStore = new PathfinderStore(repo, { configRoot });
  await repoStore.initProject();

  const discoveredStore = new PathfinderStore(repo, { configRoot });
  const workstream = await discoveredStore.createWorkstream("Repo State");

  assert.equal(workstream.id, "repo-state");
  assert.match(await readFile(path.join(repo, ".pathfinder", "workstreams", "repo-state", "workstream.json"), "utf8"), /Repo State/);
});

test("bootstraps agent instructions when AGENTS.md is missing", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const result = await store.bootstrapAgentInstructions();
  const written = await readFile(path.join(repo, "AGENTS.md"), "utf8");

  assert.equal(result.path, path.join(repo, "AGENTS.md"));
  assert.equal(result.changed, true);
  assert.equal(written, result.markdown);
  assert.match(written, /<!-- pathfinder-agent:start -->/);
  assert.match(written, /pathfinder agent next --json/);
  assert.match(written, /pathfinder agent prompt/);
  assert.match(written, /Pathfinder is the source of truth/);
  assert.match(written, /Do not create unmanaged task lists or parallel plans/);
  assert.match(written, /do not resolve Pathfinder comments automatically/);
  assert.match(written, /MCP is not required/);
});

test("bootstraps agent instructions while preserving existing AGENTS.md content", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await writeFile(path.join(repo, "AGENTS.md"), "# Existing\n\nKeep this.\n", "utf8");

  await store.bootstrapAgentInstructions();
  const written = await readFile(path.join(repo, "AGENTS.md"), "utf8");
  const second = await store.bootstrapAgentInstructions();
  const writtenAgain = await readFile(path.join(repo, "AGENTS.md"), "utf8");

  assert.match(written, /^# Existing\n\nKeep this\.\n\n<!-- pathfinder-agent:start -->/);
  assert.equal(second.changed, false);
  assert.equal(writtenAgain, written);
  assert.equal((written.match(/<!-- pathfinder-agent:start -->/g) ?? []).length, 1);
});

test("updates an existing managed agent instruction block only", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await writeFile(
    path.join(repo, "AGENTS.md"),
    "# Existing\n\n<!-- pathfinder-agent:start -->\nold instructions\n<!-- pathfinder-agent:end -->\n\n## Tail\nKeep tail.\n",
    "utf8"
  );

  await store.bootstrapAgentInstructions();
  const written = await readFile(path.join(repo, "AGENTS.md"), "utf8");

  assert.match(written, /^# Existing\n\n<!-- pathfinder-agent:start -->/);
  assert.doesNotMatch(written, /old instructions/);
  assert.match(written, /## Tail\nKeep tail\.\n$/);
});

test("dry-run bootstrap prints proposed instructions without writing", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await writeFile(path.join(repo, "AGENTS.md"), "# Existing\n", "utf8");

  const result = await store.bootstrapAgentInstructions({ dryRun: true });
  const written = await readFile(path.join(repo, "AGENTS.md"), "utf8");

  assert.equal(result.dryRun, true);
  assert.equal(result.changed, true);
  assert.match(result.markdown, /pathfinder agent next --json/);
  assert.equal(written, "# Existing\n");
});

test("installs native agent command wrappers idempotently", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const dryRun = await store.installAgentCommands({ dryRun: true });
  const firstList = await store.listAgentCommands();
  const installed = await store.installAgentCommands();
  const secondInstall = await store.installAgentCommands();
  const claudePlan = await readFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "utf8");
  const opencodeContinue = await readFile(
    path.join(repo, ".opencode", "commands", "pathfinder-continue.md"),
    "utf8"
  );

  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.files.length, 6);
  assert.equal(dryRun.files.every((file) => file.changed), true);
  assert.equal(firstList.tools[0].files[0].installed, false);
  assert.equal(installed.files.every((file) => file.skipped === false), true);
  assert.equal(installed.files.every((file) => file.changed), true);
  assert.equal(secondInstall.files.every((file) => file.changed === false), true);
  assert.match(claudePlan, /pathfinder agent prompt --phase plan/);
  assert.match(opencodeContinue, /pathfinder agent next --json/);
});

test("limits native agent command installation by tool", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const result = await store.installAgentCommands({ tool: "claude" });
  const list = await store.listAgentCommands();

  assert.deepEqual(result.files.map((file) => file.tool), ["claude", "claude", "claude"]);
  assert.equal(list.tools.find((tool) => tool.tool === "claude")?.files.every((file) => file.installed), true);
  assert.equal(list.tools.find((tool) => tool.tool === "opencode")?.files.every((file) => !file.installed), true);
});

test("preserves existing user-owned native command files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(repo, ".claude", "commands"), { recursive: true }));
  await writeFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "# Mine\n", "utf8");

  const result = await store.installAgentCommands({ tool: "claude" });
  const written = await readFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "utf8");
  const protectedFile = result.files.find((file) => file.commandName === "pathfinder-plan");

  assert.equal(protectedFile?.skipped, true);
  assert.equal(protectedFile?.managed, false);
  assert.equal(protectedFile?.reason, "Existing file is not Pathfinder-managed.");
  assert.equal(written, "# Mine\n");
  assert.match(await readFile(path.join(repo, ".claude", "commands", "pathfinder-feedback.md"), "utf8"), /pathfinder agent prompt --phase feedback/);
});

test("installs user-level Claude instructions without writing repo files", async () => {
  const repo = await createTempRepo();
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const store = new PathfinderStore(repo, { userHome });

  const dryRun = await store.installUserAgentIntegration({ tool: "claude", dryRun: true });
  const installed = await store.installUserAgentIntegration({ tool: "claude" });
  const secondInstall = await store.installUserAgentIntegration({ tool: "claude" });
  const written = await readFile(path.join(userHome, ".claude", "CLAUDE.md"), "utf8");

  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.files[0].path, path.join(userHome, ".claude", "CLAUDE.md"));
  assert.equal(installed.files[0].changed, true);
  assert.equal(secondInstall.files[0].changed, false);
  assert.match(written, /<!-- pathfinder-user-agent:start -->/);
  assert.match(written, /pathfinder agent doctor --json/);
  assert.match(written, /Do not write Pathfinder setup files into the repository unless the user asks/);
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(repo, ".claude", "CLAUDE.md"), "utf8"));
});

test("installs user-level Codex instructions without duplicate managed blocks", async () => {
  const repo = await createTempRepo();
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-user-home-"));
  const store = new PathfinderStore(repo, { userHome });

  const installed = await store.installUserAgentIntegration({ tool: "codex" });
  const secondInstall = await store.installUserAgentIntegration({ tool: "codex" });
  const written = await readFile(path.join(userHome, ".codex", "AGENTS.md"), "utf8");

  assert.equal(installed.files[0].path, path.join(userHome, ".codex", "AGENTS.md"));
  assert.equal(installed.files[0].relativePath, "AGENTS.md");
  assert.equal(installed.files[0].changed, true);
  assert.equal(secondInstall.files[0].changed, false);
  assert.equal((written.match(/<!-- pathfinder-user-agent:start -->/g) ?? []).length, 1);
  assert.match(written, /pathfinder agent doctor --json/);
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
});
