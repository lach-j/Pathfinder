import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

test("help lists the implemented MVP commands", async () => {
  const result = await runCli(["help"]);

  for (const command of [
    "pathfinder init",
    "pathfinder current",
    "pathfinder workstream create",
    "pathfinder workstream list",
    "pathfinder workstream show",
    "pathfinder requirement set",
    "pathfinder requirement show",
    "pathfinder plan set",
    "pathfinder plan show",
    "pathfinder slice add",
    "pathfinder slice list",
    "pathfinder slice active",
    "pathfinder slice status",
    "pathfinder slice branch",
    "pathfinder slice show-active",
    "pathfinder comment add",
    "pathfinder comment list",
    "pathfinder comment resolve",
    "pathfinder review create",
    "pathfinder review list",
    "pathfinder review show",
    "pathfinder git diff",
    "pathfinder git diff [--base <base-ref>]",
    "pathfinder pr generate"
  ]) {
    assert.match(result.stdout, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
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

  assert.match(result.stdout, /- Add Reorder Report \(`add-reorder-report`\): Create a local report/);
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

async function runCli(args: string[], cwd = process.cwd()): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
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

function isExecError(error: unknown): error is Error & { code: number; stderr: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "number" &&
    "stderr" in error &&
    typeof error.stderr === "string"
  );
}
