import type { ReactElement } from "react";

import type { DiffFile } from "../types";
import { fileStats, statusLabel } from "./review-model";

interface FileListProps {
  files: DiffFile[];
  selectedPath: string | undefined;
  onSelectFile: (path: string) => void;
}

export function FileList({ files, selectedPath, onSelectFile }: FileListProps): ReactElement {
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
              <span className="stats">
                +{stats.additions} -{stats.deletions}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
