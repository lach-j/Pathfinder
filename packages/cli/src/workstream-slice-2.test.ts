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
  assert.match(secondNext.stdout, /pathfinder slice start inventory-alerts add-report --base <base-ref>/);
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

test("starts a slice branch and sets it active", async () => {
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

  const result = await runCli(["slice", "start", "inventory-alerts", "add-reorder-report", "--base", "main"], repo);
  const current = await runCli(["current"], repo);

  assert.match(result.stdout, /Started branch pathfinder\/inventory-alerts\/add-reorder-report/);
  assert.equal((await git(repo, ["branch", "--show-current"])).trim(), "pathfinder/inventory-alerts/add-reorder-report");
  assert.match(current.stdout, /Active slice: Add Reorder Report \(add-reorder-report\)/);
  assert.match(current.stdout, /Status: proposed/);
});
