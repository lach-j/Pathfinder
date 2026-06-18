import type { Evidence, Project, Review, Slice, StoredMarkdownFile, Workstream } from "./domain";
import type { BranchReviewSession, ReviewComment, ReviewSession, StructuredDiff } from "./review";

export interface WorkspaceResponse {
  project: Project;
  activeWorkstream?: Workstream;
  activeSlice?: Slice;
  workstreams: Workstream[];
}

export interface WorkstreamOverviewResponse {
  workstream: Workstream;
  requirements: StoredMarkdownFile;
  plan: StoredMarkdownFile;
  slices: Slice[];
  comments: ReviewComment[];
  reviewSessions: ReviewSession[];
  reviews: Review[];
  evidence: Evidence[];
  prDraft: StoredMarkdownFile;
}

export interface FeedbackResponse {
  markdown: string;
}

export interface ActiveSliceResponse {
  workstream: Workstream;
  slice: Slice;
}

export interface BranchReviewOverviewResponse {
  sessions: BranchReviewSession[];
  comments: ReviewComment[];
  prDraft: StoredMarkdownFile;
}

export interface BranchReviewDiffResponse {
  session: BranchReviewSession;
  diff: StructuredDiff;
}

export interface BranchReviewRefreshResponse extends BranchReviewDiffResponse {
  comments: ReviewComment[];
}

export interface CommentResponse {
  comment: ReviewComment;
}
