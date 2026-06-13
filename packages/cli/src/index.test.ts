import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
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
    "pathfinder plan set",
    "pathfinder plan show",
    "pathfinder slice add",
    "pathfinder slice list",
    "pathfinder slice active",
    "pathfinder slice show-active",
    "pathfinder comment add",
    "pathfinder comment list",
    "pathfinder comment resolve",
    "pathfinder review create",
    "pathfinder review list",
    "pathfinder review show",
    "pathfinder git diff",
    "pathfinder pr generate"
  ]) {
    assert.match(result.stdout, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
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

async function runCli(args: string[], cwd = process.cwd()): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
}

async function createTempGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-"));
  await mkdir(path.join(repo, ".git"));
  return repo;
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
