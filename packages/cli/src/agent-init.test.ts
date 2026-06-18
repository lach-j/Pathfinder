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

test("diagnoses missing agent integration setup from the CLI", async () => {
  const repo = await createTempGitRepo();

  const text = await runCli(["agent", "doctor"], repo);
  const json = await runCli(["agent", "doctor", "--json"], repo);
  const parsed = JSON.parse(json.stdout);

  assert.match(text.stdout, /# Pathfinder Agent Doctor/);
  assert.match(text.stdout, /\[missing\] pathfinder-state/);
  assert.match(text.stdout, /Fix: pathfinder init/);
  assert.match(text.stdout, /\[missing\] agents-md/);
  assert.match(text.stdout, /Fix: pathfinder agent bootstrap/);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.next.phase, "uninitialized");
  assert.equal(parsed.next.command, "pathfinder agent next --json");
  assert.deepEqual(
    parsed.checks.map((check: { id: string; status: string }) => [check.id, check.status]),
    [
      ["pathfinder-state", "missing"],
      ["agents-md", "missing"],
      ["claude-commands", "missing"],
      ["opencode-commands", "missing"],
      ["agent-next", "pass"]
    ]
  );
});

test("diagnoses fully installed agent integration setup from the CLI", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["agent", "bootstrap"], repo);
  await runCli(["agent", "commands", "install"], repo);

  const result = await runCli(["agent", "doctor", "--json"], repo);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.next.phase, "needs_workstream");
  assert.deepEqual(
    parsed.checks.map((check: { id: string; status: string }) => [check.id, check.status]),
    [
      ["pathfinder-state", "pass"],
      ["agents-md", "pass"],
      ["claude-commands", "pass"],
      ["opencode-commands", "pass"],
      ["agent-next", "pass"]
    ]
  );
});

test("diagnoses personal agent setup from the CLI", async () => {
  const repo = await createTempGitRepo();
  const pathfinderHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-home-"));
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-user-home-"));
  const env = { PATHFINDER_HOME: pathfinderHome, PATHFINDER_USER_HOME: userHome };

  const missing = await runCli(["agent", "doctor", "--personal", "--json"], repo, env);
  const missingParsed = JSON.parse(missing.stdout);

  assert.equal(missingParsed.ok, false);
  assert.deepEqual(
    missingParsed.checks.map((check: { id: string; status: string }) => [check.id, check.status]),
    [
      ["cli-command", "pass"],
      ["state-mode", "missing"],
      ["external-project-state", "missing"],
      ["user-claude-instructions", "missing"],
      ["user-opencode-instructions", "pass"],
      ["repo-footprint", "pass"],
      ["agent-next", "pass"]
    ]
  );

  await runCli(["init", "--personal", "--user", "claude"], repo, env);

  const text = await runCli(["agent", "doctor", "--personal"], repo, env);
  const json = await runCli(["agent", "doctor", "--personal", "--json"], repo, env);
  const parsed = JSON.parse(json.stdout);

  assert.match(text.stdout, /# Pathfinder Agent Doctor/);
  assert.match(text.stdout, /\[pass\] state-mode/);
  assert.match(text.stdout, /\[pass\] repo-footprint/);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.next.phase, "needs_workstream");
  assert.deepEqual(
    parsed.checks.map((check: { id: string; status: string }) => [check.id, check.status]),
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

test("installs and lists native agent command wrappers from the CLI", async () => {
  const repo = await createTempGitRepo();

  const emptyList = await runCli(["agent", "commands", "list"], repo);
  const dryRun = await runCli(["agent", "commands", "install", "--dry-run"], repo);
  const claudeInstall = await runCli(["agent", "commands", "install", "--tool", "claude"], repo);
  const opencodeInstall = await runCli(["agent", "commands", "install", "--tool", "opencode"], repo);
  const list = await runCli(["agent", "commands", "list"], repo);
  const claudePlan = await readFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "utf8");
  const opencodeFeedback = await readFile(
    path.join(repo, ".opencode", "commands", "pathfinder-feedback.md"),
    "utf8"
  );

  assert.match(emptyList.stdout, /pathfinder-plan: missing at \.claude\/commands\/pathfinder-plan\.md/);
  assert.match(dryRun.stdout, /would write: claude\/pathfinder-plan/);
  assert.match(dryRun.stdout, /would write: opencode\/pathfinder-feedback/);
  assert.match(claudeInstall.stdout, /wrote: claude\/pathfinder-plan/);
  assert.doesNotMatch(claudeInstall.stdout, /opencode\/pathfinder-plan/);
  assert.match(opencodeInstall.stdout, /wrote: opencode\/pathfinder-feedback/);
  assert.match(list.stdout, /pathfinder-plan: installed at \.claude\/commands\/pathfinder-plan\.md/);
  assert.match(list.stdout, /pathfinder-feedback: installed at \.opencode\/commands\/pathfinder-feedback\.md/);
  assert.match(claudePlan, /Do not infer the Pathfinder workflow manually/);
  assert.match(opencodeFeedback, /pathfinder agent prompt --phase feedback/);
});

test("installs user-level Claude instructions from the CLI without repo files", async () => {
  const repo = await createTempGitRepo();
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-user-home-"));
  const env = { PATHFINDER_USER_HOME: userHome };

  const dryRun = await runCli(["agent", "install", "--user", "claude", "--dry-run"], repo, env);
  await assert.rejects(() => readFile(path.join(userHome, ".claude", "CLAUDE.md"), "utf8"));
  const install = await runCli(["agent", "install", "--user", "claude"], repo, env);
  const secondInstall = await runCli(["agent", "install", "--user", "claude"], repo, env);
  const written = await readFile(path.join(userHome, ".claude", "CLAUDE.md"), "utf8");
  const opencode = await runCli(["agent", "install", "--user", "opencode", "--dry-run"], repo, env);

  assert.match(dryRun.stdout, /would write: claude -> \.claude\/CLAUDE\.md/);
  assert.match(dryRun.stdout, /pathfinder-cli-user-home/);
  assert.match(install.stdout, /wrote: claude -> \.claude\/CLAUDE\.md/);
  assert.match(secondInstall.stdout, /unchanged: claude -> \.claude\/CLAUDE\.md/);
  assert.match(written, /pathfinder agent doctor --json/);
  assert.match(opencode.stdout, /manual: opencode/);
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(repo, ".claude", "CLAUDE.md"), "utf8"));
});

test("installs user-level Codex instructions from the CLI without duplicate managed blocks", async () => {
  const repo = await createTempGitRepo();
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-user-home-"));
  const env = { PATHFINDER_USER_HOME: userHome };

  const install = await runCli(["agent", "install", "--user", "codex"], repo, env);
  const secondInstall = await runCli(["agent", "install", "--user", "codex"], repo, env);
  const written = await readFile(path.join(userHome, ".codex", "AGENTS.md"), "utf8");

  assert.match(install.stdout, /wrote: codex -> AGENTS\.md/);
  assert.match(secondInstall.stdout, /unchanged: codex -> AGENTS\.md/);
  assert.match(written, /pathfinder agent doctor --json/);
  assert.equal((written.match(/<!-- pathfinder-user-agent:start -->/g) ?? []).length, 1);
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
});

test("does not overwrite user-owned native agent command files from the CLI", async () => {
  const repo = await createTempGitRepo();
  await mkdir(path.join(repo, ".claude", "commands"), { recursive: true });
  await writeFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "# Custom command\n", "utf8");

  const install = await runCli(["agent", "commands", "install", "--tool", "claude"], repo);
  const written = await readFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "utf8");
  const list = await runCli(["agent", "commands", "list"], repo);

  assert.match(install.stdout, /skip: claude\/pathfinder-plan/);
  assert.equal(written, "# Custom command\n");
  assert.match(list.stdout, /pathfinder-plan: user-owned at \.claude\/commands\/pathfinder-plan\.md/);
});

test("bootstraps repository agent instructions from the CLI", async () => {
  const repo = await createTempGitRepo();
  await writeFile(path.join(repo, "AGENTS.md"), "# Existing\n", "utf8");

  const dryRun = await runCli(["agent", "bootstrap", "--dry-run"], repo);
  const beforeWrite = await readFile(path.join(repo, "AGENTS.md"), "utf8");
  const writeResult = await runCli(["agent", "bootstrap"], repo);
  const secondWrite = await runCli(["agent", "bootstrap"], repo);
  const written = await readFile(path.join(repo, "AGENTS.md"), "utf8");

  assert.match(dryRun.stdout, /pathfinder agent next --json/);
  assert.equal(beforeWrite, "# Existing\n");
  assert.match(writeResult.stdout, /Updated .*AGENTS\.md\./);
  assert.match(secondWrite.stdout, /No changes needed for .*AGENTS\.md\./);
  assert.match(written, /^# Existing\n\n<!-- pathfinder-agent:start -->/);
  assert.equal((written.match(/<!-- pathfinder-agent:start -->/g) ?? []).length, 1);
});

test("init --agents initialises state and bootstraps instructions", async () => {
  const repo = await createTempGitRepo();

  const result = await runCli(["init", "--agents"], repo);
  const project = await readFile(path.join(repo, ".pathfinder", "project.json"), "utf8");
  const agents = await readFile(path.join(repo, "AGENTS.md"), "utf8");

  assert.match(result.stdout, /Initialised Pathfinder/);
  assert.match(result.stdout, /Updated .*AGENTS\.md\./);
  assert.match(project, /"schemaVersion": 1/);
  assert.match(agents, /pathfinder agent next --json/);
});

test("init --personal --user claude sets up personal state and user-level instructions", async () => {
  const repo = await createTempGitRepo();
  const pathfinderHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-home-"));
  const userHome = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-user-home-"));
  const env = { PATHFINDER_HOME: pathfinderHome, PATHFINDER_USER_HOME: userHome };

  const result = await runCli(["init", "--personal", "--user", "claude"], repo, env);
  const projectIds = await sortedFiles(path.join(pathfinderHome, "projects"));
  const projectRoot = path.join(pathfinderHome, "projects", projectIds[0]);
  const claudeInstructions = await readFile(path.join(userHome, ".claude", "CLAUDE.md"), "utf8");

  assert.match(result.stdout, /Initialised Pathfinder/);
  assert.match(result.stdout, /State: personal external Pathfinder state\./);
  assert.match(result.stdout, /wrote: claude -> \.claude\/CLAUDE\.md/);
  assert.equal(projectIds.length, 1);
  assert.match(await readFile(path.join(projectRoot, "project.json"), "utf8"), /"schemaVersion": 1/);
  assert.match(claudeInstructions, /pathfinder agent next --json/);
  await assert.rejects(() => readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"));
  await assert.rejects(() => readFile(path.join(repo, "AGENTS.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(repo, ".claude", "commands", "pathfinder-plan.md"), "utf8"));
});
