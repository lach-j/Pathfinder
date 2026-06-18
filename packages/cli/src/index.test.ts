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

test("help lists the implemented commands", async () => {
  const result = await runCli(["help"]);

  for (const command of [
    "pathfinder init [--interactive]",
    "pathfinder init --personal [--user claude|opencode|codex|all]",
    "pathfinder init --repo [--agents]",
    "pathfinder agent bootstrap [--dry-run]",
    "pathfinder agent install --user claude|opencode|codex|all [--dry-run]",
    "pathfinder agent commands install [--tool claude|opencode] [--dry-run]",
    "pathfinder agent commands list",
    "pathfinder agent doctor [--personal] [--json]",
    "pathfinder current",
    "pathfinder agent next [--json]",
    "pathfinder agent prompt [--phase plan|implement|feedback|review|pr]",
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
    "pathfinder slice start",
    "pathfinder slice show-active",
    "pathfinder comment add",
    "pathfinder comment list",
    "pathfinder comment resolve",
    "pathfinder agent-review prompt <workstream-id> --session <session-id>",
    "pathfinder agent-review import <workstream-id> --session <session-id>",
    "pathfinder review serve [--port 4783]",
    "pathfinder workspace serve [--port 4783]",
    "pathfinder review start --base <base-ref>",
    "pathfinder review refresh <workstream-id> <session-id>",
    "pathfinder review approve <workstream-id> --session <session-id>",
    "pathfinder review sessions",
    "pathfinder review session",
    "pathfinder review create",
    "pathfinder review run --base <base-ref>",
    "pathfinder review list",
    "pathfinder review show",
    "pathfinder branch-review next [--json]",
    "pathfinder branch-review start --base <base-ref>",
    "pathfinder branch-review refresh <session-id>",
    "pathfinder branch-review approve <session-id>",
    "pathfinder branch-review sessions [--json]",
    "pathfinder branch-review session <session-id> [--json]",
    "pathfinder branch-review diff <session-id> [--json]",
    "pathfinder branch-review comment add <session-id>",
    "pathfinder branch-review comment list [--session <session-id>] [--open] [--json]",
    "pathfinder branch-review comment resolve <comment-id>",
    "pathfinder branch-review agent-review prompt --session <session-id>",
    "pathfinder branch-review agent-review import --session <session-id>",
    "pathfinder branch-review feedback export [--session <session-id>] [--file ./feedback.md]",
    "pathfinder branch-review pr generate [--base <base-ref>]",
    "pathfinder evidence add",
    "pathfinder evidence list",
    "pathfinder diff show --base <base-ref> [--json]",
    "pathfinder diff show --session <session-id> [--json]",
    "pathfinder feedback export <workstream-id> [--session <session-id>] [--file ./feedback.md]",
    "pathfinder git diff",
    "pathfinder git diff [--base <base-ref>]",
    "pathfinder git summary --base <base-ref>",
    "pathfinder pr generate <workstream-id> [--base <base-ref>]"
  ]) {
    assert.match(result.stdout, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("prints command-group help", async () => {
  const workstream = await runCli(["workstream", "--help"]);
  const slice = await runCli(["slice", "--help"]);
  const review = await runCli(["review", "--help"]);
  const workspace = await runCli(["workspace", "--help"]);
  const comment = await runCli(["comment", "--help"]);
  const agent = await runCli(["agent", "--help"]);
  const agentReview = await runCli(["agent-review", "--help"]);
  const branchReview = await runCli(["branch-review", "--help"]);

  assert.match(workstream.stdout, /Pathfinder workstream commands/);
  assert.match(workstream.stdout, /pathfinder workstream show <id> \[--json\]/);
  assert.match(slice.stdout, /Pathfinder slice commands/);
  assert.match(slice.stdout, /pathfinder slice next <workstream-id> \[--json\]/);
  assert.match(review.stdout, /Pathfinder review commands/);
  assert.match(review.stdout, /pathfinder review sessions <workstream-id> \[--json\]/);
  assert.match(workspace.stdout, /Pathfinder workspace commands/);
  assert.match(workspace.stdout, /pathfinder workspace serve \[--port 4783\]/);
  assert.match(comment.stdout, /Pathfinder comment commands/);
  assert.match(comment.stdout, /pathfinder comment list <workstream-id> \[--session <session-id>\] \[--open\] \[--json\]/);
  assert.match(agent.stdout, /Pathfinder agent commands/);
  assert.match(agent.stdout, /pathfinder agent next \[--json\]/);
  assert.match(agentReview.stdout, /Pathfinder agent review commands/);
  assert.match(agentReview.stdout, /pathfinder agent-review import <workstream-id> --session <session-id>/);
  assert.match(branchReview.stdout, /pathfinder branch-review agent-review prompt --session <session-id>/);
});
