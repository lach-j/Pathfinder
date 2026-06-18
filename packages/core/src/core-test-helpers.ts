import type { Slice } from "./index.js";

export function testSlice(
  id: string,
  status: Slice["status"],
  createdAt: string,
  dependsOnSliceIds?: string[]
): Slice {
  return {
    id,
    title: id,
    description: id,
    status,
    ...(dependsOnSliceIds ? { dependsOnSliceIds } : {}),
    createdAt,
    updatedAt: createdAt
  };
}

export function testWorkstream(id: string, activeSliceId?: string) {
  return {
    id,
    title: id,
    ...(activeSliceId ? { activeSliceId } : {}),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
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

export function sampleUnifiedDiff(): string {
  return `diff --git a/src/modified.ts b/src/modified.ts
index 1111111..2222222 100644
--- a/src/modified.ts
+++ b/src/modified.ts
@@ -1,3 +1,4 @@
 one
-two
+two changed
 three
+four
diff --git a/src/added.ts b/src/added.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/added.ts
@@ -0,0 +1,2 @@
+alpha
+beta
diff --git a/src/deleted.ts b/src/deleted.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/deleted.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-gone
-done
diff --git a/docs/old.md b/docs/new.md
similarity index 62%
rename from docs/old.md
rename to docs/new.md
index 5555555..6666666 100644
--- a/docs/old.md
+++ b/docs/new.md
@@ -1 +1 @@
-old title
+new title
`;
}
