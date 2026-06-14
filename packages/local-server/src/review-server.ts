import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PathfinderError, ReviewCommentTarget, isReviewCommentSide } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

export interface ReviewServerOptions {
  cwd?: string;
  host?: string;
  port?: number;
  silent?: boolean;
}

interface ReviewServerDependencies {
  store: PathfinderStore;
  git: GitAdapter;
}

interface CommentRequestBody {
  body?: unknown;
  sliceId?: unknown;
  sessionId?: unknown;
  filePath?: unknown;
  lineNumber?: unknown;
  side?: unknown;
  target?: unknown;
}

const defaultHost = "127.0.0.1";
const defaultPort = 4783;
const maxBodyBytes = 1024 * 1024;
const serverDistDir = path.dirname(fileURLToPath(import.meta.url));
const uiDistDirCandidates = [
  path.resolve(serverDistDir, "../../ui/dist"),
  path.resolve(serverDistDir, "../../../../packages/ui/dist")
];

export async function serveReviewServer(options: ReviewServerOptions = {}): Promise<Server> {
  const cwd = options.cwd ?? process.cwd();
  const host = options.host ?? defaultHost;
  const port = options.port ?? defaultPort;
  const server = createReviewServer({
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
    console.log(`Pathfinder review server running at http://${host}:${actualPort}`);
  }

  return server;
}

export function createReviewServer(dependencies: ReviewServerDependencies): Server {
  return createServer((request, response) => {
    void handleReviewServerRequest(request, response, dependencies);
  });
}

export async function handleReviewServerRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ReviewServerDependencies
): Promise<void> {
  try {
    await routeRequest(request, response, dependencies);
  } catch (error) {
    writeError(response, error);
  }
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ReviewServerDependencies
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (method === "GET" && parts[0] !== "api") {
    await serveUiAsset(parts, response);
    return;
  }

  if (parts[0] !== "api") {
    writeJson(response, 404, { error: "Not found." });
    return;
  }

  if (method === "GET" && parts.length === 2 && parts[1] === "current") {
    writeJson(response, 200, await dependencies.store.getCurrentContext());
    return;
  }

  if (method === "GET" && parts.length === 2 && parts[1] === "workstreams") {
    writeJson(response, 200, { workstreams: await dependencies.store.listWorkstreams() });
    return;
  }

  if (parts[1] === "workstreams" && parts[2]) {
    await routeWorkstreamRequest(method, parts.slice(2), url, request, response, dependencies);
    return;
  }

  writeJson(response, 404, { error: "Not found." });
}

async function routeWorkstreamRequest(
  method: string,
  parts: string[],
  url: URL,
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ReviewServerDependencies
): Promise<void> {
  const [workstreamId, area, id, action] = parts;

  if (method === "GET" && area === "review-sessions" && !id) {
    writeJson(response, 200, {
      sessions: await dependencies.store.listReviewSessions(workstreamId)
    });
    return;
  }

  if (method === "GET" && area === "review-sessions" && id && action === "diff") {
    const session = await dependencies.store.getReviewSession(workstreamId, id);
    const diff = await dependencies.git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit);
    writeJson(response, 200, { session, diff });
    return;
  }

  if (method === "POST" && area === "review-sessions" && id && action === "refresh") {
    const session = await dependencies.store.getReviewSession(workstreamId, id);
    const repositorySummary = await dependencies.git.getCommittedSummaryAgainstBase(session.baseRef);
    const diff = await dependencies.git.getStructuredDiffBetweenRefs(
      repositorySummary.mergeBase,
      repositorySummary.headCommit
    );
    const refreshed = await dependencies.store.refreshReviewSession(workstreamId, id, repositorySummary, diff);
    writeJson(response, 200, { session: refreshed.session, comments: refreshed.comments, diff });
    return;
  }

  if (method === "GET" && area === "comments" && !id) {
    writeJson(response, 200, {
      comments: await dependencies.store.listComments(workstreamId, {
        sessionId: optionalQueryValue(url, "session"),
        openOnly: url.searchParams.get("open") === "true"
      })
    });
    return;
  }

  if (method === "POST" && area === "comments" && !id) {
    const comment = await addCommentFromRequest(workstreamId, request, dependencies);
    writeJson(response, 201, { comment });
    return;
  }

  if (method === "POST" && area === "comments" && id && action === "resolve") {
    const comment = await dependencies.store.resolveComment(workstreamId, id);
    writeJson(response, 200, { comment });
    return;
  }

  if (method === "GET" && area === "feedback" && !id) {
    writeJson(response, 200, {
      markdown: (await dependencies.store.exportFeedbackQueue(workstreamId, {
        sessionId: optionalQueryValue(url, "session")
      })).markdown
    });
    return;
  }

  writeJson(response, 404, { error: "Not found." });
}

async function addCommentFromRequest(
  workstreamId: string,
  request: IncomingMessage,
  dependencies: ReviewServerDependencies
) {
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

function commentTargetFromBody(body: CommentRequestBody): ReviewCommentTarget {
  if (body.target !== undefined) {
    return validateTarget(body.target);
  }

  if (body.sessionId === undefined && body.filePath === undefined && body.lineNumber === undefined) {
    return { type: "workstream" };
  }

  const sessionId = requireString(body.sessionId, "Session id");
  const filePath = requireString(body.filePath, "File path");

  if (body.lineNumber === undefined) {
    return {
      type: "file",
      sessionId,
      filePath
    };
  }

  const lineNumber = requirePositiveInteger(body.lineNumber, "Line number");
  const side = requireString(body.side, "Comment side");
  if (!isReviewCommentSide(side)) {
    throw new PathfinderError("Invalid comment side. Expected old or new.");
  }

  return {
    type: "line",
    sessionId,
    filePath,
    lineNumber,
    side
  };
}

function validateTarget(value: unknown): ReviewCommentTarget {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    throw new PathfinderError("Comment target must include a target type.");
  }

  const target = value as Record<string, unknown>;
  if (target.type === "workstream") {
    return { type: "workstream" };
  }

  if (target.type === "slice") {
    return {
      type: "slice",
      sliceId: requireString(target.sliceId, "Slice id")
    };
  }

  if (target.type === "file") {
    return {
      type: "file",
      sessionId: requireString(target.sessionId, "Session id"),
      filePath: requireString(target.filePath, "File path")
    };
  }

  if (target.type === "line") {
    const side = requireString(target.side, "Comment side");
    if (!isReviewCommentSide(side)) {
      throw new PathfinderError("Invalid comment side. Expected old or new.");
    }

    return {
      type: "line",
      sessionId: requireString(target.sessionId, "Session id"),
      filePath: requireString(target.filePath, "File path"),
      lineNumber: requirePositiveInteger(target.lineNumber, "Line number"),
      side
    };
  }

  throw new PathfinderError("Invalid comment target type.");
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let length = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.byteLength;
    if (length > maxBodyBytes) {
      throw new PathfinderError("Request body is too large.");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new PathfinderError("Request body must be JSON.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new PathfinderError("Request body must be valid JSON.");
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PathfinderError(`${name} is required.`);
  }

  return value;
}

function requirePositiveInteger(value: unknown, name: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new PathfinderError(`${name} must be a positive integer.`);
  }

  return number;
}

function optionalQueryValue(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value === null || value === "" ? undefined : value;
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

function writeError(response: ServerResponse, error: unknown): void {
  if (error instanceof PathfinderError) {
    writeJson(response, 400, { error: error.message });
    return;
  }

  writeJson(response, 500, { error: "Unexpected server error." });
}

async function serveUiAsset(parts: string[], response: ServerResponse): Promise<void> {
  const relativePath = parts.length === 0 || parts[0] !== "assets"
    ? "index.html"
    : parts.join("/");

  for (const uiDistDir of uiDistDirCandidates) {
    const filePath = path.resolve(uiDistDir, relativePath);
    if (!isPathInside(uiDistDir, filePath)) {
      writeJson(response, 404, { error: "Not found." });
      return;
    }

    try {
      const content = await readFile(filePath);
      response.writeHead(200, {
        "content-type": contentTypeFor(filePath),
        "cache-control": relativePath === "index.html" ? "no-store" : "public, max-age=31536000, immutable"
      });
      response.end(content);
      return;
    } catch {
      continue;
    }
  }

  writeJson(response, 404, {
    error: "Pathfinder UI assets were not found. Run npm run build before starting the local server."
  });
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
