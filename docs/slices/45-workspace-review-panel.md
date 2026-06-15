# Slice 45: Workspace Review Panel

Status: ready

## Goal

Move the existing review workflow into the workspace right panel.

## Reason

The local diff review experience is central to Pathfinder, but it should no longer occupy the whole browser app as a standalone review viewer. In the workspace model, review belongs to a selected slice alongside plan, evidence, feedback, and PR draft context.

This slice embeds the existing review loop into the right panel while preserving current review behavior.

## Requirements

- Add a review tab or mode in the right workspace panel.
- For the selected slice, show review sessions belonging to that slice.
- Default to the latest review session for the selected slice.
- If the selected slice has no review sessions, show a clear empty state.
- Reuse existing review session APIs where possible:
  - list sessions
  - load session diff
  - list comments for session
  - add file comment
  - add line comment
  - resolve comment
  - refresh review session
- Preserve existing review capabilities:
  - file list
  - selected file diff
  - line-level comments
  - file-level comments
  - comment resolve
  - comment filter
  - refresh review
  - stale or unknown anchor display
- The review panel should be wide and usable enough for code review. Use a resizable panel or layout treatment if needed.
- Review comments should remain backed by existing Pathfinder comment state.
- Current review API compatibility must be maintained.
- Do not change comment resolution semantics.
- Do not auto-approve reviews.
- Do not mark slices complete from the review UI unless an existing explicit approval workflow is intentionally exposed by a later slice.

## Technical Notes

- Refactor existing review components instead of rewriting review behavior from scratch.
- Keep review-specific helpers in `src/review/` or a similarly focused folder.
- The workspace shell should own selected workstream/slice/session state and pass review data into review components.
- Keep API calls through the browser API helper.
- If the current review viewer route is still useful for compatibility, it may remain as a route or fallback, but the workspace should become the primary experience.
- Do not add side-by-side diff, syntax highlighting, threaded comments, or comment editing in this slice unless they are already trivial. Those belong to later review UI depth work.

## Likely Files

- `packages/ui/src/review/*`
- `packages/ui/src/workspace/*`
- `packages/ui/src/App.tsx`
- `packages/ui/src/types.ts`
- `packages/ui/src/styles/*`
- local-server routes only if selected-slice session filtering needs API support
- tests, if practical

## Acceptance Criteria

- Selecting a slice with review sessions exposes a review tab in the right panel.
- The latest session for the selected slice loads by default.
- Users can select another session for that slice.
- Users can inspect changed files and diffs.
- Users can add file comments and line comments.
- Users can resolve comments.
- Users can refresh a review session.
- Existing review endpoint tests still pass.
- Review is visibly part of the selected slice workspace, not the entire app frame.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder workspace serve --port 4783
```

Verify the review panel with a slice that has a committed review session and at least one changed file.

