# Workstream Dependency Tree

Status: idea

## Summary

Add a local UI overview that shows the current workstream as a dependency tree of slices, including status, linked issues, branch/review/PR metadata, and quick navigation to slice details.

The UI should make it obvious which slices can be worked on in parallel and which slices are blocked by earlier work.

## User Story

As a developer, I want to open a workstream and immediately see which slices exist, what state each slice is in, which external issues they relate to, and which slices can be implemented at the same time.

## Assumptions

- Slice dependencies already belong in core/state and should remain reusable by CLI and UI.
- The dependency tree is a visualization over local state, not a separate planning system.
- The UI can start read-only and later add actions.
- Slice status values may need to be expanded or normalized for UI clarity.
- Linked issues are metadata references unless an optional integration has imported more detail.

## Requirements

- Show all slices in the selected workstream.
- Display each slice with:
  - Title.
  - Status.
  - Slice id.
  - Linked issue references.
  - Branch name, if known.
  - Review session state, if known.
  - PR draft status, if known.
  - Open comment count, if known.
- Render dependencies as a graph or tree:
  - Independent slices appear in parallel lanes.
  - Dependent slices appear after their blockers.
  - Shared setup slices appear before downstream parallel work.
- Highlight the next actionable slices based on dependency and status.
- Allow click-through to:
  - Slice detail or slice file.
  - Plan.
  - Requirements.
  - Review session.
  - PR draft.
- Surface blocked slices with a clear reason.
- Detect and report invalid dependency state rather than rendering a misleading graph.

## Status Model Ideas

The UI can map existing status values into a workflow-friendly display:

```text
proposed -> Todo
ready -> Todo
in_progress -> In Progress
review -> Review
complete -> Done
blocked -> Blocked
```

If the core domain does not yet support every display status, the UI should avoid inventing hidden state. Add domain support first.

## Layout Ideas

- Header with workstream title, plan status, base branch, and overall progress.
- Left pane for workstream navigation.
- Main pane for dependency tree.
- Right pane for selected slice details.
- Filters for status, linked issue, ready-to-start, blocked, in review, and complete.
- Compact mode for large workstreams.

## Out Of Scope

- No SaaS-style team board.
- No drag-and-drop dependency editing until dependency validation is strong.
- No issue tracker replacement.
- No remote PR status polling unless an explicit integration exists.
- No UI-owned business rules.

## Later Slice Candidates

- Add read-only workstream overview endpoint.
- Add dependency graph layout data in core.
- Build read-only dependency tree UI.
- Add slice status filtering.
- Add slice detail navigation.
- Add dependency editing with core validation.

