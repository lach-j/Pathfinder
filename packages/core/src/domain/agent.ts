import type { RepositorySummary } from "./repository.js";
import type { BranchReviewSession, ReviewComment, ReviewSession } from "./review.js";
import type { Slice } from "./slice.js";
import type { Workstream } from "./project.js";

export type BranchReviewNextPhase =
  | "uninitialized"
  | "needs_session"
  | "needs_commit"
  | "feedback"
  | "needs_refresh"
  | "awaiting_human_approval"
  | "ready_for_pr"
  | "complete"
  | "blocked";

export interface BranchReviewNextRecommendation {
  phase: BranchReviewNextPhase;
  reason: string;
  reviewSessionId?: string;
  baseRef?: string;
  feedbackQueuePath?: string;
  commands: string[];
  agentInstruction: string;
  humanInstruction: string;
}

export interface BranchReviewNextInput {
  isInitialized: boolean;
  sessions: BranchReviewSession[];
  openComments?: ReviewComment[];
  hasUncommittedChanges?: boolean;
  repositorySummary?: RepositorySummary;
  repositorySummaryError?: string;
  suggestedBaseRef?: string;
  feedbackQueuePath?: string;
  prMarkdown?: string;
  stateError?: string;
}

export type AgentNextPhase =
  | "uninitialized"
  | "needs_workstream"
  | "needs_plan"
  | "needs_slice_selection"
  | "ready_to_implement"
  | "needs_commit"
  | "needs_review_session"
  | "awaiting_human_approval"
  | "needs_human_review"
  | "feedback"
  | "ready_for_pr"
  | "blocked";

export interface AgentNextRecommendation {
  phase: AgentNextPhase;
  compatibilityPhase?: AgentNextPhase;
  reason: string;
  workstreamId?: string;
  sliceId?: string;
  reviewSessionId?: string;
  feedbackQueuePath?: string;
  commands: string[];
  agentInstruction: string;
  humanInstruction: string;
}

export interface AgentNextInput {
  isInitialized: boolean;
  workstreams: Workstream[];
  activeWorkstream?: Workstream;
  slices?: Slice[];
  activeSlice?: Slice;
  nextSlice?: Slice;
  planMarkdown?: string;
  openComments?: ReviewComment[];
  reviewSessions?: ReviewSession[];
  repositorySummary?: RepositorySummary;
  repositorySummaryError?: string;
  hasUncommittedChanges?: boolean;
  suggestedBaseRef?: string;
  feedbackQueuePath?: string;
  stateError?: string;
}

export type AgentPromptPhase = "plan" | "implement" | "feedback" | "review" | "pr";

export interface AgentRepositoryCheckSignals {
  hasPackageJson?: boolean;
  hasPythonProjectMarker?: boolean;
  hasPythonTests?: boolean;
  hasPytestConfig?: boolean;
  hasRuffConfig?: boolean;
}

export interface AgentCheckGuidance {
  commands: string[];
  instruction: string;
}

export interface AgentPromptInput {
  phase?: AgentPromptPhase;
  recommendation: AgentNextRecommendation;
  workstream?: Workstream;
  activeSlice?: Slice;
  requirementsPath?: string;
  planPath?: string;
  feedbackQueuePath?: string;
  checkGuidance?: AgentCheckGuidance;
}
