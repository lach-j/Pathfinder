import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { DiffPane } from "../review/DiffPane";
import { FileList } from "../review/FileList";
import { firstFilePath, reviewCommentSummary } from "../review/review-model";
import type {
  BranchReviewOverviewResponse,
  BranchReviewSession,
  CommentFilter,
  DiffFile,
  DiffLine,
  DraftTarget,
  ReviewComment,
  StructuredDiff
} from "../types";
import {
  addBranchReviewComment,
  loadBranchReviewDiff,
  loadBranchReviewOverview,
  refreshBranchReviewSession,
  resolveBranchReviewComment
} from "./branch-review-api";

export function BranchReviewWorkspace(): ReactElement {
  const [overview, setOverview] = useState<BranchReviewOverviewResponse>();
  const [session, setSession] = useState<BranchReviewSession>();
  const [diff, setDiff] = useState<StructuredDiff>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("open");
  const [draftTarget, setDraftTarget] = useState<DraftTarget>();
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const nextOverview = await loadBranchReviewOverview();
      const latestSession = latestSessionByCreation(nextOverview.sessions);
      setOverview(nextOverview);
      setSelectedSessionId((existing) =>
        existing && nextOverview.sessions.some((candidate) => candidate.id === existing)
          ? existing
          : latestSession?.id
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load branch review state.");
      setOverview(undefined);
      setSelectedSessionId(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiff = useCallback(async (sessionId: string) => {
    setDiffLoading(true);
    setError(undefined);
    try {
      const response = await loadBranchReviewDiff(sessionId);
      setSession(response.session);
      setDiff(response.diff);
      setSelectedPath(firstFilePath(response.diff));
      setDraftTarget(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load branch review diff.");
      setSession(undefined);
      setDiff(undefined);
      setSelectedPath(undefined);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedSessionId) {
      void loadDiff(selectedSessionId);
    } else {
      setSession(undefined);
      setDiff(undefined);
      setSelectedPath(undefined);
    }
  }, [loadDiff, selectedSessionId]);

  const comments = useMemo(
    () => overview?.comments.filter((comment) => {
      const target = comment.target;
      return !selectedSessionId ||
        ((target?.type === "file" || target?.type === "line") && target.sessionId === selectedSessionId);
    }) ?? [],
    [overview, selectedSessionId]
  );

  async function refreshSelectedSession(): Promise<void> {
    if (!selectedSessionId) {
      return;
    }

    setStatusMessage("Refreshing branch review session...");
    try {
      const response = await refreshBranchReviewSession(selectedSessionId);
      setSession(response.session);
      setDiff(response.diff);
      setSelectedPath((existing) =>
        existing && response.diff.files.some((file) => file.path === existing) ? existing : firstFilePath(response.diff)
      );
      const nextOverview = await loadBranchReviewOverview();
      setOverview(nextOverview);
      setStatusMessage("Branch review refreshed.");
    } catch (refreshError) {
      setStatusMessage(refreshError instanceof Error ? refreshError.message : "Could not refresh branch review.");
    }
  }

  async function saveComment(body: string): Promise<void> {
    if (!draftTarget) {
      return;
    }

    try {
      const response = await addBranchReviewComment(draftTarget, body);
      setOverview((existing) => existing
        ? { ...existing, comments: [...existing.comments, response.comment] }
        : existing);
      setDraftTarget(undefined);
      setStatusMessage("Comment saved.");
    } catch (saveError) {
      setStatusMessage(saveError instanceof Error ? saveError.message : "Could not save comment.");
    }
  }

  async function resolveComment(commentId: string): Promise<void> {
    try {
      const response = await resolveBranchReviewComment(commentId);
      setOverview((existing) => existing
        ? {
            ...existing,
            comments: existing.comments.map((comment) =>
              comment.id === response.comment.id ? response.comment : comment
            )
          }
        : existing);
      setStatusMessage("Comment resolved.");
    } catch (resolveError) {
      setStatusMessage(resolveError instanceof Error ? resolveError.message : "Could not resolve comment.");
    }
  }

  const emptyState = getDiffEmptyState(loading, diffLoading, error, overview, selectedSessionId);

  return (
    <div className="branch-review-workspace">
      <aside className="branch-review-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Branch review</div>
          <div className="sidebar-meta">
            {overview ? `${overview.sessions.length} session${overview.sessions.length === 1 ? "" : "s"}` : "Loading"}
          </div>
        </div>
        <SessionList
          sessions={overview?.sessions ?? []}
          selectedSessionId={selectedSessionId}
          comments={overview?.comments ?? []}
          onSelectSession={(sessionId) => {
            setSelectedSessionId(sessionId);
            setStatusMessage("");
          }}
        />
        {diff?.files.length ? (
          <FileList
            comments={comments}
            files={diff.files}
            selectedPath={selectedPath}
            onSelectFile={setSelectedPath}
          />
        ) : null}
      </aside>

      <section className="branch-review-main">
        <BranchReviewToolbar
          comments={comments}
          session={session}
          commentFilter={commentFilter}
          onChangeCommentFilter={setCommentFilter}
          onRefresh={() => {
            void refreshSelectedSession();
          }}
        />
        <DiffPane
          diff={diff}
          session={session}
          comments={comments}
          selectedPath={selectedPath}
          commentFilter={commentFilter}
          draftTarget={draftTarget}
          statusMessage={statusMessage}
          emptyState={emptyState}
          onBeginFileComment={(file) => {
            if (!selectedSessionId) {
              return;
            }
            setDraftTarget({ type: "file", sessionId: selectedSessionId, filePath: file.path });
          }}
          onBeginLineComment={(file, line) => {
            const target = lineCommentTarget(selectedSessionId, file, line);
            if (target) {
              setDraftTarget(target);
            }
          }}
          onCancelComment={() => setDraftTarget(undefined)}
          onSaveComment={(body) => {
            void saveComment(body);
          }}
          onResolveComment={(commentId) => {
            void resolveComment(commentId);
          }}
        />
      </section>
    </div>
  );
}

function BranchReviewToolbar({
  comments,
  session,
  commentFilter,
  onChangeCommentFilter,
  onRefresh
}: {
  comments: ReviewComment[];
  session?: BranchReviewSession;
  commentFilter: CommentFilter;
  onChangeCommentFilter: (filter: CommentFilter) => void;
  onRefresh: () => void;
}): ReactElement {
  const summary = reviewCommentSummary(comments);

  return (
    <div className="branch-review-toolbar">
      <div className="identity">
        <div className="eyebrow">Pathfinder Branch Review</div>
        <h1>{session ? session.headRef : "Standalone branch review"}</h1>
        <div className="slice">{session ? `${session.baseRef} to ${session.headCommit}` : "No session selected"}</div>
        <div className="review-status-strip" aria-label="Review comment status">
          <span>{summary.open} open</span>
          <span>{summary.resolved} resolved</span>
          {summary.stale > 0 && <span className="is-stale">{summary.stale} stale</span>}
        </div>
      </div>
      <div className="review-controls">
        <div className="control">
          <label htmlFor="branch-comment-filter">Comments</label>
          <select
            id="branch-comment-filter"
            value={commentFilter}
            onChange={(event) => onChangeCommentFilter(event.currentTarget.value as CommentFilter)}
          >
            <option value="all">All comments</option>
            <option value="open">Open comments</option>
            <option value="resolved">Resolved comments</option>
          </select>
        </div>
        <button className="button" type="button" disabled={!session} onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function SessionList({
  sessions,
  selectedSessionId,
  comments,
  onSelectSession
}: {
  sessions: BranchReviewSession[];
  selectedSessionId?: string;
  comments: ReviewComment[];
  onSelectSession: (sessionId: string) => void;
}): ReactElement {
  if (sessions.length === 0) {
    return (
      <div className="branch-review-empty">
        <strong>No branch review sessions</strong>
        <p>Start one from a clean committed branch:</p>
        <code>pathfinder branch-review start --base &lt;base-ref&gt;</code>
      </div>
    );
  }

  return (
    <div className="session-list">
      {sessions.map((session) => {
        const openCount = comments.filter((comment) => {
          const target = comment.target;
          return !comment.resolved &&
            (target?.type === "file" || target?.type === "line") &&
            target.sessionId === session.id;
        }).length;

        return (
          <button
            key={session.id}
            type="button"
            className="session-button"
            aria-current={session.id === selectedSessionId}
            onClick={() => onSelectSession(session.id)}
          >
            <span className="session-title">{session.id}</span>
            <span className="session-meta">{session.baseRef} to {session.headRef}</span>
            <span className="session-meta">
              {openCount} open comment{openCount === 1 ? "" : "s"}
              {session.approvedAt ? " · approved" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function lineCommentTarget(
  sessionId: string | undefined,
  file: DiffFile,
  line: DiffLine
): DraftTarget | undefined {
  if (!sessionId) {
    return undefined;
  }

  if (line.newLineNumber) {
    return { type: "line", sessionId, filePath: file.path, side: "new", lineNumber: line.newLineNumber };
  }

  if (line.oldLineNumber) {
    return { type: "line", sessionId, filePath: file.path, side: "old", lineNumber: line.oldLineNumber };
  }

  return undefined;
}

function latestSessionByCreation(sessions: BranchReviewSession[]): BranchReviewSession | undefined {
  return [...sessions].sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? "")).at(-1);
}

function getDiffEmptyState(
  loading: boolean,
  diffLoading: boolean,
  error: string | undefined,
  overview: BranchReviewOverviewResponse | undefined,
  selectedSessionId: string | undefined
): { title: string; message: string } | undefined {
  if (loading) {
    return { title: "Loading branch review", message: "Reading standalone branch review sessions." };
  }

  if (error) {
    return { title: "Branch review unavailable", message: error };
  }

  if (!overview || overview.sessions.length === 0) {
    return {
      title: "No branch review session",
      message: "Run pathfinder branch-review next --json, or start a session with pathfinder branch-review start --base <base-ref>."
    };
  }

  if (!selectedSessionId) {
    return { title: "No session selected", message: "Select a branch review session from the sidebar." };
  }

  if (diffLoading) {
    return { title: "Loading diff", message: "Reading the selected branch review diff." };
  }

  return undefined;
}
