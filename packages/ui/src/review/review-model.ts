import type {
  CommentFilter,
  DiffFile,
  DiffLine,
  DraftTarget,
  ReviewComment,
  ReviewCommentSide,
  StructuredDiff
} from "../types";

export function firstFilePath(diff: StructuredDiff | undefined): string | undefined {
  return diff?.files?.[0]?.path;
}

export function visibleComments(comments: ReviewComment[], filter: CommentFilter): ReviewComment[] {
  if (filter === "open") {
    return comments.filter((comment) => !comment.resolved);
  }

  if (filter === "resolved") {
    return comments.filter((comment) => Boolean(comment.resolved));
  }

  return comments;
}

export function commentsForFile(file: DiffFile, comments: ReviewComment[]): ReviewComment[] {
  return comments.filter((comment) => {
    const target = comment.target;
    if (!target || (target.type !== "file" && target.type !== "line")) {
      return false;
    }

    return target.filePath === file.path || target.filePath === file.oldPath || target.filePath === file.previousPath;
  });
}

export function commentsForLine(file: DiffFile, line: DiffLine, comments: ReviewComment[]): ReviewComment[] {
  return commentsForFile(file, comments).filter((comment) => {
    const target = comment.target;
    if (!target || target.type !== "line") {
      return false;
    }

    return target.side === "old"
      ? line.oldLineNumber === target.lineNumber
      : line.newLineNumber === target.lineNumber;
  });
}

export function staleCommentsForSelectedFile(
  file: DiffFile,
  files: DiffFile[],
  diff: StructuredDiff | undefined,
  comments: ReviewComment[]
): ReviewComment[] {
  return comments.filter((comment) => {
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
    return !targetFileIsInDiff && file.path === firstFilePath(diff);
  });
}

export function fileStats(file: DiffFile): { additions: number; deletions: number } {
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

export function lineCommentTarget(line: DiffLine): { side: ReviewCommentSide; lineNumber: number } | undefined {
  if (line.newLineNumber) {
    return { side: "new", lineNumber: line.newLineNumber };
  }

  if (line.oldLineNumber) {
    return { side: "old", lineNumber: line.oldLineNumber };
  }

  return undefined;
}

export function draftMatchesFile(target: DraftTarget | undefined, file: DiffFile): boolean {
  return Boolean(target && target.type === "file" && target.filePath === file.path);
}

export function draftMatchesLine(target: DraftTarget | undefined, file: DiffFile, line: DiffLine): boolean {
  if (!target || target.type !== "line" || target.filePath !== file.path) {
    return false;
  }

  return target.side === "old"
    ? line.oldLineNumber === target.lineNumber
    : line.newLineNumber === target.lineNumber;
}

export function commentTargetText(comment: ReviewComment): string {
  const target = comment.target;
  if (target?.type === "line") {
    return `${target.filePath} ${target.side} line ${target.lineNumber}`;
  }

  if (target?.type === "file") {
    return `${target.filePath} file comment`;
  }

  return "file comment";
}

export function statusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
    copied: "C",
    other: "?"
  };
  return labels[status || "other"] || "?";
}

export function linePrefix(kind: string): string {
  if (kind === "addition") {
    return "+";
  }

  if (kind === "deletion") {
    return "-";
  }

  return " ";
}

