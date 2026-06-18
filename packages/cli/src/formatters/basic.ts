import {
  describeReviewCommentTarget,
  Evidence,
  Review,
  ReviewComment,
  Slice
} from "@pathfinder/core";

export function formatSlice(slice: Slice): string {
  const dependencies = slice.dependsOnSliceIds?.length ? `\tdepends-on:${slice.dependsOnSliceIds.join(",")}` : "";
  return `${slice.id}\t${slice.status}\t${slice.title}${dependencies}`;
}

export function formatComment(comment: ReviewComment): string {
  const status = comment.resolved ? "resolved" : "open";
  const anchorStatus = comment.anchorStatus ? `\tanchor:${comment.anchorStatus}` : "";
  const origin = comment.origin && comment.origin !== "human" ? `\torigin:${comment.origin}` : "";
  return `${comment.id}\t${status}${anchorStatus}${origin}\t${describeReviewCommentTarget(comment)}\t${comment.body}`;
}

export function formatReview(review: Review): string {
  return `${review.id}\t${review.status}\t${review.sliceId}\t${review.summary}`;
}

export function formatEvidence(evidence: Evidence): string {
  const pathText = evidence.path ? `\t${evidence.path}` : "";
  return `${evidence.id}\t${evidence.kind}\t${evidence.sliceId}\t${evidence.description}${pathText}`;
}
