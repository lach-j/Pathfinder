import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { PathfinderError } from "@pathfinder/core";

import { GitAdapter } from "./index.js";

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
  await git(repo, ["init"]);
  return repo;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout;
}
