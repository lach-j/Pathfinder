import Router from "@koa/router";

import type { ReviewServerDependencies } from "../server-types.js";
import { addBranchReviewCommentFromRequest } from "./comment-actions.js";
import { optionalQueryValue } from "./request-helpers.js";
import { getBranchReviewOverviewResponse } from "./response-builders.js";

export function createBranchReviewRoutes(dependencies: ReviewServerDependencies): Router {
  const router = new Router({ prefix: "/api/branch-review" });

  router.get("/", async (ctx) => {
    ctx.body = await getBranchReviewOverviewResponse(dependencies.store);
  });

  router.get("/sessions", async (ctx) => {
    ctx.body = {
      sessions: await dependencies.store.listBranchReviewSessions()
    };
  });

  router.get("/sessions/:sessionId/diff", async (ctx) => {
    const session = await dependencies.store.getBranchReviewSession(ctx.params.sessionId);
    const diff = await dependencies.git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit);
    ctx.body = { session, diff };
  });

  router.post("/sessions/:sessionId/refresh", async (ctx) => {
    const session = await dependencies.store.getBranchReviewSession(ctx.params.sessionId);
    const repositorySummary = await dependencies.git.getCommittedSummaryAgainstBase(session.baseRef);
    const diff = await dependencies.git.getStructuredDiffBetweenRefs(
      repositorySummary.mergeBase,
      repositorySummary.headCommit
    );
    const refreshed = await dependencies.store.refreshBranchReviewSession(ctx.params.sessionId, repositorySummary, diff);
    ctx.body = { session: refreshed.session, comments: refreshed.comments, diff };
  });

  router.get("/comments", async (ctx) => {
    ctx.body = {
      comments: await dependencies.store.listBranchReviewComments({
        sessionId: optionalQueryValue(ctx.query.session),
        openOnly: ctx.query.open === "true"
      })
    };
  });

  router.post("/comments", async (ctx) => {
    const comment = await addBranchReviewCommentFromRequest(ctx.req, dependencies);
    ctx.status = 201;
    ctx.body = { comment };
  });

  router.post("/comments/:commentId/resolve", async (ctx) => {
    const comment = await dependencies.store.resolveBranchReviewComment(ctx.params.commentId);
    ctx.body = { comment };
  });

  return router;
}
