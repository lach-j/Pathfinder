import { api } from "../api";
import type {
  BranchReviewDiffResponse,
  BranchReviewRefreshResponse,
  CommentResponse,
  DraftTarget
} from "../types";

export async function loadWorkstreamReviewDiff(
  workstreamId: string,
  sessionId: string
): Promise<BranchReviewDiffResponse> {
  return api<BranchReviewDiffResponse>(
    `/api/workstreams/${encodeURIComponent(workstreamId)}/review-sessions/${encodeURIComponent(sessionId)}/diff`
  );
}

export async function refreshWorkstreamReviewSession(
  workstreamId: string,
  sessionId: string
): Promise<BranchReviewRefreshResponse> {
  return api<BranchReviewRefreshResponse>(
    `/api/workstreams/${encodeURIComponent(workstreamId)}/review-sessions/${encodeURIComponent(sessionId)}/refresh`,
    { method: "POST" }
  );
}

export async function addWorkstreamReviewComment(
  workstreamId: string,
  target: DraftTarget,
  body: string
): Promise<CommentResponse> {
  return api<CommentResponse>(`/api/workstreams/${encodeURIComponent(workstreamId)}/comments`, {
    method: "POST",
    body: JSON.stringify({
      body,
      target
    })
  });
}

export async function resolveWorkstreamReviewComment(
  workstreamId: string,
  commentId: string
): Promise<CommentResponse> {
  return api<CommentResponse>(
    `/api/workstreams/${encodeURIComponent(workstreamId)}/comments/${encodeURIComponent(commentId)}/resolve`,
    { method: "POST" }
  );
}
