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

test("recommends review session and human review phases for agents", () => {
  const workstream = testWorkstream("inventory-alerts", "add-report");
  const activeSlice = {
    ...testSlice("add-report", "review", "2026-01-01T00:00:00.000Z"),
    baseRef: "main"
  };
  const needsReviewSession = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [activeSlice],
    activeSlice,
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [],
    repositorySummary: {
      baseRef: "main",
      headRef: "feature-report",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: [
        {
          path: "src/report.ts",
          status: "added",
          category: "source"
        }
      ]
    }
  });

  assert.equal(needsReviewSession.phase, "needs_review_session");
  assert.deepEqual(needsReviewSession.commands, ["pathfinder review start --base main"]);

  const needsCommit = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [activeSlice],
    activeSlice,
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [],
    hasUncommittedChanges: true,
    repositorySummary: {
      baseRef: "main",
      headRef: "feature-report",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: []
    }
  });

  assert.equal(needsCommit.phase, "needs_commit");
  assert.deepEqual(needsCommit.commands, [
    "git status --short",
    "git add <changed-files>",
    "git commit -m \"Implement add-report\"",
    "pathfinder review start --base main"
  ]);

  const awaitingApproval = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [activeSlice],
    activeSlice,
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [
      {
        id: "review-add-report",
        workstreamId: "inventory-alerts",
        sliceId: "add-report",
        baseRef: "main",
        headRef: "feature-report",
        headCommit: "abc123",
        mergeBase: "abc000",
        changedFiles: [],
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(awaitingApproval.phase, "awaiting_human_approval");
  assert.equal(awaitingApproval.compatibilityPhase, "needs_human_review");
  assert.equal(awaitingApproval.reviewSessionId, "review-add-report");
  assert.deepEqual(awaitingApproval.commands, [
    "pathfinder review serve",
    "pathfinder diff show --session review-add-report",
    "pathfinder comment list inventory-alerts --session review-add-report --open",
    "pathfinder review approve inventory-alerts --session review-add-report"
  ]);
  assert.match(awaitingApproval.agentInstruction, /vague "continue" is not approval/);
  assert.match(awaitingApproval.humanInstruction, /explicitly tell the agent "approved"/);

  const needsCommitBeforeRefresh = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [activeSlice],
    activeSlice,
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [
      {
        id: "review-add-report",
        workstreamId: "inventory-alerts",
        sliceId: "add-report",
        baseRef: "main",
        headRef: "feature-report",
        headCommit: "abc123",
        mergeBase: "abc000",
        changedFiles: [],
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    hasUncommittedChanges: true
  });

  assert.equal(needsCommitBeforeRefresh.phase, "needs_commit");
  assert.deepEqual(needsCommitBeforeRefresh.commands.at(-1), "pathfinder review refresh inventory-alerts review-add-report");

  const completeActiveSlice = getAgentNextRecommendation({
    isInitialized: true,
    workstreams: [workstream],
    activeWorkstream: workstream,
    slices: [
      {
        ...activeSlice,
        status: "complete"
      },
      testSlice("next-slice", "proposed", "2026-01-02T00:00:00.000Z")
    ],
    activeSlice: {
      ...activeSlice,
      status: "complete"
    },
    nextSlice: testSlice("next-slice", "proposed", "2026-01-02T00:00:00.000Z"),
    planMarkdown: "# Plan",
    openComments: [],
    reviewSessions: [],
    hasUncommittedChanges: true
  });

  assert.equal(completeActiveSlice.phase, "needs_slice_selection");
  assert.equal(completeActiveSlice.sliceId, "next-slice");
});
