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

test("runs standalone branch review with comments feedback approval and PR markdown", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-branch-review"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);

  const initialNext = await runCli(["branch-review", "next", "--json"], repo);
  const parsedInitialNext = JSON.parse(initialNext.stdout);
  const start = await runCli(["branch-review", "start", "--base", "main"], repo);
  const approvalNext = await runCli(["branch-review", "next", "--json"], repo);
  const parsedApprovalNext = JSON.parse(approvalNext.stdout);
  const list = await runCli(["branch-review", "sessions"], repo);
  const diff = await runCli(["branch-review", "diff", "review-feature-branch-review"], repo);
  const comment = await runCli(
    [
      "branch-review",
      "comment",
      "add",
      "review-feature-branch-review",
      "--file",
      "src/report.ts",
      "--line",
      "1",
      "--side",
      "new",
      "--body",
      "Handle the empty branch case."
    ],
    repo
  );
  const feedbackNext = await runCli(["branch-review", "next", "--json"], repo);
  const parsedFeedbackNext = JSON.parse(feedbackNext.stdout);
  const feedback = await runCli(
    [
      "branch-review",
      "feedback",
      "export",
      "--session",
      "review-feature-branch-review",
      "--file",
      ".pathfinder-branch-feedback.md"
    ],
    repo
  );
  let approvalError: Error & { code: number; stderr: string } | undefined;
  try {
    await runCli(["branch-review", "approve", "review-feature-branch-review"], repo);
  } catch (error) {
    if (isExecError(error)) {
      approvalError = error;
    } else {
      throw error;
    }
  }
  const branchCommentId = firstOutputField(comment.stdout);
  assert.ok(approvalError);
  await runCli(["branch-review", "comment", "resolve", branchCommentId], repo);
  const approve = await runCli(["branch-review", "approve", "review-feature-branch-review"], repo);
  const prNext = await runCli(["branch-review", "next", "--json"], repo);
  const parsedPrNext = JSON.parse(prNext.stdout);
  const pr = await runCli(["branch-review", "pr", "generate", "--base", "main"], repo);
  const completeNext = await runCli(["branch-review", "next", "--json"], repo);
  const parsedCompleteNext = JSON.parse(completeNext.stdout);
  const storedPr = await readFile(path.join(repo, ".pathfinder", "branch-reviews", "pr.md"), "utf8");
  const agentNext = await runCli(["agent", "next", "--json"], repo);
  const parsedAgentNext = JSON.parse(agentNext.stdout);

  assert.equal(parsedInitialNext.phase, "needs_session");
  assert.deepEqual(parsedInitialNext.commands, ["pathfinder branch-review start --base main"]);
  assert.match(start.stdout, /# Pathfinder Branch Review Session/);
  assert.match(start.stdout, /Session: review-feature-branch-review/);
  assert.match(start.stdout, /Base ref: main/);
  assert.match(start.stdout, /Head ref: feature-branch-review/);
  assert.match(start.stdout, /- A\tsource\tsrc\/report\.ts/);
  assert.equal(parsedApprovalNext.phase, "awaiting_human_approval");
  assert.equal(parsedApprovalNext.reviewSessionId, "review-feature-branch-review");
  assert.match(list.stdout, /review-feature-branch-review\tmain\tfeature-branch-review\t[a-f0-9]+\t1 file\(s\)/);
  assert.match(diff.stdout, /src\/report\.ts/);
  assert.match(
    comment.stdout,
    /^c-[a-z0-9]{8}\topen\tsession review-feature-branch-review file src\/report\.ts new line 1\tHandle the empty branch case\./
  );
  assert.equal(parsedFeedbackNext.phase, "feedback");
  assert.deepEqual(parsedFeedbackNext.commands, [
    "pathfinder branch-review feedback export --session review-feature-branch-review --file ./.pathfinder-branch-feedback.md",
    "pathfinder branch-review refresh review-feature-branch-review"
  ]);
  assert.match(feedback.stdout, /Exported branch review feedback queue to \.pathfinder-branch-feedback\.md\./);
  assert.match(
    approvalError.stderr,
    /Cannot approve branch review session 'review-feature-branch-review' while 1 open review comment\(s\) remain/
  );
  assert.match(approve.stdout, /# Pathfinder Branch Review Approval/);
  assert.match(approve.stdout, /Session: review-feature-branch-review/);
  assert.equal(parsedPrNext.phase, "ready_for_pr");
  assert.deepEqual(parsedPrNext.commands, ["pathfinder branch-review pr generate --base main"]);
  assert.equal(storedPr, pr.stdout.replace(/^Wrote branch review PR markdown to .+\r?\n/, ""));
  assert.match(pr.stdout, /## Branch Review Sessions/);
  assert.match(pr.stdout, /Session `review-feature-branch-review`/);
  assert.match(pr.stdout, /approved /);
  assert.match(pr.stdout, new RegExp(`- \`${branchCommentId}\` \\(resolved, resolved .*; session review-feature-branch-review file src\\/report\\.ts new line 1\\): Handle the empty branch case\\.`));
  assert.equal(parsedCompleteNext.phase, "complete");
  assert.equal(parsedAgentNext.phase, "needs_workstream");
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
  const currentComment = await runCli(
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
  const movedComment = await runCli(
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
  const removedFileComment = await runCli(
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
  assert.match(comments.stdout, new RegExp(`${firstOutputField(currentComment.stdout)}\\topen\\tanchor:current`));
  assert.match(comments.stdout, new RegExp(`${firstOutputField(movedComment.stdout)}\\topen\\tanchor:stale`));
  assert.match(comments.stdout, new RegExp(`${firstOutputField(removedFileComment.stdout)}\\topen\\tanchor:stale`));
  assert.match(show.stdout, /"refreshedAt":/);
});
