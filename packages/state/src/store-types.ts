import type {
  AgentNextRecommendation,
  AgentCommandTool,
  AgentUserInstallTool,
  BranchReviewSession,
  DeterministicReviewResult,
  Evidence,
  ImportedStagePlan,
  Project,
  RepositorySummary,
  Review,
  ReviewComment,
  ReviewCommentOrigin,
  ReviewCommentTarget,
  ReviewSession,
  Slice,
  StructuredDiff,
  Workstream
} from "@pathfinder/core";

export interface ActiveSlice {
  workstream: Workstream;
  slice: Slice;
}

export interface CurrentContext {
  project: Project;
  workstream?: Workstream;
  activeSlice?: Slice;
  requirementsPath?: string;
  requirementsMarkdown?: string;
  planPath?: string;
  planMarkdown?: string;
  unresolvedComments: ReviewComment[];
  evidence: Evidence[];
}

export interface GeneratedPrMarkdown {
  markdown: string;
  path: string;
}

export interface StoredMarkdownFile {
  markdown: string;
  path: string;
}

export interface FeedbackQueueExport {
  markdown: string;
  defaultPath?: string;
}

export interface AgentBootstrapResult {
  path: string;
  markdown: string;
  changed: boolean;
  dryRun: boolean;
}

export interface AgentCommandFileResult {
  tool: AgentCommandTool;
  commandName: string;
  path: string;
  relativePath: string;
  installed: boolean;
  managed: boolean;
  changed: boolean;
  skipped: boolean;
  reason?: string;
}

export interface AgentCommandsInstallResult {
  dryRun: boolean;
  files: AgentCommandFileResult[];
}

export interface AgentCommandsListResult {
  tools: {
    tool: AgentCommandTool;
    displayName: string;
    files: AgentCommandFileResult[];
  }[];
}

export interface AgentUserInstallFileResult {
  tool: AgentUserInstallTool;
  path: string;
  relativePath: string;
  installed: boolean;
  managed: boolean;
  changed: boolean;
  skipped: boolean;
  reason?: string;
}

export interface AgentUserInstallResult {
  dryRun: boolean;
  files: AgentUserInstallFileResult[];
  manualInstructions: {
    tool: AgentUserInstallTool;
    displayName: string;
    instructions: string[];
  }[];
}

export type AgentDoctorCheckStatus = "pass" | "missing" | "warning" | "error";

export interface AgentDoctorCheck {
  id: string;
  status: AgentDoctorCheckStatus;
  message: string;
  fixCommand?: string;
}

export interface AgentDoctorResult {
  ok: boolean;
  checks: AgentDoctorCheck[];
  next: {
    phase: AgentNextRecommendation["phase"];
    command: "pathfinder agent next --json";
  };
}

export interface AgentDoctorOptions {
  personal?: boolean;
}

export interface DeterministicReviewRecord {
  review: Review;
  result: DeterministicReviewResult;
}

export interface SliceBranchMetadata {
  branchName: string;
  baseRef: string;
  startedAt: string;
}

export interface ImportedStagePlanState {
  plan: ImportedStagePlan;
  workstream: Workstream;
  slices: Slice[];
}

export type RepositorySummaryProvider = (baseRef: string) => Promise<RepositorySummary>;
export type SuggestedBaseRefProvider = () => Promise<string | undefined>;
export type UncommittedChangesProvider = () => Promise<boolean>;

export interface AddCommentInput {
  body: string;
  origin?: ReviewCommentOrigin;
  target?: ReviewCommentTarget;
  structuredDiff?: StructuredDiff;
}

export interface ListCommentsOptions {
  openOnly?: boolean;
  sessionId?: string;
}

export interface ExportFeedbackOptions {
  sessionId?: string;
}

export interface InitProjectOptions {
  personal?: boolean;
}

export interface RefreshedReviewSession {
  session: ReviewSession;
  comments: ReviewComment[];
}

export interface RefreshedBranchReviewSession {
  session: BranchReviewSession;
  comments: ReviewComment[];
}

export interface ReviewApprovalResult {
  session: ReviewSession;
  slice: Slice;
  evidence: Evidence;
}

export interface BranchReviewApprovalResult {
  session: BranchReviewSession;
}

export interface SlicesFile {
  slices: Slice[];
}

export interface CommentsFile {
  comments: ReviewComment[];
}

export interface ReviewsFile {
  reviews: Review[];
}

export interface ReviewSessionsFile {
  sessions: ReviewSession[];
}

export interface BranchReviewSessionsFile {
  sessions: BranchReviewSession[];
}

export interface EvidenceFile {
  evidence: Evidence[];
}

export interface ValidatedCommentTarget {
  target: ReviewCommentTarget;
  sliceId?: string;
}
