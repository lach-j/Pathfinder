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
    "pathfinder plan import",
    "pathfinder plan set",
    "pathfinder plan show",
    "pathfinder slice add",
    "pathfinder slice list",
    "pathfinder slice active",
    "pathfinder slice depend",
    "pathfinder slice next",
    "pathfinder slice status",
    "pathfinder slice branch",
    "pathfinder slice show-active",
    "pathfinder comment add",
    "pathfinder comment list",
    "pathfinder comment resolve",
    "pathfinder review start --base <base-ref>",
    "pathfinder review sessions",
    "pathfinder review session",
    "pathfinder review create",
    "pathfinder review run --base <base-ref>",
    "pathfinder review list",
    "pathfinder review show",
    "pathfinder evidence add",
    "pathfinder evidence list",
    "pathfinder git diff",
    "pathfinder git diff [--base <base-ref>]",
    "pathfinder git summary --base <base-ref>",
    "pathfinder pr generate <workstream-id> [--base <base-ref>]"
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
  assert.match(secondNext.stdout, /pathfinder slice active inventory-alerts add-report/);
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

  await assert.rejects(
    () => runCli(["review", "start", "--base", "missing"], repo),
    (error: unknown) =>
      isExecError(error) &&
      error.code === 1 &&
      /Error: Base ref 'missing' was not found or is not a commit\./.test(error.stderr)
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
  await runCli(
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
  assert.match(result.stdout, /- Open comment `resolve-before-pr` \(slice `add-report`\): Resolve before PR\./);
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

function sampleStagePlan(): string {
  return `# Inventory Alerts - Stage Plan

Epic: INV-1
Originating ticket: INV-2
Created: 2026-06-13

## Context
Build local inventory alerts.

## Stages

| Stage | Issue | Title | Status |
| ----- | ---- | ----- | ------ |
| 1 | INV-1 | Add Data Source | pending |
| 2 | INV-2 | Add Report | pending |

---

## Stage 1: Add Data Source (INV-1) [status: pending]

**Scope:** Create local data.
**Acceptance criteria:** Data loads from disk.
**Depends on:** None.
**Commit breakdown:**
1. Add model

## Stage 2: Add Report (INV-2) [status: pending]

**Scope:** Report reorder candidates.
**Acceptance criteria:** Report lists low stock.
**Open items:** Confirm threshold.
**Depends on:** Stage 1 data source.
**Commit breakdown:**
1. Add report
`;
}
