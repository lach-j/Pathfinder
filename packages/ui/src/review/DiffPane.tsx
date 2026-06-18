import type { ReactElement } from "react";

import type { DiffFile, DiffLine, ReviewComment } from "../types";
import "./review-shell.css";
import "./diff-table.css";
import "./review-comments.css";
import type { DiffPaneProps } from "./diff-pane-types";
import {
  commentTargetText,
  commentsForFile,
  commentsForLine,
  draftMatchesFile,
  draftMatchesLine,
  fileStats,
  lineCommentTarget,
  linePrefix,
  reviewCommentSummary,
  staleCommentsForSelectedFile,
  visibleComments
} from "./review-model";
import { highlightDiffLine } from "./syntax-highlighting";

export function DiffPane({
  diff,
  session,
  comments,
  selectedPath,
  commentFilter,
  draftTarget,
  statusMessage,
  emptyState,
  onBeginFileComment,
  onBeginLineComment,
  onCancelComment,
  onSaveComment,
  onResolveComment
}: DiffPaneProps): ReactElement {
  const files = diff?.files || [];
  const selectedFile = files.find((file) => file.path === selectedPath) || files[0];
  const filteredComments = visibleComments(comments, commentFilter);

  if (emptyState) {
    return <EmptyState title={emptyState.title} message={emptyState.message} />;
  }

  if (!selectedFile) {
    const staleComments = filteredComments.filter((comment) => comment.anchorStatus === "stale");
    if (staleComments.length > 0) {
      return (
        <section className="diff-pane">
          <div className="file-heading">
            <div className="file-heading-main">
              <h2>Stale comments</h2>
              <div className="file-subtitle">No changed files remain in this refreshed review session.</div>
            </div>
          </div>
          <table className="diff-table" aria-label="Stale review comments">
            <tbody>{staleComments.map((comment) => <CommentRow key={comment.id} comment={comment} onResolve={onResolveComment} />)}</tbody>
          </table>
        </section>
      );
    }

    return <EmptyState title="No diff" message="This review session has no changed files." />;
  }

  const fileComments = commentsForFile(selectedFile, filteredComments).filter((comment) => comment.target?.type === "file");
  const staleComments = staleCommentsForSelectedFile(selectedFile, files, diff, filteredComments);
  const stats = fileStats(selectedFile);
  const summary = reviewCommentSummary(filteredComments);

  return (
    <section className="diff-pane">
      <div className="file-heading">
        <div className="file-heading-main">
          <h2>{selectedFile.path}</h2>
          <div className="file-subtitle">
            <span>{selectedFile.status || "modified"}</span>
            <span className="diff-stat stat-addition">+{stats.additions}</span>
            <span className="diff-stat stat-deletion">-{stats.deletions}</span>
            {session ? <span>{session.baseRef} to {session.headRef}</span> : null}
          </div>
          {statusMessage && <div className="status-text">{statusMessage}</div>}
        </div>
        <div className="file-heading-actions">
          <div className="review-summary" aria-label="Visible review comments">
            <span>{summary.open} open</span>
            <span>{summary.resolved} resolved</span>
            {summary.stale > 0 && <span className="is-stale">{summary.stale} stale</span>}
          </div>
          <button className="button" type="button" onClick={() => onBeginFileComment(selectedFile)}>
            Add file comment
          </button>
        </div>
      </div>
      <table className="diff-table" aria-label={`Unified diff for ${selectedFile.path}`}>
        <tbody>
          {draftMatchesFile(draftTarget, selectedFile) && (
            <CommentFormRow
              title="Add file comment"
              onCancel={onCancelComment}
              onSave={onSaveComment}
            />
          )}
          {fileComments.map((comment) => <CommentRow key={comment.id} comment={comment} onResolve={onResolveComment} />)}
          {staleComments.map((comment) => <CommentRow key={comment.id} comment={comment} onResolve={onResolveComment} />)}
          {(selectedFile.hunks || []).flatMap((hunk, hunkIndex) => [
            <tr className="hunk-row" key={`hunk-${hunkIndex}`}>
              <td className="line-action" />
              <td className="line-number" />
              <td className="line-number" />
              <td className="code">{hunk.header}</td>
            </tr>,
            ...(hunk.lines || []).flatMap((line, lineIndex) => {
              const lineKey = `${hunkIndex}-${lineIndex}`;
              const rows = [
                <DiffLineRow
                  key={`line-${lineKey}`}
                  file={selectedFile}
                  line={line}
                  onBeginLineComment={onBeginLineComment}
                />
              ];

              if (draftMatchesLine(draftTarget, selectedFile, line)) {
                const title = draftTarget?.type === "line"
                  ? `Add comment on ${draftTarget.side} line ${draftTarget.lineNumber}`
                  : "Add file comment";
                rows.push(
                  <CommentFormRow
                    key={`form-${lineKey}`}
                    title={title}
                    onCancel={onCancelComment}
                    onSave={onSaveComment}
                  />
                );
              }

              rows.push(
                ...commentsForLine(selectedFile, line, filteredComments).map((comment) => (
                  <CommentRow key={`comment-${lineKey}-${comment.id}`} comment={comment} onResolve={onResolveComment} />
                ))
              );

              return rows;
            })
          ])}
          {(!selectedFile.hunks || selectedFile.hunks.length === 0) && (
            <tr>
              <td className="line-action" />
              <td className="line-number" />
              <td className="line-number" />
              <td className="code">No hunks for this file.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function DiffLineRow({
  file,
  line,
  onBeginLineComment
}: {
  file: DiffFile;
  line: DiffLine;
  onBeginLineComment: (file: DiffFile, line: DiffLine) => void;
}): ReactElement {
  const target = lineCommentTarget(line);

  return (
    <tr className={`line-${line.kind}`}>
      <td className="line-action">
        {target && (
          <button
            className="comment-button"
            type="button"
            title="Add line comment"
            aria-label="Add line comment"
            onClick={() => onBeginLineComment(file, line)}
          >
            <span aria-hidden="true">+</span>
          </button>
        )}
      </td>
      <td className="line-number">{line.oldLineNumber || ""}</td>
      <td className="line-number">{line.newLineNumber || ""}</td>
      <td className="code">
        <span className="prefix">{linePrefix(line.kind)}</span>
        <span className="code-content">{highlightDiffLine(file.path, line.text)}</span>
      </td>
    </tr>
  );
}

function CommentRow({
  comment,
  onResolve
}: {
  comment: ReviewComment;
  onResolve: (commentId: string) => void;
}): ReactElement {
  return (
    <tr className="comment-row">
      <td className="line-action" />
      <td className="line-number" />
      <td className="line-number" />
      <td className="comment-cell">
        <div className={`comment${comment.resolved ? " comment-resolved" : ""}`}>
          <div className="comment-header">
            <div className="comment-meta">
              <span className="comment-id">{comment.id}</span>
              <span>{commentTargetText(comment)}</span>
              <span className={`comment-state${comment.resolved ? " is-resolved" : " is-open"}`}>
                {comment.resolved ? "resolved" : "open"}
              </span>
              {comment.origin && comment.origin !== "human" && (
                <span className={`comment-origin origin-${comment.origin}`}>{comment.origin}</span>
              )}
              {comment.anchorStatus && (
                <span className={`anchor-status anchor-${comment.anchorStatus}`}>{comment.anchorStatus}</span>
              )}
            </div>
            {!comment.resolved && (
              <button className="button button-quiet" type="button" onClick={() => onResolve(comment.id)}>
                Resolve
              </button>
            )}
          </div>
          <div className="comment-body">{comment.body}</div>
        </div>
      </td>
    </tr>
  );
}

function CommentFormRow({
  title,
  onCancel,
  onSave
}: {
  title: string;
  onCancel: () => void;
  onSave: (body: string) => void;
}): ReactElement {
  return (
    <tr className="comment-form-row">
      <td className="line-action" />
      <td className="line-number" />
      <td className="line-number" />
      <td className="comment-cell">
        <form
          className="comment-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            onSave(String(data.get("body") || ""));
          }}
        >
          <div className="comment-form-title">{title}</div>
          <textarea name="body" required placeholder="Write review feedback..." autoFocus />
          <div className="comment-form-actions">
            <button className="button button-quiet" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              Save comment
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EmptyState({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <section className="diff-pane">
      <div className="empty">
        <strong>{title}</strong>
        <br />
        {message}
      </div>
    </section>
  );
}
