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
