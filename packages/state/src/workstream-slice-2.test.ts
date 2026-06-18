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
  const openComment = await store.addComment(workstream.id, slice.id, "Check output.");
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
    [openComment.id]
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

test("returns agent next setup phases without mutating state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  assert.equal((await store.getAgentNext()).phase, "uninitialized");

  await store.initProject();

  const noWorkstream = await store.getAgentNext();

  assert.equal(noWorkstream.phase, "needs_workstream");
  assert.deepEqual(noWorkstream.commands, [
    "pathfinder workstream create --title \"<workstream-title>\"",
    "pathfinder plan import --file ./PLAN.md"
  ]);
});

test("returns agent next recommendations from active Pathfinder state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Agent Flow");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nImplement one slice.\n", "utf8");
  await store.setPlanFromFile(workstream.id, "./plan.md");
  const slice = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.");

  const needsSelection = await store.getAgentNext(undefined, async () => "main");
  assert.equal(needsSelection.phase, "needs_slice_selection");
  assert.deepEqual(needsSelection.commands, [
    "pathfinder slice next agent-flow",
    "pathfinder slice start agent-flow add-report --base main"
  ]);

  await store.setActiveSlice(workstream.id, slice.id);
  await store.setSliceBranchMetadata(workstream.id, slice.id, {
    branchName: "pathfinder/agent-flow/add-report",
    baseRef: "main"
  });

  const ready = await store.getAgentNext(async (baseRef) => ({
    baseRef,
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: []
  }));

  assert.equal(ready.phase, "ready_to_implement");
  assert.equal(ready.workstreamId, workstream.id);
  assert.equal(ready.sliceId, slice.id);

  const needsCommit = await store.getAgentNext(
    async (baseRef) => ({
      baseRef,
      headRef: "feature",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: []
    }),
    undefined,
    async () => true
  );

  assert.equal(needsCommit.phase, "needs_commit");
  assert.deepEqual(needsCommit.commands, [
    "git status --short",
    "git add <changed-files>",
    "git commit -m \"Implement Add Report\"",
    "pathfinder review start --base main"
  ]);

  await store.startReviewSession({
    baseRef: "main",
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "src/report.ts",
        status: "added",
        category: "source"
      }
    ]
  });
  await store.addComment(workstream.id, {
    body: "Handle empty data.",
    target: {
      type: "file",
      sessionId: "review-add-report",
      filePath: "src/report.ts"
    }
  });

  const feedback = await store.getAgentNext();

  assert.equal(feedback.phase, "feedback");
  assert.equal(feedback.reviewSessionId, "review-add-report");
});

test("renders agent prompts from Pathfinder state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Agent Prompt");
  await writeFile(path.join(repo, "plan.md"), "# Plan\n\nImplement one slice.\n", "utf8");
  await store.setPlanFromFile(workstream.id, "./plan.md");
  const slice = await store.addSlice(workstream.id, "Add Prompt", "Render agent prompts.");
  await store.setActiveSlice(workstream.id, slice.id);

  const implement = await store.getAgentPrompt("implement");

  assert.match(implement, /# Pathfinder Agent Prompt: implement/);
  assert.match(implement, /Agent Prompt \(`agent-prompt`\)/);
  assert.match(implement, /Add Prompt \(`add-prompt`, proposed\)/);
  assert.match(implement, /\.pathfinder[\\/]workstreams[\\/]agent-prompt[\\/]plan\.md/);

  const session = await store.startReviewSession({
    baseRef: "main",
    headRef: "feature",
    headCommit: "abc123",
    mergeBase: "abc000",
    files: [
      {
        path: "src/prompt.ts",
        status: "added",
        category: "source"
      }
    ]
  });
  await store.addComment(workstream.id, {
    body: "Handle missing context.",
    target: {
      type: "file",
      sessionId: session.id,
      filePath: "src/prompt.ts"
    }
  });

  const feedback = await store.getAgentPrompt();

  assert.match(feedback, /# Pathfinder Agent Prompt: feedback/);
  assert.match(feedback, /`pathfinder review refresh agent-prompt review-add-prompt`/);
  assert.match(feedback, /Do not resolve comments/);
});
