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

test("recommends implementation, feedback, and PR phases for agents", () => {
  const workstream = testWorkstream("inventory-alerts", "add-report");
  const activeSlice = {
    ...testSlice("add-report", "in_progress", "2026-01-01T00:00:00.000Z"),
    branchName: "task/INV-1234-add-report",
    baseRef: "main"
  };

  assert.equal(
    getAgentNextRecommendation({
      isInitialized: true,
      workstreams: [workstream],
      activeWorkstream: workstream,
      slices: [activeSlice],
      activeSlice,
      planMarkdown: "# Plan",
      openComments: [],
      reviewSessions: []
    }).phase,
    "ready_to_implement"
  );

  const unbranchedRecommendation = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [testSlice("add-report", "in_progress", "2026-01-01T00:00:00.000Z")],
    activeSlice: testSlice("add-report", "in_progress", "2026-01-01T00:00:00.000Z"),
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [],
    suggestedBaseRef: "main"
  });

  assert.equal(unbranchedRecommendation.phase, "needs_slice_selection");
  assert.deepEqual(unbranchedRecommendation.commands, [
    "pathfinder slice start inventory-alerts add-report --base main",
    "pathfinder current"
  ]);

  const session = {
    id: "review-add-report",
    workstreamId: "inventory-alerts",
    sliceId: "add-report",
    baseRef: "main",
    headRef: "feature-report",
    headCommit: "abc123",
    mergeBase: "abc000",
    changedFiles: [
      {
        path: "src/report.ts",
        status: "modified" as const,
        category: "source" as const
      }
    ],
    createdAt: "2026-01-01T00:00:00.000Z"
  };
  const feedback = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [activeSlice],
    activeSlice,
    planMarkdown: "# Plan",
    openComments: [
      {
        id: "handle-empty-case",
        sliceId: "add-report",
        target: {
          type: "line",
          sessionId: "review-add-report",
          filePath: "src/report.ts",
          lineNumber: 1,
          side: "new"
        },
        body: "Handle empty data.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    reviewSessions: [session]
  });

  assert.equal(feedback.phase, "feedback");
  assert.equal(feedback.reviewSessionId, "review-add-report");
  assert.deepEqual(feedback.commands, [
    "pathfinder feedback export inventory-alerts --session review-add-report --file ./.pathfinder-feedback.md"
  ]);

  const externalFeedback = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [activeSlice],
    activeSlice,
    planMarkdown: "# Plan",
    openComments: [
      {
        id: "handle-empty-case",
        sliceId: "add-report",
        target: {
          type: "line",
          sessionId: "review-add-report",
          filePath: "src/report.ts",
          lineNumber: 1,
          side: "new"
        },
        body: "Handle empty data.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    reviewSessions: [session],
    feedbackQueuePath: "/home/me/.pathfinder/projects/demo/.pathfinder-feedback.md"
  });

  assert.deepEqual(externalFeedback.commands, [
    "pathfinder feedback export inventory-alerts --session review-add-report"
  ]);
  assert.match(externalFeedback.agentInstruction, /\/home\/me\/\.pathfinder\/projects\/demo\/\.pathfinder-feedback\.md/);

  assert.equal(
    getAgentNextRecommendation({
      isInitialized: true,
      workstreams: [testWorkstream("inventory-alerts")],
      activeWorkstream: testWorkstream("inventory-alerts"),
      slices: [testSlice("add-report", "complete", "2026-01-01T00:00:00.000Z")],
      planMarkdown: "# Plan",
      openComments: [],
      reviewSessions: []
    }).phase,
    "ready_for_pr"
  );
});
