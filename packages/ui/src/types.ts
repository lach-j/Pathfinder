export interface CurrentContext {
  workstream?: {
    id: string;
    title: string;
  };
  activeSlice?: {
    id: string;
    title: string;
  };
}

export interface ReviewSession {
  id: string;
  baseRef: string;
  headRef: string;
  mergeBase: string;
  headCommit: string;
}

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

export type CommentFilter = "all" | "open" | "resolved";
export type ReviewCommentSide = "old" | "new";

export type ReviewCommentTarget =
  | { type: "workstream" }
  | { type: "slice"; sliceId: string }
  | { type: "file"; sessionId: string; filePath: string }
  | { type: "line"; sessionId: string; filePath: string; lineNumber: number; side: ReviewCommentSide };

export interface ReviewComment {
  id: string;
  body: string;
  resolved?: boolean;
  anchorStatus?: "current" | "stale" | "unknown" | string;
  target?: ReviewCommentTarget;
}

export type DraftTarget =
  | { type: "file"; sessionId: string; filePath: string }
  | { type: "line"; sessionId: string; filePath: string; lineNumber: number; side: ReviewCommentSide };

