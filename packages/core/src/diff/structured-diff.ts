import {
  StructuredDiff,
  StructuredDiffFile,
  StructuredDiffFileStatus,
  StructuredDiffHunk,
  StructuredDiffLine
} from "../domain.js";

const diffHeaderPattern = /^diff --git a\/(.+) b\/(.+)$/;
const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

export function parseUnifiedDiff(diffText: string): StructuredDiff {
  const files: StructuredDiffFile[] = [];
  let currentFile: StructuredDiffFile | undefined;
  let currentHunk: StructuredDiffHunk | undefined;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  const lines = diffText.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }

  for (const line of lines) {
    const diffHeader = diffHeaderPattern.exec(line);
    if (diffHeader) {
      currentFile = {
        path: diffHeader[2],
        status: "modified",
        oldPath: diffHeader[1],
        newPath: diffHeader[2],
        hunks: []
      };
      files.push(currentFile);
      currentHunk = undefined;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("new file mode ")) {
      currentFile.status = "added";
      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      currentFile.status = "deleted";
      continue;
    }

    if (line.startsWith("rename from ")) {
      currentFile.status = "renamed";
      currentFile.previousPath = line.slice("rename from ".length);
      continue;
    }

    if (line.startsWith("rename to ")) {
      currentFile.path = line.slice("rename to ".length);
      currentFile.newPath = currentFile.path;
      continue;
    }

    if (line.startsWith("copy from ")) {
      currentFile.status = "copied";
      currentFile.previousPath = line.slice("copy from ".length);
      continue;
    }

    if (line.startsWith("copy to ")) {
      currentFile.path = line.slice("copy to ".length);
      currentFile.newPath = currentFile.path;
      continue;
    }

    if (line.startsWith("--- ")) {
      currentFile.oldPath = normalizePatchPath(line.slice("--- ".length));
      continue;
    }

    if (line.startsWith("+++ ")) {
      currentFile.newPath = normalizePatchPath(line.slice("+++ ".length));
      if (currentFile.status !== "deleted") {
        currentFile.path = currentFile.newPath ?? currentFile.path;
      }
      continue;
    }

    const hunkHeader = hunkHeaderPattern.exec(line);
    if (hunkHeader) {
      currentHunk = {
        header: line,
        oldStart: Number(hunkHeader[1]),
        oldLines: Number(hunkHeader[2] ?? "1"),
        newStart: Number(hunkHeader[3]),
        newLines: Number(hunkHeader[4] ?? "1"),
        ...(hunkHeader[5] ? { section: hunkHeader[5] } : {}),
        lines: []
      };
      currentFile.hunks.push(currentHunk);
      oldLineNumber = currentHunk.oldStart;
      newLineNumber = currentHunk.newStart;
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    const parsedLine = parseDiffLine(line, oldLineNumber, newLineNumber);
    currentHunk.lines.push(parsedLine.line);
    oldLineNumber = parsedLine.nextOldLineNumber;
    newLineNumber = parsedLine.nextNewLineNumber;
  }

  for (const file of files) {
    if (file.status === "modified") {
      file.status = inferStatus(file);
    }
  }

  return { files };
}

function parseDiffLine(
  line: string,
  oldLineNumber: number,
  newLineNumber: number
): { line: StructuredDiffLine; nextOldLineNumber: number; nextNewLineNumber: number } {
  if (line.startsWith("+")) {
    return {
      line: {
        kind: "addition",
        newLineNumber,
        text: line.slice(1)
      },
      nextOldLineNumber: oldLineNumber,
      nextNewLineNumber: newLineNumber + 1
    };
  }

  if (line.startsWith("-")) {
    return {
      line: {
        kind: "deletion",
        oldLineNumber,
        text: line.slice(1)
      },
      nextOldLineNumber: oldLineNumber + 1,
      nextNewLineNumber: newLineNumber
    };
  }

  if (line.startsWith("\\")) {
    return {
      line: {
        kind: "metadata",
        text: line
      },
      nextOldLineNumber: oldLineNumber,
      nextNewLineNumber: newLineNumber
    };
  }

  return {
    line: {
      kind: "context",
      oldLineNumber,
      newLineNumber,
      text: line.startsWith(" ") ? line.slice(1) : line
    },
    nextOldLineNumber: oldLineNumber + 1,
    nextNewLineNumber: newLineNumber + 1
  };
}

function normalizePatchPath(pathText: string): string | undefined {
  if (pathText === "/dev/null") {
    return undefined;
  }

  if (pathText.startsWith("a/") || pathText.startsWith("b/")) {
    return pathText.slice(2);
  }

  return pathText;
}

function inferStatus(file: StructuredDiffFile): StructuredDiffFileStatus {
  if (!file.oldPath && file.newPath) {
    return "added";
  }

  if (file.oldPath && !file.newPath) {
    return "deleted";
  }

  return "modified";
}
