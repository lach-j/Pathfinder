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

test("review start reports unborn repositories clearly", async () => {
  const repo = await createUnbornRealTempGitRepo();

  await assert.rejects(
    () => runCli(["review", "start", "--base", "main"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Cannot start a review session because this repository has no commits/.test(error.stderr) &&
      /Create a first baseline commit/.test(error.stderr)
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
  const resolvedBeforePr = await runCli(
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
  const resolvedBeforePrId = firstOutputField(resolvedBeforePr.stdout);
  await runCli(["comment", "resolve", "inventory-alerts", resolvedBeforePrId], repo);
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
  assert.match(result.stdout, /- `c-[a-z0-9]{8}` \(open; session review-add-report file src\/report\.ts new line 1\): Handle empty report data\./);
  assert.match(result.stdout, new RegExp(`- \`${resolvedBeforePrId}\` \\(resolved, resolved .*; slice \`add-report\`\\): Resolve before PR\\.`));
  assert.match(result.stdout, /## Agent Feedback Queue/);
  assert.match(result.stdout, /- Exported feedback queue: `.pathfinder-feedback\.md`/);
  assert.match(result.stdout, /- 1 unresolved review comment\(s\) remain\./);
});
