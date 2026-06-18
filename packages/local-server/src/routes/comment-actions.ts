import type { ReviewComment } from "@pathfinder/core";

import type { CommentRequestBody, ReviewServerDependencies } from "../server-types.js";
import { commentTargetFromBody, readJsonBody, requireString } from "./request-helpers.js";

export async function addCommentFromRequest(
  workstreamId: string,
  request: Parameters<typeof readJsonBody>[0],
  dependencies: ReviewServerDependencies
): Promise<ReviewComment> {
  const body = await readJsonBody<CommentRequestBody>(request);
  const text = requireString(body.body, "Comment body");

  if (typeof body.sliceId === "string") {
    return dependencies.store.addComment(workstreamId, body.sliceId, text);
  }

  const target = commentTargetFromBody(body);
  const session = target.type === "file" || target.type === "line"
    ? await dependencies.store.getReviewSession(workstreamId, target.sessionId)
    : undefined;
  const structuredDiff = session
    ? await dependencies.git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit)
    : undefined;

  return dependencies.store.addComment(workstreamId, {
    body: text,
    target,
    structuredDiff
  });
}

export async function addBranchReviewCommentFromRequest(
  request: Parameters<typeof readJsonBody>[0],
  dependencies: ReviewServerDependencies
): Promise<ReviewComment> {
  const body = await readJsonBody<CommentRequestBody>(request);
  const text = requireString(body.body, "Comment body");
  const target = commentTargetFromBody(body);
  const session = target.type === "file" || target.type === "line"
    ? await dependencies.store.getBranchReviewSession(target.sessionId)
    : undefined;
  const structuredDiff = session
    ? await dependencies.git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit)
    : undefined;

  return dependencies.store.addBranchReviewComment({
    body: text,
    target,
    structuredDiff
  });
}
