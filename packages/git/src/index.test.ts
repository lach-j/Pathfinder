import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { PathfinderError } from "@pathfinder/core";

import { GitAdapter, parseNameStatus } from "./index.js";

const execFileAsync = promisify(execFile);

test("returns the working tree diff from Git", async () => {
  const repo = await createTempRepo();
  await writeFile(path.join(repo, "tracked.txt"), "before\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  await writeFile(path.join(repo, "tracked.txt"), "after\n", "utf8");

  const diff = await new GitAdapter({ cwd: repo }).getWorkingTreeDiff();
  const expected = await git(repo, ["diff"]);

  assert.equal(diff, expected);
  assert.match(diff, /-before/);
  assert.match(diff, /\+after/);
});

test("returns an empty string when there is no working tree diff", async () => {
  const repo = await createTempRepo();

  await assert.doesNotReject(() => new GitAdapter({ cwd: repo }).getWorkingTreeDiff());
  assert.equal(await new GitAdapter({ cwd: repo }).getWorkingTreeDiff(), "");
});

test("returns committed diff against the merge base of a base ref", async () => {
  const repo = await createTempRepo();
  await writeFile(path.join(repo, "tracked.txt"), "base\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  await git(repo, ["checkout", "-b", "feature"]);
  await writeFile(path.join(repo, "tracked.txt"), "feature\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "feature"]);
  await writeFile(path.join(repo, "tracked.txt"), "working tree only\n", "utf8");

  const diff = await new GitAdapter({ cwd: repo }).getCommittedDiffAgainstBase("main");

  assert.match(diff, /-base/);
  assert.match(diff, /\+feature/);
  assert.doesNotMatch(diff, /working tree only/);
});

test("returns structured committed diffs against a base ref", async () => {
  const repo = await createTempRepo();
  await writeFile(path.join(repo, "tracked.txt"), "base\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  await git(repo, ["checkout", "-b", "feature"]);
  await writeFile(path.join(repo, "tracked.txt"), "feature\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "feature"]);

  const diff = await new GitAdapter({ cwd: repo }).getStructuredDiffAgainstBase("main");

  assert.equal(diff.files.length, 1);
  assert.equal(diff.files[0].path, "tracked.txt");
  assert.equal(diff.files[0].hunks[0].lines[0].kind, "deletion");
  assert.equal(diff.files[0].hunks[0].lines[0].oldLineNumber, 1);
  assert.equal(diff.files[0].hunks[0].lines[1].kind, "addition");
  assert.equal(diff.files[0].hunks[0].lines[1].newLineNumber, 1);
});

test("parses Git name-status output into categorized files", () => {
  assert.deepEqual(
    parseNameStatus(
      [
        "A\tpackages/core/src/index.ts",
        "M\tREADME.md",
        "D\tpackage.json",
        "R100\tdocs/old.md\tdocs/new.md",
        "C100\tpackages/core/src/index.ts\tpackages/core/src/copy.test.ts"
      ].join("\n")
    ),
    [
      {
        path: "packages/core/src/index.ts",
        status: "added",
        category: "source"
      },
      {
        path: "README.md",
        status: "modified",
        category: "documentation"
      },
      {
        path: "package.json",
        status: "deleted",
        category: "configuration"
      },
      {
        path: "docs/new.md",
        previousPath: "docs/old.md",
        status: "renamed",
        category: "documentation"
      },
      {
        path: "packages/core/src/copy.test.ts",
        previousPath: "packages/core/src/index.ts",
        status: "copied",
        category: "test"
      }
    ]
  );
});

test("returns a committed repository summary against the merge base of a base ref", async () => {
  const repo = await createTempRepo();
  await mkdir(path.join(repo, "docs"));
  await writeFile(path.join(repo, "README.md"), "# Test\n", "utf8");
  await writeFile(path.join(repo, "delete-me.txt"), "delete\n", "utf8");
  await writeFile(path.join(repo, "docs", "old.md"), "# Old\n", "utf8");
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  await git(repo, ["checkout", "-b", "feature"]);

  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "index.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(repo, "README.md"), "# Test\n\nUpdated.\n", "utf8");
  await rm(path.join(repo, "delete-me.txt"));
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "first changes"]);
  await rename(path.join(repo, "docs", "old.md"), path.join(repo, "docs", "new.md"));
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "rename docs"]);
  await writeFile(path.join(repo, "src", "index.ts"), "working tree only\n", "utf8");

  const summary = await new GitAdapter({ cwd: repo }).getCommittedSummaryAgainstBase("main");

  assert.equal(summary.baseRef, "main");
  assert.equal(summary.headRef, "feature");
  assert.match(summary.headCommit, /^[a-f0-9]+$/);
  assert.equal(summary.files.length, 4);
  assert.deepEqual(
    summary.files.map((file) => ({
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
      category: file.category
    })),
    [
      {
        path: "README.md",
        previousPath: undefined,
        status: "modified",
        category: "documentation"
      },
      {
        path: "delete-me.txt",
        previousPath: undefined,
        status: "deleted",
        category: "documentation"
      },
      {
        path: "docs/new.md",
        previousPath: "docs/old.md",
        status: "renamed",
        category: "documentation"
      },
      {
        path: "src/index.ts",
        previousPath: undefined,
        status: "added",
        category: "source"
      }
    ]
  );
});

test("detects dirty state and creates a branch from a base ref", async () => {
  const repo = await createTempRepo();
  await writeFile(path.join(repo, "tracked.txt"), "base\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  const adapter = new GitAdapter({ cwd: repo });

  assert.equal(await adapter.hasUncommittedChanges(), false);
  await writeFile(path.join(repo, "tracked.txt"), "dirty\n", "utf8");
  assert.equal(await adapter.hasUncommittedChanges(), true);
  await git(repo, ["checkout", "--", "tracked.txt"]);

  await adapter.createAndCheckoutBranch("pathfinder/workstream/slice", "main");

  assert.equal((await git(repo, ["branch", "--show-current"])).trim(), "pathfinder/workstream/slice");
});

test("suggests a base ref and checks out existing slice branches", async () => {
  const repo = await createTempRepo();
  await writeFile(path.join(repo, "tracked.txt"), "base\n", "utf8");
  await git(repo, ["add", "tracked.txt"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  const adapter = new GitAdapter({ cwd: repo });

  assert.equal(await adapter.getSuggestedBaseRef(), "main");
  assert.equal(await adapter.createOrCheckoutBranch("pathfinder/workstream/slice", "main"), "created");
  await git(repo, ["checkout", "main"]);
  assert.equal(await adapter.createOrCheckoutBranch("pathfinder/workstream/slice", "main"), "checked_out");
  assert.equal((await git(repo, ["branch", "--show-current"])).trim(), "pathfinder/workstream/slice");
});

test("slice branch start fails clearly when the repository has no commits", async () => {
  const repo = await createTempRepo();

  await assert.rejects(
    () => new GitAdapter({ cwd: repo }).createOrCheckoutBranch("pathfinder/workstream/slice", "main"),
    (error: unknown) => error instanceof PathfinderError && /repository has no commits/.test(error.message)
  );
});

test("fails clearly when a base ref is invalid", async () => {
  const repo = await createTempRepo();

  await assert.rejects(
    () => new GitAdapter({ cwd: repo }).getCommittedDiffAgainstBase("missing"),
    (error: unknown) => error instanceof PathfinderError && /Base ref 'missing'/.test(error.message)
  );
});

test("fails clearly outside a Git repository", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pathfinder-git-outside-"));

  await assert.rejects(
    () => new GitAdapter({ cwd: directory }).getWorkingTreeDiff(),
    (error: unknown) => error instanceof PathfinderError && /inside a Git repository/.test(error.message)
  );
});

test("fails clearly when Git is unavailable", async () => {
  const repo = await createTempRepo();

  await assert.rejects(
    () => new GitAdapter({ cwd: repo, gitBinary: "pathfinder-missing-git-binary" }).getWorkingTreeDiff(),
    (error: unknown) => error instanceof PathfinderError && /Git executable not found/.test(error.message)
  );
});

async function createTempRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-git-"));
  await git(repo, ["init", "--initial-branch=main"]);
  return repo;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout;
}
