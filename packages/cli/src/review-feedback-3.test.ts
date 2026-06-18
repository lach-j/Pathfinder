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
  const fileCommentId = firstOutputField(fileComment.stdout);
  const lineCommentId = firstOutputField(lineComment.stdout);
  await runCli(["comment", "resolve", "inventory-alerts", lineCommentId], repo);
  const openList = await runCli(["comment", "list", "inventory-alerts", "--session", "review-add-report", "--open"], repo);

  assert.match(fileComment.stdout, /^c-[a-z0-9]{8}\topen\tsession review-add-report file src\/report\.ts\tReview this file\./);
  assert.match(
    lineComment.stdout,
    /^c-[a-z0-9]{8}\topen\tsession review-add-report file src\/report\.ts new line 1\tHandle the empty case\./
  );
  assert.match(list.stdout, new RegExp(fileCommentId));
  assert.match(list.stdout, new RegExp(lineCommentId));
  assert.doesNotMatch(list.stdout, /keep-compatibility/);
  assert.match(openList.stdout, new RegExp(fileCommentId));
  assert.doesNotMatch(openList.stdout, new RegExp(lineCommentId));
});

test("exports and imports workstream agent review comments", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await runCli(
    ["slice", "add", "inventory-alerts", "--title", "Add Report", "--description", "Report reorder candidates."],
    repo
  );
  await runCli(["slice", "active", "inventory-alerts", "add-report"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-agent-review"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);
  await writeFile(
    path.join(repo, "agent-comments.json"),
    JSON.stringify({
      runId: "first-pass",
      comments: [
        { filePath: "src/report.ts", lineNumber: 1, side: "new", body: "Check the empty report case." },
        { filePath: "src/report.ts", lineNumber: 99, side: "new", body: "Falls back to file level." },
        { body: "Whole session concern." }
      ]
    }),
    "utf8"
  );

  const prompt = await runCli(["agent-review", "prompt", "inventory-alerts", "--session", "review-add-report"], repo);
  const imported = await runCli(
    ["agent-review", "import", "inventory-alerts", "--session", "review-add-report", "--file", "./agent-comments.json"],
    repo
  );
  const list = JSON.parse(
    (await runCli(["comment", "list", "inventory-alerts", "--session", "review-add-report", "--json"], repo)).stdout
  );
  const feedback = await runCli(["feedback", "export", "inventory-alerts", "--session", "review-add-report"], repo);

  assert.match(prompt.stdout, /Pathfinder Agent Review Prompt/);
  assert.match(imported.stdout, /Imported 3 agent review comments/);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((comment: { origin?: string }) => comment.origin), ["agent", "agent"]);
  assert.deepEqual(list.map((comment: { target: { type: string } }) => comment.target.type), ["line", "file"]);
  assert.doesNotMatch(feedback.stdout, /Check the empty report case/);
});

test("exports and imports branch-review agent comments", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-branch-agent-review"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["branch-review", "start", "--base", "main"], repo);
  await writeFile(
    path.join(repo, "branch-agent-comments.json"),
    JSON.stringify({
      comments: [
        { filePath: "src/report.ts", lineNumber: 1, side: "new", body: "Branch agent line comment." },
        { body: "Branch session concern." }
      ]
    }),
    "utf8"
  );

  const prompt = await runCli(
    ["branch-review", "agent-review", "prompt", "--session", "review-feature-branch-agent-review"],
    repo
  );
  const imported = await runCli(
    [
      "branch-review",
      "agent-review",
      "import",
      "--session",
      "review-feature-branch-agent-review",
      "--file",
      "./branch-agent-comments.json"
    ],
    repo
  );
  const list = JSON.parse(
    (await runCli(["branch-review", "comment", "list", "--session", "review-feature-branch-agent-review", "--json"], repo)).stdout
  );
  const feedback = await runCli(["branch-review", "feedback", "export", "--session", "review-feature-branch-agent-review"], repo);

  assert.match(prompt.stdout, /Pathfinder Agent Review Prompt/);
  assert.match(imported.stdout, /Imported 2 agent branch review comments/);
  assert.equal(list.length, 1);
  assert.equal(list[0].origin, "agent");
  assert.equal(list[0].target.type, "line");
  assert.doesNotMatch(feedback.stdout, /Branch agent line comment/);
});
