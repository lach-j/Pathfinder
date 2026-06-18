import Router from "@koa/router";

import type { ReviewServerDependencies } from "../server-types.js";
import { addCommentFromRequest } from "./comment-actions.js";
import { optionalQueryValue } from "./request-helpers.js";
import { getWorkstreamOverviewResponse } from "./response-builders.js";

export function createWorkstreamRoutes(dependencies: ReviewServerDependencies): Router {
  const router = new Router({ prefix: "/api/workstreams" });

  router.get("/:workstreamId", async (ctx) => {
    ctx.body = { workstream: await dependencies.store.getWorkstream(ctx.params.workstreamId) };
  });

  router.get("/:workstreamId/overview", async (ctx) => {
    ctx.body = await getWorkstreamOverviewResponse(dependencies.store, ctx.params.workstreamId);
  });

  router.post("/:workstreamId/slices/:sliceId/active", async (ctx) => {
    ctx.body = await dependencies.store.setActiveSlice(ctx.params.workstreamId, ctx.params.sliceId);
  });

  router.get("/:workstreamId/review-sessions", async (ctx) => {
    ctx.body = {
      sessions: await dependencies.store.listReviewSessions(ctx.params.workstreamId)
    };
  });

  router.get("/:workstreamId/review-sessions/:sessionId/diff", async (ctx) => {
    const session = await dependencies.store.getReviewSession(ctx.params.workstreamId, ctx.params.sessionId);
    const diff = await dependencies.git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit);
    ctx.body = { session, diff };
  });

  router.post("/:workstreamId/review-sessions/:sessionId/refresh", async (ctx) => {
    const session = await dependencies.store.getReviewSession(ctx.params.workstreamId, ctx.params.sessionId);
    const repositorySummary = await dependencies.git.getCommittedSummaryAgainstBase(session.baseRef);
    const diff = await dependencies.git.getStructuredDiffBetweenRefs(
      repositorySummary.mergeBase,
      repositorySummary.headCommit
    );
    const refreshed = await dependencies.store.refreshReviewSession(
      ctx.params.workstreamId,
      ctx.params.sessionId,
      repositorySummary,
      diff
    );
    ctx.body = { session: refreshed.session, comments: refreshed.comments, diff };
  });

  router.get("/:workstreamId/comments", async (ctx) => {
    ctx.body = {
      comments: await dependencies.store.listComments(ctx.params.workstreamId, {
        sessionId: optionalQueryValue(ctx.query.session),
        openOnly: ctx.query.open === "true"
      })
    };
  });

  router.post("/:workstreamId/comments", async (ctx) => {
    const comment = await addCommentFromRequest(ctx.params.workstreamId, ctx.req, dependencies);
    ctx.status = 201;
    ctx.body = { comment };
  });

  router.post("/:workstreamId/comments/:commentId/resolve", async (ctx) => {
    const comment = await dependencies.store.resolveComment(ctx.params.workstreamId, ctx.params.commentId);
    ctx.body = { comment };
  });

  router.get("/:workstreamId/feedback", async (ctx) => {
    ctx.body = {
      markdown: (await dependencies.store.exportFeedbackQueue(ctx.params.workstreamId, {
        sessionId: optionalQueryValue(ctx.query.session)
      })).markdown
    };
  });

  return router;
}
