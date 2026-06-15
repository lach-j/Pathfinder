import {
  AgentNextInput,
  AgentNextRecommendation,
  ReviewComment,
  ReviewSession,
  Slice
} from "../domain.js";

export function getAgentNextRecommendation(input: AgentNextInput): AgentNextRecommendation {
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
      agentInstruction: "Stop implementation work until Pathfinder is initialized for this repository.",
      humanInstruction: "Run pathfinder init from the repository root, then create or import a workstream plan."
    });
  }

  if (input.workstreams.length === 0) {
    return recommendation({
      phase: "needs_workstream",
      reason: "Pathfinder is initialized but no workstreams exist.",
      commands: [
        "pathfinder workstream create --title \"<workstream-title>\"",
        "pathfinder plan import --file ./PLAN.md"
      ],
      agentInstruction: "Do not implement yet. Ask the human for the intended workstream and plan source.",
      humanInstruction: "Create a workstream manually or import a stage plan."
    });
  }

  const workstream = input.activeWorkstream;
  if (!workstream) {
    return recommendation({
      phase: "needs_slice_selection",
      reason: "No active workstream is set.",
      commands: ["pathfinder workstream list", "pathfinder slice next <workstream-id>"],
      agentInstruction: "Ask the human which workstream should be active before implementing.",
      humanInstruction: "Select a workstream and set an active slice."
    });
  }

  const slices = input.slices ?? [];
  if (!input.planMarkdown?.trim() || slices.length === 0) {
    return recommendation({
      phase: "needs_plan",
      reason: !input.planMarkdown?.trim()
        ? "The active workstream has no meaningful plan."
        : "The active workstream has no slices.",
      workstreamId: workstream.id,
      commands: [
        `pathfinder plan set ${workstream.id} --file ./plan.md`,
        "pathfinder plan import --file ./PLAN.md",
        `pathfinder slice add ${workstream.id} --title "..." --description "..."`
      ],
      agentInstruction: "Do not implement yet. Ask the human to record the plan and slice breakdown in Pathfinder.",
      humanInstruction: "Add a plan and at least one reviewable slice."
    });
  }

  if (workstream.activeSliceId && !input.activeSlice) {
    return recommendation({
      phase: "blocked",
      reason: `Active slice '${workstream.activeSliceId}' was not found in workstream '${workstream.id}'.`,
      workstreamId: workstream.id,
      commands: [`pathfinder slice list ${workstream.id}`],
      agentInstruction: "Stop implementation work until the inconsistent active slice state is fixed.",
      humanInstruction: "Set a valid active slice or repair the local Pathfinder state."
    });
  }

  const openComments = input.openComments ?? [];
  const activeSlice = input.activeSlice;
  const allSlicesComplete = slices.length > 0 && slices.every((slice) => slice.status === "complete");

  if (activeSlice) {
    const activeSessions = sessionsForSlice(input.reviewSessions ?? [], activeSlice.id);
    const latestSession = activeSessions[activeSessions.length - 1];
    const openSessionComments = latestSession
      ? openComments.filter((comment) => commentTargetsSession(comment, latestSession.id))
      : [];
    const openActiveComments = openComments.filter((comment) => commentAppliesToActiveSlice(comment, activeSlice.id));

    if (latestSession && openSessionComments.length > 0) {
      const feedbackQueuePath = input.feedbackQueuePath ?? "./.pathfinder-feedback.md";
      return recommendation({
        phase: "feedback",
        reason: "Active review session has open comments.",
        workstreamId: workstream.id,
        sliceId: activeSlice.id,
        reviewSessionId: latestSession.id,
        feedbackQueuePath,
        commands: [feedbackExportCommand(workstream.id, latestSession.id, input.feedbackQueuePath)],
        agentInstruction: `Read ${feedbackQueuePath}, address every open comment while staying scoped to slice ${activeSlice.id}, run checks, then run pathfinder review refresh ${workstream.id} ${latestSession.id}. Do not resolve comments automatically.`,
        humanInstruction: "Review the updated diff after the agent refreshes the session."
      });
    }

    if (openActiveComments.length > 0) {
      const feedbackQueuePath = input.feedbackQueuePath ?? "./.pathfinder-feedback.md";
      return recommendation({
        phase: "feedback",
        reason: "The active slice has open feedback.",
        workstreamId: workstream.id,
        sliceId: activeSlice.id,
        ...(latestSession ? { reviewSessionId: latestSession.id } : {}),
        feedbackQueuePath,
        commands: [feedbackExportCommand(workstream.id, undefined, input.feedbackQueuePath)],
        agentInstruction: `Read ${feedbackQueuePath}, address every open item while staying scoped to the active slice, then run checks. Do not resolve comments automatically.`,
        humanInstruction: "Review the changes and resolve comments only after verifying the fixes."
      });
    }

    if (allSlicesComplete) {
      return readyForPr(workstream.id);
    }

    if (activeSlice.status === "complete") {
      return selectNextSlice(workstream.id, input.nextSlice);
    }

    if (latestSession) {
      return recommendation({
        phase: "needs_human_review",
        reason: "Active review session exists and has no open comments.",
        workstreamId: workstream.id,
        sliceId: activeSlice.id,
        reviewSessionId: latestSession.id,
        commands: [
          "pathfinder review serve",
          `pathfinder diff show --session ${latestSession.id}`,
          `pathfinder comment list ${workstream.id} --session ${latestSession.id} --open`
        ],
        agentInstruction: "Pause implementation. The current diff needs human review before more agent work.",
        humanInstruction: "Open the local review UI or inspect the session diff, then add comments or mark the slice complete."
      });
    }

    if (input.repositorySummary && input.repositorySummary.files.length > 0) {
      return recommendation({
        phase: "needs_review_session",
        reason: "The active slice has committed changes but no review session.",
        workstreamId: workstream.id,
        sliceId: activeSlice.id,
        commands: [`pathfinder review start --base ${input.repositorySummary.baseRef}`],
        agentInstruction: "Do not continue implementation until a local review session is created for the committed diff.",
        humanInstruction: "Start a review session, inspect the diff, and add feedback if needed."
      });
    }

    if (input.repositorySummaryError) {
      return recommendation({
        phase: "ready_to_implement",
        reason: `Active slice is not complete, but Pathfinder could not inspect the known base ref: ${input.repositorySummaryError}`,
        workstreamId: workstream.id,
        sliceId: activeSlice.id,
        commands: ["pathfinder current", "pathfinder review start --base <base-ref>"],
        agentInstruction: "Implement only the active slice. Ask the human for the correct base ref before starting review.",
        humanInstruction: "Provide a valid base ref when the slice is ready for review."
      });
    }

    const baseRef = activeSlice.baseRef ?? "<base-ref>";
    return recommendation({
      phase: "ready_to_implement",
      reason: "Active slice is ready for implementation and has no open feedback.",
      workstreamId: workstream.id,
      sliceId: activeSlice.id,
      commands: ["pathfinder current", `pathfinder review start --base ${baseRef}`],
      agentInstruction: "Implement only the active slice, keep changes scoped, run checks, then start a review session when changes are ready.",
      humanInstruction: "After implementation, review the local diff in Pathfinder."
    });
  }

  if (allSlicesComplete && openComments.length === 0) {
    return readyForPr(workstream.id);
  }

  return selectNextSlice(workstream.id, input.nextSlice, input.suggestedBaseRef);
}

function selectNextSlice(
  workstreamId: string,
  nextSlice: Slice | undefined,
  suggestedBaseRef?: string
): AgentNextRecommendation {
  if (!nextSlice) {
    return recommendation({
      phase: "blocked",
      reason: "No active slice is set and no proposed or ready slice is currently actionable.",
      workstreamId,
      commands: [`pathfinder slice list ${workstreamId}`],
      agentInstruction: "Stop and ask the human to update slice statuses or dependencies.",
      humanInstruction: "Complete blocking dependencies or choose a slice manually."
    });
  }

  const baseRef = suggestedBaseRef ?? "<base-ref>";

  return recommendation({
    phase: "needs_slice_selection",
    reason: "An actionable slice exists but no active slice is set.",
    workstreamId,
    sliceId: nextSlice.id,
    commands: [
      `pathfinder slice next ${workstreamId}`,
      `pathfinder slice start ${workstreamId} ${nextSlice.id} --base ${baseRef}`
    ],
    agentInstruction: "Do not implement until the recommended slice branch is started and the slice is active.",
    humanInstruction: "Start the recommended slice branch, then rerun pathfinder agent next."
  });
}

function readyForPr(workstreamId: string): AgentNextRecommendation {
  return recommendation({
    phase: "ready_for_pr",
    reason: "All slices are complete and no open feedback blocks PR generation.",
    workstreamId,
    commands: [`pathfinder pr generate ${workstreamId}`, `pathfinder pr generate ${workstreamId} --base <base-ref>`],
    agentInstruction: "Do not add new implementation work. Generate or update the PR draft if asked.",
    humanInstruction: "Generate the PR draft and review it before publishing externally."
  });
}

function feedbackExportCommand(
  workstreamId: string,
  sessionId: string | undefined,
  defaultFeedbackQueuePath: string | undefined
): string {
  const sessionFlag = sessionId ? ` --session ${sessionId}` : "";
  const fileFlag = defaultFeedbackQueuePath ? "" : " --file ./.pathfinder-feedback.md";
  return `pathfinder feedback export ${workstreamId}${sessionFlag}${fileFlag}`;
}

function recommendation(value: AgentNextRecommendation): AgentNextRecommendation {
  return value;
}

function sessionsForSlice(sessions: ReviewSession[], sliceId: string): ReviewSession[] {
  return sessions
    .filter((session) => session.sliceId === sliceId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function commentTargetsSession(comment: ReviewComment, sessionId: string): boolean {
  return (
    (comment.target?.type === "file" || comment.target?.type === "line") &&
    comment.target.sessionId === sessionId &&
    !comment.resolved
  );
}

function commentAppliesToActiveSlice(comment: ReviewComment, sliceId: string): boolean {
  if (comment.resolved) {
    return false;
  }

  if (!comment.sliceId) {
    return true;
  }

  return comment.sliceId === sliceId;
}
