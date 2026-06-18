import {
  RepositoryChangeStatus,
  RepositorySummary,
  StructuredDiff,
  StructuredDiffLine
} from "@pathfinder/core";

export function formatRepositorySummary(summary: RepositorySummary): string {
  const counts = countRepositoryStatuses(summary.files);
  const lines = [
    "# Repository Summary",
    "",
    `Base ref: ${summary.baseRef}`,
    `Head ref: ${summary.headRef}`,
    `Head commit: ${summary.headCommit}`,
    `Merge base: ${summary.mergeBase}`,
    `Changed files: ${summary.files.length}`,
    `Added: ${counts.added}`,
    `Modified: ${counts.modified}`,
    `Deleted: ${counts.deleted}`,
    `Renamed: ${counts.renamed}`,
    ""
  ];

  if (summary.files.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Files");
  lines.push("");

  for (const file of summary.files) {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    lines.push(`- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatStructuredDiff(diff: StructuredDiff): string {
  const lines = ["# Pathfinder Diff", "", `Changed files: ${diff.files.length}`, ""];

  if (diff.files.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  for (const file of diff.files) {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    lines.push(`## ${formatChangeStatus(file.status)} ${pathText}`);
    lines.push("");

    if (file.hunks.length === 0) {
      lines.push("No textual hunks.");
      lines.push("");
      continue;
    }

    for (const hunk of file.hunks) {
      lines.push(hunk.header);
      for (const line of hunk.lines) {
        lines.push(formatStructuredDiffLine(line));
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function formatChangeStatus(status: RepositoryChangeStatus): string {
  if (status === "added") {
    return "A";
  }

  if (status === "modified") {
    return "M";
  }

  if (status === "deleted") {
    return "D";
  }

  if (status === "renamed") {
    return "R";
  }

  if (status === "copied") {
    return "C";
  }

  return "?";
}

function countRepositoryStatuses(files: RepositorySummary["files"]): Record<RepositoryChangeStatus, number> {
  return files.reduce<Record<RepositoryChangeStatus, number>>(
    (counts, file) => ({
      ...counts,
      [file.status]: counts[file.status] + 1
    }),
    {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
      copied: 0,
      other: 0
    }
  );
}

function formatStructuredDiffLine(line: StructuredDiffLine): string {
  const oldLine = line.oldLineNumber === undefined ? "    " : String(line.oldLineNumber).padStart(4, " ");
  const newLine = line.newLineNumber === undefined ? "    " : String(line.newLineNumber).padStart(4, " ");

  if (line.kind === "addition") {
    return `${oldLine} ${newLine} +${line.text}`;
  }

  if (line.kind === "deletion") {
    return `${oldLine} ${newLine} -${line.text}`;
  }

  if (line.kind === "metadata") {
    return `          ${line.text}`;
  }

  return `${oldLine} ${newLine}  ${line.text}`;
}
