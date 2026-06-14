# Review UI Depth

Status: idea

## Summary

Deepen the local diff review UI from a functional unified viewer into a richer review workspace with side-by-side mode, syntax highlighting, comment threads, editing, keyboard navigation, search, and better stale anchor handling.

## Gap

The current UI covers the essential loop: select a session, inspect files, add file or line comments, resolve comments, filter comments, and refresh stale anchors. It does not yet provide the richer review ergonomics developers expect from GitHub, GitLab, or Bitbucket.

## Assumptions

- Unified diff should remain the baseline view.
- Side-by-side should be optional and share the same structured diff model.
- Comment behavior must stay backed by `.pathfinder/` state.
- UI additions should call local server endpoints and avoid owning business logic.
- Browser testing should become part of this work as the UI grows.

## Requirements

- Add side-by-side diff mode.
- Add syntax highlighting for common languages without making review state depend on a highlighter.
- Add comment editing.
- Add threaded replies or explicit follow-up notes.
- Add markdown rendering for comment bodies.
- Add keyboard shortcuts for file navigation, next comment, previous comment, add comment, resolve.
- Add search/filter by file path, comment text, status, and anchor state.
- Add comment summary counts by file in the file list.
- Add stale comment relocation assistance:
  - show stale comments in a dedicated panel
  - let the user manually re-anchor a stale comment
  - keep the old target as history
- Add copyable file/line references for agent prompts.
- Preserve responsive layout on narrow screens.

## Data Model Ideas

Possible comment thread extension:

```json
{
  "id": "handle-empty-case",
  "body": "Handle the empty case.",
  "replies": [
    {
      "id": "reply-2",
      "body": "Agent changed this in commit abc123.",
      "createdAt": "2026-06-14T00:00:00.000Z"
    }
  ]
}
```

Manual re-anchor history:

```json
{
  "anchorHistory": [
    {
      "sessionId": "review-add-report",
      "filePath": "src/report.ts",
      "lineNumber": 12,
      "side": "new"
    }
  ]
}
```

## Out Of Scope

- No hosted review service.
- No remote GitHub/GitLab sync.
- No team approval workflow.
- No AI-required review.
- No IDE replacement.

## Later Slice Candidates

- Add comment counts to review session API responses.
- Add file search and comment filters to the UI.
- Add comment editing through core/state/server.
- Add side-by-side diff rendering.
- Add syntax highlighting behind a small UI-only adapter.
- Add manual stale comment re-anchor flow.
- Add Playwright smoke tests for review UI workflows.

