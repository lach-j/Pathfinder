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

test("validates session comment targets", async () => {
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
            header: "@@ -1 +1 @@",
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: [
              {
                kind: "context" as const,
                oldLineNumber: 1,
                newLineNumber: 1,
                text: "const one = 1;"
              }
            ]
          }
        ]
      }
    ]
  };

  await assert.rejects(
    () =>
      store.addComment(workstream.id, {
        body: "Missing session.",
        target: {
          type: "file",
          sessionId: "missing",
          filePath: "src/report.ts"
        },
        structuredDiff
      }),
    PathfinderError
  );
  await assert.rejects(
    () =>
      store.addComment(workstream.id, {
        body: "Missing file.",
        target: {
          type: "file",
          sessionId: session.id,
          filePath: "src/missing.ts"
        },
        structuredDiff
      }),
    PathfinderError
  );
  await assert.rejects(
    () =>
      store.addComment(workstream.id, {
        body: "Missing line.",
        target: {
          type: "line",
          sessionId: session.id,
          filePath: "src/report.ts",
          lineNumber: 2,
          side: "new"
        },
        structuredDiff
      }),
    PathfinderError
  );
});

test("exports open feedback queue with optional session filtering", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const activeSlice = await store.addSlice(workstream.id, "First Slice", "Add comment support.");
  const otherSlice = await store.addSlice(workstream.id, "Other Slice", "Unrelated work.");
  await store.updateSliceStatus(workstream.id, activeSlice.id, "review");
  await store.setActiveSlice(workstream.id, activeSlice.id);
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
            header: "@@ -1 +1 @@",
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: [
              {
                kind: "context" as const,
                oldLineNumber: 1,
                newLineNumber: 1,
                text: "const one = 1;"
              }
            ]
          }
        ]
      }
    ]
  };

  await store.addComment(workstream.id, otherSlice.id, "Do not include in session export.");
  await store.addComment(workstream.id, {
    body: "Review this file.",
    target: {
      type: "file",
      sessionId: session.id,
      filePath: "src/report.ts"
    },
    structuredDiff
  });
  await store.addComment(workstream.id, {
    body: "Handle the empty case.",
    target: {
      type: "line",
      sessionId: session.id,
      filePath: "src/report.ts",
      lineNumber: 1,
      side: "new"
    },
    structuredDiff
  });

  const allFeedback = await store.exportFeedbackQueue(workstream.id);
  const sessionFeedback = await store.exportFeedbackQueue(workstream.id, { sessionId: session.id });

  assert.match(allFeedback.markdown, /Do not include in session export\./);
  assert.match(allFeedback.markdown, /Review this file\./);
  assert.match(sessionFeedback.markdown, /- Session: `review-first-slice`/);
  assert.match(sessionFeedback.markdown, /Handle the empty case\./);
  assert.doesNotMatch(sessionFeedback.markdown, /Do not include in session export\./);
});

test("exports empty feedback queue when no open comments exist", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");

  const feedback = await store.exportFeedbackQueue(workstream.id);

  assert.match(feedback.markdown, /# Pathfinder Feedback Queue/);
  assert.match(feedback.markdown, /No open feedback items found\./);
});

test("external state provides an external default feedback queue path", async () => {
  const repo = await createTempRepo();
  const configRoot = await mkdtemp(path.join(os.tmpdir(), "pathfinder-home-"));
  const store = new PathfinderStore(repo, { configRoot });

  await store.initProject({ personal: true });
  const workstream = await store.createWorkstream("External Feedback");
  const projectIds = await sortedFiles(path.join(configRoot, "projects"));
  const projectRoot = path.join(configRoot, "projects", projectIds[0]);

  const feedback = await store.exportFeedbackQueue(workstream.id);

  assert.equal(feedback.defaultPath, path.join(projectRoot, ".pathfinder-feedback.md"));
  assert.equal(feedback.defaultPath.startsWith(repo), false);
  assert.match(feedback.markdown, /External Feedback/);
});
