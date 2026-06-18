import type { ReviewComment } from "../domain.js";

export interface LineCommentGroup {
  filePath: string;
  comments: ReviewComment[];
}

export interface FileCommentGroup {
  filePath: string;
  comments: ReviewComment[];
}
