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
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);

  await assert.rejects(
    () => runCli(["review", "start", "--base", "missing"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Base ref 'missing' was not found or is not a commit\./.test(error.stderr)
  );
});

test("review start requires a clean committed worktree", async () => {
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
  await git(repo, ["checkout", "-b", "feature-review-cleanliness"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");

  await assert.rejects(
    () => runCli(["review", "start", "--base", "main"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Cannot start a review session with uncommitted changes/.test(error.stderr) &&
      /Commit the relevant changes, stash or remove unrelated changes/.test(error.stderr)
  );

  await git(repo, ["add", "src/report.ts"]);
  await assert.rejects(
    () => runCli(["review", "start", "--base", "main"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Cannot start a review session with uncommitted changes/.test(error.stderr)
  );

  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  const clean = await runCli(["review", "start", "--base", "main"], repo);

  assert.match(clean.stdout, /# Pathfinder Review Session/);
  assert.match(clean.stdout, /Head ref: feature-review-cleanliness/);
  assert.match(clean.stdout, /Changed files: 1/);
});

test("review approve records approval and advances agent next", async () => {
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
  await runCli(
    [
      "slice",
      "add",
      "inventory-alerts",
      "--title",
      "Add Chart",
      "--description",
      "Chart reorder candidates."
    ],
    repo
  );
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-approval"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);

  const session = await runCli(["review", "start", "--base", "main"], repo);
  assert.match(session.stdout, /Session: review-add-report/);

  const beforeApproval = JSON.parse((await runCli(["agent", "next", "--json"], repo)).stdout);
  assert.equal(beforeApproval.phase, "awaiting_human_approval");
  assert.equal(beforeApproval.compatibilityPhase, "needs_human_review");
  assert.deepEqual(beforeApproval.commands.at(-1), "pathfinder review approve inventory-alerts --session review-add-report");

  const approval = await runCli(["review", "approve", "inventory-alerts", "--session", "review-add-report"], repo);
  assert.match(approval.stdout, /# Pathfinder Review Approval/);
  assert.match(approval.stdout, /Slice status: complete/);
  assert.match(approval.stdout, /explicit review decision/);

  const afterApproval = JSON.parse((await runCli(["agent", "next", "--json"], repo)).stdout);
  assert.equal(afterApproval.phase, "needs_slice_selection");
  assert.equal(afterApproval.sliceId, "add-chart");
});
