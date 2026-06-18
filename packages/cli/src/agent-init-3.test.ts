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

test("prints agent prompts in automatic and explicit phase modes", async () => {
  const repo = await createTempGitRepo();

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
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);

  const explicitImplement = await runCli(["agent", "prompt", "--phase", "implement"], repo);

  assert.match(explicitImplement.stdout, /# Pathfinder Agent Prompt: implement/);
  assert.match(explicitImplement.stdout, /`pathfinder current`/);
  assert.match(explicitImplement.stdout, /Implement only slice `add-report`/);

  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--body",
      "Add tests."
    ],
    repo
  );

  const automaticFeedback = await runCli(["agent", "prompt"], repo);

  assert.match(automaticFeedback.stdout, /# Pathfinder Agent Prompt: feedback/);
  assert.match(automaticFeedback.stdout, /`pathfinder feedback export inventory-alerts --file \.\/\.pathfinder-feedback\.md`/);
  assert.match(automaticFeedback.stdout, /Do not resolve comments/);
});

test("agent prompt uses Python checks in Python-only repositories", async () => {
  const repo = await createTempGitRepo();

  await writeFile(path.join(repo, "pyproject.toml"), "[project]\nname = \"demo\"\n", "utf8");
  await mkdir(path.join(repo, "tests"));
  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Python Tool"], repo);
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd report.\n", "utf8");
  await runCli(["plan", "set", "python-tool", "--file", "./plan.md"], repo);
  await runCli(
    ["slice", "add", "python-tool", "--title", "Add Report", "--description", "Report reorder candidates."],
    repo
  );
  await runCli(["slice", "active", "python-tool", "add-report"], repo);

  const prompt = await runCli(["agent", "prompt", "--phase", "implement"], repo);

  assert.match(prompt.stdout, /`python -m pytest`/);
  assert.doesNotMatch(prompt.stdout, /npm run typecheck/);
  assert.doesNotMatch(prompt.stdout, /npm test/);
  assert.doesNotMatch(prompt.stdout, /npm run lint --if-present/);
});

test("prints JSON for agent-friendly read-only commands", async () => {
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
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-json-commands"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);
  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--session",
      "review-add-report",
      "--file",
      "src/report.ts",
      "--line",
      "1",
      "--side",
      "new",
      "--body",
      "Handle empty report data."
    ],
    repo
  );

  const workstreamShow = JSON.parse((await runCli(["workstream", "show", "inventory-alerts", "--json"], repo)).stdout);
  const workstreamList = JSON.parse((await runCli(["workstream", "list", "--json"], repo)).stdout);
  const sliceList = JSON.parse((await runCli(["slice", "list", "inventory-alerts", "--json"], repo)).stdout);
  const nextSlice = JSON.parse((await runCli(["slice", "next", "inventory-alerts", "--json"], repo)).stdout);
  const sessions = JSON.parse((await runCli(["review", "sessions", "inventory-alerts", "--json"], repo)).stdout);
  const comments = JSON.parse(
    (await runCli(["comment", "list", "inventory-alerts", "--session", "review-add-report", "--open", "--json"], repo)).stdout
  );

  assert.equal(workstreamShow.id, "inventory-alerts");
  assert.equal(workstreamList[0].id, "inventory-alerts");
  assert.equal(sliceList[0].id, "add-report");
  assert.equal(nextSlice.id, "add-report");
  assert.equal(sessions[0].id, "review-add-report");
  assert.match(comments[0].id, /^c-[a-z0-9]{8}$/);
  assert.notEqual(comments[0].id, "handle-empty-report-data");
});

test("agent next and prompt reference external feedback path in external mode", async () => {
  const repo = await createTempGitRepo();
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
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo, env);
  await runCli(
    ["comment", "add", "inventory-alerts", "--slice", "add-report", "--body", "Add tests."],
    repo,
    env
  );

  const next = await runCli(["agent", "next", "--json"], repo, env);
  const prompt = await runCli(["agent", "prompt"], repo, env);
  const parsed = JSON.parse(next.stdout);

  assert.equal(parsed.phase, "feedback");
  assert.match(parsed.feedbackQueuePath, /projects.*\.pathfinder-feedback\.md/);
  assert.deepEqual(parsed.commands, ["pathfinder feedback export inventory-alerts"]);
  assert.match(parsed.agentInstruction, /projects.*\.pathfinder-feedback\.md/);
  assert.match(prompt.stdout, /`pathfinder feedback export inventory-alerts`/);
  assert.match(prompt.stdout, /Export and read `.*projects.*\.pathfinder-feedback\.md`/);
});
