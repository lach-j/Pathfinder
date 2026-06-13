# Slice 09: MVP Review Follow-Up

Status: done

## Goal

Address the workflow gaps found during the first full smoke test: slice status transitions, committed/base-branch diff behavior, and minimal slice branch support.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Context From Smoke Test

The end-to-end smoke test worked technically, but the workflow exposed two important gaps:

- PR markdown could not show completed slices because there is no CLI command to move a slice through its lifecycle.
- `pathfinder git diff` currently shows the working tree diff. The desired MVP behavior is closer to "what will this look like as a PR against the base branch?", using committed changes.

The test also raised an important product question: when starting a new slice, Pathfinder may need to create or switch to a branch based on the slice it depends on.

## Scope

Implement the smallest useful version of these three capabilities.

### 1. Slice Status Updates

Add a CLI command to update a slice status:

```bash
pathfinder slice status <workstream-id> <slice-id> <status>
```

Valid statuses must remain:

```text
proposed
ready
in_progress
review
complete
```

Expected behavior:

- Validates the workstream, slice, and status.
- Updates `slices.json` with the new status and `updatedAt`.
- Keeps JSON human-readable.
- PR generation should naturally include slices marked `complete`.
- `current`, `slice list`, and `slice show-active` should show the updated status.

### 2. Committed Diff Against Base

Adjust or add a Git command for committed branch diff output. Prefer an explicit command so existing working-tree behavior can remain available:

```bash
pathfinder git diff
pathfinder git diff --base <base-ref>
```

Expected behavior:

- With no `--base`, preserve existing working-tree diff behavior unless the implementation finds a cleaner command split.
- With `--base <base-ref>`, print the committed diff for the current branch compared with `<base-ref>`.
- The intended Git operation is equivalent to comparing merge-base/base to `HEAD`, not showing unstaged working tree changes.
- Fails clearly if the base ref is missing or invalid.
- Does not call GitHub/GitLab or any external API.

Suggested Git behavior:

```bash
git merge-base <base-ref> HEAD
git diff <merge-base>..HEAD
```

Use a local Git adapter method rather than embedding Git process logic directly in the CLI.

### 3. Minimal Slice Branch Support

Add local branch metadata and a conservative branch-start command:

```bash
pathfinder slice branch <workstream-id> <slice-id> --base <base-ref>
```

Expected behavior:

- Creates and checks out a branch for the slice.
- Branch names should be stable and URL-safe, for example:

```text
pathfinder/<workstream-id>/<slice-id>
```

- Stores branch metadata on the slice or in a simple local state shape:
  - `branchName`
  - `baseRef`
  - `startedAt`
- Fails clearly if the working tree has uncommitted changes, unless a safer existing project convention says otherwise.
- Does not commit, push, open PRs, or contact a remote.

Dependency behavior:

- For this slice, require the user to pass `--base <base-ref>` explicitly.
- Do not build dependency graphs yet.
- It is acceptable to document that a later slice can add `dependsOnSliceId` and automatic base selection.

## Out Of Scope

- No GitHub/GitLab PR creation.
- No remote branch push.
- No automatic dependency graph yet.
- No UI.
- No MCP.
- No AI review.
- No external APIs.
- No automatic commits.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/git/src/index.ts`
- `packages/git/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`
- `docs/implementation-status.md`
- This file

## Acceptance Criteria

- Done: A slice can be marked `complete`.
- Done: `pathfinder pr generate <workstream-id>` lists completed slices after status updates.
- Done: `pathfinder git diff --base <base-ref>` shows committed changes from the current branch relative to the merge base with `<base-ref>`.
- Done: Existing `pathfinder git diff` working-tree behavior is preserved.
- Done: `pathfinder slice branch <workstream-id> <slice-id> --base <base-ref>` creates/checks out a local branch and records branch metadata.
- Done: Branch command refuses to run on a dirty working tree with a clear error.
- Done: Tests cover status updates, base diff behavior, and branch command state behavior where practical.
- Done: README documents the updated MVP workflow.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test in a temporary Git repo:

```bash
npm exec -- pathfinder init
npm exec -- pathfinder workstream create --title "Inventory alerts"
npm exec -- pathfinder slice add inventory-alerts --title "Add reorder report" --description "Create a local report for low stock items."
npm exec -- pathfinder slice branch inventory-alerts add-reorder-report --base main
# make and commit a small local change
npm exec -- pathfinder slice status inventory-alerts add-reorder-report complete
npm exec -- pathfinder git diff --base main
npm exec -- pathfinder pr generate inventory-alerts
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/09-mvp-review.md.

Current slice goal:
Address MVP smoke-test workflow gaps by adding slice status updates, committed diff against a base ref, and minimal local slice branch support.

Implement only this slice.

Do not build GitHub/GitLab integration, remote pushes, automatic dependency graphs, AI review, UI, MCP, Claude/Codex hooks, or external APIs.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test the updated branch, status, base diff, and PR generation workflow.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
