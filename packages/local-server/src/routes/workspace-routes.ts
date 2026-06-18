import Router from "@koa/router";

import type { ReviewServerDependencies } from "../server-types.js";
import { getWorkspaceResponse } from "./response-builders.js";

export function createWorkspaceRoutes(dependencies: ReviewServerDependencies): Router {
  const router = new Router({ prefix: "/api" });

  router.get("/current", async (ctx) => {
    ctx.body = await dependencies.store.getCurrentContext();
  });

  router.get("/workspace", async (ctx) => {
    ctx.body = await getWorkspaceResponse(dependencies.store);
  });

  router.get("/workstreams", async (ctx) => {
    ctx.body = { workstreams: await dependencies.store.listWorkstreams() };
  });

  return router;
}
