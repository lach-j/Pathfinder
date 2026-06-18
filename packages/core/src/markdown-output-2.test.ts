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

test("generates deterministic PR markdown from workstream state", () => {
  const markdown = generatePrMarkdown({
    workstream: {
      id: "billing-foundation",
      title: "Billing Foundation",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    requirementsMarkdown: "# Requirements\n\nCreate billing state.",
    planMarkdown: "# Plan\n\nCreate the first billing slice.",
    slices: [
      {
        id: "create-state",
        title: "Create State",
        description: "Add filesystem-backed state.",
        status: "complete",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "wire-ui",
        title: "Wire UI",
        description: "Future UI work.",
        status: "proposed",
        dependsOnSliceIds: ["create-state"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    comments: [
      {
        id: "needs-docs",
        sliceId: "create-state",
        body: "Needs docs.",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "empty-case-fixed",
        sliceId: "create-state",
        target: {
          type: "line",
          sessionId: "review-create-state",
          filePath: "packages/core/src/index.ts",
          lineNumber: 12,
          side: "new"
        },
        anchorStatus: "current",
        body: "Handle the empty case.",
        resolved: true,
        createdAt: "2026-01-01T00:00:01.000Z",
        resolvedAt: "2026-01-01T00:00:03.000Z"
      },
      {
        id: "stale-inline",
        sliceId: "create-state",
        target: {
          type: "line",
          sessionId: "review-create-state",
          filePath: "packages/core/src/index.ts",
          lineNumber: 99,
          side: "new"
        },
        anchorStatus: "stale",
        body: "This line moved after refresh.",
        resolved: false,
        createdAt: "2026-01-01T00:00:02.000Z"
      }
    ],
    reviews: [
      {
        id: "manual-review",
        sliceId: "create-state",
        status: "complete",
        summary: "Manual review passed.",
        comments: [],
        evidence: [
          {
            id: "npm-test",
            sliceId: "create-state",
            kind: "test",
            description: "npm test",
            createdAt: "2026-01-01T00:00:00.000Z"
          }
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    reviewSessions: [
      {
        id: "review-create-state",
        workstreamId: "billing-foundation",
        sliceId: "create-state",
        baseRef: "main",
        headRef: "feature-billing",
        headCommit: "abc123",
        mergeBase: "abc000",
        changedFiles: [
          {
            path: "packages/core/src/index.ts",
            status: "modified",
            category: "source"
          }
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        refreshedAt: "2026-01-01T00:00:04.000Z"
      }
    ],
    evidence: [
      {
        id: "typecheck-passed",
        sliceId: "create-state",
        kind: "test",
        description: "npm run typecheck",
        path: "typecheck.log",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    repositorySummary: {
      baseRef: "main",
      headRef: "feature-billing",
      headCommit: "abc123",
      mergeBase: "abc000",
      files: [
        {
          path: "packages/core/src/index.test.ts",
          status: "modified",
          category: "test"
        },
        {
          path: "packages/core/src/index.ts",
          status: "modified",
          category: "source"
        }
      ]
    },
    feedbackQueuePath: ".pathfinder-feedback.md"
  });

  assert.equal(
    markdown,
    `## Summary

- Workstream: Billing Foundation (\`billing-foundation\`)
- Scope: Local Pathfinder PR draft assembled from recorded requirements, plan, slices, evidence, reviews, and comments.

## Requirements

\`\`\`markdown
# Requirements

Create billing state.
\`\`\`

## Plan

\`\`\`markdown
# Plan

Create the first billing slice.
\`\`\`

## Completed Slices

- Create State (\`create-state\`, complete): Add filesystem-backed state. Dependencies: none.

## Remaining Slices

- Wire UI (\`wire-ui\`, proposed): Future UI work. Dependencies: \`create-state\`.

## Changed Files

- Base ref: \`main\`
- Head ref: \`feature-billing\`
- Head commit: \`abc123\`
- Merge base: \`abc000\`
- Changed files: 2 (source 1, test 1, documentation 0, configuration 0, state 0, other 0)
- M test: packages/core/src/index.test.ts
- M source: packages/core/src/index.ts

## Testing Evidence

- Slice \`create-state\` (Create State):
  - \`typecheck-passed\` [test]: npm run typecheck (typecheck.log)
- Review \`manual-review\` evidence:
  - \`npm-test\` [test]: npm test

## Review Notes

- Review \`manual-review\` (complete, slice \`create-state\`): Manual review passed.
- Open comment \`needs-docs\` (slice \`create-state\`): Needs docs.
- Open comment \`stale-inline\` (session review-create-state file packages/core/src/index.ts new line 99): This line moved after refresh.
- Resolved comment \`empty-case-fixed\` (session review-create-state file packages/core/src/index.ts new line 12): Handle the empty case.

## Review Sessions

- Session \`review-create-state\` for slice \`create-state\`: base \`main\`, head \`feature-billing\`, head commit \`abc123\`, merge base \`abc000\`, changed files 1, created 2026-01-01T00:00:00.000Z, refreshed 2026-01-01T00:00:04.000Z.
  - M source: packages/core/src/index.ts

## Local Review Feedback

### Open Comments

- \`needs-docs\` (open; slice \`create-state\`): Needs docs.
- \`stale-inline\` (open, anchor stale; session review-create-state file packages/core/src/index.ts new line 99): This line moved after refresh.

### Resolved Comments

- \`empty-case-fixed\` (resolved, anchor current, resolved 2026-01-01T00:00:03.000Z; session review-create-state file packages/core/src/index.ts new line 12): Handle the empty case.

### Stale Or Unknown Anchors

- \`stale-inline\` (open, anchor stale; session review-create-state file packages/core/src/index.ts new line 99): This line moved after refresh.

## Agent Feedback Queue

- Exported feedback queue: \`.pathfinder-feedback.md\`

## Risks

- 2 unresolved review comment(s) remain.
- 1 stale or unknown review comment anchor(s) need review.

## Checklist

- [ ] Requirements reviewed
- [ ] Plan reviewed
- [ ] Completed slices verified
- [ ] Testing evidence reviewed
- [ ] Local diff reviewed in Pathfinder
- [ ] Agent feedback queue addressed
- [ ] Open review comments resolved or accepted
- [ ] Changed files reviewed against slice scope
`
  );
});
