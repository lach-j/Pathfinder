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

test("starts a slice branch with a caller-provided branch name", async () => {
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

  await runCli(
    [
      "slice",
      "start",
      "inventory-alerts",
      "add-reorder-report",
      "--base",
      "main",
      "--branch",
      "task/INV-1234-add-reorder-report"
    ],
    repo
  );
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", "inventory-alerts", "slices.json"),
    "utf8"
  );

  assert.equal((await git(repo, ["branch", "--show-current"])).trim(), "task/INV-1234-add-reorder-report");
  assert.match(stored, /"branchName": "task\/INV-1234-add-reorder-report"/);
});

test("slice start checks out an existing recorded branch", async () => {
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
  await runCli(["slice", "start", "inventory-alerts", "add-reorder-report", "--base", "main"], repo);
  await git(repo, ["add", ".pathfinder"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "slice branch state"]);
  await git(repo, ["checkout", "main"]);

  const result = await runCli(["slice", "start", "inventory-alerts", "add-reorder-report", "--base", "main"], repo);

  assert.match(result.stdout, /Checked out branch pathfinder\/inventory-alerts\/add-reorder-report/);
  assert.equal((await git(repo, ["branch", "--show-current"])).trim(), "pathfinder/inventory-alerts/add-reorder-report");
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

  await assert.rejects(
    () => runCli(["slice", "start", "inventory-alerts", "add-reorder-report", "--base", "main"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Cannot start a slice branch with uncommitted changes/.test(error.stderr)
  );
});

test("slice start refuses missing bases and unborn repositories clearly", async () => {
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

  await assert.rejects(
    () => runCli(["slice", "start", "inventory-alerts", "add-reorder-report", "--base", "missing"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Base ref 'missing' was not found or is not a commit/.test(error.stderr)
  );

  const unborn = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-unborn-"));
  await git(unborn, ["init", "--initial-branch=main"]);
  await runCli(["init"], unborn);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], unborn);
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
    unborn
  );

  await assert.rejects(
    () => runCli(["slice", "start", "inventory-alerts", "add-reorder-report", "--base", "main"], unborn),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /repository has no commits/.test(error.stderr)
  );
});
