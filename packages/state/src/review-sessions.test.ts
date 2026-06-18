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

test("creates, lists, and gets local review records", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add review support.");

  const first = await store.createReview(workstream.id, slice.id, "Manual review passed.");
  const second = await store.createReview(workstream.id, slice.id, "Manual review passed.");
  const reviews = await store.listReviews(workstream.id);
  const storedFile = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "reviews.json"),
    "utf8"
  );

  assert.equal(first.id, "manual-review-passed");
  assert.equal(second.id, "manual-review-passed-2");
  assert.equal(reviews.length, 2);
  assert.equal(reviews[0]?.status, "open");
  assert.deepEqual(reviews[0]?.comments, []);
  assert.deepEqual(reviews[0]?.evidence, []);
  assert.equal((await store.getReview(workstream.id, first.id)).summary, "Manual review passed.");
  assert.match(storedFile, /"reviews": \[/);
  assert.match(storedFile, /\n    \{/);
});

test("starts, lists, and gets local review sessions for the active slice", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add session support.");
  await store.setActiveSlice(workstream.id, slice.id);

  const first = await store.startReviewSession({
    baseRef: "main",
    headRef: "feature-review",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "src/index.ts",
        status: "added",
        category: "source"
      }
    ]
  });
  const second = await store.startReviewSession({
    baseRef: "main",
    headRef: "feature-review",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: []
  });
  const sessions = await store.listReviewSessions(workstream.id);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "review-sessions.json"),
    "utf8"
  );

  assert.equal(first.id, "review-first-slice");
  assert.equal(second.id, "review-first-slice-2");
  assert.equal(first.workstreamId, workstream.id);
  assert.equal(first.sliceId, slice.id);
  assert.equal(first.baseRef, "main");
  assert.equal(first.changedFiles.length, 1);
  assert.equal(sessions.length, 2);
  assert.equal((await store.getReviewSession(workstream.id, first.id)).headRef, "feature-review");
  assert.match(stored, /"sessions": \[/);
  assert.match(stored, /"changedFiles": \[/);
});

test("approves review sessions only after session comments are closed", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add session approval.");
  await store.updateSliceStatus(workstream.id, slice.id, "review");
  await store.setActiveSlice(workstream.id, slice.id);
  const session = await store.startReviewSession({
    baseRef: "main",
    headRef: "feature-review",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "src/index.ts",
        status: "added",
        category: "source"
      }
    ]
  });
  const diff = structuredDiff([structuredDiffFile("src/index.ts", [1])]);
  const comment = await store.addComment(workstream.id, {
    body: "Needs a fix before approval.",
    target: {
      type: "line",
      sessionId: session.id,
      filePath: "src/index.ts",
      lineNumber: 1,
      side: "new"
    },
    structuredDiff: diff
  });

  await assert.rejects(
    () => store.approveReviewSession(workstream.id, session.id),
    /Cannot approve review session 'review-first-slice' while 1 open review comment\(s\) remain/
  );

  await store.resolveComment(workstream.id, comment.id);
  const approval = await store.approveReviewSession(workstream.id, session.id);
  const evidence = await store.listEvidence(workstream.id);

  assert.equal(approval.session.id, session.id);
  assert.equal(approval.slice.status, "complete");
  assert.equal(approval.evidence.kind, "manual");
  assert.equal(approval.evidence.description, `Human approved review session ${session.id}.`);
  assert.deepEqual(evidence.map((item) => item.id), ["human-approved-review-session-review-first-slice"]);
  assert.equal((await store.listSlices(workstream.id))[0]?.status, "complete");
});

test("refreshes review sessions and marks stale comment anchors", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add session refresh.");
  await store.setActiveSlice(workstream.id, slice.id);
  const session = await store.startReviewSession({
    baseRef: "main",
    headRef: "feature-before",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "src/report.ts",
        status: "modified",
        category: "source"
      },
      {
        path: "src/removed.ts",
        status: "modified",
        category: "source"
      }
    ]
  });
  const originalDiff = structuredDiff([
    structuredDiffFile("src/report.ts", [1, 2]),
    structuredDiffFile("src/removed.ts", [1])
  ]);
  const currentComment = await store.addComment(workstream.id, {
    body: "Still current.",
    target: {
      type: "line",
      sessionId: session.id,
      filePath: "src/report.ts",
      lineNumber: 1,
      side: "new"
    },
    structuredDiff: originalDiff
  });
  const disappearedLineComment = await store.addComment(workstream.id, {
    body: "Line disappeared.",
    target: {
      type: "line",
      sessionId: session.id,
      filePath: "src/report.ts",
      lineNumber: 2,
      side: "new"
    },
    structuredDiff: originalDiff
  });
  const disappearedFileComment = await store.addComment(workstream.id, {
    body: "File disappeared.",
    target: {
      type: "line",
      sessionId: session.id,
      filePath: "src/removed.ts",
      lineNumber: 1,
      side: "new"
    },
    structuredDiff: originalDiff
  });

  const refreshed = await store.refreshReviewSession(
    workstream.id,
    session.id,
    {
      baseRef: "main",
      headRef: "feature-after",
      headCommit: "def456",
      mergeBase: "abc000",
      files: [
        {
          path: "src/report.ts",
          status: "modified",
          category: "source"
        }
      ]
    },
    structuredDiff([structuredDiffFile("src/report.ts", [1])])
  );
  const comments = await store.listComments(workstream.id, { sessionId: session.id });

  assert.equal(refreshed.session.headRef, "feature-after");
  assert.equal(refreshed.session.headCommit, "def456");
  assert.equal(typeof refreshed.session.refreshedAt, "string");
  assert.deepEqual(
    comments.map((comment) => [comment.id, comment.anchorStatus]),
    [
      [currentComment.id, "current"],
      [disappearedLineComment.id, "stale"],
      [disappearedFileComment.id, "stale"]
    ]
  );
  assert.deepEqual(
    comments.map((comment) => comment.body),
    ["Still current.", "Line disappeared.", "File disappeared."]
  );
});

test("review sessions require an active slice and validate lookup ids", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");

  await assert.rejects(
    () =>
      store.startReviewSession({
        baseRef: "main",
        headRef: "feature",
        headCommit: "abc123",
        mergeBase: "abc000",
        files: []
      }),
    PathfinderError
  );
  await assert.rejects(() => store.getReviewSession(workstream.id, "missing"), PathfinderError);
});
