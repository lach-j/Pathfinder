# Slice 42: Workspace Shell Current Repo

Status: done

## Goal

Replace the review-only UI frame with a current-repository workspace shell.

## Reason

Personal and external state mode keeps Pathfinder data outside the working repository. That is good for no-repo-footprint usage, but it makes the state hard to inspect manually because users have to find the correct external folder and open markdown or JSON files by hand.

The browser app should become the main local workspace for the repository the user is currently working in. This slice creates the shell and navigation structure before adding deeper graph, preview, and review experiences.

## Requirements

- Build a three-zone workspace layout:
  - left rail for current repo/project and workstream navigation
  - center workspace area
  - right inspector panel
- Use the workspace APIs from slice 41.
- The UI should load the current repository workspace on startup.
- The left rail should show:
  - project or repository name
  - workstreams
  - active workstream marker, if one exists
  - useful empty state when there are no workstreams
- Selecting a workstream in the UI should update the selected workstream view without changing Pathfinder active state.
- The center area should show a placeholder workstream overview surface suitable for the dependency canvas added in slice 43.
- The right inspector should show selected workstream or slice details using existing state:
  - title
  - id
  - status for slices
  - description for slices
  - dependencies for slices
  - branch/base metadata for slices, when present
  - open comment count
  - review session count
  - evidence count
- Selecting a slice in the UI should update local UI selection only.
- Add an explicit "Make active" action for a selected slice.
- The "Make active" action should call the active-slice endpoint from slice 41.
- Keep the UI read-mostly. Do not add editing for workstream metadata, requirements, plan markdown, slice descriptions, evidence, comments outside existing review behavior, or PR drafts.
- Preserve useful empty states:
  - no Pathfinder state
  - no workstreams
  - workstream with no slices
  - selected workstream not found
  - selected slice not found

## Technical Notes

- The app should still be a local-only React app served by the local server.
- Keep browser types in `packages/ui/src/types.ts` or focused UI type modules.
- Prefer small components and feature folders over growing `App.tsx`.
- The center area can be structurally ready for the canvas without implementing graph layout in this slice.
- Do not add React Flow in this slice unless the implementation naturally chooses to combine slices 42 and 43; the intended dependency is added in slice 43.
- Use a quiet, dense, agent-style layout: navigation left, content middle, preview/inspector right.
- Do not add a marketing landing page, SaaS dashboard, auth, teams, or remote project concepts.

## Likely Files

- `packages/ui/src/App.tsx`
- `packages/ui/src/types.ts`
- `packages/ui/src/api.ts`
- `packages/ui/src/styles/*`
- new workspace UI components
- tests, if the repo has a practical UI test surface

## Acceptance Criteria

- Opening the local app shows a workspace shell instead of the old review-only frame.
- Workstreams from the current repository state appear in the left rail.
- Selecting a workstream loads its overview data.
- Selecting a slice updates the right inspector.
- Clicking "Make active" updates active slice state and reflects the active marker in the UI.
- No state is mutated by simply selecting workstreams or slices.
- Existing review functionality is not removed; it may remain accessible through the old route/component shape until slice 45 moves it into the inspector.
- Empty states are understandable and do not instruct users to inspect external state folders manually.

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

Then open the browser app in a repository with at least one workstream and verify workstream and slice selection.
