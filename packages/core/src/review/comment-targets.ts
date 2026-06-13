import {
  ReviewComment,
  ReviewCommentAnchorStatus,
  ReviewCommentSide,
  ReviewCommentTarget,
  StructuredDiff,
  StructuredDiffFile
} from "../domain.js";

export const reviewCommentSides: readonly ReviewCommentSide[] = ["old", "new"];

export function isReviewCommentSide(value: string): value is ReviewCommentSide {
  return reviewCommentSides.includes(value as ReviewCommentSide);
}

export function describeReviewCommentTarget(comment: ReviewComment): string {
  const target = getReviewCommentTarget(comment);

  if (target.type === "slice") {
    return `slice ${target.sliceId}`;
  }

  if (target.type === "file") {
    return `session ${target.sessionId} file ${target.filePath}`;
  }

  if (target.type === "line") {
    return `session ${target.sessionId} file ${target.filePath} ${target.side} line ${target.lineNumber}`;
  }

  return "workstream";
}

export function getReviewCommentTarget(comment: ReviewComment): ReviewCommentTarget {
  if (comment.target) {
    return comment.target;
  }

  if (comment.sliceId) {
    return {
      type: "slice",
      sliceId: comment.sliceId
    };
  }

  return {
    type: "workstream"
  };
}

export function structuredDiffHasFile(diff: StructuredDiff, filePath: string): boolean {
  return diff.files.some((file) => structuredDiffFileMatches(file, filePath));
}

export function structuredDiffHasLine(
  diff: StructuredDiff,
  filePath: string,
  lineNumber: number,
  side: ReviewCommentSide
): boolean {
  return diff.files.some((file) => {
    if (!structuredDiffFileMatches(file, filePath)) {
      return false;
    }

    return file.hunks.some((hunk) =>
      hunk.lines.some((line) =>
        side === "new" ? line.newLineNumber === lineNumber : line.oldLineNumber === lineNumber
      )
    );
  });
}

export function getReviewCommentAnchorStatus(
  comment: ReviewComment,
  sessionId: string,
  diff: StructuredDiff
): ReviewCommentAnchorStatus {
  const target = comment.target;

  if (!target || (target.type !== "file" && target.type !== "line") || target.sessionId !== sessionId) {
    return "unknown";
  }

  if (!structuredDiffHasFile(diff, target.filePath)) {
    return "stale";
  }

  if (target.type === "file") {
    return "current";
  }

  return structuredDiffHasLine(diff, target.filePath, target.lineNumber, target.side) ? "current" : "stale";
}

function structuredDiffFileMatches(file: StructuredDiffFile, filePath: string): boolean {
  return [file.path, file.previousPath, file.oldPath, file.newPath].includes(filePath);
}
