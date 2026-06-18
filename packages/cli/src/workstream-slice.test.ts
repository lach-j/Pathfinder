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
