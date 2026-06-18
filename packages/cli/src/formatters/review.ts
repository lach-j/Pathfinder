import {
  BranchReviewSession,
  describeReviewCommentTarget,
  Evidence,
  RepositorySummary,
  Review,
  ReviewCheck,
  ReviewComment,
  ReviewSession
} from "@pathfinder/core";
import { BranchReviewApprovalResult, ReviewApprovalResult } from "@pathfinder/state";

import { formatChangeStatus } from "./repository.js";

export function formatReviewSession(session: ReviewSession): string {
  return `${session.id}\t${session.sliceId}\t${session.baseRef}\t${session.headRef}\t${session.headCommit}\t${session.changedFiles.length} file(s)`;
}

export function formatReviewSessionSummary(session: ReviewSession): string {
  const lines = [
    "# Pathfinder Review Session",
    "",
    `Session: ${session.id}`,
    `Workstream: ${session.workstreamId}`,
    `Slice: ${session.sliceId}`,
    `Base ref: ${session.baseRef}`,
    `Head ref: ${session.headRef}`,
    `Head commit: ${session.headCommit}`,
    `Merge base: ${session.mergeBase}`,
    `Changed files: ${session.changedFiles.length}`,
    ""
  ];

  if (session.changedFiles.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Files");
  lines.push("");
  lines.push(...session.changedFiles.map((file) => {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    return `- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`;
  }));

  return `${lines.join("\n")}\n`;
}

export function formatBranchReviewSession(session: BranchReviewSession): string {
  const approval = session.approvedAt ? `\tapproved:${session.approvedAt}` : "";
  return `${session.id}\t${session.baseRef}\t${session.headRef}\t${session.headCommit}\t${session.changedFiles.length} file(s)${approval}`;
}

export function formatBranchReviewSessionSummary(session: BranchReviewSession): string {
  const lines = [
    "# Pathfinder Branch Review Session",
    "",
    `Session: ${session.id}`,
    `Base ref: ${session.baseRef}`,
    `Head ref: ${session.headRef}`,
    `Head commit: ${session.headCommit}`,
    `Merge base: ${session.mergeBase}`,
    `Changed files: ${session.changedFiles.length}`,
    ...(session.approvedAt ? [`Approved at: ${session.approvedAt}`] : []),
    ""
  ];

  if (session.changedFiles.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Files");
  lines.push("");
  lines.push(...session.changedFiles.map((file) => {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    return `- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`;
  }));

  return `${lines.join("\n")}\n`;
}

export function formatReviewApproval(result: ReviewApprovalResult): string {
  const lines = [
    "# Pathfinder Review Approval",
    "",
    `Session: ${result.session.id}`,
    `Workstream: ${result.session.workstreamId}`,
    `Slice: ${result.slice.id}`,
    `Slice status: ${result.slice.status}`,
    `Evidence: ${result.evidence.id}`,
    "",
    "Human approval recorded locally. This was an explicit review decision, not hidden automation."
  ];

  return `${lines.join("\n")}\n`;
}

export function formatBranchReviewApproval(result: BranchReviewApprovalResult): string {
  const lines = [
    "# Pathfinder Branch Review Approval",
    "",
    `Session: ${result.session.id}`,
    `Base ref: ${result.session.baseRef}`,
    `Head ref: ${result.session.headRef}`,
    `Head commit: ${result.session.headCommit}`,
    `Approved at: ${result.session.approvedAt}`,
    "",
    "Human approval recorded locally for this branch review session."
  ];

  return `${lines.join("\n")}\n`;
}

export function formatDeterministicReview(review: Review, repositorySummary: RepositorySummary): string {
  const lines = [
    "# Pathfinder Deterministic Review",
    "",
    `Review: ${review.id}`,
    `Status: ${review.status}`,
    `Slice: ${review.sliceId}`,
    `Base ref: ${repositorySummary.baseRef}`,
    `Head ref: ${repositorySummary.headRef}`,
    `Head commit: ${repositorySummary.headCommit}`,
    `Merge base: ${repositorySummary.mergeBase}`,
    "",
    "## Checks",
    "",
    ...formatReviewChecks(review.checks ?? []),
    "",
    "## Unresolved Comments",
    "",
    ...formatReviewComments(review.comments),
    "",
    "## Evidence",
    "",
    ...formatReviewEvidence(review.evidence),
    "",
    "## Changed Files",
    "",
    ...formatReviewFiles(repositorySummary)
  ];

  return `${lines.join("\n")}\n`;
}

function formatReviewChecks(checks: ReviewCheck[]): string[] {
  if (checks.length === 0) {
    return ["- [info] No deterministic checks recorded."];
  }

  return checks.map((check) => `- [${check.severity}] ${check.message}`);
}

function formatReviewComments(comments: ReviewComment[]): string[] {
  if (comments.length === 0) {
    return ["No unresolved comments for the active slice."];
  }

  return comments.map((comment) => `- ${comment.id} (${describeReviewCommentTarget(comment)}): ${comment.body}`);
}

function formatReviewEvidence(evidence: Evidence[]): string[] {
  if (evidence.length === 0) {
    return ["No evidence recorded for the active slice."];
  }

  return evidence.map((item) => {
    const pathText = item.path ? ` (${item.path})` : "";
    return `- ${item.id} [${item.kind}]: ${item.description}${pathText}`;
  });
}

function formatReviewFiles(summary: RepositorySummary): string[] {
  if (summary.files.length === 0) {
    return ["No committed file changes found."];
  }

  return summary.files.map((file) => {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    return `- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`;
  });
}
