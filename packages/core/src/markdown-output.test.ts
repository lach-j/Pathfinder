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
