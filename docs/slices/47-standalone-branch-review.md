# Slice 47: Standalone Branch Review

Status: done

## Goal

Add first-class standalone branch review for small committed branch tasks without requiring a workstream or slice.

## Reason

Developers sometimes work on atomic branches and still need Pathfinder's local diff review loop, inline comments, agent feedback loop, refresh, approval, and PR markdown. This workflow should not fake a slice or weaken the existing `pathfinder agent next` slice/workstream state machine.

## Requirements

- Add branch-review state separate from workstreams.
- Add `pathfinder branch-review next --json` as the branch-review state machine.
- Preserve `pathfinder agent next` as the required workstream/slice workflow.
- Support start, diff, comments, feedback export, refresh, approval, and PR markdown generation for branch reviews.
- Keep branch-review `next` read-only.
- Add local-server branch-review API routes.
- Add full-width browser Branch review mode with:
  - session sidebar
  - file list
  - diff view
  - file and line comments
  - comment resolve
  - review refresh
- Do not require a workstream or active slice.
- Do not add hosted Git provider integration.

## Technical Notes

- Branch review state is stored under `branch-reviews/`.
- Feedback markdown is optional export output, not the source of state.
- The UI reuses existing diff and comment components.
- The workspace rail exposes Branch review as a separate mode.
- The existing workstream artifact and slice UI remains unchanged.

## Likely Files

- `packages/core/src/branch-review/next.ts`
- `packages/core/src/domain.ts`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/formatters.ts`
- `packages/cli/src/help.ts`
- `packages/local-server/src/review-server.ts`
- `packages/ui/src/workspace/BranchReviewWorkspace.tsx`
- `packages/ui/src/workspace/branch-review-api.ts`
- `packages/ui/src/workspace/WorkspaceShell.tsx`
- `packages/ui/src/styles/workspace.css`
- `packages/ui/src/types.ts`
- `README.md`
- tests

## Acceptance Criteria

- A repo with committed branch changes can run `pathfinder branch-review next --json` and receive actionable branch-review guidance.
- Branch-review sessions can be started against a base branch without a workstream or slice.
- File and line comments can be added, listed, and resolved for branch-review sessions.
- Open feedback can be exported for an agent and sessions can be refreshed after fixes.
- Branch review approval is blocked while open comments remain.
- Branch-review PR markdown can be generated from standalone branch review state.
- The local browser workspace has a Branch review mode that shows sessions, changed files, diff, file and line comment controls, resolve, and refresh.
- Existing workstream/slice review workflow and `pathfinder agent next` behavior are unchanged.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder branch-review next --json
pathfinder branch-review start --base <base-ref>
pathfinder workspace serve --port 4783
```

Verify Branch review mode in the browser, select a session, add a file or line comment, resolve it, and refresh the session.

## Completion Notes

- Added standalone branch-review domain, state, CLI workflow, and read-only `branch-review next`.
- Added branch-review feedback export and PR markdown generation.
- Added branch-review local-server API routes.
- Added full-width browser Branch review workspace mode.
- Verified with automated checks and browser smoke testing.
