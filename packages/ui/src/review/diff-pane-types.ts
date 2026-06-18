import type {
  DiffFile,
  DiffLine,
  DraftTarget,
  ReviewComment,
  ReviewSession,
  StructuredDiff
} from "../types";

export interface DiffPaneProps {
  diff: StructuredDiff | undefined;
  session: ReviewSession | undefined;
  comments: ReviewComment[];
  selectedPath: string | undefined;
  commentFilter: "all" | "open" | "resolved";
  draftTarget: DraftTarget | undefined;
  statusMessage: string;
  emptyState?: { title: string; message: string };
  onBeginFileComment: (file: DiffFile) => void;
  onBeginLineComment: (file: DiffFile, line: DiffLine) => void;
  onCancelComment: () => void;
  onSaveComment: (body: string) => void;
  onResolveComment: (commentId: string) => void;
}
