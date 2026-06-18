import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Context, Middleware } from "koa";

const serverDistDir = path.dirname(fileURLToPath(import.meta.url));
const uiDistDirCandidates = [
  path.resolve(serverDistDir, "../../../ui/dist"),
  path.resolve(serverDistDir, "../../../../../packages/ui/dist")
];

export function createAssetMiddleware(): Middleware {
  return async (ctx, next) => {
    if (ctx.method !== "GET" || ctx.path.startsWith("/api")) {
      await next();
      return;
    }

    await serveUiAsset(ctx);
  };
}

async function serveUiAsset(ctx: Context): Promise<void> {
  const parts = ctx.path.split("/").filter(Boolean).map(decodeURIComponent);
  const relativePath = parts.length === 0 || parts[0] !== "assets"
    ? "index.html"
    : parts.join("/");

  for (const uiDistDir of uiDistDirCandidates) {
    const filePath = path.resolve(uiDistDir, relativePath);
    if (!isPathInside(uiDistDir, filePath)) {
      ctx.status = 404;
      ctx.body = { error: "Not found." };
      return;
    }

    try {
      const content = await readFile(filePath);
      ctx.status = 200;
      ctx.type = contentTypeFor(filePath);
      ctx.set("cache-control", relativePath === "index.html" ? "no-store" : "public, max-age=31536000, immutable");
      ctx.body = content;
      return;
    } catch {
      continue;
    }
  }

  ctx.status = 404;
  ctx.body = {
    error: "Pathfinder UI assets were not found. Run npm run build before starting the local server."
  };
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath);
  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".js") {
    return "text/javascript; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  return "application/octet-stream";
}
