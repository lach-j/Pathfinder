import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { Server } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { serveReviewServer } from "@pathfinder/local-server";

const execFileAsync = promisify(execFile);
const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

test("help lists the implemented commands", async () => {
  const result = await runCli(["help"]);

  for (const command of [
    "pathfinder init [--interactive]",
    "pathfinder init --personal [--user claude|opencode|codex|all]",
    "pathfinder init --repo [--agents]",
    "pathfinder agent bootstrap [--dry-run]",
    "pathfinder agent install --user claude|opencode|codex|all [--dry-run]",
    "pathfinder agent commands install [--tool claude|opencode] [--dry-run]",
    "pathfinder agent commands list",
    "pathfinder agent doctor [--json]",
    "pathfinder current",
    "pathfinder agent next [--json]",
    "pathfinder agent prompt [--phase plan|implement|feedback|review|pr]",
    "pathfinder workstream create",
    "pathfinder workstream list",
    "pathfinder workstream show",
    "pathfinder requirement set",
    "pathfinder requirement show",
    "pathfinder plan import",
    "pathfinder plan set",
    "pathfinder plan show",
    "pathfinder slice add",
    "pathfinder slice list",
    "pathfinder slice active",
    "pathfinder slice depend",
    "pathfinder slice next",
    "pathfinder slice status",
    "pathfinder slice branch",
    "pathfinder slice show-active",
    "pathfinder comment add",
    "pathfinder comment list",
    "pathfinder comment resolve",
    "pathfinder review serve [--port 4783]",
    "pathfinder review start --base <base-ref>",
    "pathfinder review refresh <workstream-id> <session-id>",
    "pathfinder review sessions",
    "pathfinder review session",
    "pathfinder review create",
    "pathfinder review run --base <base-ref>",
    "pathfinder review list",
    "pathfinder review show",
    "pathfinder evidence add",
    "pathfinder evidence list",
    "pathfinder diff show --base <base-ref> [--json]",
    "pathfinder diff show --session <session-id> [--json]",
    "pathfinder feedback export <workstream-id> [--session <session-id>] [--file ./feedback.md]",
    "pathfinder git diff",
    "pathfinder git diff [--base <base-ref>]",
    "pathfinder git summary --base <base-ref>",
    "pathfinder pr generate <workstream-id> [--base <base-ref>]"
  ]) {
    assert.match(result.stdout, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

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

  const result = await runCli(["agent", "next", "--json"], repo);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.phase, "ready_to_implement");
  assert.equal(parsed.workstreamId, "inventory-alerts");
  assert.equal(parsed.sliceId, "add-report");
  assert.deepEqual(parsed.commands, ["pathfinder current", "pathfinder review start --base <base-ref>"]);
});

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

test("sets and shows workstream requirements", async () => {
  const repo = await createTempGitRepo();
  await writeFile(path.join(repo, "requirements.md"), "# Requirements\n\nSend low-stock alerts.\n", "utf8");

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  const setResult = await runCli(
    ["requirement", "set", "inventory-alerts", "--file", "./requirements.md"],
    repo
  );
  const showResult = await runCli(["requirement", "show", "inventory-alerts"], repo);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "requirements.md"),
    "utf8"
  );

  assert.match(setResult.stdout, /Updated requirements for inventory-alerts\./);
  assert.equal(showResult.stdout, "# Requirements\n\nSend low-stock alerts.\n");
  assert.equal(stored, "# Requirements\n\nSend low-stock alerts.\n");
});

test("imports a stored stage plan from the CLI", async () => {
  const repo = await createTempGitRepo();
  await writeFile(path.join(repo, "PLAN.md"), sampleStagePlan(), "utf8");

  await runCli(["init"], repo);
  const importResult = await runCli(["plan", "import", "--file", "./PLAN.md"], repo);
  const workstreams = await runCli(["workstream", "list"], repo);
  const slices = await runCli(["slice", "list", "inventory-alerts"], repo);
  const plan = await runCli(["plan", "show", "inventory-alerts"], repo);

  assert.match(importResult.stdout, /Imported workstream: inventory-alerts\tInventory Alerts/);
  assert.match(importResult.stdout, /Imported slice: add-data-source\tAdd Data Source/);
  assert.match(importResult.stdout, /Imported slice: add-report\tAdd Report/);
  assert.match(workstreams.stdout, /inventory-alerts\tInventory Alerts/);
  assert.match(slices.stdout, /add-data-source\tproposed\tAdd Data Source/);
  assert.match(slices.stdout, /add-report\tproposed\tAdd Report/);
  assert.equal(plan.stdout, sampleStagePlan());
});

test("reports invalid stage plan imports clearly", async () => {
  const repo = await createTempGitRepo();
  await writeFile(path.join(repo, "PLAN.md"), "# Inventory Alerts - Stage Plan\n\n## Context\nNo stages.\n", "utf8");

  await runCli(["init"], repo);

  await assert.rejects(
    () => runCli(["plan", "import", "--file", "./PLAN.md"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Could not import stage plan: no '## Stage N:' sections were found\./.test(error.stderr)
  );
});

test("shows a clear empty-state for missing requirements", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);

  const result = await runCli(["requirement", "show", "inventory-alerts"], repo);

  assert.match(result.stdout, /No requirements recorded\./);
});

test("includes requirements in current context", async () => {
  const repo = await createTempGitRepo();
  await writeFile(path.join(repo, "requirements.md"), "# Requirements\n\nSend low-stock alerts.\n", "utf8");

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(["requirement", "set", "inventory-alerts", "--file", "./requirements.md"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Reorder Report",
      "--description",
      "Create a local report for low stock items."
    ],
    repo
  );
  await runCli(["slice", "active", "inventory-alerts", "add-reorder-report"], repo);

  const result = await runCli(["current"], repo);

  assert.match(result.stdout, /## Requirements/);
  assert.match(result.stdout, /Location: .*requirements\.md/);
  assert.match(result.stdout, /Send low-stock alerts\./);
});

test("reports unknown commands with usage guidance", async () => {
  await assert.rejects(
    () => runCli(["nope"]),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Unknown command 'nope'\. Run 'pathfinder help' for usage\./.test(error.stderr)
  );
});

test("reports missing required options with usage guidance", async () => {
  const repo = await createTempGitRepo();

  await assert.rejects(
    () => runCli(["workstream", "create"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Missing required option --title\. Run 'pathfinder help' for usage\./.test(error.stderr)
  );
});

test("reports uninitialised Pathfinder state clearly", async () => {
  const repo = await createTempGitRepo();

  await assert.rejects(
    () => runCli(["workstream", "list"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Pathfinder state not found\. Run 'pathfinder init' first\./.test(error.stderr)
  );
});

test("updates slice status and includes completed slices in generated PR markdown", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Reorder Report",
      "--description",
      "Create a local report for low stock items."
    ],
    repo
  );
  await runCli(["slice", "status", "inventory-alerts", "add-reorder-report", "complete"], repo);
  const result = await runCli(["pr", "generate", "inventory-alerts"], repo);

  assert.match(result.stdout, /- Add Reorder Report \(`add-reorder-report`, complete\): Create a local report/);
});

test("adds, lists, and includes evidence in current context and PR markdown", async () => {
  const repo = await createTempGitRepo();
  await writeFile(path.join(repo, "test-output.log"), "tests passed\n", "utf8");

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  const addResult = await runCli(
    [
      "evidence",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--kind",
      "test",
      "--description",
      "npm test passed",
      "--path",
      "./test-output.log"
    ],
    repo
  );
  const listResult = await runCli(["evidence", "list", "inventory-alerts"], repo);
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);
  const currentResult = await runCli(["current"], repo);
  const prResult = await runCli(["pr", "generate", "inventory-alerts"], repo);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "evidence.json"),
    "utf8"
  );

  assert.match(addResult.stdout, /npm-test-passed\ttest\tadd-report\tnpm test passed\t\.\/test-output\.log/);
  assert.equal(listResult.stdout, addResult.stdout);
  assert.match(currentResult.stdout, /## Evidence/);
  assert.match(currentResult.stdout, /npm-test-passed \[test\]: npm test passed \(\.\/test-output\.log\)/);
  assert.match(prResult.stdout, /- `npm-test-passed` \[test\]: npm test passed \(\.\/test-output\.log\)/);
  assert.match(stored, /"path": "\.\/test-output\.log"/);
});

test("reports evidence validation errors", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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

  await assert.rejects(
    () =>
      runCli(
        [
          "evidence",
          "add",
          "inventory-alerts",
          "--slice",
          "add-report",
          "--kind",
          "video",
          "--description",
          "demo"
        ],
        repo
      ),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Invalid evidence kind 'video'\./.test(error.stderr)
  );
  await assert.rejects(
    () =>
      runCli(
        [
          "evidence",
          "add",
          "inventory-alerts",
          "--slice",
          "missing",
          "--kind",
          "test",
          "--description",
          "npm test passed"
        ],
        repo
      ),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Slice 'missing' was not found in workstream 'inventory-alerts'\./.test(error.stderr)
  );
});

test("adds dependencies and selects the next actionable slice", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Data Source",
      "--description",
      "Create local inventory data."
    ],
    repo
  );
  const addDependent = await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Report",
      "--description",
      "Report reorder candidates.",
      "--depends-on",
      "add-data-source"
    ],
    repo
  );
  const list = await runCli(["slice", "list", "inventory-alerts"], repo);
  const firstNext = await runCli(["slice", "next", "inventory-alerts"], repo);
  await runCli(["slice", "status", "inventory-alerts", "add-data-source", "complete"], repo);
  const secondNext = await runCli(["slice", "next", "inventory-alerts"], repo);

  assert.match(addDependent.stdout, /add-report\tproposed\tAdd Report\tdepends-on:add-data-source/);
  assert.match(list.stdout, /add-report\tproposed\tAdd Report\tdepends-on:add-data-source/);
  assert.match(firstNext.stdout, /add-data-source\tproposed\tAdd Data Source/);
  assert.match(secondNext.stdout, /add-report\tproposed\tAdd Report\tdepends-on:add-data-source/);
  assert.match(secondNext.stdout, /pathfinder slice active inventory-alerts add-report/);
});

test("adds dependencies after creation and reports duplicate dependency errors", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Data Source",
      "--description",
      "Create local inventory data."
    ],
    repo
  );
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

  const result = await runCli(["slice", "depend", "inventory-alerts", "add-report", "add-data-source"], repo);

  assert.match(result.stdout, /add-report\tproposed\tAdd Report\tdepends-on:add-data-source/);
  await assert.rejects(
    () => runCli(["slice", "depend", "inventory-alerts", "add-report", "add-data-source"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Slice 'add-report' already depends on 'add-data-source'\./.test(error.stderr)
  );
});

test("reports when no slice is actionable", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Done Slice",
      "--description",
      "Already done."
    ],
    repo
  );
  await runCli(["slice", "status", "inventory-alerts", "done-slice", "complete"], repo);

  const result = await runCli(["slice", "next", "inventory-alerts"], repo);

  assert.match(result.stdout, /No actionable slices found\./);
});

test("starts a slice branch and records branch metadata", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Reorder Report",
      "--description",
      "Create a local report for low stock items."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);

  await runCli(["slice", "branch", "inventory-alerts", "add-reorder-report", "--base", "main"], repo);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "slices.json"),
    "utf8"
  );

  assert.equal((await git(repo, ["branch", "--show-current"])).trim(), "pathfinder/inventory-alerts/add-reorder-report");
  assert.match(stored, /"branchName": "pathfinder\/inventory-alerts\/add-reorder-report"/);
  assert.match(stored, /"baseRef": "main"/);
});

test("refuses to start a slice branch with uncommitted changes", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Reorder Report",
      "--description",
      "Create a local report for low stock items."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await writeFile(path.join(repo, "dirty.txt"), "dirty\n", "utf8");

  await assert.rejects(
    () => runCli(["slice", "branch", "inventory-alerts", "add-reorder-report", "--base", "main"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Cannot start a slice branch with uncommitted changes/.test(error.stderr)
  );
});

test("prints a repository summary for committed changes against a base ref", async () => {
  const repo = await createRealTempGitRepo();

  await git(repo, ["checkout", "-b", "feature-summary"]);
  await mkdir(path.join(repo, "src"));
  await mkdir(path.join(repo, "docs"));
  await writeFile(path.join(repo, "src", "index.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(repo, "docs", "summary.md"), "# Summary\n", "utf8");
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "feature"]);
  await writeFile(path.join(repo, "src", "index.ts"), "working tree only\n", "utf8");

  const result = await runCli(["git", "summary", "--base", "main"], repo);

  assert.match(result.stdout, /# Repository Summary/);
  assert.match(result.stdout, /Base ref: main/);
  assert.match(result.stdout, /Head ref: feature-summary/);
  assert.match(result.stdout, /Changed files: 2/);
  assert.match(result.stdout, /Added: 2/);
  assert.match(result.stdout, /- A\tdocumentation\tdocs\/summary\.md/);
  assert.match(result.stdout, /- A\tsource\tsrc\/index\.ts/);
  assert.doesNotMatch(result.stdout, /working tree only/);
});

test("prints committed diff against a base ref without working tree changes", async () => {
  const repo = await createRealTempGitRepo();

  await git(repo, ["checkout", "-b", "feature-diff"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n\nCommitted change.\n", "utf8");
  await git(repo, ["add", "README.md"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "feature"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n\nWorking tree only.\n", "utf8");

  const result = await runCli(["git", "diff", "--base", "main"], repo);

  assert.match(result.stdout, /\+Committed change\./);
  assert.doesNotMatch(result.stdout, /Working tree only/);
});

test("prints structured diff output for committed changes against a base ref", async () => {
  const repo = await createRealTempGitRepo();

  await git(repo, ["checkout", "-b", "feature-structured-diff"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n\nCommitted change.\n", "utf8");
  await git(repo, ["add", "README.md"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "feature"]);

  const result = await runCli(["diff", "show", "--base", "main"], repo);
  const json = await runCli(["diff", "show", "--base", "main", "--json"], repo);
  const parsed = JSON.parse(json.stdout);

  assert.match(result.stdout, /# Pathfinder Diff/);
  assert.match(result.stdout, /## M README\.md/);
  assert.match(result.stdout, /@@ -1 \+1,3 @@/);
  assert.match(result.stdout, /\+Committed change\./);
  assert.equal(parsed.files[0].path, "README.md");
  assert.equal(
    parsed.files[0].hunks[0].lines.some(
      (line: { kind: string; text: string }) => line.kind === "addition" && line.text === "Committed change."
    ),
    true
  );
});

test("prints structured diff output for a stored review session", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await git(repo, ["checkout", "-b", "feature-session-diff"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);

  const result = await runCli(["diff", "show", "--session", "review-add-report", "--json"], repo);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.files[0].path, "src/report.ts");
  assert.equal(parsed.files[0].status, "added");
  assert.equal(parsed.files[0].hunks[0].lines[0].newLineNumber, 1);
});

test("reports missing and invalid summary base refs clearly", async () => {
  const repo = await createRealTempGitRepo();

  await assert.rejects(
    () => runCli(["git", "summary"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Missing required option --base\. Run 'pathfinder help' for usage\./.test(error.stderr)
  );
  await assert.rejects(
    () => runCli(["git", "summary", "--base", "missing"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Base ref 'missing' was not found or is not a commit\./.test(error.stderr)
  );
});

test("runs a deterministic review against committed branch changes", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await writeFile(path.join(repo, "requirements.md"), "# Requirements\n\nReport reorder candidates.\n", "utf8");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd a local report.\n", "utf8");
  await runCli(["requirement", "set", "inventory-alerts", "--file", "./requirements.md"], repo);
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
  await runCli(["slice", "status", "inventory-alerts", "add-report", "in_progress"], repo);
  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--body",
      "Confirm docs mention the report."
    ],
    repo
  );
  await runCli(
    [
      "evidence",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--kind",
      "test",
      "--description",
      "npm test passed"
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-review"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);

  const result = await runCli(["review", "run", "--base", "main"], repo);
  const list = await runCli(["review", "list", "inventory-alerts"], repo);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "reviews.json"),
    "utf8"
  );

  assert.match(result.stdout, /# Pathfinder Deterministic Review/);
  assert.match(result.stdout, /Review: deterministic-review/);
  assert.match(result.stdout, /Base ref: main/);
  assert.match(result.stdout, /- \[warning\] 1 unresolved comment\(s\) remain for the active slice\./);
  assert.match(result.stdout, /- npm-test-passed \[test\]: npm test passed/);
  assert.match(result.stdout, /- A\tsource\tsrc\/report\.ts/);
  assert.match(list.stdout, /deterministic-review\topen\tadd-report\tDeterministic review against main: 1 warning\(s\)\./);
  assert.match(stored, /"checks": \[/);
});

test("starts, lists, and shows a review session against committed branch changes", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await git(repo, ["checkout", "-b", "feature-session"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);

  const start = await runCli(["review", "start", "--base", "main"], repo);
  const list = await runCli(["review", "sessions", "inventory-alerts"], repo);
  const show = await runCli(["review", "session", "inventory-alerts", "review-add-report"], repo);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "review-sessions.json"),
    "utf8"
  );

  assert.match(start.stdout, /# Pathfinder Review Session/);
  assert.match(start.stdout, /Session: review-add-report/);
  assert.match(start.stdout, /Base ref: main/);
  assert.match(start.stdout, /Head ref: feature-session/);
  assert.match(start.stdout, /Changed files: 1/);
  assert.match(start.stdout, /- A\tsource\tsrc\/report\.ts/);
  assert.match(list.stdout, /review-add-report\tadd-report\tmain\tfeature-session\t[a-f0-9]+\t1 file\(s\)/);
  assert.match(show.stdout, /"id": "review-add-report"/);
  assert.match(show.stdout, /"sliceId": "add-report"/);
  assert.match(show.stdout, /"changedFiles": \[/);
  assert.match(stored, /"sessions": \[/);
});

test("refreshes review sessions and reports stale comment anchors", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await git(repo, ["checkout", "-b", "feature-refresh"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const first = 1;\nexport const second = 2;\n", "utf8");
  await writeFile(path.join(repo, "src", "removed.ts"), "export const removed = true;\n", "utf8");
  await git(repo, ["add", "src"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report files"]);
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
      "Keep this line."
    ],
    repo
  );
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
      "2",
      "--side",
      "new",
      "--body",
      "This line will move away."
    ],
    repo
  );
  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--session",
      "review-add-report",
      "--file",
      "src/removed.ts",
      "--line",
      "1",
      "--side",
      "new",
      "--body",
      "This file will disappear."
    ],
    repo
  );
  await writeFile(path.join(repo, "src", "report.ts"), "export const first = 1;\n", "utf8");
  await import("node:fs/promises").then(({ rm }) => rm(path.join(repo, "src", "removed.ts")));
  await git(repo, ["add", "src"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "address feedback"]);

  const refresh = await runCli(["review", "refresh", "inventory-alerts", "review-add-report"], repo);
  const comments = await runCli(["comment", "list", "inventory-alerts", "--session", "review-add-report", "--open"], repo);
  const show = await runCli(["review", "session", "inventory-alerts", "review-add-report"], repo);

  assert.match(refresh.stdout, /Session: review-add-report/);
  assert.match(refresh.stdout, /Changed files: 1/);
  assert.match(refresh.stdout, /Anchor status: 2 stale, 0 unknown\./);
  assert.match(comments.stdout, /keep-this-line\topen\tanchor:current/);
  assert.match(comments.stdout, /this-line-will-move-away\topen\tanchor:stale/);
  assert.match(comments.stdout, /this-file-will-disappear\topen\tanchor:stale/);
  assert.match(show.stdout, /"refreshedAt":/);
});

test("adds, lists, filters, and resolves file and line comments for a review session", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--body",
      "Keep compatibility."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-inline-comments"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);

  const fileComment = await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--session",
      "review-add-report",
      "--file",
      "src/report.ts",
      "--body",
      "Review this file."
    ],
    repo
  );
  const lineComment = await runCli(
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
      "Handle the empty case."
    ],
    repo
  );
  const list = await runCli(["comment", "list", "inventory-alerts", "--session", "review-add-report", "--open"], repo);
  await runCli(["comment", "resolve", "inventory-alerts", "handle-the-empty-case"], repo);
  const openList = await runCli(["comment", "list", "inventory-alerts", "--session", "review-add-report", "--open"], repo);

  assert.match(fileComment.stdout, /review-this-file\topen\tsession review-add-report file src\/report\.ts\tReview this file\./);
  assert.match(
    lineComment.stdout,
    /handle-the-empty-case\topen\tsession review-add-report file src\/report\.ts new line 1\tHandle the empty case\./
  );
  assert.match(list.stdout, /review-this-file/);
  assert.match(list.stdout, /handle-the-empty-case/);
  assert.doesNotMatch(list.stdout, /keep-compatibility/);
  assert.match(openList.stdout, /review-this-file/);
  assert.doesNotMatch(openList.stdout, /handle-the-empty-case/);
});

test("exports feedback queue to stdout and a markdown file", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--body",
      "Keep compatibility."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-feedback"]);
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
      "Handle the empty case."
    ],
    repo
  );

  const stdoutResult = await runCli(["feedback", "export", "inventory-alerts"], repo);
  const fileResult = await runCli(
    ["feedback", "export", "inventory-alerts", "--session", "review-add-report", "--file", "./feedback.md"],
    repo
  );
  const written = await readFile(path.join(repo, "feedback.md"), "utf8");

  assert.match(stdoutResult.stdout, /# Pathfinder Feedback Queue/);
  assert.match(stdoutResult.stdout, /Keep compatibility\./);
  assert.match(stdoutResult.stdout, /Handle the empty case\./);
  assert.match(fileResult.stdout, /Wrote feedback queue to .*feedback\.md\./);
  assert.match(written, /- Session: `review-add-report`/);
  assert.match(written, /Handle the empty case\./);
  assert.doesNotMatch(written, /Keep compatibility\./);
});

test("exports useful empty feedback queue output", async () => {
  const repo = await createTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);

  const result = await runCli(["feedback", "export", "inventory-alerts"], repo);

  assert.match(result.stdout, /No open feedback items found\./);
});

test("serves local review JSON endpoints and mutates comments", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await git(repo, ["checkout", "-b", "feature-review-server"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);

  const server = await serveReviewServer({ cwd: repo, port: 0, silent: true });
  try {
    const baseUrl = serverBaseUrl(server);
    const html = await fetch(`${baseUrl}/`);
    const htmlText = await html.text();
    const scriptMatch = htmlText.match(/src="([^"]+\.js)"/);
    const styleMatch = htmlText.match(/href="([^"]+\.css)"/);
    assert.ok(scriptMatch);
    assert.ok(styleMatch);
    const script = await fetch(`${baseUrl}${scriptMatch[1]}`);
    const style = await fetch(`${baseUrl}${styleMatch[1]}`);
    const current = await jsonFetch(`${baseUrl}/api/current`);
    const workstreams = await jsonFetch(`${baseUrl}/api/workstreams`);
    const sessions = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/review-sessions`);
    const diff = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/review-sessions/review-add-report/diff`);
    const added = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: "Handle the empty case.",
        sessionId: "review-add-report",
        filePath: "src/report.ts",
        lineNumber: 1,
        side: "new"
      })
    });
    await git(repo, ["rm", "src/report.ts"]);
    await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "remove report"]);
    const refreshed = await jsonFetch(
      `${baseUrl}/api/workstreams/inventory-alerts/review-sessions/review-add-report/refresh`,
      { method: "POST" }
    );
    const comments = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/comments?session=review-add-report`);
    const feedback = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/feedback?session=review-add-report`);
    const resolved = await jsonFetch(
      `${baseUrl}/api/workstreams/inventory-alerts/comments/handle-the-empty-case/resolve`,
      { method: "POST" }
    );
    const openComments = await jsonFetch(
      `${baseUrl}/api/workstreams/inventory-alerts/comments?session=review-add-report&open=true`
    );

    assert.equal(html.status, 200);
    assert.match(htmlText, /Pathfinder Review/);
    assert.match(htmlText, /id="root"/);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type") ?? "", /text\/javascript/);
    assert.equal(style.status, 200);
    assert.match(style.headers.get("content-type") ?? "", /text\/css/);
    assert.equal(current.activeSlice.id, "add-report");
    assert.equal(workstreams.workstreams[0].id, "inventory-alerts");
    assert.equal(sessions.sessions[0].id, "review-add-report");
    assert.equal(diff.session.id, "review-add-report");
    assert.equal(diff.diff.files[0].path, "src/report.ts");
    assert.equal(added.comment.id, "handle-the-empty-case");
    assert.equal(refreshed.comments[0].anchorStatus, "stale");
    assert.equal(comments.comments.length, 1);
    assert.equal(comments.comments[0].anchorStatus, "stale");
    assert.match(feedback.markdown, /Handle the empty case\./);
    assert.equal(resolved.comment.resolved, true);
    assert.equal(openComments.comments.length, 0);
  } finally {
    await closeServer(server);
  }
});

test("serves JSON errors when Pathfinder state is missing", async () => {
  const repo = await createRealTempGitRepo();
  const server = await serveReviewServer({ cwd: repo, port: 0, silent: true });

  try {
    const response = await fetch(`${serverBaseUrl(server)}/api/current`);
    const body = await response.json() as { error: string };

    assert.equal(response.status, 400);
    assert.match(body.error, /Pathfinder state not found/);
  } finally {
    await closeServer(server);
  }
});

test("reports invalid inline comment session files and lines clearly", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
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
  await git(repo, ["checkout", "-b", "feature-inline-comment-errors"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);

  await assert.rejects(
    () =>
      runCli(
        [
          "comment",
          "add",
          "inventory-alerts",
          "--session",
          "missing",
          "--file",
          "src/report.ts",
          "--body",
          "Missing session."
        ],
        repo
      ),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Review session 'missing' was not found\./.test(error.stderr)
  );
  await assert.rejects(
    () =>
      runCli(
        [
          "comment",
          "add",
          "inventory-alerts",
          "--session",
          "review-add-report",
          "--file",
          "src/missing.ts",
          "--body",
          "Missing file."
        ],
        repo
      ),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: File 'src\/missing\.ts' was not found in review session 'review-add-report'\./.test(error.stderr)
  );
  await assert.rejects(
    () =>
      runCli(
        [
          "comment",
          "add",
          "inventory-alerts",
          "--session",
          "review-add-report",
          "--file",
          "src/report.ts",
          "--line",
          "2",
          "--side",
          "new",
          "--body",
          "Missing line."
        ],
        repo
      ),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Line 2 \(new\) was not found for 'src\/report\.ts'/.test(error.stderr)
  );
});

test("review session start reports missing active slice and invalid base refs", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);

  await assert.rejects(
    () => runCli(["review", "start", "--base", "main"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: No active slice set\. Use 'pathfinder slice active <workstream-id> <slice-id>' first\./.test(
        error.stderr
      )
  );

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

  await assert.rejects(
    () => runCli(["review", "start", "--base", "missing"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Base ref 'missing' was not found or is not a commit\./.test(error.stderr)
  );
});

test("generates PR markdown with committed repository summary", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await writeFile(path.join(repo, "requirements.md"), "# Requirements\n\nReport reorder candidates.\n", "utf8");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd a local report.\n", "utf8");
  await runCli(["requirement", "set", "inventory-alerts", "--file", "./requirements.md"], repo);
  await runCli(["plan", "set", "inventory-alerts", "--file", "./plan.md"], repo);
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Data Source",
      "--description",
      "Create local inventory data."
    ],
    repo
  );
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Report",
      "--description",
      "Report reorder candidates.",
      "--depends-on",
      "add-data-source"
    ],
    repo
  );
  await runCli(["slice", "status", "inventory-alerts", "add-data-source", "complete"], repo);
  await runCli(["slice", "status", "inventory-alerts", "add-report", "review"], repo);
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);
  await runCli(
    [
      "evidence",
      "add",
      "inventory-alerts",
      "--slice",
      "add-data-source",
      "--kind",
      "test",
      "--description",
      "npm test passed"
    ],
    repo
  );
  await runCli(
    [
      "comment",
      "add",
      "inventory-alerts",
      "--slice",
      "add-report",
      "--body",
      "Resolve before PR."
    ],
    repo
  );
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-pr"]);
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
  await runCli(["comment", "resolve", "inventory-alerts", "resolve-before-pr"], repo);
  await runCli(
    ["feedback", "export", "inventory-alerts", "--session", "review-add-report", "--file", "./.pathfinder-feedback.md"],
    repo
  );

  const result = await runCli(["pr", "generate", "inventory-alerts", "--base", "main"], repo);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "pr.md"),
    "utf8"
  );

  assert.equal(stored, result.stdout);
  assert.match(result.stdout, /## Requirements/);
  assert.match(result.stdout, /Report reorder candidates\./);
  assert.match(result.stdout, /## Remaining Slices/);
  assert.match(result.stdout, /- Add Report \(`add-report`, review\): Report reorder candidates\. Dependencies: `add-data-source`\./);
  assert.match(result.stdout, /## Changed Files/);
  assert.match(result.stdout, /- Base ref: `main`/);
  assert.match(result.stdout, /- Head ref: `feature-pr`/);
  assert.match(result.stdout, /- A source: src\/report\.ts/);
  assert.match(result.stdout, /- `npm-test-passed` \[test\]: npm test passed/);
  assert.match(result.stdout, /## Review Sessions/);
  assert.match(result.stdout, /- Session `review-add-report` for slice `add-report`: base `main`, head `feature-pr`/);
  assert.match(result.stdout, /## Local Review Feedback/);
  assert.match(result.stdout, /- `handle-empty-report-data` \(open; session review-add-report file src\/report\.ts new line 1\): Handle empty report data\./);
  assert.match(result.stdout, /- `resolve-before-pr` \(resolved, resolved .*; slice `add-report`\): Resolve before PR\./);
  assert.match(result.stdout, /## Agent Feedback Queue/);
  assert.match(result.stdout, /- Exported feedback queue: `.pathfinder-feedback\.md`/);
  assert.match(result.stdout, /- 1 unresolved review comment\(s\) remain\./);
});

async function jsonFetch(url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    },
    ...init
  });
  const body = await response.json();

  assert.ok(response.ok, JSON.stringify(body));
  return body;
}

function serverBaseUrl(server: Server): string {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function runCli(
  args: string[],
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = {}
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
}

async function createTempGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-"));
  await mkdir(path.join(repo, ".git"));
  return repo;
}

async function createRealTempGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-git-"));
  await git(repo, ["init", "--initial-branch=main"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n", "utf8");
  await git(repo, ["add", "README.md"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  return repo;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout;
}

async function sortedFiles(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(directory)).sort();
}

function isExecError(error: unknown): error is Error & { code: number; stderr: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "number" &&
    "stderr" in error &&
    typeof error.stderr === "string"
  );
}

function sampleStagePlan(): string {
  return `# Inventory Alerts - Stage Plan

Epic: INV-1
Originating ticket: INV-2
Created: 2026-06-13

## Context
Build local inventory alerts.

## Stages

| Stage | Issue | Title | Status |
| ----- | ---- | ----- | ------ |
| 1 | INV-1 | Add Data Source | pending |
| 2 | INV-2 | Add Report | pending |

---

## Stage 1: Add Data Source (INV-1) [status: pending]

**Scope:** Create local data.
**Acceptance criteria:** Data loads from disk.
**Depends on:** None.
**Commit breakdown:**
1. Add model

## Stage 2: Add Report (INV-2) [status: pending]

**Scope:** Report reorder candidates.
**Acceptance criteria:** Report lists low stock.
**Open items:** Confirm threshold.
**Depends on:** Stage 1 data source.
**Commit breakdown:**
1. Add report
`;
}
