import assert from "node:assert/strict";
import test from "node:test";

import {
  PathfinderError,
  assertNonEmptyText,
  findNextActionableSlice,
  generatePrMarkdown,
  isSliceActionable,
  isSliceStatus,
  isUrlSafeId,
  nextAvailableId,
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

test("generates deterministic PR markdown from workstream state", () => {
  const markdown = generatePrMarkdown({
    workstream: {
      id: "billing-foundation",
      title: "Billing Foundation",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
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
            kind: "test",
            description: "npm test",
            createdAt: "2026-01-01T00:00:00.000Z"
          }
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(
    markdown,
    `## Summary

- Workstream: Billing Foundation (\`billing-foundation\`)
- Plan: Recorded in Pathfinder.
- Scope: Local Pathfinder workstream output assembled from recorded slices, comments, and reviews.

## Completed Slices

- Create State (\`create-state\`): Add filesystem-backed state.

## Testing

- npm test - review \`manual-review\`

## Risks

- No explicit risks are recorded in Pathfinder state yet.

## Review Notes

- Review \`manual-review\` (complete, slice \`create-state\`): Manual review passed.
- Open comment \`needs-docs\` (slice \`create-state\`): Needs docs.

## Checklist

- [ ] Plan reviewed
- [ ] Completed slices verified
- [ ] Tests run or intentionally skipped
- [ ] Open review comments resolved or accepted
`
  );
});

test("generates useful PR markdown when optional state is empty", () => {
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

  assert.match(markdown, /- Plan: No plan recorded\./);
  assert.match(markdown, /- No completed slices recorded\./);
  assert.match(markdown, /- No testing evidence recorded\./);
  assert.match(markdown, /- No review records found\./);
  assert.match(markdown, /- No open review comments\./);
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
