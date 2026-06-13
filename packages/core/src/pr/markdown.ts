import {
  Evidence,
  PrMarkdownInput,
  RepositoryChangeStatus,
  RepositorySummary,
  Review,
  ReviewComment,
  ReviewSession,
  Slice
} from "../domain.js";
import { countRepositoryCategories } from "../repository.js";
import { describeReviewCommentTarget } from "../review/comment-targets.js";

export function generatePrMarkdown(input: PrMarkdownInput): string {
  const slices = sortSlices(input.slices);
  const completedSlices = slices.filter((slice) => slice.status === "complete");
  const remainingSlices = slices.filter((slice) => slice.status !== "complete");
  const evidence = sortEvidence(input.evidence ?? []);
  const reviews = sortReviews(input.reviews);
  const reviewSessions = sortReviewSessions(input.reviewSessions ?? []);
  const openComments = sortComments(input.comments.filter((comment) => !comment.resolved));
  const resolvedComments = sortComments(input.comments.filter((comment) => comment.resolved));
  const staleComments = sortComments(
    input.comments.filter((comment) => comment.anchorStatus === "stale" || comment.anchorStatus === "unknown")
  );

  const lines = [
    "## Summary",
    "",
    `- Workstream: ${input.workstream.title} (\`${input.workstream.id}\`)`,
    "- Scope: Local Pathfinder PR draft assembled from recorded requirements, plan, slices, evidence, reviews, and comments.",
    "",
    "## Requirements",
    "",
    ...formatMarkdownSection(input.requirementsMarkdown ?? "", "requirements"),
    "",
    "## Plan",
    "",
    ...formatMarkdownSection(input.planMarkdown, "plan"),
    "",
    "## Completed Slices",
    "",
    ...formatCompletedSlices(completedSlices),
    "",
    "## Remaining Slices",
    "",
    ...formatRemainingSlices(remainingSlices),
    "",
    "## Changed Files",
    "",
    ...formatChangedFiles(input.repositorySummary),
    "",
    "## Testing Evidence",
    "",
    ...formatTestingEvidence(evidence, reviews, slices),
    "",
    "## Review Notes",
    "",
    ...formatReviewNotes(reviews, openComments, resolvedComments),
    "",
    "## Review Sessions",
    "",
    ...formatReviewSessions(reviewSessions),
    "",
    "## Local Review Feedback",
    "",
    ...formatLocalReviewFeedback(openComments, resolvedComments, staleComments),
    "",
    "## Agent Feedback Queue",
    "",
    ...formatAgentFeedbackQueue(input.feedbackQueuePath),
    "",
    "## Risks",
    "",
    ...formatRisks(openComments, staleComments, reviews),
    "",
    "## Checklist",
    "",
    "- [ ] Requirements reviewed",
    "- [ ] Plan reviewed",
    "- [ ] Completed slices verified",
    "- [ ] Testing evidence reviewed",
    "- [ ] Local diff reviewed in Pathfinder",
    "- [ ] Agent feedback queue addressed",
    "- [ ] Open review comments resolved or accepted",
    "- [ ] Changed files reviewed against slice scope",
    ""
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function sortSlices(slices: Slice[]): Slice[] {
  return [...slices].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortComments(comments: ReviewComment[]): ReviewComment[] {
  return [...comments].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortReviewSessions(sessions: ReviewSession[]): ReviewSession[] {
  return [...sessions].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortEvidence(evidence: Evidence[]): Evidence[] {
  return [...evidence].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function formatReviewSessions(sessions: ReviewSession[]): string[] {
  if (sessions.length === 0) {
    return ["- No local review sessions recorded."];
  }

  const lines: string[] = [];
  for (const session of sessions) {
    lines.push(
      `- Session \`${session.id}\` for slice \`${session.sliceId}\`: base \`${session.baseRef}\`, head \`${session.headRef}\`, head commit \`${session.headCommit}\`, merge base \`${session.mergeBase}\`, changed files ${session.changedFiles.length}, created ${session.createdAt}${session.refreshedAt ? `, refreshed ${session.refreshedAt}` : ""}.`
    );

    const files = [...session.changedFiles].sort((left, right) => {
      const leftPath = left.previousPath ? `${left.previousPath} -> ${left.path}` : left.path;
      const rightPath = right.previousPath ? `${right.previousPath} -> ${right.path}` : right.path;
      return leftPath.localeCompare(rightPath);
    });

    for (const file of files) {
      const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
      lines.push(`  - ${formatRepositoryStatus(file.status)} ${file.category}: ${pathText}`);
    }
  }

  return lines;
}

function formatLocalReviewFeedback(
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

function formatFeedbackComment(comment: ReviewComment): string {
  const status = comment.resolved ? "resolved" : "open";
  const anchor = comment.anchorStatus ? `, anchor ${comment.anchorStatus}` : "";
  const resolvedAt = comment.resolvedAt ? `, resolved ${comment.resolvedAt}` : "";
  return `- \`${comment.id}\` (${status}${anchor}${resolvedAt}; ${formatCommentTarget(comment)}): ${comment.body}`;
}

function formatAgentFeedbackQueue(feedbackQueuePath: string | undefined): string[] {
  if (feedbackQueuePath) {
    return [`- Exported feedback queue: \`${feedbackQueuePath}\``];
  }

  return ["- No exported feedback queue file found. Run `pathfinder feedback export <workstream-id> --file ./.pathfinder-feedback.md` if an agent handoff is needed."];
}

function formatMarkdownSection(markdown: string, label: string): string[] {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return [`- No ${label} recorded.`];
  }

  const excerptLength = 700;
  const excerpt =
    trimmed.length > excerptLength ? `${trimmed.slice(0, excerptLength).trimEnd()}...` : trimmed;

  return ["```markdown", excerpt, "```"];
}

function formatCompletedSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No completed slices recorded."];
  }

  return slices.map(formatSliceForPr);
}

function formatRemainingSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No remaining slices recorded."];
  }

  return slices.map(formatSliceForPr);
}

function formatSliceForPr(slice: Slice): string {
  const dependencies = slice.dependsOnSliceIds?.length
    ? ` Dependencies: ${slice.dependsOnSliceIds.map((dependency) => `\`${dependency}\``).join(", ")}.`
    : " Dependencies: none.";

  return `- ${slice.title} (\`${slice.id}\`, ${slice.status}): ${slice.description}${dependencies}`;
}

function formatChangedFiles(summary: RepositorySummary | undefined): string[] {
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

  const files = [...summary.files].sort((left, right) => {
    const leftPath = left.previousPath ? `${left.previousPath} -> ${left.path}` : left.path;
    const rightPath = right.previousPath ? `${right.previousPath} -> ${right.path}` : right.path;
    if (leftPath < rightPath) {
      return -1;
    }

    if (leftPath > rightPath) {
      return 1;
    }

    return 0;
  });

  for (const file of files) {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    lines.push(`- ${formatRepositoryStatus(file.status)} ${file.category}: ${pathText}`);
  }

  return lines;
}

function formatTestingEvidence(evidence: Evidence[], reviews: Review[], slices: Slice[]): string[] {
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

function formatReviewNotes(
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

function formatCommentTarget(comment: ReviewComment): string {
  return describeReviewCommentTarget(comment).replace(/^slice (.+)$/, "slice `$1`");
}

function formatRisks(openComments: ReviewComment[], staleComments: ReviewComment[], reviews: Review[]): string[] {
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
