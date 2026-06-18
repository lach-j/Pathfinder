import {
  BranchReviewSession,
  Evidence,
  Review,
  ReviewComment,
  ReviewSession,
  Slice
} from "../domain.js";

export function sortSlices(slices: Slice[]): Slice[] {
  return [...slices].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

export function sortComments(comments: ReviewComment[]): ReviewComment[] {
  return [...comments].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

export function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

export function sortReviewSessions(sessions: ReviewSession[]): ReviewSession[] {
  return [...sessions].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

export function sortBranchReviewSessions(sessions: BranchReviewSession[]): BranchReviewSession[] {
  return [...sessions].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

export function sortEvidence(evidence: Evidence[]): Evidence[] {
  return [...evidence].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}
