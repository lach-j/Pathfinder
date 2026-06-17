import type { ReactElement } from "react";

import type { DiffFile, ReviewComment } from "../types";
import { commentCountsForFile, fileStats, statusLabel } from "./review-model";

interface FileListProps {
  files: DiffFile[];
  comments?: ReviewComment[];
  selectedPath: string | undefined;
  onSelectFile: (path: string) => void;
}

export function FileList({ comments = [], files, selectedPath, onSelectFile }: FileListProps): ReactElement {
  const changed = files.length === 1 ? "1 changed file" : `${files.length} changed files`;

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-title">Changed files</div>
        <div className="sidebar-meta">{changed}</div>
      </div>
      <div className="file-list">
        {files.map((file) => {
          const stats = fileStats(file);
          const status = file.status || "other";
          const commentCounts = commentCountsForFile(file, comments);

          return (
            <button
              key={file.path}
              className="file-button"
              type="button"
              aria-current={file.path === selectedPath ? "true" : undefined}
              onClick={() => onSelectFile(file.path)}
            >
              <span className={`status status-${status}`}>{statusLabel(status)}</span>
              <span className="file-name">{file.path}</span>
              <span className="stats" aria-label={`${stats.additions} additions and ${stats.deletions} deletions`}>
                <span className="stat-addition">+{stats.additions}</span>
                <span className="stat-deletion">-{stats.deletions}</span>
              </span>
              {commentCounts.total > 0 && (
                <span
                  className={`file-comment-pill${commentCounts.open > 0 ? " has-open-comments" : ""}`}
                  title={`${commentCounts.open} open, ${commentCounts.resolved} resolved`}
                >
                  {commentCounts.open > 0 ? commentCounts.open : commentCounts.resolved}
                  <span>{commentCounts.open > 0 ? "open" : "resolved"}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
