import assert from "node:assert/strict";
import test from "node:test";

import {
  PathfinderError,
  assertNonEmptyText,
  categorizeRepositoryPath,
  findNextActionableSlice,
  generateDeterministicReview,
  generatePrMarkdown,
  isSliceActionable,
  isSliceStatus,
  isUrlSafeId,
  nextAvailableId,
  parseUnifiedDiff,
  parseStagePlanMarkdown,
  Slice,
  toUrlSafeId
} from "./index.js";

test("creates URL-safe ids from titles", () => {
  assert.equal(toUrlSafeId(" Add Billing: Phase 1! "), "add-billing-phase-1");
  assert.equal(isUrlSafeId("add-billing-phase-1"), true);
  assert.equal(isUrlSafeId("Add Billing"), false);
});

test("allocates a stable numeric suffix when an id already exists", () => {
  assert.equal(nextAvailableId("slice", ["slice", "slice-2"]), "slice-3");
  assert.equal(nextAvailableId("slice", ["other"]), "slice");
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

test("parses stored stage plans into a workstream title and stages", () => {
  const plan = parseStagePlanMarkdown(sampleStagePlan());

  assert.equal(plan.workstreamTitle, "Inventory Alerts");
  assert.equal(plan.markdown, sampleStagePlan());
  assert.deepEqual(
    plan.stages.map((stage) => [stage.stageNumber, stage.title]),
    [
      [1, "Add Data Source"],
      [2, "Add Report"]
    ]
  );
  assert.match(plan.stages[0].description, /^## Stage 1: Add Data Source \(INV-1\) \[status: pending\]/);
  assert.match(plan.stages[1].description, /\*\*Depends on:\*\* Stage 1 data source\./);
});

test("rejects stage plans without recognizable stages", () => {
  assert.throws(
    () => parseStagePlanMarkdown("# Inventory Alerts - Stage Plan\n\n## Context\nNo stages yet.\n"),
    /no '## Stage N:' sections/
  );
});

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
    }
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

## Risks

- 1 unresolved review comment(s) remain.

## Checklist

- [ ] Requirements reviewed
- [ ] Plan reviewed
- [ ] Completed slices verified
- [ ] Testing evidence reviewed
- [ ] Open review comments resolved or accepted
- [ ] Changed files reviewed against slice scope
`
  );
});

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
  assert.match(markdown, /- No unresolved comments or deterministic review warnings recorded\./);
});

test("classifies repository paths conservatively", () => {
  assert.equal(categorizeRepositoryPath("packages/core/src/index.ts"), "source");
  assert.equal(categorizeRepositoryPath("packages/core/src/index.test.ts"), "test");
  assert.equal(categorizeRepositoryPath("docs/slices/13-repository-intelligence-summary.md"), "documentation");
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

function testSlice(
  id: string,
  status: Slice["status"],
  createdAt: string,
  dependsOnSliceIds?: string[]
): Slice {
  return {
    id,
    title: id,
    description: id,
    status,
    ...(dependsOnSliceIds ? { dependsOnSliceIds } : {}),
    createdAt,
    updatedAt: createdAt
  };
}

function sampleStagePlan(): string {
  return `# Inventory Alerts - Stage Plan

Epic: INV-1
Originating ticket: INV-2
Created: 2026-06-13

## Context
Build local inventory alerts.

## Stages

| Stage | Issue | Title | Status |
| ----- | ---- | ----- | ------ |
| 1 | INV-1 | Add Data Source | pending |
| 2 | INV-2 | Add Report | pending |

---

## Stage 1: Add Data Source (INV-1) [status: pending]

**Scope:** Create local data.
**Acceptance criteria:** Data loads from disk.
**Depends on:** None.
**Commit breakdown:**
1. Add model

## Stage 2: Add Report (INV-2) [status: pending]

**Scope:** Report reorder candidates.
**Acceptance criteria:** Report lists low stock.
**Open items:** Confirm threshold.
**Depends on:** Stage 1 data source.
**Commit breakdown:**
1. Add report
`;
}

function sampleUnifiedDiff(): string {
  return `diff --git a/src/modified.ts b/src/modified.ts
index 1111111..2222222 100644
--- a/src/modified.ts
+++ b/src/modified.ts
@@ -1,3 +1,4 @@
 one
-two
+two changed
 three
+four
diff --git a/src/added.ts b/src/added.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/added.ts
@@ -0,0 +1,2 @@
+alpha
+beta
diff --git a/src/deleted.ts b/src/deleted.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/deleted.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-gone
-done
diff --git a/docs/old.md b/docs/new.md
similarity index 62%
rename from docs/old.md
rename to docs/new.md
index 5555555..6666666 100644
--- a/docs/old.md
+++ b/docs/new.md
@@ -1 +1 @@
-old title
+new title
`;
}
