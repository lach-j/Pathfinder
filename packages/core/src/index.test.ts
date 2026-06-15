import assert from "node:assert/strict";
import test from "node:test";

import {
  PathfinderError,
  assertNonEmptyText,
  categorizeRepositoryPath,
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
  parseUnifiedDiff,
  parseStagePlanMarkdown,
  renderAgentPrompt,
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

test("recommends implementation, feedback, and PR phases for agents", () => {
  const workstream = testWorkstream("inventory-alerts", "add-report");
  const activeSlice = testSlice("add-report", "in_progress", "2026-01-01T00:00:00.000Z");

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

test("renders deterministic agent prompts for implement and feedback phases", () => {
  const workstream = testWorkstream("inventory-alerts", "add-report");
  const activeSlice = testSlice("add-report", "in_progress", "2026-01-01T00:00:00.000Z");
  const implement = renderAgentPrompt({
    phase: "implement",
    recommendation: {
      phase: "ready_to_implement",
      reason: "Active slice is ready for implementation and has no open feedback.",
      workstreamId: "inventory-alerts",
      sliceId: "add-report",
      commands: ["pathfinder current", "pathfinder review start --base <base-ref>"],
      agentInstruction: "Implement only the active slice.",
      humanInstruction: "Review the local diff."
    },
    workstream,
    activeSlice,
    requirementsPath: "/repo/.pathfinder/workstreams/inventory-alerts/requirements.md",
    planPath: "/repo/.pathfinder/workstreams/inventory-alerts/plan.md"
  });

  assert.match(implement, /# Pathfinder Agent Prompt: implement/);
  assert.match(implement, /Use Pathfinder as the source of truth/);
  assert.match(implement, /Do not resolve Pathfinder comments automatically/);
  assert.match(implement, /`pathfinder current`/);
  assert.equal((implement.match(/- `pathfinder current`/g) ?? []).length, 1);
  assert.match(implement, /slice start <workstream-id> <slice-id> --base <base-ref>/);
  assert.match(implement, /Implement only slice `add-report`/);
  assert.match(implement, /`npm run typecheck`/);
  assert.match(implement, /git commit -m "Implement <slice-title>"/);
  assert.match(implement, /commit the implementation before review/);

  const feedback = renderAgentPrompt({
    recommendation: {
      phase: "feedback",
      reason: "Active review session has open comments.",
      workstreamId: "inventory-alerts",
      sliceId: "add-report",
      reviewSessionId: "review-add-report",
      commands: [
        "pathfinder feedback export inventory-alerts --session review-add-report --file ./.pathfinder-feedback.md"
      ],
      agentInstruction: "Read feedback.",
      humanInstruction: "Review fixes."
    },
    workstream,
    activeSlice
  });

  assert.match(feedback, /# Pathfinder Agent Prompt: feedback/);
  assert.match(feedback, /`pathfinder feedback export inventory-alerts --session review-add-report --file \.\/\.pathfinder-feedback\.md`/);
  assert.match(feedback, /Address every open feedback item/);
  assert.match(feedback, /Do not resolve comments/);

  const review = renderAgentPrompt({
    recommendation: {
      phase: "awaiting_human_approval",
      compatibilityPhase: "needs_human_review",
      reason: "Active review session exists and has no open comments.",
      workstreamId: "inventory-alerts",
      sliceId: "add-report",
      reviewSessionId: "review-add-report",
      commands: [
        "pathfinder review serve",
        "pathfinder diff show --session review-add-report",
        "pathfinder comment list inventory-alerts --session review-add-report --open",
        "pathfinder review approve inventory-alerts --session review-add-report"
      ],
      agentInstruction: "Pause.",
      humanInstruction: "Approve."
    },
    workstream,
    activeSlice
  });

  assert.match(review, /# Pathfinder Agent Prompt: review/);
  assert.match(review, /pathfinder review approve inventory-alerts --session review-add-report/);
  assert.match(review, /Generic messages like "continue" are not approval/);

  const externalFeedback = renderAgentPrompt({
    recommendation: {
      phase: "feedback",
      reason: "Active review session has open comments.",
      workstreamId: "inventory-alerts",
      sliceId: "add-report",
      reviewSessionId: "review-add-report",
      feedbackQueuePath: "/home/me/.pathfinder/projects/demo/.pathfinder-feedback.md",
      commands: [
        "pathfinder feedback export inventory-alerts --session review-add-report"
      ],
      agentInstruction: "Read feedback.",
      humanInstruction: "Review fixes."
    },
    workstream,
    activeSlice
  });

  assert.match(externalFeedback, /`pathfinder feedback export inventory-alerts --session review-add-report`/);
  assert.match(externalFeedback, /Export and read `\/home\/me\/\.pathfinder\/projects\/demo\/\.pathfinder-feedback\.md`/);
});

test("renders repository-aware check guidance in agent prompts", () => {
  const workstream = testWorkstream("python-tool", "add-report");
  const activeSlice = testSlice("add-report", "in_progress", "2026-01-01T00:00:00.000Z");
  const prompt = renderAgentPrompt({
    phase: "implement",
    recommendation: {
      phase: "ready_to_implement",
      reason: "Active slice is ready.",
      workstreamId: "python-tool",
      sliceId: "add-report",
      commands: ["pathfinder current"],
      agentInstruction: "Implement only the active slice.",
      humanInstruction: "Review the local diff."
    },
    workstream,
    activeSlice,
    checkGuidance: getAgentCheckGuidance({
      hasPythonProjectMarker: true,
      hasPythonTests: true
    })
  });

  assert.match(prompt, /`python -m pytest`/);
  assert.doesNotMatch(prompt, /npm run typecheck/);
});

test("defines managed native agent command wrappers", () => {
  const definitions = getAgentCommandToolDefinitions();
  const claude = getAgentCommandToolDefinitions("claude");
  const userInstall = getAgentUserInstallToolDefinitions();

  assert.deepEqual(
    definitions.map((definition) => definition.tool),
    ["claude", "opencode"]
  );
  assert.deepEqual(
    claude[0].files.map((file) => file.relativePath),
    [
      ".claude/commands/pathfinder-plan.md",
      ".claude/commands/pathfinder-continue.md",
      ".claude/commands/pathfinder-feedback.md"
    ]
  );
  assert.match(claude[0].files[0].markdown, /<!-- pathfinder-command:start -->/);
  assert.match(claude[0].files[0].markdown, /pathfinder agent prompt --phase plan/);
  assert.match(claude[0].files[1].markdown, /pathfinder agent next --json/);
  assert.match(claude[0].files[2].markdown, /Do not infer the Pathfinder workflow manually/);
  assert.deepEqual(userInstall[0].files.map((file) => file.relativePath), [".claude/CLAUDE.md"]);
  assert.match(userInstall[0].files[0].markdown, /<!-- pathfinder-user-agent:start -->/);
  assert.match(userInstall[0].files[0].markdown, /pathfinder agent doctor --json/);
  assert.equal(userInstall[1].files.length, 0);
  assert.match(userInstall[1].manualInstructions.join("\n"), /OpenCode user-level rule and command locations vary/);
  assert.deepEqual(userInstall.map((definition) => definition.tool), ["claude", "opencode", "codex"]);
  assert.deepEqual(userInstall[2].files.map((file) => file.relativePath), ["AGENTS.md"]);
  assert.equal(userInstall[2].files[0].installRoot, "codex-home");
  assert.match(userInstall[2].files[0].markdown, /pathfinder agent doctor --json/);
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

function testWorkstream(id: string, activeSliceId?: string) {
  return {
    id,
    title: id,
    ...(activeSliceId ? { activeSliceId } : {}),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
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
