import type {
  BranchReviewSession,
  Evidence,
  Project,
  Review,
  ReviewComment,
  ReviewCommentTarget,
  ReviewSession,
  Slice,
  Workstream
} from "@pathfinder/core";
import type { GitAdapter } from "@pathfinder/git";
import type { PathfinderStore } from "@pathfinder/state";

export interface ReviewServerOptions {
  cwd?: string;
  host?: string;
  port?: number;
  silent?: boolean;
}

export type WorkspaceServerOptions = ReviewServerOptions;

export interface ReviewServerDependencies {
  store: PathfinderStore;
  git: GitAdapter;
}

export interface WorkspaceResponse {
  project: Project;
  activeWorkstream?: Workstream;
  activeSlice?: Slice;
  workstreams: Workstream[];
}

export interface WorkstreamOverviewResponse {
  workstream: Workstream;
  requirements: {
    markdown: string;
    path: string;
  };
  plan: {
    markdown: string;
    path: string;
  };
  slices: Slice[];
  comments: ReviewComment[];
  reviewSessions: ReviewSession[];
  reviews: Review[];
  evidence: Evidence[];
  prDraft: {
    markdown: string;
    path: string;
  };
}

export interface BranchReviewOverviewResponse {
  sessions: BranchReviewSession[];
  comments: ReviewComment[];
  prDraft: {
    markdown: string;
    path: string;
  };
}

export interface CommentRequestBody {
  body?: unknown;
  sliceId?: unknown;
  sessionId?: unknown;
  filePath?: unknown;
  lineNumber?: unknown;
  side?: unknown;
  target?: unknown;
}

export interface ValidatedCommentRequest {
  target: ReviewCommentTarget;
  body: string;
}
