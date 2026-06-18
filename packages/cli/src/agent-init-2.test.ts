import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { Server } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { serveReviewServer, serveWorkspaceServer } from "@pathfinder/local-server";

const execFileAsync = promisify(execFile);
const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

import {
  closeServer,
  createRealTempGitRepo,
  createTempGitRepo,
  createUnbornRealTempGitRepo,
  firstOutputField,
  git,
  isExecError,
  jsonFetch,
  runCli,
  sampleStagePlan,
  serverBaseUrl,
  sortedFiles
} from "./cli-test-helpers.js";

test("init --personal --user all sets up every supported personal integration", async () => {
  const repo = await createTempGitRepo();
  const pathfinderHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-home-"));
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-user-home-"));
  const env = { PATHFINDER_HOME: pathfinderHome, PATHFINDER_USER_HOME: userHome };

  const result = await runCli(["init", "--personal", "--user", "all"], repo, env);
  const claudeInstructions = await readFile(path.join(userHome, ".claude", "CLAUDE.md"), "utf8");
  const codexInstructions = await readFile(path.join(userHome, ".codex", "AGENTS.md"), "utf8");

  assert.match(result.stdout, /wrote: claude -> \.claude\/CLAUDE\.md/);
  assert.match(result.stdout, /manual: opencode/);
  assert.match(result.stdout, /wrote: codex -> AGENTS\.md/);
  assert.match(claudeInstructions, /pathfinder agent next --json/);
  assert.match(codexInstructions, /pathfinder agent next --json/);
  await assert.rejects(() => readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"));
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
});

test("uses external state after init --personal without global config", async () => {
  const repo = await createTempGitRepo();
  const pathfinderHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-home-"));
  const env = { PATHFINDER_HOME: pathfinderHome };

  const init = await runCli(["init", "--personal"], repo, env);
  const workstream = await runCli(["workstream", "create", "--title", "Demo"], repo, env);
  const current = await runCli(["current"], repo, env);
  const projectIds = await sortedFiles(path.join(pathfinderHome, "projects"));
  const projectRoot = path.join(pathfinderHome, "projects", projectIds[0]);

  assert.match(init.stdout, /Initialised Pathfinder/);
  assert.match(workstream.stdout, /demo\tDemo/);
  assert.match(current.stdout, /Project:/);
  assert.equal(projectIds.length, 1);
  assert.match(await readFile(path.join(projectRoot, "project.json"), "utf8"), /"schemaVersion": 1/);
  await assert.rejects(() => readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"));
});

test("writes feedback export to external state by default in external mode", async () => {
  const repo = await createTempGitRepo();
  const pathfinderHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-home-"));
  const env = { PATHFINDER_HOME: pathfinderHome };

  await runCli(["init", "--personal"], repo, env);
  await runCli(["workstream", "create", "--title", "Feedback Mode"], repo, env);

  const result = await runCli(["feedback", "export", "feedback-mode"], repo, env);
  const projectIds = await sortedFiles(path.join(pathfinderHome, "projects"));
  const feedbackPath = path.join(pathfinderHome, "projects", projectIds[0], ".pathfinder-feedback.md");
  const feedback = await readFile(feedbackPath, "utf8");

  assert.match(result.stdout, /Wrote feedback queue to .*\.pathfinder-feedback\.md\./);
  assert.match(feedback, /Feedback Mode/);
  await assert.rejects(() => readFile(path.join(repo, ".pathfinder-feedback.md"), "utf8"));
});

test("prints agent next setup recommendation as text and JSON", async () => {
  const repo = await createTempGitRepo();

  const text = await runCli(["agent", "next"], repo);
  const json = await runCli(["agent", "next", "--json"], repo);
  const parsed = JSON.parse(json.stdout);

  assert.match(text.stdout, /# Pathfinder Agent Next/);
  assert.match(text.stdout, /Phase: uninitialized/);
  assert.equal(parsed.phase, "uninitialized");
  assert.deepEqual(parsed.commands, ["pathfinder init"]);
});

test("prints agent next recommendation for active implementation state", async () => {
  const repo = await createRealTempGitRepo();
  const pathfinderHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-home-"));
  const env = { PATHFINDER_HOME: pathfinderHome };

  await runCli(["init", "--personal"], repo, env);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo, env);
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd report.\n", "utf8");
  await runCli(["plan", "set", "inventory-alerts", "--file", "./plan.md"], repo, env);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Report",
      "--description",
      "Report reorder candidates."
    ],
    repo,
    env
  );
  await git(repo, ["add", "plan.md"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder plan"]);
  await runCli(["slice", "start", "inventory-alerts", "add-report", "--base", "main"], repo, env);

  const result = await runCli(["agent", "next", "--json"], repo, env);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.phase, "ready_to_implement");
  assert.equal(parsed.workstreamId, "inventory-alerts");
  assert.equal(parsed.sliceId, "add-report");
  assert.deepEqual(parsed.commands, ["pathfinder current", "pathfinder review start --base main"]);
});

test("agent next redirects active unbranched slices to slice start", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd report.\n", "utf8");
  await runCli(["plan", "set", "inventory-alerts", "--file", "./plan.md"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Report",
      "--description",
      "Report reorder candidates."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);
  await git(repo, ["add", ".pathfinder"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "active slice state"]);

  const result = await runCli(["agent", "next", "--json"], repo);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.phase, "needs_slice_selection");
  assert.match(parsed.reason, /no recorded slice branch/);
  assert.deepEqual(parsed.commands, [
    "pathfinder slice start inventory-alerts add-report --base main",
    "pathfinder current"
  ]);
});

test("agent next recommends slice start with the suggested base when selecting a slice", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd report.\n", "utf8");
  await runCli(["plan", "set", "inventory-alerts", "--file", "./plan.md"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Report",
      "--description",
      "Report reorder candidates."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);

  const result = await runCli(["agent", "next", "--json"], repo);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.phase, "needs_slice_selection");
  assert.deepEqual(parsed.commands, [
    "pathfinder slice next inventory-alerts",
    "pathfinder slice start inventory-alerts add-report --base main"
  ]);
});

test("agent next reports needs_commit for dirty active slice work", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd report.\n", "utf8");
  await runCli(["plan", "set", "inventory-alerts", "--file", "./plan.md"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Report",
      "--description",
      "Report reorder candidates."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await runCli(["slice", "start", "inventory-alerts", "add-report", "--base", "main"], repo);
  await git(repo, ["add", ".pathfinder"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "slice branch state"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");

  const result = await runCli(["agent", "next", "--json"], repo);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.phase, "needs_commit");
  assert.deepEqual(parsed.commands, [
    "git status --short",
    "git add <changed-files>",
    "git commit -m \"Implement Add Report\"",
    "pathfinder review start --base main"
  ]);

  await git(repo, ["add", "src/report.ts"]);
  const staged = await runCli(["agent", "next", "--json"], repo);
  assert.equal(JSON.parse(staged.stdout).phase, "needs_commit");
});
