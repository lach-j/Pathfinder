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

test("includes deterministic review checks in PR markdown", () => {
  const markdown = generatePrMarkdown({
    workstream: {
      id: "review-flow",
      title: "Review Flow",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    planMarkdown: "",
    slices: [testSlice("add-report", "complete", "2026-01-01T00:00:00.000Z")],
    comments: [],
    reviews: [
      {
        id: "deterministic-review",
        sliceId: "add-report",
        status: "open",
        summary: "Deterministic review against main: 1 warning(s).",
        comments: [],
        evidence: [],
        checks: [
          {
            severity: "warning",
            message: "No committed diff found against main."
          }
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  assert.match(markdown, /- \[warning\] No committed diff found against main\./);
  assert.match(markdown, /- 1 deterministic review warning\(s\) recorded\./);
});

test("includes placeholders when PR markdown optional state is empty", () => {
  const markdown = generatePrMarkdown({
    workstream: {
      id: "empty",
      title: "Empty",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    planMarkdown: "",
    slices: [],
    comments: [],
    reviews: []
  });

  assert.match(markdown, /- No requirements recorded\./);
  assert.match(markdown, /- No plan recorded\./);
  assert.match(markdown, /- No completed slices recorded\./);
  assert.match(markdown, /- No remaining slices recorded\./);
  assert.match(markdown, /- No repository summary requested\./);
  assert.match(markdown, /- No testing evidence recorded\./);
  assert.match(markdown, /- No review records found\./);
  assert.match(markdown, /- No open review comments\./);
  assert.match(markdown, /- No local review sessions recorded\./);
  assert.match(markdown, /- No open local review comments\./);
  assert.match(markdown, /- No resolved local review comments\./);
  assert.match(markdown, /- No stale or unknown comment anchors recorded\./);
  assert.match(markdown, /- No exported feedback queue file found\./);
  assert.match(markdown, /- No unresolved comments, stale anchors, or deterministic review warnings recorded\./);
});

test("generates grouped feedback queue markdown", () => {
  const markdown = generateFeedbackQueueMarkdown({
    workstream: {
      id: "inventory-alerts",
      title: "Inventory Alerts",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      activeSliceId: "add-report"
    },
    activeSlice: testSlice("add-report", "review", "2026-01-01T00:00:00.000Z"),
    requirementsPath: "/repo/.pathfinder/workstreams/inventory-alerts/requirements.md",
    planPath: "/repo/.pathfinder/workstreams/inventory-alerts/plan.md",
    session: {
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
          status: "modified",
          category: "source"
        }
      ],
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    slices: [testSlice("add-report", "review", "2026-01-01T00:00:00.000Z")],
    comments: [
      {
        id: "file-note",
        sliceId: "add-report",
        target: {
          type: "file",
          sessionId: "review-add-report",
          filePath: "src/report.ts"
        },
        body: "Review this file.",
        resolved: false,
        createdAt: "2026-01-01T00:00:03.000Z"
      },
      {
        id: "line-note",
        sliceId: "add-report",
        target: {
          type: "line",
          sessionId: "review-add-report",
          filePath: "src/report.ts",
          lineNumber: 12,
          side: "new"
        },
        body: "Handle the empty case.",
        resolved: false,
        createdAt: "2026-01-01T00:00:02.000Z"
      },
      {
        id: "slice-note",
        sliceId: "add-report",
        body: "Add tests.",
        resolved: false,
        createdAt: "2026-01-01T00:00:01.000Z"
      },
      {
        id: "resolved-note",
        sliceId: "add-report",
        body: "Already handled.",
        resolved: true,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  assert.match(markdown, /# Pathfinder Feedback Queue/);
  assert.match(markdown, /- Workstream: Inventory Alerts \(`inventory-alerts`\)/);
  assert.match(markdown, /- Active slice: add-report \(`add-report`, review\)/);
  assert.match(markdown, /- Session: `review-add-report`/);
  assert.match(markdown, /### Line Comments[\s\S]*#### src\/report\.ts[\s\S]*`line-note`/);
  assert.match(markdown, /### File Comments[\s\S]*`file-note`/);
  assert.match(markdown, /### Slice And Workstream Comments[\s\S]*`slice-note`/);
  assert.doesNotMatch(markdown, /resolved-note/);
});

test("feedback queue markdown has a useful empty state", () => {
  const markdown = generateFeedbackQueueMarkdown({
    workstream: {
      id: "empty",
      title: "Empty",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    requirementsPath: "/repo/.pathfinder/workstreams/empty/requirements.md",
    planPath: "/repo/.pathfinder/workstreams/empty/plan.md",
    comments: [],
    slices: []
  });

  assert.match(markdown, /No open feedback items found\./);
  assert.match(markdown, /Re-run review or add comments/);
});
