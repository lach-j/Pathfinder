import type { ReactElement } from "react";

import type { CommentFilter, CurrentContext, ReviewSession } from "../types";

interface ReviewHeaderProps {
  current: CurrentContext | undefined;
  sessions: ReviewSession[];
  selectedSessionId: string | undefined;
  commentFilter: CommentFilter;
  onSelectSession: (sessionId: string) => void;
  onChangeCommentFilter: (filter: CommentFilter) => void;
  onRefresh: () => void;
}

export function ReviewHeader({
  current,
  sessions,
  selectedSessionId,
  commentFilter,
  onSelectSession,
  onChangeCommentFilter,
  onRefresh
}: ReviewHeaderProps): ReactElement {
  const title = current?.workstream?.title || "No active workstream";
  const sliceText = current?.activeSlice
    ? `${current.activeSlice.title} (${current.activeSlice.id})`
    : "No active slice";

  return (
    <section className="topbar">
      <div className="identity">
        <div className="eyebrow">Pathfinder Review</div>
        <h1>{title}</h1>
        <div className="slice">{sliceText}</div>
      </div>
      {sessions.length > 0 && (
        <div className="review-controls">
          <div className="control session-control">
            <label htmlFor="session-select">Review session</label>
            <select
              id="session-select"
              value={selectedSessionId || ""}
              onChange={(event) => onSelectSession(event.currentTarget.value)}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.id} - {session.baseRef} to {session.headRef}
                </option>
              ))}
            </select>
          </div>
          <div className="control">
            <label htmlFor="comment-filter">Comments</label>
            <select
              id="comment-filter"
              value={commentFilter}
              onChange={(event) => onChangeCommentFilter(event.currentTarget.value as CommentFilter)}
            >
              <option value="all">All comments</option>
              <option value="open">Open comments</option>
              <option value="resolved">Resolved comments</option>
            </select>
          </div>
          <button className="button" type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      )}
    </section>
  );
}
