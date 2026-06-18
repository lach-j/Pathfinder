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
  const activeComment = await store.addComment(workstream.id, activeSlice.id, "Fix active slice.");
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
    [activeComment.id]
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
  const comment = await store.addComment(workstream.id, slice.id, "Confirm generated output.");

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
  assert.match(result.markdown, new RegExp(`- Open comment \`${comment.id}\` \\(slice \`first-slice\`\\): Confirm generated output\\.`));
});

test("reads stored PR markdown without regenerating it", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("PR Draft Read");
  await store.addSlice(workstream.id, "First Slice", "Leave the stored draft alone.");
  const prPath = path.join(repo, ".pathfinder", "workstreams", workstream.id, "pr.md");
  await writeFile(prPath, "Custom PR draft.\n", "utf8");

  const stored = await store.getStoredPrMarkdown(workstream.id);
  const afterRead = await readFile(prPath, "utf8");

  assert.equal(stored.path, prPath);
  assert.equal(stored.markdown, "Custom PR draft.\n");
  assert.equal(afterRead, "Custom PR draft.\n");
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
