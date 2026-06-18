import { PathfinderError, type BranchReviewSession, type ReviewComment, type ReviewSession } from "@pathfinder/core";

import type { AgentCommandsListResult, AgentDoctorCheck } from "./store-types.js";

export function checkAgentCommandTool(tool: AgentCommandsListResult["tools"][number]): AgentDoctorCheck {
  const id = `${tool.tool}-commands`;
  const missing = tool.files.filter((file) => !file.installed);
  const userOwned = tool.files.filter((file) => file.installed && !file.managed);
  const outdated = tool.files.filter((file) => file.installed && file.managed && file.changed);
  const fixCommand = `pathfinder agent commands install --tool ${tool.tool}`;

  if (missing.length > 0) {
    return {
      id,
      status: "missing",
      message: `${tool.displayName} Pathfinder command wrappers are missing: ${missing.map((file) => file.relativePath).join(", ")}.`,
      fixCommand
    };
  }

  if (userOwned.length > 0) {
    return {
      id,
      status: "warning",
      message: `${tool.displayName} command wrapper paths exist but are not Pathfinder-managed: ${userOwned.map((file) => file.relativePath).join(", ")}.`,
      fixCommand
    };
  }

  if (outdated.length > 0) {
    return {
      id,
      status: "warning",
      message: `${tool.displayName} Pathfinder command wrappers are installed but need updating: ${outdated.map((file) => file.relativePath).join(", ")}.`,
      fixCommand
    };
  }

  return {
    id,
    status: "pass",
    message: `${tool.displayName} Pathfinder command wrappers are installed.`
  };
}

export function checkPersonalStateMode(hasExternalProject: boolean, hasRepoProject: boolean): AgentDoctorCheck {
  if (hasRepoProject) {
    return {
      id: "state-mode",
      status: "error",
      message: "Repo-local Pathfinder state exists; personal doctor expects external state with no repo-local state."
    };
  }

  if (!hasExternalProject) {
    return {
      id: "state-mode",
      status: "missing",
      message: "External Pathfinder state is not initialized for this repository.",
      fixCommand: "pathfinder init --personal"
    };
  }

  return {
    id: "state-mode",
    status: "pass",
    message: "State mode is external for this repository."
  };
}

export function changedFileMatches(path: string, previousPath: string | undefined, filePath: string): boolean {
  return path === filePath || previousPath === filePath;
}

export function commentTargetsSession(comment: ReviewComment, sessionId: string): boolean {
  return (
    (comment.target?.type === "file" || comment.target?.type === "line") &&
    comment.target.sessionId === sessionId
  );
}

export function latestSessionForSlice(sessions: ReviewSession[], sliceId: string | undefined): ReviewSession | undefined {
  if (!sliceId) {
    return undefined;
  }

  return sessions
    .filter((session) => session.sliceId === sliceId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
}

export function latestBranchReviewSession(sessions: BranchReviewSession[]): BranchReviewSession | undefined {
  return [...sessions].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unknown Pathfinder state error.";
}

export const AGENT_BOOTSTRAP_START = "<!-- pathfinder-agent:start -->";
export const AGENT_BOOTSTRAP_END = "<!-- pathfinder-agent:end -->";

const AGENT_BOOTSTRAP_BLOCK = `${AGENT_BOOTSTRAP_START}
## Pathfinder Agent Workflow

Pathfinder is the source of truth for planning, slice scope, review feedback, and PR output in this repository.

When asked to plan, implement, continue, review, or address feedback here, first run:

\`\`\`bash
pathfinder agent next --json
\`\`\`

Follow the returned \`phase\`, \`commands\`, and \`agentInstruction\`. Use \`pathfinder agent prompt\` when you need tool-neutral markdown instructions for the current phase.

Do not create unmanaged task lists or parallel plans when Pathfinder state exists. Keep implementation scoped to the active Pathfinder slice, and do not resolve Pathfinder comments automatically after making code changes.

MCP is not required for this workflow; use the local Pathfinder CLI commands above.
${AGENT_BOOTSTRAP_END}
`;

export function applyAgentBootstrapBlock(existing: string): string {
  return applyManagedBlock(
    existing,
    AGENT_BOOTSTRAP_BLOCK,
    AGENT_BOOTSTRAP_START,
    AGENT_BOOTSTRAP_END,
    "AGENTS.md contains an incomplete Pathfinder agent bootstrap block.",
    "AGENTS.md contains malformed Pathfinder agent bootstrap markers."
  );
}

export function applyManagedBlock(
  existing: string,
  block: string,
  startMarker: string,
  endMarker: string,
  incompleteMessage: string,
  malformedMessage: string
): string {
  const startIndex = existing.indexOf(startMarker);
  const endIndex = existing.indexOf(endMarker);

  if ((startIndex === -1) !== (endIndex === -1)) {
    throw new PathfinderError(incompleteMessage);
  }

  if (startIndex !== -1 && endIndex !== -1) {
    if (endIndex < startIndex) {
      throw new PathfinderError(malformedMessage);
    }

    const afterEnd = endIndex + endMarker.length;
    return `${existing.slice(0, startIndex)}${block}${existing.slice(afterEnd).replace(/^\r?\n/, "")}`;
  }

  if (!existing.trim()) {
    return block;
  }

  const trimmedEnd = existing.replace(/\s*$/, "");
  return `${trimmedEnd}\n\n${block}`;
}
