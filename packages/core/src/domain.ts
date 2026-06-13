export type SliceStatus =
  | "proposed"
  | "ready"
  | "in_progress"
  | "review"
  | "complete";

export const sliceStatuses: readonly SliceStatus[] = [
  "proposed",
  "ready",
  "in_progress",
  "review",
  "complete"
];

export type EvidenceKind = "test" | "screenshot" | "log" | "manual" | "benchmark" | "other";

export const evidenceKinds: readonly EvidenceKind[] = [
  "test",
  "screenshot",
  "log",
  "manual",
  "benchmark",
  "other"
];

export type RepositoryFileCategory =
  | "test"
  | "documentation"
  | "source"
  | "configuration"
  | "state"
  | "other";

export const repositoryFileCategories: readonly RepositoryFileCategory[] = [
  "test",
  "documentation",
  "source",
  "configuration",
  "state",
  "other"
];

export type RepositoryChangeStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "other";

export interface RepositorySummaryFile {
  path: string;
  previousPath?: string;
  status: RepositoryChangeStatus;
  category: RepositoryFileCategory;
}

export interface RepositorySummary {
  baseRef: string;
  headRef: string;
  headCommit: string;
  mergeBase: string;
  files: RepositorySummaryFile[];
}

export type StructuredDiffFileStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "other";

export type StructuredDiffLineKind = "context" | "addition" | "deletion" | "metadata";

export interface StructuredDiffLine {
  kind: StructuredDiffLineKind;
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
}

export interface StructuredDiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  section?: string;
  lines: StructuredDiffLine[];
}

export interface StructuredDiffFile {
  path: string;
  previousPath?: string;
  status: StructuredDiffFileStatus;
  oldPath?: string;
  newPath?: string;
  hunks: StructuredDiffHunk[];
}

export interface StructuredDiff {
  files: StructuredDiffFile[];
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

export interface Plan {
  workstreamId: string;
  markdown: string;
}

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

export interface ReviewComment {
  id: string;
  sliceId?: string;
  target?: ReviewCommentTarget;
  body: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export type ReviewCommentSide = "old" | "new";

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
}

export interface Evidence {
  id: string;
  sliceId: string;
  kind: EvidenceKind;
  description: string;
  path?: string;
  createdAt: string;
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

export interface PrMarkdownInput {
  workstream: Workstream;
  requirementsMarkdown?: string;
  planMarkdown: string;
  slices: Slice[];
  comments: ReviewComment[];
  reviews: Review[];
  evidence?: Evidence[];
  repositorySummary?: RepositorySummary;
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

export interface ImportedStagePlanStage {
  stageNumber: number;
  title: string;
  heading: string;
  description: string;
}

export interface ImportedStagePlan {
  workstreamTitle: string;
  markdown: string;
  stages: ImportedStagePlanStage[];
}
