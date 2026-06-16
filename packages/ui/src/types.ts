export interface CurrentContext {
  project?: Project;
  workstream?: {
    id: string;
    title: string;
  };
  activeSlice?: {
    id: string;
    title: string;
  };
}

export interface Project {
  schemaVersion: 1;
  name: string;
  createdAt: string;
  activeWorkstreamId?: string;
}

export interface Workstream {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeSliceId?: string;
}

export type SliceStatus = "proposed" | "ready" | "in_progress" | "review" | "complete";

export interface Slice {
  id: string;
  title: string;
  description: string;
  status: SliceStatus;
  dependsOnSliceIds?: string[];
  branchName?: string;
  baseRef?: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  sliceId: string;
  kind: string;
  description: string;
  path?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  sliceId: string;
  status: "open" | "complete" | string;
  summary: string;
}

export interface StoredMarkdownFile {
  markdown: string;
  path: string;
}

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

export interface ReviewSession {
  id: string;
  workstreamId?: string;
  sliceId?: string;
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
  sliceId?: string;
  body: string;
  resolved?: boolean;
  anchorStatus?: "current" | "stale" | "unknown" | string;
  target?: ReviewCommentTarget;
}

export type DraftTarget =
  | { type: "file"; sessionId: string; filePath: string }
  | { type: "line"; sessionId: string; filePath: string; lineNumber: number; side: ReviewCommentSide };
