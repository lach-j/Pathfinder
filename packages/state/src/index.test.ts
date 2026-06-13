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
  const commentsBeforeResolve = await store.listComments(workstream.id);

  assert.equal(first.id, "needs-tests");
  assert.equal(second.id, "needs-tests-2");
  assert.equal(commentsBeforeResolve.length, 2);
  assert.equal(commentsBeforeResolve[0]?.resolved, false);

  const resolved = await store.resolveComment(workstream.id, first.id);
  const commentsAfterResolve = await store.listComments(workstream.id);

  assert.equal(resolved.resolved, true);
  assert.equal(typeof resolved.resolvedAt, "string");
  assert.equal(commentsAfterResolve[0]?.resolved, true);
  assert.equal(commentsAfterResolve[0]?.resolvedAt, resolved.resolvedAt);
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
  assert.match(result.markdown, /- First Slice \(`first-slice`\): Generate markdown\./);
  assert.match(result.markdown, /- npm test passed\. - slice `first-slice`/);
  assert.match(result.markdown, /- Review `manual-review-passed` \(open, slice `first-slice`\): Manual review passed\./);
  assert.match(result.markdown, /- Open comment `confirm-generated-output` \(slice `first-slice`\): Confirm generated output\./);
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
