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

test("serves local review JSON endpoints and mutates comments", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await runCli(["workstream", "create", "--title", "Inventory Alerts"], repo);
  await writeFile(path.join(repo, "requirements.md"), "# Requirements\n\nReport reorder candidates.\n", "utf8");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nAdd report.\n", "utf8");
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
  await runCli(["review", "create", "inventory-alerts", "--slice", "add-report", "--summary", "Manual review passed"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-review-server"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["review", "start", "--base", "main"], repo);
  await runCli(["pr", "generate", "inventory-alerts"], repo);

  const server = await serveWorkspaceServer({ cwd: repo, port: 0, silent: true });
  try {
    const baseUrl = serverBaseUrl(server);
    const html = await fetch(`${baseUrl}/`);
    const htmlText = await html.text();
    const scriptMatch = htmlText.match(/src="([^"]+\.js)"/);
    const styleMatch = htmlText.match(/href="([^"]+\.css)"/);
    assert.ok(scriptMatch);
    assert.ok(styleMatch);
    const script = await fetch(`${baseUrl}${scriptMatch[1]}`);
    const style = await fetch(`${baseUrl}${styleMatch[1]}`);
    const current = await jsonFetch(`${baseUrl}/api/current`);
    const workspace = await jsonFetch(`${baseUrl}/api/workspace`);
    const workstreams = await jsonFetch(`${baseUrl}/api/workstreams`);
    const overview = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/overview`);
    const active = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/slices/add-report/active`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const sessions = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/review-sessions`);
    const diff = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/review-sessions/review-add-report/diff`);
    const added = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: "Handle the empty case.",
        sessionId: "review-add-report",
        filePath: "src/report.ts",
        lineNumber: 1,
        side: "new"
      })
    });
    await git(repo, ["rm", "src/report.ts"]);
    await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "remove report"]);
    const refreshed = await jsonFetch(
      `${baseUrl}/api/workstreams/inventory-alerts/review-sessions/review-add-report/refresh`,
      { method: "POST" }
    );
    const comments = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/comments?session=review-add-report`);
    const feedback = await jsonFetch(`${baseUrl}/api/workstreams/inventory-alerts/feedback?session=review-add-report`);
    const resolved = await jsonFetch(
      `${baseUrl}/api/workstreams/inventory-alerts/comments/${added.comment.id}/resolve`,
      { method: "POST" }
    );
    const openComments = await jsonFetch(
      `${baseUrl}/api/workstreams/inventory-alerts/comments?session=review-add-report&open=true`
    );

    assert.equal(html.status, 200);
    assert.match(htmlText, /Pathfinder Review/);
    assert.match(htmlText, /id="root"/);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type") ?? "", /text\/javascript/);
    assert.equal(style.status, 200);
    assert.match(style.headers.get("content-type") ?? "", /text\/css/);
    assert.equal(current.activeSlice.id, "add-report");
    assert.equal(workspace.project.activeWorkstreamId, "inventory-alerts");
    assert.equal(workspace.activeWorkstream.id, "inventory-alerts");
    assert.equal(workspace.activeSlice.id, "add-report");
    assert.equal(workspace.workstreams[0].id, "inventory-alerts");
    assert.equal(workstreams.workstreams[0].id, "inventory-alerts");
    assert.equal(overview.workstream.id, "inventory-alerts");
    assert.match(overview.requirements.markdown, /Report reorder candidates\./);
    assert.match(overview.requirements.path, /requirements\.md$/);
    assert.match(overview.plan.markdown, /Add report\./);
    assert.match(overview.plan.path, /plan\.md$/);
    assert.equal(overview.slices[0].id, "add-report");
    assert.equal(overview.reviewSessions[0].id, "review-add-report");
    assert.equal(overview.reviews[0].id, "manual-review-passed");
    assert.equal(overview.evidence[0].id, "npm-test-passed");
    assert.match(overview.prDraft.markdown, /## Summary/);
    assert.match(overview.prDraft.path, /pr\.md$/);
    assert.equal(active.slice.id, "add-report");
    assert.equal(active.workstream.activeSliceId, "add-report");
    assert.equal(sessions.sessions[0].id, "review-add-report");
    assert.equal(diff.session.id, "review-add-report");
    assert.equal(diff.diff.files[0].path, "src/report.ts");
    assert.match(added.comment.id, /^c-[a-z0-9]{8}$/);
    assert.notEqual(added.comment.id, "handle-the-empty-case");
    assert.equal(refreshed.comments[0].anchorStatus, "stale");
    assert.equal(comments.comments.length, 1);
    assert.equal(comments.comments[0].anchorStatus, "stale");
    assert.match(feedback.markdown, /Handle the empty case\./);
    assert.equal(resolved.comment.resolved, true);
    assert.equal(openComments.comments.length, 0);
  } finally {
    await closeServer(server);
  }
});

test("serves branch review JSON endpoints and mutates comments", async () => {
  const repo = await createRealTempGitRepo();

  await runCli(["init"], repo);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "pathfinder state"]);
  await git(repo, ["checkout", "-b", "feature-branch-review-server"]);
  await mkdir(path.join(repo, "src"));
  await writeFile(path.join(repo, "src", "report.ts"), "export const report = [];\n", "utf8");
  await git(repo, ["add", "src/report.ts"]);
  await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "add report"]);
  await runCli(["branch-review", "start", "--base", "main"], repo);

  const server = await serveWorkspaceServer({ cwd: repo, port: 0, silent: true });
  try {
    const baseUrl = serverBaseUrl(server);
    const overview = await jsonFetch(`${baseUrl}/api/branch-review`);
    const sessions = await jsonFetch(`${baseUrl}/api/branch-review/sessions`);
    const diff = await jsonFetch(`${baseUrl}/api/branch-review/sessions/review-feature-branch-review-server/diff`);
    const added = await jsonFetch(`${baseUrl}/api/branch-review/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: "Handle the empty branch case.",
        sessionId: "review-feature-branch-review-server",
        filePath: "src/report.ts",
        lineNumber: 1,
        side: "new"
      })
    });
    await git(repo, ["rm", "src/report.ts"]);
    await git(repo, ["-c", "user.name=Pathfinder Test", "-c", "user.email=test@example.invalid", "commit", "-m", "remove report"]);
    const refreshed = await jsonFetch(
      `${baseUrl}/api/branch-review/sessions/review-feature-branch-review-server/refresh`,
      { method: "POST" }
    );
    const comments = await jsonFetch(
      `${baseUrl}/api/branch-review/comments?session=review-feature-branch-review-server`
    );
    const resolved = await jsonFetch(
      `${baseUrl}/api/branch-review/comments/${added.comment.id}/resolve`,
      { method: "POST" }
    );
    const openComments = await jsonFetch(
      `${baseUrl}/api/branch-review/comments?session=review-feature-branch-review-server&open=true`
    );

    assert.equal(overview.sessions[0].id, "review-feature-branch-review-server");
    assert.match(overview.prDraft.path, /branch-reviews[\\/]+pr\.md$/);
    assert.equal(sessions.sessions[0].id, "review-feature-branch-review-server");
    assert.equal(diff.session.id, "review-feature-branch-review-server");
    assert.equal(diff.diff.files[0].path, "src/report.ts");
    assert.match(added.comment.id, /^c-[a-z0-9]{8}$/);
    assert.notEqual(added.comment.id, "handle-the-empty-branch-case");
    assert.equal(refreshed.comments[0].anchorStatus, "stale");
    assert.equal(comments.comments.length, 1);
    assert.equal(comments.comments[0].anchorStatus, "stale");
    assert.equal(resolved.comment.resolved, true);
    assert.equal(openComments.comments.length, 0);
  } finally {
    await closeServer(server);
  }
});

test("serves JSON errors when Pathfinder state is missing", async () => {
  const repo = await createRealTempGitRepo();
  const server = await serveReviewServer({ cwd: repo, port: 0, silent: true });

  try {
    const response = await fetch(`${serverBaseUrl(server)}/api/current`);
    const body = await response.json() as { error: string };

    assert.equal(response.status, 400);
    assert.match(body.error, /Pathfinder state not found/);
  } finally {
    await closeServer(server);
  }
});
