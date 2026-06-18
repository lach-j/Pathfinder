import {
  BranchPrMarkdownInput,
  PrMarkdownInput
} from "../domain.js";

import {
  formatAgentFeedbackQueue,
  formatBranchAgentFeedbackQueue,
  formatBranchReviewSessions,
  formatBranchRisks,
  formatChangedFiles,
  formatCompletedSlices,
  formatLocalReviewFeedback,
  formatMarkdownSection,
  formatRemainingSlices,
  formatReviewNotes,
  formatReviewSessions,
  formatRisks,
  formatTestingEvidence
} from "./markdown-sections.js";
import {
  sortBranchReviewSessions,
  sortComments,
  sortEvidence,
  sortReviewSessions,
  sortReviews,
  sortSlices
} from "./markdown-sort.js";

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

export function generateBranchPrMarkdown(input: BranchPrMarkdownInput): string {
  const sessions = sortBranchReviewSessions(input.sessions);
  const openComments = sortComments(input.comments.filter((comment) => !comment.resolved));
  const resolvedComments = sortComments(input.comments.filter((comment) => comment.resolved));
  const staleComments = sortComments(
    input.comments.filter((comment) => comment.anchorStatus === "stale" || comment.anchorStatus === "unknown")
  );

  const lines = [
    "## Summary",
    "",
    "- Scope: Local Pathfinder PR draft assembled from a standalone branch review.",
    "",
    "## Changed Files",
    "",
    ...formatChangedFiles(input.repositorySummary),
    "",
    "## Branch Review Sessions",
    "",
    ...formatBranchReviewSessions(sessions),
    "",
    "## Local Review Feedback",
    "",
    ...formatLocalReviewFeedback(openComments, resolvedComments, staleComments),
    "",
    "## Agent Feedback Queue",
    "",
    ...formatBranchAgentFeedbackQueue(input.feedbackQueuePath),
    "",
    "## Risks",
    "",
    ...formatBranchRisks(openComments, staleComments, sessions),
    "",
    "## Checklist",
    "",
    "- [ ] Branch diff reviewed in Pathfinder",
    "- [ ] Agent feedback queue addressed",
    "- [ ] Open review comments resolved or accepted",
    "- [ ] Changed files reviewed against branch scope",
    "- [ ] Tests and checks reviewed",
    ""
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}
