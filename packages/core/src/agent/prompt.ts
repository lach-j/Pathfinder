import { AgentNextPhase, AgentPromptInput, AgentPromptPhase } from "../domain.js";
import { getAgentCheckGuidance } from "./checks.js";

export function renderAgentPrompt(input: AgentPromptInput): string {
  const phase = input.phase ?? promptPhaseForNextPhase(input.recommendation.phase);
  const workstreamId = input.workstream?.id ?? input.recommendation.workstreamId ?? "<workstream-id>";
  const workstreamTitle = input.workstream?.title ?? "<workstream-title>";
  const sliceId = input.activeSlice?.id ?? input.recommendation.sliceId ?? "<slice-id>";
  const sliceTitle = input.activeSlice?.title ?? "<slice-title>";
  const sliceStatus = input.activeSlice?.status ?? "<slice-status>";
  const reviewSessionId = input.recommendation.reviewSessionId ?? "<review-session-id>";
  const requirementsPath =
    input.requirementsPath ?? `.pathfinder/workstreams/${workstreamId}/requirements.md`;
  const planPath = input.planPath ?? `.pathfinder/workstreams/${workstreamId}/plan.md`;
  const feedbackQueuePath = input.feedbackQueuePath ?? input.recommendation.feedbackQueuePath ?? "./.pathfinder-feedback.md";
  const checkGuidance = input.checkGuidance ?? getAgentCheckGuidance({ hasPackageJson: true });

  const lines = [
    `# Pathfinder Agent Prompt: ${phase}`,
    "",
    "Use Pathfinder as the source of truth for this repository.",
    "",
    "## Current Pathfinder State",
    "",
    `- Agent next phase: \`${input.recommendation.phase}\``,
    `- Reason: ${input.recommendation.reason}`,
    `- Workstream: ${workstreamTitle} (\`${workstreamId}\`)`,
    `- Active slice: ${sliceTitle} (\`${sliceId}\`, ${sliceStatus})`,
    `- Review session: \`${reviewSessionId}\``,
    `- Requirements path: \`${requirementsPath}\``,
    `- Plan path: \`${planPath}\``,
    "",
    "## Required Constraints",
    "",
    "- Treat Pathfinder state as canonical; do not create a parallel plan, checklist, or task tracker outside Pathfinder.",
    "- Keep changes scoped to the active slice unless the human explicitly changes the Pathfinder slice.",
    "- Do not resolve Pathfinder comments automatically; leave resolution for the human after review.",
    "- Do not call external APIs, add hosted services, or add authentication, billing, cloud sync, organisations, roles, or permissions.",
    `- ${checkGuidance.instruction}`,
    "- Commit implementation or feedback fixes before starting or refreshing a Pathfinder review session.",
    "",
    "## Commands To Run",
    "",
    ...commandsForPromptPhase(phase, {
      workstreamId,
      sliceId,
      reviewSessionId,
      requirementsPath,
      planPath,
      feedbackQueuePath,
      checkGuidance,
      recommendedCommands: input.recommendation.commands
    }).map((command) => `- \`${command}\``),
    "",
    "## Instructions",
    "",
    ...instructionsForPromptPhase(phase, {
      workstreamId,
      sliceId,
      reviewSessionId,
      requirementsPath,
      planPath,
      feedbackQueuePath,
      checkGuidance
    })
  ];

  return `${lines.join("\n")}\n`;
}

export function promptPhaseForNextPhase(phase: AgentNextPhase): AgentPromptPhase {
  if (phase === "feedback") {
    return "feedback";
  }

  if (phase === "awaiting_human_approval" || phase === "needs_human_review" || phase === "needs_review_session") {
    return "review";
  }

  if (phase === "ready_for_pr") {
    return "pr";
  }

  if (phase === "ready_to_implement" || phase === "needs_slice_selection" || phase === "needs_commit") {
    return "implement";
  }

  return "plan";
}

export function isAgentPromptPhase(value: string): value is AgentPromptPhase {
  return value === "plan" || value === "implement" || value === "feedback" || value === "review" || value === "pr";
}

interface PromptCommandContext {
  workstreamId: string;
  sliceId: string;
  reviewSessionId: string;
  requirementsPath: string;
  planPath: string;
  feedbackQueuePath: string;
  checkGuidance: ReturnType<typeof getAgentCheckGuidance>;
  recommendedCommands: string[];
}

function commandsForPromptPhase(phase: AgentPromptPhase, context: PromptCommandContext): string[] {
  if (phase === "plan") {
    return [
      "pathfinder agent next --json",
      "pathfinder workstream create --title \"<workstream-title>\"",
      "pathfinder requirement set <workstream-id> --file ./requirements.md",
      "pathfinder plan set <workstream-id> --file ./plan.md",
      "pathfinder plan import --file ./PLAN.md",
      "pathfinder slice add <workstream-id> --title \"<slice-title>\" --description \"<slice-description>\"",
      "pathfinder slice list <workstream-id>"
    ];
  }

  if (phase === "implement") {
    return uniqueCommands([
      "pathfinder agent next --json",
      ...context.recommendedCommands,
      "pathfinder current",
      ...context.checkGuidance.commands,
      "git status --short",
      "git add <changed-files>",
      "git commit -m \"Implement <slice-title>\"",
      `pathfinder review start --base <base-ref>`
    ]);
  }

  if (phase === "feedback") {
    return uniqueCommands([
      "pathfinder agent next --json",
      feedbackExportCommand(context.workstreamId, context.reviewSessionId, context.feedbackQueuePath),
      ...context.checkGuidance.commands,
      "git status --short",
      "git add <changed-files>",
      "git commit -m \"Address Pathfinder feedback\"",
      `pathfinder review refresh ${context.workstreamId} ${context.reviewSessionId}`
    ]);
  }

  if (phase === "review") {
    return [
      "pathfinder agent next --json",
      `pathfinder review start --base <base-ref>`,
      "pathfinder review serve",
      `pathfinder diff show --session ${context.reviewSessionId}`,
      `pathfinder comment list ${context.workstreamId} --session ${context.reviewSessionId} --open`,
      `pathfinder review approve ${context.workstreamId} --session ${context.reviewSessionId}`
    ];
  }

  return [
    "pathfinder agent next --json",
    `pathfinder pr generate ${context.workstreamId}`,
    `pathfinder pr generate ${context.workstreamId} --base <base-ref>`
  ];
}

interface PromptInstructionContext {
  workstreamId: string;
  sliceId: string;
  reviewSessionId: string;
  requirementsPath: string;
  planPath: string;
  feedbackQueuePath: string;
  checkGuidance: ReturnType<typeof getAgentCheckGuidance>;
}

function instructionsForPromptPhase(phase: AgentPromptPhase, context: PromptInstructionContext): string[] {
  if (phase === "plan") {
    return [
      `1. Read \`${context.requirementsPath}\`, \`${context.planPath}\`, README.md, PATHFINDER_PRD.md, and AGENTS.md if they exist.`,
      "2. Explore the repository just enough to understand affected areas.",
      "3. Ask only necessary questions when requirements or acceptance criteria are missing.",
      "4. Create or update the Pathfinder workstream, requirements, plan, and reviewable slices with Pathfinder commands.",
      "5. Stop before implementation unless Pathfinder reports an active slice ready to implement."
    ];
  }

  if (phase === "implement") {
    return [
      "1. Run the recommended `pathfinder slice start <workstream-id> <slice-id> --base <base-ref>` command if Pathfinder is still in `needs_slice_selection`.",
      "2. Run `pathfinder current` and read the active requirements, plan, and slice description after the slice branch is checked out.",
      `3. Implement only slice \`${context.sliceId}\`; avoid adjacent refactors and unrelated cleanup.`,
      `4. ${formatCheckInstruction(context.checkGuidance)}`,
      "5. Inspect `git status --short`, stage only the slice files, and commit the implementation before review.",
      "6. After the commit, run `pathfinder review start --base <base-ref>` or refresh the existing review session if Pathfinder reports one.",
      "7. Summarize changed files, checks, and manual verification steps."
    ];
  }

  if (phase === "feedback") {
    return [
      `1. Export and read \`${context.feedbackQueuePath}\`.`,
      "2. Address every open feedback item in that file while staying scoped to the active slice.",
      `3. ${formatCheckInstruction(context.checkGuidance)}`,
      "4. Inspect `git status --short`, stage only feedback fixes, and commit them.",
      `5. Refresh the review session with \`pathfinder review refresh ${context.workstreamId} ${context.reviewSessionId}\`.`,
      "6. Do not resolve comments; the human reviewer resolves them after verifying the refreshed diff."
    ];
  }

  if (phase === "review") {
    return [
      "1. Ensure the worktree and index are clean; Pathfinder review sessions use committed diffs only.",
      "2. Ensure a review session exists for the active slice; start one with `pathfinder review start --base <base-ref>` if needed.",
      "3. Run `pathfinder review serve` so the human can inspect the local diff UI.",
      "4. If using CLI-only review, inspect `pathfinder diff show --session <review-session-id>` and open comments with `pathfinder comment list`.",
      "5. Pause implementation until the human adds feedback or explicitly approves the review.",
      `6. Approval is a real human decision gate. Generic messages like "continue" are not approval; only run \`pathfinder review approve ${context.workstreamId} --session ${context.reviewSessionId}\` after the human clearly says the review is approved.`
    ];
  }

  return [
    "1. Generate the local PR markdown from Pathfinder state.",
    "2. Review the generated draft for unresolved comments, stale anchors, missing evidence, and remaining risks.",
    "3. Do not add new implementation work in PR mode.",
    "4. Summarize the PR draft path and any blockers that remain."
  ];
}

function feedbackExportCommand(workstreamId: string, reviewSessionId: string, feedbackQueuePath: string): string {
  const sessionFlag = reviewSessionId.startsWith("<") ? "" : ` --session ${reviewSessionId}`;
  const fileFlag = feedbackQueuePath === "./.pathfinder-feedback.md" ? " --file ./.pathfinder-feedback.md" : "";
  return `pathfinder feedback export ${workstreamId}${sessionFlag}${fileFlag}`;
}

function uniqueCommands(commands: string[]): string[] {
  return [...new Set(commands)];
}

function formatCheckInstruction(guidance: ReturnType<typeof getAgentCheckGuidance>): string {
  if (guidance.commands.length === 0) {
    return guidance.instruction;
  }

  return `Run ${guidance.commands.map((command) => `\`${command}\``).join(", ")}.`;
}
