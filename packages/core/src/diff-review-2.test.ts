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

test("deterministic review only counts active-slice and workstream comments", () => {
  const result = generateDeterministicReview({
    baseRef: "main",
    workstream: {
      id: "inventory-alerts",
      title: "Inventory Alerts",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    activeSlice: testSlice("add-report", "review", "2026-01-01T00:00:00.000Z"),
    planMarkdown: "# Plan",
    requirementsMarkdown: "# Requirements",
    unresolvedComments: [
      {
        id: "active-comment",
        sliceId: "add-report",
        body: "Fix the active slice.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "other-comment",
        sliceId: "other-slice",
        body: "Do not block this review.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "workstream-comment",
        body: "Applies to the whole workstream.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    evidence: [
      {
        id: "npm-test",
        sliceId: "add-report",
        kind: "test",
        description: "npm test",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    repositorySummary: {
      baseRef: "main",
      headRef: "feature",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: [
        {
          path: "src/index.ts",
          status: "modified",
          category: "source"
        }
      ]
    }
  });

  assert.match(
    result.checks.map((check) => check.message).join("\n"),
    /2 unresolved comment\(s\) remain for the active slice\./
  );
});

test("generates passing deterministic review checks with category summary", () => {
  const result = generateDeterministicReview({
    baseRef: "main",
    workstream: {
      id: "inventory-alerts",
      title: "Inventory Alerts",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    activeSlice: testSlice("add-report", "review", "2026-01-01T00:00:00.000Z"),
    planMarkdown: "# Plan",
    requirementsMarkdown: "# Requirements",
    unresolvedComments: [],
    evidence: [
      {
        id: "npm-test",
        sliceId: "add-report",
        kind: "test",
        description: "npm test",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    repositorySummary: {
      baseRef: "main",
      headRef: "feature",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: [
        {
          path: "src/index.ts",
          status: "added",
          category: "source"
        },
        {
          path: "src/index.test.ts",
          status: "added",
          category: "test"
        }
      ]
    }
  });

  assert.equal(result.status, "complete");
  assert.match(result.summary, /0 warning\(s\)/);
  assert.equal(result.checks.every((check) => check.severity === "info"), true);
  assert.match(
    result.checks.map((check) => check.message).join("\n"),
    /Changed categories: source 1, test 1/
  );
});
