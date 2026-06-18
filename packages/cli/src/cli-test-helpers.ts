import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { Server } from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

export async function jsonFetch(url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    },
    ...init
  });
  const body = await response.json();

  assert.ok(response.ok, JSON.stringify(body));
  return body;
}

export function serverBaseUrl(server: Server): string {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function firstOutputField(stdout: string): string {
  const field = stdout.trim().split(/\s+/)[0];
  assert.match(field, /^c-[a-z0-9]{8}$/);
  return field;
}

export async function runCli(
  args: string[],
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = {}
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
}

export async function createTempGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-"));
  await mkdir(path.join(repo, ".git"));
  return repo;
}

export async function createRealTempGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-git-"));
  await git(repo, ["init", "--initial-branch=main"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n", "utf8");
  await git(repo, ["add", "README.md"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "initial"]);
  return repo;
}

export async function createUnbornRealTempGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-cli-git-unborn-"));
  await git(repo, ["init", "--initial-branch=main"]);
  return repo;
}

export async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout;
}

export async function sortedFiles(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(directory)).sort();
}

export function isExecError(error: unknown): error is Error & { code: number; stderr: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "number" &&
    "stderr" in error &&
    typeof error.stderr === "string"
  );
}

export function sampleStagePlan(): string {
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
