import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

import Koa from "koa";
import { PathfinderError } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

import { createAssetMiddleware } from "./routes/asset-routes.js";
import { createBranchReviewRoutes } from "./routes/branch-review-routes.js";
import { createWorkspaceRoutes } from "./routes/workspace-routes.js";
import { createWorkstreamRoutes } from "./routes/workstream-routes.js";
import type {
  ReviewServerDependencies,
  ReviewServerOptions,
  WorkspaceServerOptions
} from "./server-types.js";

const defaultHost = "127.0.0.1";
const defaultPort = 4783;

export async function serveReviewServer(options: ReviewServerOptions = {}): Promise<Server> {
  return startWorkspaceServer(options, "review");
}

export async function serveWorkspaceServer(options: WorkspaceServerOptions = {}): Promise<Server> {
  return startWorkspaceServer(options, "workspace");
}

async function startWorkspaceServer(options: WorkspaceServerOptions, label: "review" | "workspace"): Promise<Server> {
  const cwd = options.cwd ?? process.cwd();
  const host = options.host ?? defaultHost;
  const port = options.port ?? defaultPort;
  const server = createWorkspaceServer({
    store: new PathfinderStore(cwd),
    git: new GitAdapter({ cwd })
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  if (!options.silent) {
    console.log(`Pathfinder ${label} server running at http://${host}:${actualPort}`);
  }

  return server;
}

export function createReviewServer(dependencies: ReviewServerDependencies): Server {
  return createWorkspaceServer(dependencies);
}

export function createWorkspaceServer(dependencies: ReviewServerDependencies): Server {
  return createServer(createWorkspaceApp(dependencies).callback());
}

export async function handleReviewServerRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ReviewServerDependencies
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    response.once("finish", resolve);
    response.once("error", reject);
    createWorkspaceApp(dependencies).callback()(request, response);
  });
}

function createWorkspaceApp(dependencies: ReviewServerDependencies): Koa {
  const app = new Koa();
  const workspaceRoutes = createWorkspaceRoutes(dependencies);
  const workstreamRoutes = createWorkstreamRoutes(dependencies);
  const branchReviewRoutes = createBranchReviewRoutes(dependencies);

  app.use(errorMiddleware);
  app.use(async (ctx, next) => {
    if (ctx.method === "OPTIONS") {
      ctx.status = 204;
      return;
    }

    await next();
  });
  app.use(async (ctx, next) => {
    await next();
    if (ctx.body !== undefined) {
      ctx.set("cache-control", "no-store");
    }
  });
  app.use(workspaceRoutes.routes());
  app.use(workspaceRoutes.allowedMethods());
  app.use(workstreamRoutes.routes());
  app.use(workstreamRoutes.allowedMethods());
  app.use(branchReviewRoutes.routes());
  app.use(branchReviewRoutes.allowedMethods());
  app.use(createAssetMiddleware());
  app.use((ctx) => {
    ctx.status = 404;
    ctx.body = { error: "Not found." };
  });

  return app;
}

async function errorMiddleware(ctx: Koa.Context, next: Koa.Next): Promise<void> {
  try {
    await next();
  } catch (error) {
    if (error instanceof PathfinderError) {
      ctx.status = 400;
      ctx.body = { error: error.message };
      return;
    }

    ctx.status = 500;
    ctx.body = { error: "Unexpected server error." };
  }
}
