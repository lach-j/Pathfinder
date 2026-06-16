import {
  BranchReviewNextInput,
  BranchReviewNextRecommendation,
  BranchReviewSession,
  ReviewComment
} from "../domain.js";

export function getBranchReviewNextRecommendation(
  input: BranchReviewNextInput
): BranchReviewNextRecommendation {
  if (input.stateError) {
    return recommendation({
      phase: "blocked",
      reason: input.stateError,
      commands: ["pathfinder init"],
      agentInstruction: "Stop and ask the human to run Pathfinder from a Git repository with valid local state.",
      humanInstruction: "Run Pathfinder from a Git repository and repair local state before continuing."
    });
  }

  if (!input.isInitialized) {
    return recommendation({
      phase: "uninitialized",
      reason: "Pathfinder state was not found.",
      commands: ["pathfinder init"],
      agentInstruction: "Stop branch review work until Pathfinder is initialized for this repository.",
      humanInstruction: "Run pathfinder init from the repository root."
    });
  }

  const latestSession = latestBranchReviewSession(input.sessions);
  const suggestedBaseRef = input.suggestedBaseRef ?? "<base-ref>";

  if (!latestSession) {
    if (input.hasUncommittedChanges) {
      return recommendation({
        phase: "needs_commit",
        reason: "The current branch has uncommitted changes. Branch review sessions use committed diffs.",
        baseRef: suggestedBaseRef,
        commands: [
          "git status --short",
          "git add <changed-files>",
          "git commit -m \"Prepare branch review\"",
          `pathfinder branch-review start --base ${suggestedBaseRef}`
        ],
        agentInstruction: "Commit the relevant branch changes before starting Pathfinder branch review. Do not automatically include unrelated files.",
        humanInstruction: "Review pending Git changes, commit the branch work, then start branch review."
      });
    }

    return recommendation({
      phase: "needs_session",
      reason: "No branch review session exists for this repository.",
      baseRef: suggestedBaseRef,
      commands: [`pathfinder branch-review start --base ${suggestedBaseRef}`],
      agentInstruction: "Start a Pathfinder branch review session for the current committed branch.",
      humanInstruction: "Start a branch review session, then inspect the diff and add feedback if needed."
    });
  }

  const openSessionComments = (input.openComments ?? []).filter((comment) =>
    commentTargetsSession(comment, latestSession.id)
  );

  if (openSessionComments.length > 0) {
    const feedbackQueuePath = input.feedbackQueuePath ?? "./.pathfinder-branch-feedback.md";
    return recommendation({
      phase: "feedback",
      reason: "The active branch review session has open comments.",
      reviewSessionId: latestSession.id,
      baseRef: latestSession.baseRef,
      feedbackQueuePath,
      commands: [
        branchFeedbackExportCommand(latestSession.id, input.feedbackQueuePath),
        `pathfinder branch-review refresh ${latestSession.id}`
      ],
      agentInstruction: `Use Pathfinder branch-review state to address every open comment for session ${latestSession.id}. Export feedback only if a file handoff is useful. Commit fixes, then run pathfinder branch-review refresh ${latestSession.id}. Do not resolve comments automatically.`,
      humanInstruction: "Review the refreshed diff after the agent addresses the open branch review comments."
    });
  }

  if (input.hasUncommittedChanges) {
    return recommendation({
      phase: "needs_commit",
      reason: "The current branch has uncommitted changes after branch review began.",
      reviewSessionId: latestSession.id,
      baseRef: latestSession.baseRef,
      commands: [
        "git status --short",
        "git add <changed-files>",
        "git commit -m \"Address branch review feedback\"",
        `pathfinder branch-review refresh ${latestSession.id}`
      ],
      agentInstruction: `Commit the relevant branch changes, then refresh branch review session ${latestSession.id}. Do not automatically include unrelated files.`,
      humanInstruction: "Review pending Git changes, commit the branch work, then refresh branch review."
    });
  }

  if (input.repositorySummaryError) {
    return recommendation({
      phase: "blocked",
      reason: `Pathfinder could not inspect the branch review base ref '${latestSession.baseRef}': ${input.repositorySummaryError}`,
      reviewSessionId: latestSession.id,
      baseRef: latestSession.baseRef,
      commands: [`pathfinder branch-review refresh ${latestSession.id}`],
      agentInstruction: "Stop branch review work until the base ref can be inspected.",
      humanInstruction: "Provide or restore a valid base ref for the branch review session."
    });
  }

  if (input.repositorySummary && input.repositorySummary.headCommit !== latestSession.headCommit) {
    return recommendation({
      phase: "needs_refresh",
      reason: "The branch HEAD has moved since the latest branch review session snapshot.",
      reviewSessionId: latestSession.id,
      baseRef: latestSession.baseRef,
      commands: [`pathfinder branch-review refresh ${latestSession.id}`],
      agentInstruction: `Refresh branch review session ${latestSession.id} before continuing.`,
      humanInstruction: "Refresh the branch review session so comments are checked against the latest committed diff."
    });
  }

  if (!latestSession.approvedAt) {
    const approveCommand = `pathfinder branch-review approve ${latestSession.id}`;
    return recommendation({
      phase: "awaiting_human_approval",
      reason: "The branch review session has no open comments; a human must approve it before PR generation is final.",
      reviewSessionId: latestSession.id,
      baseRef: latestSession.baseRef,
      commands: [
        `pathfinder branch-review diff ${latestSession.id}`,
        `pathfinder branch-review comment list --session ${latestSession.id} --open`,
        approveCommand
      ],
      agentInstruction: `Pause branch review work until the human explicitly approves. Only run ${approveCommand} after a clear approval.`,
      humanInstruction: `Inspect the diff. If acceptable, approve it with '${approveCommand}' or explicitly tell the agent "approved".`
    });
  }

  if (!input.prMarkdown?.trim()) {
    return recommendation({
      phase: "ready_for_pr",
      reason: "The branch review session is approved and no stored PR draft exists.",
      reviewSessionId: latestSession.id,
      baseRef: latestSession.baseRef,
      commands: [`pathfinder branch-review pr generate --base ${latestSession.baseRef}`],
      agentInstruction: "Generate the standalone branch review PR draft. Do not add new implementation work.",
      humanInstruction: "Review the generated PR draft before publishing externally."
    });
  }

  return recommendation({
    phase: "complete",
    reason: "The branch review session is approved and PR markdown is stored.",
    reviewSessionId: latestSession.id,
    baseRef: latestSession.baseRef,
    commands: [`pathfinder branch-review pr generate --base ${latestSession.baseRef}`],
    agentInstruction: "Branch review is complete. Do not add implementation work unless the human asks for another change.",
    humanInstruction: "The branch review and local PR draft are ready for external PR publication."
  });
}

function latestBranchReviewSession(sessions: BranchReviewSession[]): BranchReviewSession | undefined {
  return [...sessions].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1);
}

function commentTargetsSession(comment: ReviewComment, sessionId: string): boolean {
  return (
    (comment.target?.type === "file" || comment.target?.type === "line") &&
    comment.target.sessionId === sessionId &&
    !comment.resolved
  );
}

function branchFeedbackExportCommand(
  sessionId: string,
  defaultFeedbackQueuePath: string | undefined
): string {
  const fileFlag = defaultFeedbackQueuePath ? "" : " --file ./.pathfinder-branch-feedback.md";
  return `pathfinder branch-review feedback export --session ${sessionId}${fileFlag}`;
}

function recommendation(value: BranchReviewNextRecommendation): BranchReviewNextRecommendation {
  return value;
}
