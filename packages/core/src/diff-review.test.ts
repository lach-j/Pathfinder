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

test("classifies repository paths conservatively", () => {
  assert.equal(categorizeRepositoryPath("packages/core/src/index.ts"), "source");
  assert.equal(categorizeRepositoryPath("packages/core/src/index.test.ts"), "test");
  assert.equal(categorizeRepositoryPath("guides/repository-intelligence-summary.md"), "documentation");
  assert.equal(categorizeRepositoryPath("README.md"), "documentation");
  assert.equal(categorizeRepositoryPath("package.json"), "configuration");
  assert.equal(categorizeRepositoryPath(".github/workflows/test.yml"), "configuration");
  assert.equal(categorizeRepositoryPath(".pathfinder/workstreams/demo/slices.json"), "state");
  assert.equal(categorizeRepositoryPath("assets/logo.png"), "other");
});

test("parses unified diffs into files, hunks, and line numbers", () => {
  const diff = parseUnifiedDiff(sampleUnifiedDiff());

  assert.deepEqual(
    diff.files.map((file) => ({
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
      hunks: file.hunks.length
    })),
    [
      {
        path: "src/modified.ts",
        previousPath: undefined,
        status: "modified",
        hunks: 1
      },
      {
        path: "src/added.ts",
        previousPath: undefined,
        status: "added",
        hunks: 1
      },
      {
        path: "src/deleted.ts",
        previousPath: undefined,
        status: "deleted",
        hunks: 1
      },
      {
        path: "docs/new.md",
        previousPath: "docs/old.md",
        status: "renamed",
        hunks: 1
      }
    ]
  );

  assert.deepEqual(diff.files[0].hunks[0], {
    header: "@@ -1,3 +1,4 @@",
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 4,
    lines: [
      {
        kind: "context",
        oldLineNumber: 1,
        newLineNumber: 1,
        text: "one"
      },
      {
        kind: "deletion",
        oldLineNumber: 2,
        text: "two"
      },
      {
        kind: "addition",
        newLineNumber: 2,
        text: "two changed"
      },
      {
        kind: "context",
        oldLineNumber: 3,
        newLineNumber: 3,
        text: "three"
      },
      {
        kind: "addition",
        newLineNumber: 4,
        text: "four"
      }
    ]
  });
});

test("classifies review comment anchors against structured diffs", () => {
  const diff = parseUnifiedDiff(sampleUnifiedDiff());

  assert.equal(
    getReviewCommentAnchorStatus(
      {
        id: "current-line",
        target: {
          type: "line",
          sessionId: "review-1",
          filePath: "src/modified.ts",
          lineNumber: 4,
          side: "new"
        },
        body: "Still here.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      "review-1",
      diff
    ),
    "current"
  );
  assert.equal(
    getReviewCommentAnchorStatus(
      {
        id: "stale-line",
        target: {
          type: "line",
          sessionId: "review-1",
          filePath: "src/modified.ts",
          lineNumber: 42,
          side: "new"
        },
        body: "Gone now.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      "review-1",
      diff
    ),
    "stale"
  );
  assert.equal(
    getReviewCommentAnchorStatus(
      {
        id: "other-session",
        target: {
          type: "line",
          sessionId: "review-2",
          filePath: "src/modified.ts",
          lineNumber: 4,
          side: "new"
        },
        body: "Different session.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      "review-1",
      diff
    ),
    "unknown"
  );
});

test("generates deterministic review checks with warnings", () => {
  const result = generateDeterministicReview({
    baseRef: "main",
    workstream: {
      id: "inventory-alerts",
      title: "Inventory Alerts",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    activeSlice: testSlice("add-report", "proposed", "2026-01-01T00:00:00.000Z"),
    planMarkdown: "",
    requirementsMarkdown: "",
    unresolvedComments: [
      {
        id: "needs-tests",
        sliceId: "add-report",
        body: "Needs tests.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    evidence: [],
    repositorySummary: {
      baseRef: "main",
      headRef: "feature",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: []
    }
  });

  assert.equal(result.status, "open");
  assert.match(result.summary, /7 warning\(s\)/);
  assert.deepEqual(
    result.checks.filter((check) => check.severity === "warning").map((check) => check.message),
    [
      "Active slice status is proposed; expected in_progress, review, or complete.",
      "No committed diff found against main.",
      "No source, test, documentation, or configuration files changed in the committed diff.",
      "1 unresolved comment(s) remain for the active slice.",
      "No evidence recorded for the active slice.",
      "Plan is empty.",
      "Requirements are empty."
    ]
  );
});
