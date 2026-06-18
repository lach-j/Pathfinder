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
