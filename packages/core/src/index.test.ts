import assert from "node:assert/strict";
import test from "node:test";

import {
  PathfinderError,
  assertNonEmptyText,
  categorizeRepositoryPath,
  createOpaqueReviewCommentId,
  findNextActionableSlice,
  getAgentNextRecommendation,
  generateDeterministicReview,
  generateFeedbackQueueMarkdown,
  generatePrMarkdown,
  getAgentCommandToolDefinitions,
  getAgentCheckGuidance,
  getAgentUserInstallToolDefinitions,
  getReviewCommentAnchorStatus,
  isSliceActionable,
  isSliceStatus,
  isUrlSafeId,
  nextAvailableId,
  parseAgentReviewImportJson,
  parseUnifiedDiff,
  parseStagePlanMarkdown,
  renderAgentPrompt,
  renderAgentReviewPrompt,
  Slice,
  toUrlSafeId
} from "./index.js";

import {
  sampleStagePlan,
  sampleUnifiedDiff,
  testSlice,
  testWorkstream
} from "./core-test-helpers.js";

test("creates URL-safe ids from titles", () => {
  assert.equal(toUrlSafeId(" Add Billing: Phase 1! "), "add-billing-phase-1");
  assert.equal(isUrlSafeId("add-billing-phase-1"), true);
  assert.equal(isUrlSafeId("Add Billing"), false);
});

test("allocates a stable numeric suffix when an id already exists", () => {
  assert.equal(nextAvailableId("slice", ["slice", "slice-2"]), "slice-3");
  assert.equal(nextAvailableId("slice", ["other"]), "slice");
});

test("creates short opaque review comment ids", () => {
  const id = createOpaqueReviewCommentId([]);

  assert.match(id, /^c-[a-z0-9]{8}$/);
  assert.notEqual(id, "needs-tests");
  assert.notEqual(createOpaqueReviewCommentId([id]), id);
});

test("renders and parses agent review prompt artifacts", () => {
  const prompt = renderAgentReviewPrompt({
    mode: "branch",
    session: {
      id: "review-feature",
      baseRef: "main",
      headRef: "feature",
      headCommit: "abc123",
      mergeBase: "abc000",
      changedFiles: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    diff: parseUnifiedDiff(sampleUnifiedDiff())
  });
  const imported = parseAgentReviewImportJson(JSON.stringify({
    runId: "first-pass",
    comments: [
      { filePath: "src/modified.ts", lineNumber: 4, side: "new", body: "Check the edge case." },
      { filePath: "src/modified.ts", body: "Review this file." },
      { body: "Session-level concern." }
    ]
  }));

  assert.match(prompt, /Pathfinder Agent Review Prompt/);
  assert.equal(imported.runId, "first-pass");
  assert.equal(imported.comments.length, 3);
  assert.equal(imported.comments[0].side, "new");
  assert.throws(
    () => parseAgentReviewImportJson(JSON.stringify({ comments: [{ lineNumber: 1, body: "Missing file." }] })),
    PathfinderError
  );
});

test("validates required text and slice statuses", () => {
  assert.equal(assertNonEmptyText("  usable  ", "Title"), "usable");
  assert.equal(isSliceStatus("in_progress"), true);
  assert.equal(isSliceStatus("blocked"), false);
  assert.throws(() => assertNonEmptyText(" ", "Title"), PathfinderError);
});

test("finds the first actionable slice by creation time", () => {
  const slices: Slice[] = [
    testSlice("dependent", "ready", "2026-01-03T00:00:00.000Z", ["foundation"]),
    testSlice("foundation", "complete", "2026-01-01T00:00:00.000Z"),
    testSlice("blocked", "proposed", "2026-01-02T00:00:00.000Z", ["missing"]),
    testSlice("later", "proposed", "2026-01-04T00:00:00.000Z")
  ];

  assert.equal(isSliceActionable(slices[0], slices), true);
  assert.equal(isSliceActionable(slices[1], slices), false);
  assert.equal(isSliceActionable(slices[2], slices), false);
  assert.equal(findNextActionableSlice(slices)?.id, "dependent");
});

test("recommends agent next phases for setup and slice selection", () => {
  assert.deepEqual(getAgentNextRecommendation({ isInitialized: false, workstreams: [] }), {
    phase: "uninitialized",
    reason: "Pathfinder state was not found.",
    commands: ["pathfinder init"],
    agentInstruction: "Stop implementation work until Pathfinder is initialized for this repository.",
    humanInstruction: "Run pathfinder init from the repository root, then create or import a workstream plan."
  });

  assert.equal(
    getAgentNextRecommendation({
      isInitialized: true,
      workstreams: []
    }).phase,
    "needs_workstream"
  );

  const workstream = testWorkstream("inventory-alerts");
  const nextSlice = testSlice("add-report", "proposed", "2026-01-01T00:00:00.000Z");
  const recommendation = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [nextSlice],
    nextSlice,
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [],
    suggestedBaseRef: "main"
  });

  assert.equal(recommendation.phase, "needs_slice_selection");
  assert.equal(recommendation.workstreamId, "inventory-alerts");
  assert.equal(recommendation.sliceId, "add-report");
  assert.deepEqual(recommendation.commands, [
    "pathfinder slice next inventory-alerts",
    "pathfinder slice start inventory-alerts add-report --base main"
  ]);
});
