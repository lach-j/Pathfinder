import {
  BranchFeedbackQueueMarkdownInput,
  FeedbackQueueMarkdownInput,
  ReviewComment,
  ReviewCommentFileTarget,
  ReviewCommentLineTarget,
  ReviewCommentTarget,
  Slice
} from "../domain.js";
import { getReviewCommentTarget } from "../review/comment-targets.js";

interface LineCommentGroup {
  filePath: string;
  comments: ReviewComment[];
}

interface FileCommentGroup {
  filePath: string;
  comments: ReviewComment[];
}

export function generateFeedbackQueueMarkdown(input: FeedbackQueueMarkdownInput): string {
  const openComments = sortComments(input.comments.filter((comment) => !comment.resolved));
  const grouped = groupFeedbackComments(openComments);

  const lines = [
    "# Pathfinder Feedback Queue",
    "",
    "This queue is generated from local Pathfinder review comments. It is intended for a coding agent to action in bulk.",
    "",
    "## Agent Instructions",
    "",
    "- Address every open item below.",
    "- Keep changes scoped to the active slice.",
    "- Run the relevant tests and checks before stopping.",
    "- Do not resolve Pathfinder comments unless the user explicitly asks you to.",
    "",
    "## Context",
    "",
    `- Workstream: ${input.workstream.title} (\`${input.workstream.id}\`)`,
    `- Active slice: ${formatActiveSlice(input.activeSlice)}`,
    `- Requirements: \`${input.requirementsPath}\``,
    `- Plan: \`${input.planPath}\``,
    "",
    ...formatSession(input),
    "## Open Feedback",
    ""
  ];

  if (openComments.length === 0) {
    lines.push("- No open feedback items found.");
    lines.push("- Re-run review or add comments before handing this queue to an agent.");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  lines.push(`Open items: ${openComments.length}`);
  lines.push("");
  lines.push("### Line Comments");
  lines.push("");
  lines.push(...formatLineCommentGroups(grouped.lineGroups));
  lines.push("");
  lines.push("### File Comments");
  lines.push("");
  lines.push(...formatFileCommentGroups(grouped.fileGroups));
  lines.push("");
  lines.push("### Slice And Workstream Comments");
  lines.push("");
  lines.push(...formatBroadComments(grouped.broadComments, input.slices));

  return `${lines.join("\n").trimEnd()}\n`;
}

export function generateBranchFeedbackQueueMarkdown(input: BranchFeedbackQueueMarkdownInput): string {
  const openComments = sortComments(input.comments.filter((comment) => !comment.resolved));
  const grouped = groupFeedbackComments(openComments);

  const lines = [
    "# Pathfinder Branch Feedback Queue",
    "",
    "This queue is generated from local Pathfinder branch review comments. It is intended for a coding agent to action in bulk.",
    "",
    "## Agent Instructions",
    "",
    "- Address every open item below.",
    "- Keep changes scoped to the current branch review.",
    "- Run the relevant tests and checks before stopping.",
    "- Do not resolve Pathfinder comments unless the user explicitly asks you to.",
    "",
    ...formatBranchSession(input),
    "## Open Feedback",
    ""
  ];

  if (openComments.length === 0) {
    lines.push("- No open feedback items found.");
    lines.push("- Re-run review or add comments before handing this queue to an agent.");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  lines.push(`Open items: ${openComments.length}`);
  lines.push("");
  lines.push("### Line Comments");
  lines.push("");
  lines.push(...formatLineCommentGroups(grouped.lineGroups));
  lines.push("");
  lines.push("### File Comments");
  lines.push("");
  lines.push(...formatFileCommentGroups(grouped.fileGroups));
  lines.push("");
  lines.push("### Branch Comments");
  lines.push("");
  lines.push(...formatBranchBroadComments(grouped.broadComments));

  return `${lines.join("\n").trimEnd()}\n`;
}

function groupFeedbackComments(comments: ReviewComment[]): {
  lineGroups: LineCommentGroup[];
  fileGroups: FileCommentGroup[];
  broadComments: ReviewComment[];
} {
  const lineGroups = new Map<string, ReviewComment[]>();
  const fileGroups = new Map<string, ReviewComment[]>();
  const broadComments: ReviewComment[] = [];

  for (const comment of comments) {
    const target = getReviewCommentTarget(comment);

    if (target.type === "line") {
      lineGroups.set(target.filePath, [...(lineGroups.get(target.filePath) ?? []), comment]);
      continue;
    }

    if (target.type === "file") {
      fileGroups.set(target.filePath, [...(fileGroups.get(target.filePath) ?? []), comment]);
      continue;
    }

    broadComments.push(comment);
  }

  return {
    lineGroups: mapToSortedGroups(lineGroups),
    fileGroups: mapToSortedGroups(fileGroups),
    broadComments: sortComments(broadComments)
  };
}

function mapToSortedGroups<T extends LineCommentGroup | FileCommentGroup>(
  groups: Map<string, ReviewComment[]>
): T[] {
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, comments]) => ({
      filePath,
      comments: sortComments(comments)
    }) as T);
}

function formatActiveSlice(slice: Slice | undefined): string {
  if (!slice) {
    return "none";
  }

  return `${slice.title} (\`${slice.id}\`, ${slice.status})`;
}

function formatSession(input: FeedbackQueueMarkdownInput): string[] {
  if (!input.session) {
    return [];
  }

  return [
    "## Review Session",
    "",
    `- Session: \`${input.session.id}\``,
    `- Slice: \`${input.session.sliceId}\``,
    `- Base ref: \`${input.session.baseRef}\``,
    `- Head ref: \`${input.session.headRef}\``,
    `- Head commit: \`${input.session.headCommit}\``,
    `- Merge base: \`${input.session.mergeBase}\``,
    `- Changed files: ${input.session.changedFiles.length}`,
    ""
  ];
}

function formatBranchSession(input: BranchFeedbackQueueMarkdownInput): string[] {
  if (!input.session) {
    return [];
  }

  return [
    "## Branch Review Session",
    "",
    `- Session: \`${input.session.id}\``,
    `- Base ref: \`${input.session.baseRef}\``,
    `- Head ref: \`${input.session.headRef}\``,
    `- Head commit: \`${input.session.headCommit}\``,
    `- Merge base: \`${input.session.mergeBase}\``,
    `- Changed files: ${input.session.changedFiles.length}`,
    ""
  ];
}

function formatLineCommentGroups(groups: LineCommentGroup[]): string[] {
  if (groups.length === 0) {
    return ["- No open line comments."];
  }

  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`#### ${group.filePath}`);
    lines.push("");
    for (const comment of group.comments) {
      const target = getReviewCommentTarget(comment) as ReviewCommentLineTarget;
      lines.push(`- \`${comment.id}\` (${target.sessionId}, ${target.side} line ${target.lineNumber}): ${comment.body}`);
    }
    lines.push("");
  }

  return trimTrailingBlank(lines);
}

function formatFileCommentGroups(groups: FileCommentGroup[]): string[] {
  if (groups.length === 0) {
    return ["- No open file comments."];
  }

  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`#### ${group.filePath}`);
    lines.push("");
    for (const comment of group.comments) {
      const target = getReviewCommentTarget(comment) as ReviewCommentFileTarget;
      lines.push(`- \`${comment.id}\` (${target.sessionId}): ${comment.body}`);
    }
    lines.push("");
  }

  return trimTrailingBlank(lines);
}

function formatBranchBroadComments(comments: ReviewComment[]): string[] {
  if (comments.length === 0) {
    return ["- No open branch-level comments."];
  }

  return comments.map((comment) => `- \`${comment.id}\` (branch): ${comment.body}`);
}

function formatBroadComments(comments: ReviewComment[], slices: Slice[]): string[] {
  if (comments.length === 0) {
    return ["- No open slice or workstream comments."];
  }

  const slicesById = new Map(slices.map((slice) => [slice.id, slice]));
  return comments.map((comment) => {
    const target = getReviewCommentTarget(comment);
    return `- \`${comment.id}\` (${formatBroadTarget(target, slicesById)}): ${comment.body}`;
  });
}

function formatBroadTarget(target: ReviewCommentTarget, slicesById: Map<string, Slice>): string {
  if (target.type === "slice") {
    const slice = slicesById.get(target.sliceId);
    return slice ? `slice ${slice.title} (\`${target.sliceId}\`)` : `slice \`${target.sliceId}\``;
  }

  return "workstream";
}

function sortComments(comments: ReviewComment[]): ReviewComment[] {
  return [...comments].sort((left, right) => {
    const leftTarget = getReviewCommentTarget(left);
    const rightTarget = getReviewCommentTarget(right);
    const targetComparison = compareTargets(leftTarget, rightTarget);

    if (targetComparison !== 0) {
      return targetComparison;
    }

    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function compareTargets(left: ReviewCommentTarget, right: ReviewCommentTarget): number {
  const leftPath = "filePath" in left ? left.filePath : "";
  const rightPath = "filePath" in right ? right.filePath : "";
  const pathComparison = leftPath.localeCompare(rightPath);

  if (pathComparison !== 0) {
    return pathComparison;
  }

  const leftLine = left.type === "line" ? left.lineNumber : 0;
  const rightLine = right.type === "line" ? right.lineNumber : 0;

  if (leftLine !== rightLine) {
    return leftLine - rightLine;
  }

  const leftSide = left.type === "line" ? left.side : "";
  const rightSide = right.type === "line" ? right.side : "";
  return leftSide.localeCompare(rightSide);
}

function trimTrailingBlank(lines: string[]): string[] {
  while (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}
