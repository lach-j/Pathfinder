import { PathfinderError, ReviewCommentSide } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";

import { usageError } from "../options.js";

export function parseOptionalLineNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const lineNumber = Number(value);
  if (!Number.isInteger(lineNumber) || lineNumber < 1) {
    throw usageError("Invalid --line value. Expected a positive integer.");
  }

  return lineNumber;
}

export function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 4783;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw usageError("Invalid --port value. Expected an integer between 1 and 65535.");
  }

  return port;
}

export async function requireBaselineCommit(git: GitAdapter, action: string): Promise<void> {
  if (!(await git.hasCommits())) {
    throw new PathfinderError(
      `Cannot ${action} because this repository has no commits. Create a first baseline commit before using committed-diff review.`
    );
  }
}

export async function requireCleanCommittedReviewRepo(git: GitAdapter, action: string): Promise<void> {
  await requireBaselineCommit(git, action);
  if (await git.hasUncommittedChanges()) {
    throw new PathfinderError(
      `Cannot ${action} with uncommitted changes. Commit the relevant changes, stash or remove unrelated changes, then rerun the review command.`
    );
  }
}

export function assertReviewSide(side: string | undefined): ReviewCommentSide {
  if (side !== "old" && side !== "new") {
    throw usageError("Invalid --side value. Expected old or new.");
  }

  return side;
}
