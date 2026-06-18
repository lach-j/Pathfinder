import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PathfinderError } from "@pathfinder/core";

import { PathfinderStore } from "./index.js";

import {
  createTempRepo,
  duplicateTitleStagePlan,
  sampleStagePlan,
  sortedFiles,
  structuredDiff,
  structuredDiffFile
} from "./state-test-helpers.js";

test("adds and lists slice evidence in human-readable state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Evidence Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add evidence support.");
  const logPath = path.join(repo, "test-output.log");
  await writeFile(logPath, "tests passed\n", "utf8");

  const first = await store.addEvidence(workstream.id, slice.id, "test", "npm test passed", "./test-output.log");
  const second = await store.addEvidence(workstream.id, slice.id, "test", "npm test passed");
  const evidence = await store.listEvidence(workstream.id);
  const storedFile = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "evidence.json"),
    "utf8"
  );

  assert.equal(first.id, "npm-test-passed");
  assert.equal(first.sliceId, slice.id);
  assert.equal(first.kind, "test");
  assert.equal(first.path, "./test-output.log");
  assert.equal(second.id, "npm-test-passed-2");
  assert.equal(evidence.length, 2);
  assert.match(storedFile, /"evidence": \[/);
  assert.match(storedFile, /\n    \{/);
});

test("validates evidence workstream, slice, kind, description, and path", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Evidence Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add evidence support.");

  await assert.rejects(() => store.addEvidence("missing", slice.id, "test", "npm test passed"), PathfinderError);
  await assert.rejects(() => store.addEvidence(workstream.id, "missing", "test", "npm test passed"), PathfinderError);
  await assert.rejects(() => store.addEvidence(workstream.id, slice.id, "video", "Demo captured."), PathfinderError);
  await assert.rejects(() => store.addEvidence(workstream.id, slice.id, "test", " "), PathfinderError);
  await assert.rejects(
    () => store.addEvidence(workstream.id, slice.id, "log", "Log captured.", "./missing.log"),
    PathfinderError
  );
});

test("adds, lists, and resolves review comments", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add comment support.");

  const first = await store.addComment(workstream.id, slice.id, "Needs tests.");
  const second = await store.addComment(workstream.id, slice.id, "Needs tests.");
  const workstreamComment = await store.addComment(workstream.id, {
    body: "Applies everywhere."
  });
  const commentsBeforeResolve = await store.listComments(workstream.id);

  assert.match(first.id, /^c-[a-z0-9]{8}$/);
  assert.match(second.id, /^c-[a-z0-9]{8}$/);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, "needs-tests");
  assert.equal(workstreamComment.target?.type, "workstream");
  assert.equal(commentsBeforeResolve.length, 3);
  assert.equal(commentsBeforeResolve[0]?.resolved, false);

  const resolved = await store.resolveComment(workstream.id, first.id);
  const commentsAfterResolve = await store.listComments(workstream.id);

  assert.equal(resolved.resolved, true);
  assert.equal(typeof resolved.resolvedAt, "string");
  assert.equal(commentsAfterResolve[0]?.resolved, true);
  assert.equal(commentsAfterResolve[0]?.resolvedAt, resolved.resolvedAt);
});

test("adds file and line review comments anchored to sessions", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add comment support.");
  await store.setActiveSlice(workstream.id, slice.id);
  const session = await store.startReviewSession({
    baseRef: "main",
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "src/report.ts",
        status: "modified",
        category: "source"
      }
    ]
  });
  const structuredDiff = {
    files: [
      {
        path: "src/report.ts",
        status: "modified" as const,
        oldPath: "src/report.ts",
        newPath: "src/report.ts",
        hunks: [
          {
            header: "@@ -1 +1,2 @@",
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 2,
            lines: [
              {
                kind: "context" as const,
                oldLineNumber: 1,
                newLineNumber: 1,
                text: "const one = 1;"
              },
              {
                kind: "addition" as const,
                newLineNumber: 2,
                text: "const two = 2;"
              }
            ]
          }
        ]
      }
    ]
  };

  const fileComment = await store.addComment(workstream.id, {
    body: "Review this file.",
    target: {
      type: "file",
      sessionId: session.id,
      filePath: "src/report.ts"
    },
    structuredDiff
  });
  const lineComment = await store.addComment(workstream.id, {
    body: "Handle the empty case.",
    target: {
      type: "line",
      sessionId: session.id,
      filePath: "src/report.ts",
      lineNumber: 2,
      side: "new"
    },
    structuredDiff
  });
  const sessionComments = await store.listComments(workstream.id, { sessionId: session.id, openOnly: true });

  assert.equal(fileComment.target?.type, "file");
  assert.equal(lineComment.target?.type, "line");
  assert.equal(lineComment.sliceId, slice.id);
  assert.deepEqual(sessionComments.map((comment) => comment.id), [fileComment.id, lineComment.id]);
  assert.match(fileComment.id, /^c-[a-z0-9]{8}$/);
  assert.match(lineComment.id, /^c-[a-z0-9]{8}$/);

  const resolved = await store.resolveComment(workstream.id, lineComment.id);

  assert.deepEqual(resolved.target, lineComment.target);
  assert.deepEqual(
    (await store.listComments(workstream.id, { sessionId: session.id, openOnly: true })).map(
      (comment) => comment.id
    ),
    [fileComment.id]
  );
});

test("preserves legacy slug review comment ids", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add comment support.");
  await writeFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "comments.json"),
    `${JSON.stringify({
      comments: [
        {
          id: "needs-tests",
          sliceId: slice.id,
          target: { type: "slice", sliceId: slice.id },
          body: "Needs tests.",
          resolved: false,
          createdAt: new Date(0).toISOString()
        }
      ]
    }, null, 2)}\n`,
    "utf8"
  );

  const listed = await store.listComments(workstream.id);
  const feedback = await store.exportFeedbackQueue(workstream.id);
  const resolved = await store.resolveComment(workstream.id, "needs-tests");

  assert.equal(listed[0].id, "needs-tests");
  assert.match(feedback.markdown, /`needs-tests`/);
  assert.equal(resolved.id, "needs-tests");
});

test("persists agent comment origin and omits agent comments from default feedback", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add comment support.");
  await store.setActiveSlice(workstream.id, slice.id);
  const human = await store.addComment(workstream.id, slice.id, "Human follow-up.");
  const agent = await store.addComment(workstream.id, {
    body: "Agent first-pass issue.",
    origin: "agent",
    target: { type: "slice", sliceId: slice.id }
  });

  const comments = await store.listComments(workstream.id);
  const feedback = await store.exportFeedbackQueue(workstream.id);

  assert.equal(comments.find((comment) => comment.id === human.id)?.origin, "human");
  assert.equal(comments.find((comment) => comment.id === agent.id)?.origin, "agent");
  assert.match(feedback.markdown, /Human follow-up\./);
  assert.doesNotMatch(feedback.markdown, /Agent first-pass issue\./);
});

test("validates comment workstream, slice, body, and resolution state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add comment support.");
  const comment = await store.addComment(workstream.id, slice.id, "Needs tests.");

  await assert.rejects(() => store.addComment("missing", slice.id, "Body"), PathfinderError);
  await assert.rejects(() => store.addComment(workstream.id, "missing", "Body"), PathfinderError);
  await assert.rejects(() => store.addComment(workstream.id, slice.id, " "), PathfinderError);
  await assert.rejects(() => store.resolveComment(workstream.id, "missing"), PathfinderError);

  await store.resolveComment(workstream.id, comment.id);
  await assert.rejects(() => store.resolveComment(workstream.id, comment.id), PathfinderError);
});
