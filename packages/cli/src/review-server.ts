import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

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

  if (method === "GET" && parts.length === 0) {
    writeHtml(response, diffViewerHtml());
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

function writeHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function writeError(response: ServerResponse, error: unknown): void {
  if (error instanceof PathfinderError) {
    writeJson(response, 400, { error: error.message });
    return;
  }

  writeJson(response, 500, { error: "Unexpected server error." });
}

function diffViewerHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pathfinder Review</title>
    <style>
      :root {
        color-scheme: light;
        --background: #f7f8fb;
        --panel: #ffffff;
        --panel-soft: #f2f5f8;
        --border: #d7dde5;
        --border-strong: #aeb8c5;
        --text: #17202a;
        --muted: #5c6b7a;
        --added: #e8f7ee;
        --added-line: #24854b;
        --deleted: #fdeaea;
        --deleted-line: #b13a3a;
        --metadata: #eef1f5;
        --selected: #e7f0ff;
        --comment: #fff7d8;
        --comment-border: #d8b23f;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--background);
        color: var(--text);
      }

      button,
      select {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      .app {
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
      }

      .topbar {
        background: var(--panel);
        border-bottom: 1px solid var(--border);
        padding: 16px 20px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
      }

      .identity {
        min-width: 0;
      }

      .eyebrow {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.4;
        text-transform: uppercase;
      }

      h1 {
        margin: 2px 0 0;
        font-size: 20px;
        line-height: 1.25;
        font-weight: 650;
      }

      .slice {
        margin-top: 4px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.35;
      }

      .session-control {
        display: grid;
        gap: 6px;
        min-width: 260px;
      }

      .session-control label {
        color: var(--muted);
        font-size: 12px;
      }

      select {
        width: 100%;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: #fff;
        color: var(--text);
        padding: 8px 10px;
      }

      .layout {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(250px, 320px) minmax(0, 1fr);
      }

      .sidebar {
        border-right: 1px solid var(--border);
        background: var(--panel);
        min-width: 0;
        overflow: auto;
      }

      .sidebar-header {
        padding: 14px 16px 10px;
        border-bottom: 1px solid var(--border);
      }

      .sidebar-title {
        font-size: 13px;
        font-weight: 650;
      }

      .sidebar-meta {
        margin-top: 3px;
        color: var(--muted);
        font-size: 12px;
      }

      .file-list {
        display: grid;
      }

      .file-button {
        appearance: none;
        border: 0;
        border-bottom: 1px solid var(--border);
        background: transparent;
        color: var(--text);
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
        padding: 11px 16px;
        text-align: left;
      }

      .file-button:hover,
      .file-button[aria-current="true"] {
        background: var(--selected);
      }

      .status {
        border-radius: 4px;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        min-width: 22px;
        padding: 2px 5px;
        text-align: center;
        text-transform: uppercase;
      }

      .status-added {
        background: #1f7a45;
      }

      .status-deleted {
        background: #b13a3a;
      }

      .status-renamed,
      .status-copied {
        background: #8a5a12;
      }

      .status-modified,
      .status-other {
        background: #526170;
      }

      .file-name {
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 13px;
        line-height: 1.35;
      }

      .stats {
        white-space: nowrap;
        color: var(--muted);
        font-size: 12px;
      }

      .diff-pane {
        min-width: 0;
        overflow: auto;
        padding: 18px;
      }

      .file-heading {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px 8px 0 0;
        padding: 12px 14px;
        display: grid;
        gap: 3px;
      }

      .file-heading h2 {
        margin: 0;
        font-size: 15px;
        overflow-wrap: anywhere;
      }

      .file-heading .file-subtitle {
        color: var(--muted);
        font-size: 12px;
      }

      .diff-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: var(--panel);
        border: 1px solid var(--border);
        border-top: 0;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 13px;
        line-height: 1.45;
      }

      .diff-table td {
        vertical-align: top;
        border-top: 1px solid #edf0f3;
      }

      .line-number {
        width: 58px;
        padding: 2px 8px;
        color: var(--muted);
        background: var(--panel-soft);
        text-align: right;
        user-select: none;
      }

      .code {
        padding: 2px 10px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .prefix {
        display: inline-block;
        width: 18px;
        color: var(--muted);
        user-select: none;
      }

      .line-addition .code,
      .line-addition .line-number {
        background: var(--added);
      }

      .line-addition .prefix {
        color: var(--added-line);
      }

      .line-deletion .code,
      .line-deletion .line-number {
        background: var(--deleted);
      }

      .line-deletion .prefix {
        color: var(--deleted-line);
      }

      .line-metadata .code,
      .hunk-row .code {
        background: var(--metadata);
        color: var(--muted);
      }

      .comment-row td {
        background: var(--comment);
        border-top: 1px solid var(--comment-border);
      }

      .comment-cell {
        padding: 9px 12px;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      .comment {
        border-left: 3px solid var(--comment-border);
        padding-left: 10px;
        display: grid;
        gap: 3px;
      }

      .comment-meta {
        color: #72590b;
        font-size: 12px;
        font-weight: 650;
      }

      .comment-body {
        color: #382d05;
        font-size: 13px;
        line-height: 1.35;
        white-space: pre-wrap;
      }

      .comment-resolved {
        opacity: 0.68;
      }

      .empty,
      .error {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 22px;
        color: var(--muted);
        line-height: 1.45;
      }

      .error {
        border-color: #d99a9a;
        color: #8f2e2e;
      }

      @media (max-width: 760px) {
        .topbar {
          grid-template-columns: 1fr;
        }

        .session-control {
          min-width: 0;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        .sidebar {
          border-right: 0;
          border-bottom: 1px solid var(--border);
          max-height: 34vh;
        }

        .diff-pane {
          padding: 12px;
        }

        .line-number {
          width: 44px;
          padding-inline: 5px;
        }

        .code {
          padding-inline: 7px;
        }
      }
    </style>
  </head>
  <body>
    <main id="app" class="app">
      <section class="topbar">
        <div class="identity">
          <div class="eyebrow">Pathfinder Review</div>
          <h1>Loading local review...</h1>
          <div class="slice">Reading Pathfinder state from this repository.</div>
        </div>
      </section>
    </main>
    <script>
      const app = document.querySelector("#app");
      const state = {
        current: undefined,
        sessions: [],
        session: undefined,
        diff: undefined,
        comments: [],
        selectedPath: undefined
      };

      init().catch((error) => {
        renderError(error instanceof Error ? error.message : "Unexpected review viewer error.");
      });

      async function init() {
        state.current = await api("/api/current");
        renderShell();

        if (!state.current.workstream) {
          renderEmpty("No active workstream", "Create or select a workstream before opening the review viewer.");
          return;
        }

        if (!state.current.activeSlice) {
          renderEmpty("No active slice", "Set an active slice before starting a review session.");
          return;
        }

        const sessionsPayload = await api("/api/workstreams/" + encodeURIComponent(state.current.workstream.id) + "/review-sessions");
        state.sessions = sessionsPayload.sessions || [];

        if (state.sessions.length === 0) {
          renderShell();
          renderEmpty("No review sessions", "Start a review session with pathfinder review start --base <base-ref>.");
          return;
        }

        await selectSession(state.sessions[state.sessions.length - 1].id);
      }

      async function selectSession(sessionId) {
        const workstreamId = state.current.workstream.id;
        const diffPayload = await api(
          "/api/workstreams/" + encodeURIComponent(workstreamId) +
          "/review-sessions/" + encodeURIComponent(sessionId) + "/diff"
        );
        const commentsPayload = await api(
          "/api/workstreams/" + encodeURIComponent(workstreamId) +
          "/comments?session=" + encodeURIComponent(sessionId)
        );

        state.session = diffPayload.session;
        state.diff = diffPayload.diff;
        state.comments = commentsPayload.comments || [];
        state.selectedPath = firstFilePath(state.diff) || undefined;
        renderShell();
        renderDiff();
      }

      async function api(path) {
        const response = await fetch(path, { headers: { "accept": "application/json" } });
        const text = await response.text();
        let body;
        try {
          body = text ? JSON.parse(text) : {};
        } catch {
          throw new Error("Server returned invalid JSON for " + path + ".");
        }

        if (!response.ok) {
          throw new Error(body.error || "Request failed for " + path + ".");
        }

        return body;
      }

      function renderShell() {
        const workstream = state.current && state.current.workstream;
        const slice = state.current && state.current.activeSlice;
        const title = workstream ? workstream.title : "No active workstream";
        const sliceText = slice ? slice.title + " (" + slice.id + ")" : "No active slice";
        const sessionOptions = state.sessions.map((session) => {
          const selected = state.session && state.session.id === session.id ? " selected" : "";
          return "<option value=\\"" + escapeAttribute(session.id) + "\\"" + selected + ">" +
            escapeHtml(session.id) + " - " + escapeHtml(session.baseRef) + " to " + escapeHtml(session.headRef) +
            "</option>";
        }).join("");

        app.innerHTML =
          "<section class=\\"topbar\\">" +
            "<div class=\\"identity\\">" +
              "<div class=\\"eyebrow\\">Pathfinder Review</div>" +
              "<h1>" + escapeHtml(title) + "</h1>" +
              "<div class=\\"slice\\">" + escapeHtml(sliceText) + "</div>" +
            "</div>" +
            (state.sessions.length > 0
              ? "<div class=\\"session-control\\">" +
                  "<label for=\\"session-select\\">Review session</label>" +
                  "<select id=\\"session-select\\">" + sessionOptions + "</select>" +
                "</div>"
              : "") +
          "</section>" +
          "<section class=\\"layout\\">" +
            "<aside class=\\"sidebar\\"><div id=\\"file-list\\"></div></aside>" +
            "<section id=\\"diff-pane\\" class=\\"diff-pane\\"></section>" +
          "</section>";

        const select = document.querySelector("#session-select");
        if (select) {
          select.addEventListener("change", () => {
            selectSession(select.value).catch((error) => renderError(error.message));
          });
        }
      }

      function renderDiff() {
        const files = state.diff && Array.isArray(state.diff.files) ? state.diff.files : [];
        if (files.length === 0) {
          renderFileList([]);
          renderEmpty("No diff", "This review session has no changed files.");
          return;
        }

        renderFileList(files);
        const selectedFile = files.find((file) => file.path === state.selectedPath) || files[0];
        state.selectedPath = selectedFile.path;
        renderSelectedFile(selectedFile);
      }

      function renderFileList(files) {
        const fileList = document.querySelector("#file-list");
        if (!fileList) {
          return;
        }

        const changed = files.length === 1 ? "1 changed file" : files.length + " changed files";
        fileList.innerHTML =
          "<div class=\\"sidebar-header\\">" +
            "<div class=\\"sidebar-title\\">Changed files</div>" +
            "<div class=\\"sidebar-meta\\">" + escapeHtml(changed) + "</div>" +
          "</div>" +
          "<div class=\\"file-list\\">" +
          files.map((file) => {
            const stats = fileStats(file);
            const current = file.path === state.selectedPath ? " aria-current=\\"true\\"" : "";
            return "<button class=\\"file-button\\" type=\\"button\\" data-path=\\"" + escapeAttribute(file.path) + "\\"" + current + ">" +
              "<span class=\\"status status-" + escapeAttribute(file.status || "other") + "\\">" + escapeHtml(statusLabel(file.status)) + "</span>" +
              "<span class=\\"file-name\\">" + escapeHtml(file.path) + "</span>" +
              "<span class=\\"stats\\">+" + stats.additions + " -" + stats.deletions + "</span>" +
            "</button>";
          }).join("") +
          "</div>";

        fileList.querySelectorAll(".file-button").forEach((button) => {
          button.addEventListener("click", () => {
            state.selectedPath = button.getAttribute("data-path") || state.selectedPath;
            renderDiff();
          });
        });
      }

      function renderSelectedFile(file) {
        const pane = document.querySelector("#diff-pane");
        if (!pane) {
          return;
        }

        const fileComments = commentsForFile(file).filter((comment) => comment.target.type === "file");
        const stats = fileStats(file);
        const rows = [];

        for (const comment of fileComments) {
          rows.push(commentRow(comment));
        }

        for (const hunk of file.hunks || []) {
          rows.push(
            "<tr class=\\"hunk-row\\">" +
              "<td class=\\"line-number\\"></td>" +
              "<td class=\\"line-number\\"></td>" +
              "<td class=\\"code\\">" + escapeHtml(hunk.header) + "</td>" +
            "</tr>"
          );

          for (const line of hunk.lines || []) {
            rows.push(diffLineRow(line));
            for (const comment of commentsForLine(file, line)) {
              rows.push(commentRow(comment));
            }
          }
        }

        pane.innerHTML =
          "<div class=\\"file-heading\\">" +
            "<h2>" + escapeHtml(file.path) + "</h2>" +
            "<div class=\\"file-subtitle\\">" + escapeHtml(file.status || "modified") +
              " - +" + stats.additions + " -" + stats.deletions +
              (state.session ? " - " + escapeHtml(state.session.baseRef) + " to " + escapeHtml(state.session.headRef) : "") +
            "</div>" +
          "</div>" +
          "<table class=\\"diff-table\\" aria-label=\\"Unified diff for " + escapeAttribute(file.path) + "\\">" +
            "<tbody>" + (rows.join("") || emptyDiffRows()) + "</tbody>" +
          "</table>";
      }

      function diffLineRow(line) {
        const oldNumber = line.oldLineNumber || "";
        const newNumber = line.newLineNumber || "";
        return "<tr class=\\"line-" + escapeAttribute(line.kind) + "\\">" +
          "<td class=\\"line-number\\">" + escapeHtml(String(oldNumber)) + "</td>" +
          "<td class=\\"line-number\\">" + escapeHtml(String(newNumber)) + "</td>" +
          "<td class=\\"code\\"><span class=\\"prefix\\">" + escapeHtml(linePrefix(line.kind)) + "</span>" + escapeHtml(line.text || "") + "</td>" +
        "</tr>";
      }

      function commentRow(comment) {
        const target = comment.target || {};
        const targetText = target.type === "line"
          ? target.side + " line " + target.lineNumber
          : "file comment";
        const resolvedClass = comment.resolved ? " comment-resolved" : "";
        return "<tr class=\\"comment-row\\">" +
          "<td class=\\"line-number\\"></td>" +
          "<td class=\\"line-number\\"></td>" +
          "<td class=\\"comment-cell\\">" +
            "<div class=\\"comment" + resolvedClass + "\\">" +
              "<div class=\\"comment-meta\\">" + escapeHtml(comment.id) + " - " + escapeHtml(targetText) + (comment.resolved ? " - resolved" : "") + "</div>" +
              "<div class=\\"comment-body\\">" + escapeHtml(comment.body) + "</div>" +
            "</div>" +
          "</td>" +
        "</tr>";
      }

      function commentsForFile(file) {
        return state.comments.filter((comment) => {
          const target = comment.target;
          if (!target || (target.type !== "file" && target.type !== "line")) {
            return false;
          }

          return target.filePath === file.path || target.filePath === file.oldPath || target.filePath === file.previousPath;
        });
      }

      function commentsForLine(file, line) {
        return commentsForFile(file).filter((comment) => {
          const target = comment.target;
          if (!target || target.type !== "line") {
            return false;
          }

          if (target.side === "old") {
            return line.oldLineNumber === target.lineNumber;
          }

          return line.newLineNumber === target.lineNumber;
        });
      }

      function fileStats(file) {
        const stats = { additions: 0, deletions: 0 };
        for (const hunk of file.hunks || []) {
          for (const line of hunk.lines || []) {
            if (line.kind === "addition") {
              stats.additions += 1;
            } else if (line.kind === "deletion") {
              stats.deletions += 1;
            }
          }
        }

        return stats;
      }

      function firstFilePath(diff) {
        return diff && diff.files && diff.files[0] ? diff.files[0].path : undefined;
      }

      function statusLabel(status) {
        const labels = {
          added: "A",
          modified: "M",
          deleted: "D",
          renamed: "R",
          copied: "C",
          other: "?"
        };
        return labels[status] || "?";
      }

      function linePrefix(kind) {
        if (kind === "addition") {
          return "+";
        }
        if (kind === "deletion") {
          return "-";
        }
        return " ";
      }

      function emptyDiffRows() {
        return "<tr><td class=\\"line-number\\"></td><td class=\\"line-number\\"></td><td class=\\"code\\">No hunks for this file.</td></tr>";
      }

      function renderEmpty(title, message) {
        const pane = document.querySelector("#diff-pane") || app;
        pane.innerHTML = "<div class=\\"empty\\"><strong>" + escapeHtml(title) + "</strong><br>" + escapeHtml(message) + "</div>";
      }

      function renderError(message) {
        app.innerHTML = "<section class=\\"diff-pane\\"><div class=\\"error\\"><strong>Could not load review data</strong><br>" + escapeHtml(message) + "</div></section>";
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function escapeAttribute(value) {
        return escapeHtml(value);
      }
    </script>
  </body>
</html>
`;
}
