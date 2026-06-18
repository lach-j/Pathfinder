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
