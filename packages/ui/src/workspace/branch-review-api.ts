import { api } from "../api";
import type {
  BranchReviewDiffResponse,
  BranchReviewOverviewResponse,
  BranchReviewRefreshResponse,
  CommentResponse,
  DraftTarget
} from "../types";

export async function loadBranchReviewOverview(): Promise<BranchReviewOverviewResponse> {
  return api<BranchReviewOverviewResponse>("/api/branch-review");
}

export async function loadBranchReviewDiff(sessionId: string): Promise<BranchReviewDiffResponse> {
  return api<BranchReviewDiffResponse>(
    `/api/branch-review/sessions/${encodeURIComponent(sessionId)}/diff`
  );
}

export async function refreshBranchReviewSession(sessionId: string): Promise<BranchReviewRefreshResponse> {
  return api<BranchReviewRefreshResponse>(
    `/api/branch-review/sessions/${encodeURIComponent(sessionId)}/refresh`,
    { method: "POST" }
  );
}

export async function addBranchReviewComment(target: DraftTarget, body: string): Promise<CommentResponse> {
  return api<CommentResponse>("/api/branch-review/comments", {
    method: "POST",
    body: JSON.stringify({
      body,
      target
    })
  });
}

export async function resolveBranchReviewComment(commentId: string): Promise<CommentResponse> {
  return api<CommentResponse>(
    `/api/branch-review/comments/${encodeURIComponent(commentId)}/resolve`,
    { method: "POST" }
  );
}
