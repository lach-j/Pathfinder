export interface ReviewSession {
  id: string;
  workstreamId?: string;
  sliceId?: string;
  baseRef: string;
  headRef: string;
  mergeBase: string;
  headCommit: string;
  changedFiles?: unknown[];
  createdAt?: string;
  refreshedAt?: string;
  approvedAt?: string;
}

export type BranchReviewSession = ReviewSession;

export interface StructuredDiff {
  files: DiffFile[];
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  previousPath?: string;
  status?: string;
  hunks?: DiffHunk[];
}

export interface DiffHunk {
  header: string;
  lines?: DiffLine[];
}

export interface DiffLine {
  kind: "context" | "addition" | "deletion" | string;
  text?: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export type ReviewCommentSide = "old" | "new";

export type ReviewCommentTarget =
  | { type: "workstream" }
  | { type: "slice"; sliceId: string }
  | { type: "file"; sessionId: string; filePath: string }
  | { type: "line"; sessionId: string; filePath: string; lineNumber: number; side: ReviewCommentSide };

export interface ReviewComment {
  id: string;
  sliceId?: string;
  body: string;
  origin?: "human" | "agent" | "system" | string;
  resolved?: boolean;
  anchorStatus?: "current" | "stale" | "unknown" | string;
  target?: ReviewCommentTarget;
}
