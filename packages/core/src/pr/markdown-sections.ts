import {
  BranchReviewSession,
  Evidence,
  RepositoryChangeStatus,
  RepositorySummary,
  Review,
  ReviewComment,
  ReviewSession,
  Slice
} from "../domain.js";
import { countRepositoryCategories } from "../repository.js";
import { describeReviewCommentTarget } from "../review/comment-targets.js";

import { sortEvidence } from "./markdown-sort.js";

export function formatReviewSessions(sessions: ReviewSession[]): string[] {
  if (sessions.length === 0) {
    return ["- No local review sessions recorded."];
  }

  const lines: string[] = [];
  for (const session of sessions) {
    lines.push(
      `- Session \`${session.id}\` for slice \`${session.sliceId}\`: base \`${session.baseRef}\`, head \`${session.headRef}\`, head commit \`${session.headCommit}\`, merge base \`${session.mergeBase}\`, changed files ${session.changedFiles.length}, created ${session.createdAt}${session.refreshedAt ? `, refreshed ${session.refreshedAt}` : ""}.`
    );

    lines.push(...formatChangedFileRows(session.changedFiles));
  }

  return lines;
}

export function formatBranchReviewSessions(sessions: BranchReviewSession[]): string[] {
  if (sessions.length === 0) {
    return ["- No branch review sessions recorded."];
  }

  const lines: string[] = [];
  for (const session of sessions) {
    const approval = session.approvedAt ? `, approved ${session.approvedAt}` : "";
    lines.push(
      `- Session \`${session.id}\`: base \`${session.baseRef}\`, head \`${session.headRef}\`, head commit \`${session.headCommit}\`, merge base \`${session.mergeBase}\`, changed files ${session.changedFiles.length}, created ${session.createdAt}${session.refreshedAt ? `, refreshed ${session.refreshedAt}` : ""}${approval}.`
    );

    lines.push(...formatChangedFileRows(session.changedFiles));
  }

  return lines;
}

export function formatLocalReviewFeedback(
  openComments: ReviewComment[],
  resolvedComments: ReviewComment[],
  staleComments: ReviewComment[]
): string[] {
  const lines: string[] = [];

  lines.push("### Open Comments", "");
  if (openComments.length === 0) {
    lines.push("- No open local review comments.");
  } else {
    lines.push(...openComments.map((comment) => formatFeedbackComment(comment)));
  }

  lines.push("", "### Resolved Comments", "");
  if (resolvedComments.length === 0) {
    lines.push("- No resolved local review comments.");
  } else {
    lines.push(...resolvedComments.map((comment) => formatFeedbackComment(comment)));
  }

  lines.push("", "### Stale Or Unknown Anchors", "");
  if (staleComments.length === 0) {
    lines.push("- No stale or unknown comment anchors recorded.");
  } else {
    lines.push(...staleComments.map((comment) => formatFeedbackComment(comment)));
  }

  return lines;
}

export function formatAgentFeedbackQueue(feedbackQueuePath: string | undefined): string[] {
  if (feedbackQueuePath) {
    return [`- Exported feedback queue: \`${feedbackQueuePath}\``];
  }

  return ["- No exported feedback queue file found. Run `pathfinder feedback export <workstream-id> --file ./.pathfinder-feedback.md` if an agent handoff is needed."];
}

export function formatBranchAgentFeedbackQueue(feedbackQueuePath: string | undefined): string[] {
  if (feedbackQueuePath) {
    return [`- Exported feedback queue: \`${feedbackQueuePath}\``];
  }

  return ["- No exported feedback queue file found. Run `pathfinder branch-review feedback export --file ./.pathfinder-branch-feedback.md` if an agent handoff is needed."];
}

export function formatMarkdownSection(markdown: string, label: string): string[] {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return [`- No ${label} recorded.`];
  }

  const excerptLength = 700;
  const excerpt =
    trimmed.length > excerptLength ? `${trimmed.slice(0, excerptLength).trimEnd()}...` : trimmed;

  return ["```markdown", excerpt, "```"];
}

export function formatCompletedSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No completed slices recorded."];
  }

  return slices.map(formatSliceForPr);
}

export function formatRemainingSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No remaining slices recorded."];
  }

  return slices.map(formatSliceForPr);
}

export function formatChangedFiles(summary: RepositorySummary | undefined): string[] {
  if (!summary) {
    return ["- No repository summary requested. Re-run with `--base <base-ref>` to include committed changes."];
  }

  const counts = countRepositoryCategories(summary.files);
  const lines = [
    `- Base ref: \`${summary.baseRef}\``,
    `- Head ref: \`${summary.headRef}\``,
    `- Head commit: \`${summary.headCommit}\``,
    `- Merge base: \`${summary.mergeBase}\``,
    `- Changed files: ${summary.files.length} (source ${counts.source}, test ${counts.test}, documentation ${counts.documentation}, configuration ${counts.configuration}, state ${counts.state}, other ${counts.other})`
  ];

  if (summary.files.length === 0) {
    lines.push("- No committed file changes found.");
    return lines;
  }

  lines.push(...formatChangedFileRows(summary.files, false));

  return lines;
}

export function formatTestingEvidence(evidence: Evidence[], reviews: Review[], slices: Slice[]): string[] {
  const lines: string[] = [];
  const slicesById = new Map(slices.map((slice) => [slice.id, slice]));
  const evidenceBySlice = groupEvidenceBySlice(evidence);

  if (evidence.length === 0 && reviews.every((review) => review.evidence.length === 0)) {
    return ["- No testing evidence recorded."];
  }

  for (const [sliceId, sliceEvidence] of evidenceBySlice) {
    const slice = slicesById.get(sliceId);
    lines.push(`- Slice \`${sliceId}\`${slice ? ` (${slice.title})` : ""}:`);
    for (const item of sliceEvidence) {
      lines.push(`  - ${formatEvidenceItem(item)}`);
    }
  }

  for (const review of reviews) {
    const reviewEvidence = sortEvidence(review.evidence);
    if (reviewEvidence.length === 0) {
      continue;
    }

    lines.push(`- Review \`${review.id}\` evidence:`);
    for (const item of reviewEvidence) {
      lines.push(`  - ${formatEvidenceItem(item)}`);
    }
  }

  return lines;
}

export function formatReviewNotes(
  reviews: Review[],
  openComments: ReviewComment[],
  resolvedComments: ReviewComment[]
): string[] {
  const lines: string[] = [];

  if (reviews.length === 0) {
    lines.push("- No review records found.");
  } else {
    for (const review of reviews) {
      lines.push(`- Review \`${review.id}\` (${review.status}, slice \`${review.sliceId}\`): ${review.summary}`);
      for (const check of review.checks ?? []) {
        lines.push(`  - [${check.severity}] ${check.message}`);
      }
    }
  }

  if (openComments.length === 0) {
    lines.push("- No open review comments.");
  } else {
    for (const comment of openComments) {
      lines.push(`- Open comment \`${comment.id}\` (${formatCommentTarget(comment)}): ${comment.body}`);
    }
  }

  if (resolvedComments.length > 0) {
    for (const comment of resolvedComments) {
      lines.push(`- Resolved comment \`${comment.id}\` (${formatCommentTarget(comment)}): ${comment.body}`);
    }
  }

  return lines;
}

export function formatBranchRisks(
  openComments: ReviewComment[],
  staleComments: ReviewComment[],
  sessions: BranchReviewSession[]
): string[] {
  const unapprovedSessions = sessions.filter((session) => !session.approvedAt);

  if (openComments.length === 0 && staleComments.length === 0 && unapprovedSessions.length === 0) {
    return ["- No unresolved comments, stale anchors, or unapproved branch review sessions recorded."];
  }

  const lines: string[] = [];

  if (openComments.length > 0) {
    lines.push(`- ${openComments.length} unresolved review comment(s) remain.`);
  }

  if (staleComments.length > 0) {
    lines.push(`- ${staleComments.length} stale or unknown review comment anchor(s) need review.`);
  }

  if (unapprovedSessions.length > 0) {
    lines.push(`- ${unapprovedSessions.length} branch review session(s) have not been explicitly approved.`);
  }

  return lines;
}

export function formatRisks(openComments: ReviewComment[], staleComments: ReviewComment[], reviews: Review[]): string[] {
  const warningCount = reviews.reduce(
    (total, review) => total + (review.checks ?? []).filter((check) => check.severity === "warning").length,
    0
  );

  if (openComments.length === 0 && staleComments.length === 0 && warningCount === 0) {
    return ["- No unresolved comments, stale anchors, or deterministic review warnings recorded."];
  }

  const lines: string[] = [];

  if (openComments.length > 0) {
    lines.push(`- ${openComments.length} unresolved review comment(s) remain.`);
  }

  if (staleComments.length > 0) {
    lines.push(`- ${staleComments.length} stale or unknown review comment anchor(s) need review.`);
  }

  if (warningCount > 0) {
    lines.push(`- ${warningCount} deterministic review warning(s) recorded.`);
  }

  return lines;
}

function formatFeedbackComment(comment: ReviewComment): string {
  const status = comment.resolved ? "resolved" : "open";
  const anchor = comment.anchorStatus ? `, anchor ${comment.anchorStatus}` : "";
  const resolvedAt = comment.resolvedAt ? `, resolved ${comment.resolvedAt}` : "";
  return `- \`${comment.id}\` (${status}${anchor}${resolvedAt}; ${formatCommentTarget(comment)}): ${comment.body}`;
}

function formatSliceForPr(slice: Slice): string {
  const dependencies = slice.dependsOnSliceIds?.length
    ? ` Dependencies: ${slice.dependsOnSliceIds.map((dependency) => `\`${dependency}\``).join(", ")}.`
    : " Dependencies: none.";

  return `- ${slice.title} (\`${slice.id}\`, ${slice.status}): ${slice.description}${dependencies}`;
}

function groupEvidenceBySlice(evidence: Evidence[]): Array<[string, Evidence[]]> {
  const grouped = new Map<string, Evidence[]>();

  for (const item of evidence) {
    grouped.set(item.sliceId, [...(grouped.get(item.sliceId) ?? []), item]);
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function formatEvidenceItem(evidence: Evidence): string {
  const pathText = evidence.path ? ` (${evidence.path})` : "";
  return `\`${evidence.id}\` [${evidence.kind}]: ${evidence.description}${pathText}`;
}

function formatCommentTarget(comment: ReviewComment): string {
  return describeReviewCommentTarget(comment).replace(/^slice (.+)$/, "slice `$1`");
}

function formatChangedFileRows(
  files: RepositorySummary["files"] | ReviewSession["changedFiles"],
  indent = true
): string[] {
  return sortChangedFiles(files).map((file) => {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    const prefix = indent ? "  - " : "- ";
    return `${prefix}${formatRepositoryStatus(file.status)} ${file.category}: ${pathText}`;
  });
}

function sortChangedFiles(files: RepositorySummary["files"] | ReviewSession["changedFiles"]) {
  return [...files].sort((left, right) => {
    const leftPath = left.previousPath ? `${left.previousPath} -> ${left.path}` : left.path;
    const rightPath = right.previousPath ? `${right.previousPath} -> ${right.path}` : right.path;
    return leftPath.localeCompare(rightPath);
  });
}

function formatRepositoryStatus(status: RepositoryChangeStatus): string {
  if (status === "added") {
    return "A";
  }

  if (status === "modified") {
    return "M";
  }

  if (status === "deleted") {
    return "D";
  }

  if (status === "renamed") {
    return "R";
  }

  if (status === "copied") {
    return "C";
  }

  return "?";
}
