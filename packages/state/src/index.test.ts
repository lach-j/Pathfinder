import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PathfinderError } from "@pathfinder/core";

import { PathfinderStore } from "./index.js";

test("initialises Pathfinder state inside a Git repository", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const project = await store.initProject();

  assert.equal(project.name, path.basename(repo));
  assert.equal(project.schemaVersion, 1);
  assert.match(await readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"), /"schemaVersion": 1/);
});

test("creates workstreams with markdown and JSON state files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();

  const workstream = await store.createWorkstream("Add Billing");

  assert.equal(workstream.id, "add-billing");
  assert.deepEqual(
    await sortedFiles(path.join(repo, ".pathfinder", "workstreams", workstream.id)),
    [
      "comments.json",
      "evidence.json",
      "plan.md",
      "pr.md",
      "requirements.md",
      "review-sessions.json",
      "reviews.json",
      "slices.json",
      "workstream.json"
    ]
  );
});

test("stores requirements as markdown and handles legacy missing files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Requirements Flow");
  const requirementsPath = path.join(repo, "requirements.md");
  await writeFile(requirementsPath, "# Requirements\n\nKeep original text intact.\n", "utf8");

  await store.setRequirementsFromFile(workstream.id, requirementsPath);

  assert.equal(await store.getRequirements(workstream.id), "# Requirements\n\nKeep original text intact.\n");

  await rm(path.join(repo, ".pathfinder", "workstreams", workstream.id, "requirements.md"));

  assert.equal(await store.getRequirements(workstream.id), "");

  await store.setRequirementsFromFile(workstream.id, requirementsPath);

  assert.equal(await store.getRequirements(workstream.id), "# Requirements\n\nKeep original text intact.\n");
});

test("stores plans as markdown and tracks active slices", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Stage One");
  const planPath = path.join(repo, "plan.md");
  await writeFile(planPath, "# Plan\n\nKeep markdown intact.\n", "utf8");

  await store.setPlanFromFile(workstream.id, planPath);
  const slice = await store.addSlice(workstream.id, "Create State", "Add local files.");
  const active = await store.setActiveSlice(workstream.id, slice.id);

  assert.equal(await store.getPlan(workstream.id), "# Plan\n\nKeep markdown intact.\n");
  assert.equal(active.slice.id, "create-state");
  assert.equal((await store.getActiveSlice())?.slice.title, "Create State");
});

test("imports a stored stage plan into workstream, plan, and slices", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const planPath = path.join(repo, "PLAN.md");
  const markdown = sampleStagePlan();
  await writeFile(planPath, markdown, "utf8");

  const result = await store.importStagePlanFromFile("./PLAN.md");
  const storedPlan = await readFile(
    path.join(repo, ".pathfinder", "workstreams", result.workstream.id, "plan.md"),
    "utf8"
  );
  const slices = await store.listSlices(result.workstream.id);

  assert.equal(result.workstream.id, "inventory-alerts");
  assert.equal(result.workstream.title, "Inventory Alerts");
  assert.equal(storedPlan, markdown);
  assert.deepEqual(
    slices.map((slice) => [slice.id, slice.title, slice.status]),
    [
      ["add-data-source", "Add Data Source", "proposed"],
      ["add-report", "Add Report", "proposed"]
    ]
  );
  assert.match(slices[0].description, /\*\*Acceptance criteria:\*\* Data loads from disk\./);
  assert.match(slices[1].description, /\*\*Depends on:\*\* Stage 1 data source\./);
  assert.equal(slices[1].dependsOnSliceIds, undefined);
});

test("imports duplicate stage titles with unique slice ids", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  await writeFile(path.join(repo, "PLAN.md"), duplicateTitleStagePlan(), "utf8");

  const result = await store.importStagePlanFromFile("./PLAN.md");
  const slices = await store.listSlices(result.workstream.id);

  assert.deepEqual(
    slices.map((slice) => slice.id),
    ["add-report", "add-report-2", "add-report-3"]
  );
});

test("stage plan import validates missing files and failed parses before creating state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  await writeFile(path.join(repo, "PLAN.md"), "# Inventory Alerts - Stage Plan\n\n## Context\nNo stages.\n", "utf8");

  await assert.rejects(() => store.importStagePlanFromFile("./missing.md"), /Plan file not found/);
  await assert.rejects(() => store.importStagePlanFromFile("./PLAN.md"), /no '## Stage N:' sections/);

  assert.deepEqual(await store.listWorkstreams(), []);
});

test("updates slice status and branch metadata in human-readable state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Slice Lifecycle");
  const slice = await store.addSlice(workstream.id, "Create Branch", "Track local branch state.");

  const updatedStatus = await store.updateSliceStatus(workstream.id, slice.id, "complete");
  const updatedBranch = await store.setSliceBranchMetadata(workstream.id, slice.id, {
    branchName: "pathfinder/slice-lifecycle/create-branch",
    baseRef: "main",
    startedAt: "2026-01-01T00:00:00.000Z"
  });
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "slices.json"),
    "utf8"
  );

  assert.equal(updatedStatus.status, "complete");
  assert.equal(updatedBranch.branchName, "pathfinder/slice-lifecycle/create-branch");
  assert.equal(updatedBranch.baseRef, "main");
  assert.equal(updatedBranch.startedAt, "2026-01-01T00:00:00.000Z");
  assert.match(stored, /"status": "complete"/);
  assert.match(stored, /"branchName": "pathfinder\/slice-lifecycle\/create-branch"/);
});

test("stores slice dependencies and selects the next actionable slice", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Dependencies");
  const first = await store.addSlice(workstream.id, "Add Data Source", "Create local data.");
  const second = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.", [
    first.id
  ]);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "slices.json"),
    "utf8"
  );

  assert.deepEqual(second.dependsOnSliceIds, [first.id]);
  assert.match(stored, /"dependsOnSliceIds": \[/);
  assert.equal((await store.getNextSlice(workstream.id))?.id, first.id);

  await store.updateSliceStatus(workstream.id, first.id, "complete");

  assert.equal((await store.getNextSlice(workstream.id))?.id, second.id);
});

test("adds slice dependencies after creation", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Dependencies");
  const first = await store.addSlice(workstream.id, "Add Data Source", "Create local data.");
  const second = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.");

  const updated = await store.addSliceDependency(workstream.id, second.id, first.id);

  assert.deepEqual(updated.dependsOnSliceIds, [first.id]);
});

test("validates slice dependencies", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Dependencies");
  const first = await store.addSlice(workstream.id, "Add Data Source", "Create local data.");
  const second = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.");

  await assert.rejects(
    () => store.addSlice(workstream.id, "Invalid", "Missing dependency.", ["missing"]),
    PathfinderError
  );
  await assert.rejects(() => store.addSliceDependency(workstream.id, second.id, second.id), PathfinderError);
  await assert.rejects(() => store.addSliceDependency(workstream.id, second.id, "missing"), PathfinderError);

  await store.addSliceDependency(workstream.id, second.id, first.id);

  await assert.rejects(() => store.addSliceDependency(workstream.id, second.id, first.id), PathfinderError);
  await assert.rejects(
    () => store.addSlice(workstream.id, "Duplicate", "Duplicate dependency.", [first.id, first.id]),
    PathfinderError
  );
});

test("validates slice status updates", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Slice Lifecycle");
  const slice = await store.addSlice(workstream.id, "Create Branch", "Track local branch state.");

  await assert.rejects(() => store.updateSliceStatus(workstream.id, slice.id, "blocked"), PathfinderError);
  await assert.rejects(() => store.updateSliceStatus(workstream.id, "missing", "complete"), PathfinderError);
});

test("returns current context for the active workstream and slice", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Agent Context");
  const planPath = path.join(repo, "plan.md");
  const requirementsPath = path.join(repo, "requirements.md");
  await writeFile(requirementsPath, "# Requirements\n\nSupport agent context.\n", "utf8");
  await writeFile(planPath, "# Plan\n\nKeep the agent focused.\n", "utf8");
  await store.setRequirementsFromFile(workstream.id, requirementsPath);
  await store.setPlanFromFile(workstream.id, planPath);
  const slice = await store.addSlice(workstream.id, "Current Command", "Print local context.");
  await store.setActiveSlice(workstream.id, slice.id);
  await store.addComment(workstream.id, slice.id, "Check output.");
  const resolved = await store.addComment(workstream.id, slice.id, "Already handled.");
  await store.resolveComment(workstream.id, resolved.id);
  await store.addEvidence(workstream.id, slice.id, "manual", "Manual QA passed.");

  const context = await store.getCurrentContext();

  assert.equal(context.workstream?.id, workstream.id);
  assert.equal(context.activeSlice?.id, slice.id);
  assert.equal(context.requirementsMarkdown, "# Requirements\n\nSupport agent context.\n");
  assert.equal(
    context.requirementsPath,
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "requirements.md")
  );
  assert.equal(context.planMarkdown, "# Plan\n\nKeep the agent focused.\n");
  assert.equal(context.planPath, path.join(repo, ".pathfinder", "workstreams", workstream.id, "plan.md"));
  assert.deepEqual(
    context.unresolvedComments.map((comment) => comment.id),
    ["check-output"]
  );
  assert.deepEqual(
    context.evidence.map((evidence) => evidence.id),
    ["manual-qa-passed"]
  );
});

test("returns clear current context when no active slice is set", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();

  const context = await store.getCurrentContext();

  assert.equal(context.workstream, undefined);
  assert.equal(context.activeSlice, undefined);
  assert.deepEqual(context.unresolvedComments, []);
  assert.deepEqual(context.evidence, []);
});

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

  assert.equal(first.id, "needs-tests");
  assert.equal(second.id, "needs-tests-2");
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
  assert.deepEqual(
    sessionComments.map((comment) => comment.id),
    ["review-this-file", "handle-the-empty-case"]
  );

  const resolved = await store.resolveComment(workstream.id, lineComment.id);

  assert.deepEqual(resolved.target, lineComment.target);
  assert.deepEqual(
    (await store.listComments(workstream.id, { sessionId: session.id, openOnly: true })).map(
      (comment) => comment.id
    ),
    ["review-this-file"]
  );
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
  await store.addComment(workstream.id, {
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
  await store.addComment(workstream.id, {
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
  await store.addComment(workstream.id, {
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
      ["still-current", "current"],
      ["line-disappeared", "stale"],
      ["file-disappeared", "stale"]
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

test("runs and stores deterministic reviews for the active slice", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const planPath = path.join(repo, "plan.md");
  const requirementsPath = path.join(repo, "requirements.md");
  await writeFile(planPath, "# Plan\n\nAdd deterministic checks.\n", "utf8");
  await writeFile(requirementsPath, "# Requirements\n\nReview local branch changes.\n", "utf8");
  await store.setPlanFromFile(workstream.id, planPath);
  await store.setRequirementsFromFile(workstream.id, requirementsPath);
  const slice = await store.addSlice(workstream.id, "First Slice", "Add review support.");
  await store.updateSliceStatus(workstream.id, slice.id, "in_progress");
  await store.setActiveSlice(workstream.id, slice.id);
  await store.addComment(workstream.id, slice.id, "Needs docs.");
  await store.addEvidence(workstream.id, slice.id, "test", "npm test passed.");

  const { review, result } = await store.runDeterministicReview("main", {
    baseRef: "main",
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "packages/core/src/index.ts",
        status: "modified",
        category: "source"
      }
    ]
  });
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "reviews.json"),
    "utf8"
  );

  assert.equal(review.id, "deterministic-review");
  assert.equal(review.sliceId, slice.id);
  assert.equal(review.status, "open");
  assert.match(review.summary, /1 warning\(s\)/);
  assert.equal(review.comments.length, 1);
  assert.equal(review.evidence.length, 1);
  assert.equal(review.checks?.length, result.checks.length);
  assert.match(stored, /"checks": \[/);
  assert.match(stored, /Needs docs\./);
  assert.match(stored, /npm test passed\./);
});

test("deterministic review stores only active-slice comments", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const activeSlice = await store.addSlice(workstream.id, "First Slice", "Add review support.");
  const otherSlice = await store.addSlice(workstream.id, "Other Slice", "Unrelated review feedback.");
  await store.updateSliceStatus(workstream.id, activeSlice.id, "review");
  await store.setActiveSlice(workstream.id, activeSlice.id);
  await store.addComment(workstream.id, activeSlice.id, "Fix active slice.");
  await store.addComment(workstream.id, otherSlice.id, "Do not include in active review.");
  await store.addEvidence(workstream.id, activeSlice.id, "test", "npm test passed.");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n", "utf8");
  await writeFile(path.join(repo, "requirements.md"), "# Requirements\n", "utf8");
  await store.setPlanFromFile(workstream.id, path.join(repo, "plan.md"));
  await store.setRequirementsFromFile(workstream.id, path.join(repo, "requirements.md"));

  const { review } = await store.runDeterministicReview("main", {
    baseRef: "main",
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "packages/core/src/index.ts",
        status: "modified",
        category: "source"
      }
    ]
  });

  assert.deepEqual(
    review.comments.map((comment) => comment.id),
    ["fix-active-slice"]
  );
  assert.match(review.summary, /1 warning\(s\)/);
  assert.match(
    review.checks?.map((check) => check.message).join("\n") ?? "",
    /1 unresolved comment\(s\) remain for the active slice/
  );
});

test("deterministic review warns without evidence, plan, requirements, or diff", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add review support.");
  await store.setActiveSlice(workstream.id, slice.id);

  const { review } = await store.runDeterministicReview("main", {
    baseRef: "main",
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: []
  });

  assert.equal(review.status, "open");
  assert.match(review.summary, /6 warning\(s\)/);
  assert.equal(review.evidence.length, 0);
  assert.match(
    review.checks?.map((check) => check.message).join("\n") ?? "",
    /No evidence recorded for the active slice/
  );
});

test("validates review workstream, slice, summary, and review ids", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Review Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Add review support.");

  await assert.rejects(() => store.createReview("missing", slice.id, "Summary"), PathfinderError);
  await assert.rejects(() => store.createReview(workstream.id, "missing", "Summary"), PathfinderError);
  await assert.rejects(() => store.createReview(workstream.id, slice.id, " "), PathfinderError);
  await assert.rejects(() => store.getReview(workstream.id, "missing"), PathfinderError);
});

test("generates and writes local PR markdown", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("PR Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Generate markdown.");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nShip a PR draft.\n", "utf8");
  await store.setPlanFromFile(workstream.id, path.join(repo, "plan.md"));
  await store.updateSliceStatus(workstream.id, slice.id, "complete");
  await store.createReview(workstream.id, slice.id, "Manual review passed.");
  await store.addEvidence(workstream.id, slice.id, "test", "npm test passed.");
  await store.addComment(workstream.id, slice.id, "Confirm generated output.");

  const result = await store.generatePrMarkdown(workstream.id);
  const stored = await readFile(path.join(repo, ".pathfinder", "workstreams", workstream.id, "pr.md"), "utf8");

  assert.equal(result.path, path.join(repo, ".pathfinder", "workstreams", workstream.id, "pr.md"));
  assert.equal(stored, result.markdown);
  assert.match(result.markdown, /## Summary/);
  assert.match(result.markdown, /- Workstream: PR Flow \(`pr-flow`\)/);
  assert.match(result.markdown, /## Requirements/);
  assert.match(result.markdown, /- First Slice \(`first-slice`, complete\): Generate markdown\. Dependencies: none\./);
  assert.match(result.markdown, /- `npm-test-passed` \[test\]: npm test passed\./);
  assert.match(result.markdown, /- Review `manual-review-passed` \(open, slice `first-slice`\): Manual review passed\./);
  assert.match(result.markdown, /- Open comment `confirm-generated-output` \(slice `first-slice`\): Confirm generated output\./);
});

test("generates PR markdown with repository summary", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("PR Flow");
  const slice = await store.addSlice(workstream.id, "First Slice", "Generate markdown.");
  await store.updateSliceStatus(workstream.id, slice.id, "complete");

  const result = await store.generatePrMarkdown(workstream.id, {
    baseRef: "main",
    headRef: "feature-pr",
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

  assert.match(result.markdown, /## Changed Files/);
  assert.match(result.markdown, /- Base ref: `main`/);
  assert.match(result.markdown, /- Changed files: 1 \(source 1, test 0/);
  assert.match(result.markdown, /- A source: src\/index\.ts/);
});

test("fails clearly before init", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  await assert.rejects(() => store.listWorkstreams(), PathfinderError);
});

async function createTempRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-state-"));
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(repo, ".git")));
  return repo;
}

async function sortedFiles(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(directory)).sort();
}

function structuredDiff(files: ReturnType<typeof structuredDiffFile>[]) {
  return { files };
}

function structuredDiffFile(filePath: string, newLineNumbers: number[]) {
  return {
    path: filePath,
    status: "modified" as const,
    oldPath: filePath,
    newPath: filePath,
    hunks: [
      {
        header: "@@ -1 +1 @@",
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: newLineNumbers.length,
        lines: newLineNumbers.map((newLineNumber) => ({
          kind: "addition" as const,
          newLineNumber,
          text: `line ${newLineNumber}`
        }))
      }
    ]
  };
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

function duplicateTitleStagePlan(): string {
  return `# Duplicate Titles - Stage Plan

## Context
Exercise duplicate title import.

## Stage 1: Add Report (INV-1) [status: pending]

**Scope:** First report.

## Stage 2: Add Report (INV-2) [status: pending]

**Scope:** Second report.

## Stage 3: Add Report (INV-3) [status: pending]

**Scope:** Third report.
`;
}
