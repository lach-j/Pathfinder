import type { ReviewCommentSide } from "./review";

export type CommentFilter = "all" | "open" | "resolved";

export type DraftTarget =
  | { type: "file"; sessionId: string; filePath: string }
  | { type: "line"; sessionId: string; filePath: string; lineNumber: number; side: ReviewCommentSide };
