import type { ReactElement } from "react";

import { reviewCommentSummary } from "../review/review-model";
import type { CommentFilter, DiffFile, DiffLine, DraftTarget, ReviewComment, ReviewSession } from "../types";

interface ReviewToolbarProps {
  eyebrow: string;
  title: string;
  description: string;
  comments: ReviewComment[];
  session?: ReviewSession;
  commentFilter: CommentFilter;
  commentFilterId: string;
  className?: string;
  onChangeCommentFilter: (filter: CommentFilter) => void;
  onRefresh: () => void;
}

export function ReviewToolbar({
  eyebrow,
  title,
  description,
  comments,
  session,
  commentFilter,
  commentFilterId,
  className,
  onChangeCommentFilter,
  onRefresh
}: ReviewToolbarProps): ReactElement {
  const summary = reviewCommentSummary(comments);

  return (
    <div className={["branch-review-toolbar", className].filter(Boolean).join(" ")}>
      <div className="identity">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <div className="slice">{description}</div>
        <div className="review-status-strip" aria-label="Review comment status">
          <span>{summary.open} open</span>
          <span>{summary.resolved} resolved</span>
          {summary.stale > 0 && <span className="is-stale">{summary.stale} stale</span>}
        </div>
      </div>
      <div className="review-controls">
        <div className="control">
          <label htmlFor={commentFilterId}>Comments</label>
          <select
            id={commentFilterId}
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

interface ReviewSessionListProps<TSession extends ReviewSession> {
  sessions: TSession[];
  selectedSessionId?: string;
  comments: ReviewComment[];
  emptyTitle: string;
  emptyMessage: string;
  emptyCommand: string;
  approvedSeparator?: string;
  onSelectSession: (sessionId: string) => void;
}

export function ReviewSessionList<TSession extends ReviewSession>({
  sessions,
  selectedSessionId,
  comments,
  emptyTitle,
  emptyMessage,
  emptyCommand,
  approvedSeparator = " · ",
  onSelectSession
}: ReviewSessionListProps<TSession>): ReactElement {
  if (sessions.length === 0) {
    return (
      <div className="branch-review-empty">
        <strong>{emptyTitle}</strong>
        <p>{emptyMessage}</p>
        <code>{emptyCommand}</code>
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
              {session.approvedAt ? `${approvedSeparator}approved` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function lineCommentTarget(
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

export function latestSessionByCreation<TSession extends ReviewSession>(sessions: TSession[]): TSession | undefined {
  return [...sessions].sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? "")).at(-1);
}
