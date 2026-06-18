import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-state-"));
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(repo, ".git")));
  return repo;
}

export async function sortedFiles(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(directory)).sort();
}

export function structuredDiff(files: ReturnType<typeof structuredDiffFile>[]) {
  return { files };
}

export function structuredDiffFile(filePath: string, newLineNumbers: number[]) {
  return {
    path: filePath,
    status: "modified" as const,
    oldPath: filePath,
    newPath: filePath,
    hunks: [
      {
        header: "@@ -1 +1 @@",
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: newLineNumbers.length,
        lines: newLineNumbers.map((newLineNumber) => ({
          kind: "addition" as const,
          newLineNumber,
          text: `line ${newLineNumber}`
        }))
      }
    ]
  };
}

export function sampleStagePlan(): string {
  return `# Inventory Alerts - Stage Plan

Epic: INV-1
Originating ticket: INV-2
Created: 2026-06-13

## Context
Build local inventory alerts.

## Stages

| Stage | Issue | Title | Status |
| ----- | ---- | ----- | ------ |
| 1 | INV-1 | Add Data Source | pending |
| 2 | INV-2 | Add Report | pending |

---

## Stage 1: Add Data Source (INV-1) [status: pending]

**Scope:** Create local data.
**Acceptance criteria:** Data loads from disk.
**Depends on:** None.
**Commit breakdown:**
1. Add model

## Stage 2: Add Report (INV-2) [status: pending]

**Scope:** Report reorder candidates.
**Acceptance criteria:** Report lists low stock.
**Open items:** Confirm threshold.
**Depends on:** Stage 1 data source.
**Commit breakdown:**
1. Add report
`;
}

export function duplicateTitleStagePlan(): string {
  return `# Duplicate Titles - Stage Plan

## Context
Exercise duplicate title import.

## Stage 1: Add Report (INV-1) [status: pending]

**Scope:** First report.

## Stage 2: Add Report (INV-2) [status: pending]

**Scope:** Second report.

## Stage 3: Add Report (INV-3) [status: pending]

**Scope:** Third report.
`;
}
