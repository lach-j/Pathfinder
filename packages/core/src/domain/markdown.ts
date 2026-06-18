import type { BranchReviewSession, Review, ReviewComment, ReviewSession } from "./review.js";
import type { Evidence } from "./evidence.js";
import type { RepositorySummary } from "./repository.js";
import type { Slice } from "./slice.js";
import type { Workstream } from "./project.js";

export interface PrMarkdownInput {
  workstream: Workstream;
  requirementsMarkdown?: string;
  planMarkdown: string;
  slices: Slice[];
  comments: ReviewComment[];
  reviews: Review[];
  reviewSessions?: ReviewSession[];
  evidence?: Evidence[];
  repositorySummary?: RepositorySummary;
  feedbackQueuePath?: string;
}

export interface FeedbackQueueMarkdownInput {
  workstream: Workstream;
  activeSlice?: Slice;
  requirementsPath: string;
  planPath: string;
  session?: ReviewSession;
  comments: ReviewComment[];
  slices: Slice[];
}

export interface BranchFeedbackQueueMarkdownInput {
  session?: BranchReviewSession;
  comments: ReviewComment[];
}

export interface BranchPrMarkdownInput {
  sessions: BranchReviewSession[];
  comments: ReviewComment[];
  repositorySummary?: RepositorySummary;
  feedbackQueuePath?: string;
}
