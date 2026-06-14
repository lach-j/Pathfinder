export const reviewViewerClientScript: string = `const app = document.querySelector("#app");
const state = {
  current: undefined,
  sessions: [],
  session: undefined,
  diff: undefined,
  comments: [],
  selectedPath: undefined,
  commentFilter: "all",
  draftTarget: undefined,
  statusMessage: ""
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
  const commentsPayload = await fetchComments(workstreamId, sessionId);

  state.session = diffPayload.session;
  state.diff = diffPayload.diff;
  state.comments = commentsPayload.comments || [];
  state.selectedPath = firstFilePath(state.diff) || undefined;
  state.draftTarget = undefined;
  renderShell();
  renderDiff();
}

async function fetchComments(workstreamId, sessionId) {
  return api(
    "/api/workstreams/" + encodeURIComponent(workstreamId) +
    "/comments?session=" + encodeURIComponent(sessionId)
  );
}

async function api(path, init) {
  const response = await fetch(path, {
    headers: {
      "accept": "application/json",
      ...(init && init.body ? { "content-type": "application/json" } : {})
    },
    ...(init || {})
  });
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
  const filterOptions = [
    ["all", "All comments"],
    ["open", "Open comments"],
    ["resolved", "Resolved comments"]
  ].map(([value, label]) => {
    const selected = state.commentFilter === value ? " selected" : "";
    return "<option value=\\"" + value + "\\"" + selected + ">" + label + "</option>";
  }).join("");

  app.innerHTML =
    "<section class=\\"topbar\\">" +
      "<div class=\\"identity\\">" +
        "<div class=\\"eyebrow\\">Pathfinder Review</div>" +
        "<h1>" + escapeHtml(title) + "</h1>" +
        "<div class=\\"slice\\">" + escapeHtml(sliceText) + "</div>" +
      "</div>" +
      (state.sessions.length > 0
        ? "<div class=\\"review-controls\\">" +
            "<div class=\\"control session-control\\">" +
              "<label for=\\"session-select\\">Review session</label>" +
              "<select id=\\"session-select\\">" + sessionOptions + "</select>" +
            "</div>" +
            "<div class=\\"control\\">" +
              "<label for=\\"comment-filter\\">Comments</label>" +
              "<select id=\\"comment-filter\\">" + filterOptions + "</select>" +
            "</div>" +
            "<button class=\\"button\\" type=\\"button\\" id=\\"refresh-review\\">Refresh</button>" +
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

  const filter = document.querySelector("#comment-filter");
  if (filter) {
    filter.addEventListener("change", () => {
      state.commentFilter = filter.value;
      state.draftTarget = undefined;
      renderDiff();
    });
  }

  const refresh = document.querySelector("#refresh-review");
  if (refresh) {
    refresh.addEventListener("click", () => {
      refreshReview().catch((error) => {
        state.statusMessage = error.message;
        renderDiff();
      });
    });
  }
}

function renderDiff() {
  const files = state.diff && Array.isArray(state.diff.files) ? state.diff.files : [];
  if (files.length === 0) {
    renderFileList([]);
    renderNoDiff();
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

  if (draftMatchesFile(file)) {
    rows.push(commentFormRow(file));
  }

  for (const comment of fileComments) {
    rows.push(commentRow(comment));
  }

  for (const comment of staleCommentsForSelectedFile(file, files)) {
    rows.push(commentRow(comment));
  }

  for (const hunk of file.hunks || []) {
    rows.push(
      "<tr class=\\"hunk-row\\">" +
        "<td class=\\"line-action\\"></td>" +
        "<td class=\\"line-number\\"></td>" +
        "<td class=\\"line-number\\"></td>" +
        "<td class=\\"code\\">" + escapeHtml(hunk.header) + "</td>" +
      "</tr>"
    );

    for (const line of hunk.lines || []) {
      rows.push(diffLineRow(line));
      if (draftMatchesLine(file, line)) {
        rows.push(commentFormRow(file));
      }
      for (const comment of commentsForLine(file, line)) {
        rows.push(commentRow(comment));
      }
    }
  }

  pane.innerHTML =
    "<div class=\\"file-heading\\">" +
      "<div class=\\"file-heading-main\\">" +
        "<h2>" + escapeHtml(file.path) + "</h2>" +
        "<div class=\\"file-subtitle\\">" + escapeHtml(file.status || "modified") +
          " - +" + stats.additions + " -" + stats.deletions +
          (state.session ? " - " + escapeHtml(state.session.baseRef) + " to " + escapeHtml(state.session.headRef) : "") +
        "</div>" +
        (state.statusMessage ? "<div class=\\"status-text\\">" + escapeHtml(state.statusMessage) + "</div>" : "") +
      "</div>" +
      "<button class=\\"button\\" type=\\"button\\" id=\\"file-comment-button\\">Add file comment</button>" +
    "</div>" +
    "<table class=\\"diff-table\\" aria-label=\\"Unified diff for " + escapeAttribute(file.path) + "\\">" +
      "<tbody>" + (rows.join("") || emptyDiffRows()) + "</tbody>" +
    "</table>";

  bindSelectedFileActions(file);
}

function diffLineRow(line) {
  const oldNumber = line.oldLineNumber || "";
  const newNumber = line.newLineNumber || "";
  const target = lineCommentTarget(line);
  const action = target
    ? "<button class=\\"comment-button\\" type=\\"button\\" title=\\"Add line comment\\" aria-label=\\"Add line comment\\" " +
        "data-comment-side=\\"" + escapeAttribute(target.side) + "\\" data-comment-line=\\"" + escapeAttribute(String(target.lineNumber)) + "\\">+</button>"
    : "";
  return "<tr class=\\"line-" + escapeAttribute(line.kind) + "\\">" +
    "<td class=\\"line-action\\">" + action + "</td>" +
    "<td class=\\"line-number\\">" + escapeHtml(String(oldNumber)) + "</td>" +
    "<td class=\\"line-number\\">" + escapeHtml(String(newNumber)) + "</td>" +
    "<td class=\\"code\\"><span class=\\"prefix\\">" + escapeHtml(linePrefix(line.kind)) + "</span>" + escapeHtml(line.text || "") + "</td>" +
  "</tr>";
}

function commentRow(comment) {
  const target = comment.target || {};
  const targetText = commentTargetText(target);
  const resolvedClass = comment.resolved ? " comment-resolved" : "";
  const anchorStatus = comment.anchorStatus
    ? "<span class=\\"anchor-status anchor-" + escapeAttribute(comment.anchorStatus) + "\\">" +
        escapeHtml(comment.anchorStatus) +
      "</span>"
    : "";
  return "<tr class=\\"comment-row\\">" +
    "<td class=\\"line-action\\"></td>" +
    "<td class=\\"line-number\\"></td>" +
    "<td class=\\"line-number\\"></td>" +
    "<td class=\\"comment-cell\\">" +
      "<div class=\\"comment" + resolvedClass + "\\">" +
        "<div class=\\"comment-header\\">" +
          "<div class=\\"comment-meta\\">" + escapeHtml(comment.id) + " - " + escapeHtml(targetText) + (comment.resolved ? " - resolved" : "") + anchorStatus + "</div>" +
          (!comment.resolved ? "<button class=\\"button button-quiet\\" type=\\"button\\" data-resolve-comment=\\"" + escapeAttribute(comment.id) + "\\">Resolve</button>" : "") +
        "</div>" +
        "<div class=\\"comment-body\\">" + escapeHtml(comment.body) + "</div>" +
      "</div>" +
    "</td>" +
  "</tr>";
}

function commentFormRow(file) {
  const target = state.draftTarget || {};
  const title = target.type === "line"
    ? "Add comment on " + target.side + " line " + target.lineNumber
    : "Add file comment";
  return "<tr class=\\"comment-form-row\\">" +
    "<td class=\\"line-action\\"></td>" +
    "<td class=\\"line-number\\"></td>" +
    "<td class=\\"line-number\\"></td>" +
    "<td class=\\"comment-cell\\">" +
      "<form class=\\"comment-form\\" id=\\"comment-form\\">" +
        "<div class=\\"comment-form-title\\">" + escapeHtml(title) + "</div>" +
        "<textarea id=\\"comment-body\\" name=\\"body\\" required placeholder=\\"Write review feedback...\\"></textarea>" +
        "<div class=\\"comment-form-actions\\">" +
          "<button class=\\"button button-quiet\\" type=\\"button\\" id=\\"cancel-comment\\">Cancel</button>" +
          "<button class=\\"button button-primary\\" type=\\"submit\\">Save comment</button>" +
        "</div>" +
      "</form>" +
    "</td>" +
  "</tr>";
}

function bindSelectedFileActions(file) {
  const fileButton = document.querySelector("#file-comment-button");
  if (fileButton) {
    fileButton.addEventListener("click", () => {
      state.draftTarget = {
        type: "file",
        sessionId: state.session.id,
        filePath: file.path
      };
      state.statusMessage = "";
      renderSelectedFile(file);
    });
  }

  document.querySelectorAll("[data-comment-line]").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftTarget = {
        type: "line",
        sessionId: state.session.id,
        filePath: file.path,
        side: button.getAttribute("data-comment-side"),
        lineNumber: Number(button.getAttribute("data-comment-line"))
      };
      state.statusMessage = "";
      renderSelectedFile(file);
    });
  });

  document.querySelectorAll("[data-resolve-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      resolveComment(button.getAttribute("data-resolve-comment")).catch((error) => {
        state.statusMessage = error.message;
        renderSelectedFile(file);
      });
    });
  });

  const cancel = document.querySelector("#cancel-comment");
  if (cancel) {
    cancel.addEventListener("click", () => {
      state.draftTarget = undefined;
      renderSelectedFile(file);
    });
  }

  const form = document.querySelector("#comment-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const textarea = document.querySelector("#comment-body");
      addComment(textarea ? textarea.value : "").catch((error) => {
        state.statusMessage = error.message;
        renderSelectedFile(file);
      });
    });
    const textarea = document.querySelector("#comment-body");
    if (textarea) {
      textarea.focus();
    }
  }
}

async function addComment(body) {
  if (!state.current.workstream || !state.session || !state.draftTarget) {
    return;
  }

  const target = state.draftTarget;
  const payload = target.type === "line"
    ? {
        body,
        sessionId: target.sessionId,
        filePath: target.filePath,
        lineNumber: target.lineNumber,
        side: target.side
      }
    : {
        body,
        sessionId: target.sessionId,
        filePath: target.filePath
      };
  await api("/api/workstreams/" + encodeURIComponent(state.current.workstream.id) + "/comments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.draftTarget = undefined;
  state.statusMessage = "Comment saved.";
  await refreshComments();
}

async function resolveComment(commentId) {
  if (!state.current.workstream || !state.session || !commentId) {
    return;
  }

  await api(
    "/api/workstreams/" + encodeURIComponent(state.current.workstream.id) +
    "/comments/" + encodeURIComponent(commentId) + "/resolve",
    { method: "POST" }
  );
  state.statusMessage = "Comment resolved.";
  await refreshComments();
}

async function refreshComments() {
  const commentsPayload = await fetchComments(state.current.workstream.id, state.session.id);
  state.comments = commentsPayload.comments || [];
  renderDiff();
}

async function refreshReview() {
  if (!state.current.workstream || !state.session) {
    return;
  }

  const payload = await api(
    "/api/workstreams/" + encodeURIComponent(state.current.workstream.id) +
    "/review-sessions/" + encodeURIComponent(state.session.id) + "/refresh",
    { method: "POST" }
  );
  state.session = payload.session;
  state.sessions = state.sessions.map((session) =>
    session.id === payload.session.id ? payload.session : session
  );
  state.diff = payload.diff;
  state.comments = payload.comments || [];
  state.selectedPath = firstFilePath(state.diff) || state.selectedPath;
  state.draftTarget = undefined;
  state.statusMessage = "Review refreshed.";
  renderShell();
  renderDiff();
}

function commentsForFile(file) {
  return visibleComments().filter((comment) => {
    const target = comment.target;
    if (!target || (target.type !== "file" && target.type !== "line")) {
      return false;
    }

    return target.filePath === file.path || target.filePath === file.oldPath || target.filePath === file.previousPath;
  });
}

function visibleComments() {
  return state.comments.filter((comment) => {
    if (state.commentFilter === "open") {
      return !comment.resolved;
    }

    if (state.commentFilter === "resolved") {
      return Boolean(comment.resolved);
    }

    return true;
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

function staleCommentsForSelectedFile(file, files) {
  return visibleComments().filter((comment) => {
    const target = comment.target;
    if (!target || target.type !== "line" || comment.anchorStatus !== "stale") {
      return false;
    }

    if (target.filePath === file.path || target.filePath === file.oldPath || target.filePath === file.previousPath) {
      return true;
    }

    const targetFileIsInDiff = files.some((candidate) =>
      target.filePath === candidate.path ||
      target.filePath === candidate.oldPath ||
      target.filePath === candidate.previousPath
    );
    return !targetFileIsInDiff && file.path === firstFilePath(state.diff);
  });
}

function commentTargetText(target) {
  if (target.type === "line") {
    return target.filePath + " " + target.side + " line " + target.lineNumber;
  }

  if (target.type === "file") {
    return target.filePath + " file comment";
  }

  return "file comment";
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

function lineCommentTarget(line) {
  if (line.newLineNumber) {
    return { side: "new", lineNumber: line.newLineNumber };
  }

  if (line.oldLineNumber) {
    return { side: "old", lineNumber: line.oldLineNumber };
  }

  return undefined;
}

function draftMatchesFile(file) {
  const target = state.draftTarget;
  return target && target.type === "file" && target.filePath === file.path;
}

function draftMatchesLine(file, line) {
  const target = state.draftTarget;
  if (!target || target.type !== "line" || target.filePath !== file.path) {
    return false;
  }

  if (target.side === "old") {
    return line.oldLineNumber === target.lineNumber;
  }

  return line.newLineNumber === target.lineNumber;
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
  return "<tr><td class=\\"line-action\\"></td><td class=\\"line-number\\"></td><td class=\\"line-number\\"></td><td class=\\"code\\">No hunks for this file.</td></tr>";
}

function renderEmpty(title, message) {
  const pane = document.querySelector("#diff-pane") || app;
  pane.innerHTML = "<div class=\\"empty\\"><strong>" + escapeHtml(title) + "</strong><br>" + escapeHtml(message) + "</div>";
}

function renderNoDiff() {
  const staleComments = visibleComments().filter((comment) => comment.anchorStatus === "stale");
  if (staleComments.length === 0) {
    renderEmpty("No diff", "This review session has no changed files.");
    return;
  }

  const pane = document.querySelector("#diff-pane") || app;
  pane.innerHTML =
    "<div class=\\"file-heading\\">" +
      "<div class=\\"file-heading-main\\">" +
        "<h2>Stale comments</h2>" +
        "<div class=\\"file-subtitle\\">No changed files remain in this refreshed review session.</div>" +
      "</div>" +
    "</div>" +
    "<table class=\\"diff-table\\" aria-label=\\"Stale review comments\\">" +
      "<tbody>" + staleComments.map((comment) => commentRow(comment)).join("") + "</tbody>" +
    "</table>";
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
`;
