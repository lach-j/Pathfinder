import type { Evidence } from "./evidence.js";
import type { RepositorySummary, RepositorySummaryFile } from "./repository.js";
import type { Slice } from "./slice.js";
import type { Workstream } from "./project.js";

export interface ReviewComment {
  id: string;
  sliceId?: string;
  target?: ReviewCommentTarget;
  anchorStatus?: ReviewCommentAnchorStatus;
  origin?: ReviewCommentOrigin;
  body: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export type ReviewCommentOrigin = "human" | "agent" | "system";

export type ReviewCommentSide = "old" | "new";
export type ReviewCommentAnchorStatus = "current" | "stale" | "unknown";

export type ReviewCommentTarget =
  | ReviewCommentSliceTarget
  | ReviewCommentFileTarget
  | ReviewCommentLineTarget
  | ReviewCommentWorkstreamTarget;

export interface ReviewCommentSliceTarget {
  type: "slice";
  sliceId: string;
}

export interface ReviewCommentFileTarget {
  type: "file";
  sessionId: string;
  filePath: string;
}

export interface ReviewCommentLineTarget {
  type: "line";
  sessionId: string;
  filePath: string;
  lineNumber: number;
  side: ReviewCommentSide;
}

export interface ReviewCommentWorkstreamTarget {
  type: "workstream";
}

export interface Review {
  id: string;
  sliceId: string;
  status: "open" | "complete";
  summary: string;
  comments: ReviewComment[];
  evidence: Evidence[];
  checks?: ReviewCheck[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSession {
  id: string;
  workstreamId: string;
  sliceId: string;
  baseRef: string;
  headRef: string;
  headCommit: string;
  mergeBase: string;
  changedFiles: RepositorySummaryFile[];
  createdAt: string;
  refreshedAt?: string;
}

export interface BranchReviewSession {
  id: string;
  baseRef: string;
  headRef: string;
  headCommit: string;
  mergeBase: string;
  changedFiles: RepositorySummaryFile[];
  createdAt: string;
  refreshedAt?: string;
  approvedAt?: string;
}

export type ReviewCheckSeverity = "info" | "warning";

export interface ReviewCheck {
  severity: ReviewCheckSeverity;
  message: string;
}

export interface DeterministicReviewInput {
  baseRef: string;
  workstream: Workstream;
  activeSlice: Slice;
  planMarkdown: string;
  requirementsMarkdown: string;
  unresolvedComments: ReviewComment[];
  evidence: Evidence[];
  repositorySummary: RepositorySummary;
}

export interface DeterministicReviewResult {
  status: Review["status"];
  summary: string;
  checks: ReviewCheck[];
}
