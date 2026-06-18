export type RepositoryFileCategory =
  | "test"
  | "documentation"
  | "source"
  | "configuration"
  | "state"
  | "other";

export const repositoryFileCategories: readonly RepositoryFileCategory[] = [
  "test",
  "documentation",
  "source",
  "configuration",
  "state",
  "other"
];

export type RepositoryChangeStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "other";

export interface RepositorySummaryFile {
  path: string;
  previousPath?: string;
  status: RepositoryChangeStatus;
  category: RepositoryFileCategory;
}

export interface RepositorySummary {
  baseRef: string;
  headRef: string;
  headCommit: string;
  mergeBase: string;
  files: RepositorySummaryFile[];
}

export type StructuredDiffFileStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "other";

export type StructuredDiffLineKind = "context" | "addition" | "deletion" | "metadata";

export interface StructuredDiffLine {
  kind: StructuredDiffLineKind;
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
}

export interface StructuredDiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  section?: string;
  lines: StructuredDiffLine[];
}

export interface StructuredDiffFile {
  path: string;
  previousPath?: string;
  status: StructuredDiffFileStatus;
  oldPath?: string;
  newPath?: string;
  hunks: StructuredDiffHunk[];
}

export interface StructuredDiff {
  files: StructuredDiffFile[];
}
