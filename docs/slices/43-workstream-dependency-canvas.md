# Slice 43: Workstream Dependency Canvas

Status: done

## Goal

Add the central dependency canvas for workstream slices.

## Reason

The main workspace should make the workstream structure visible at a glance. Users should be able to see which slices exist, which slice is active, which slices are complete or in review, and which slices depend on earlier work without reading `slices.json` or CLI output.

This slice turns the center workspace area into a visual map of the selected workstream.

## Requirements

- Add a focused graph/canvas dependency, preferably:

```text
@xyflow/react
```

- Render one dependency canvas for the selected workstream.
- Render each slice as a node.
- Render each `dependsOnSliceIds` relationship as an edge.
- Node content should include:
  - slice title
  - slice id
  - status
  - active marker when it is the active slice
  - branch name, if present
  - base ref, if present
  - open comment count
  - review session count
  - evidence count
- Node styling should make statuses scannable without relying only on color.
- Clicking a node should select that slice and update the right inspector from slice 42.
- The graph should use deterministic layout so it does not rearrange unpredictably between reloads.
- Layout should be dependency-aware:
  - dependency-free slices appear in the first column or lane
  - dependent slices appear after their dependencies
  - independent slices can appear in parallel lanes
- Add pan and zoom controls.
- Add a minimap if supported by the selected graph library.
- Detect invalid dependency references and cycles before rendering misleading edges.
- Invalid dependency state should show a visible warning in the canvas area.
- The canvas should handle an empty slice list with a useful empty state.

## Technical Notes

- Keep dependency validation and graph derivation as small pure UI helpers unless reusable domain behavior already exists.
- Do not mutate slice dependencies in this slice. Dependency editing is out of scope.
- Do not add drag-and-drop persistence. Manual node movement can be disabled or local-only.
- Do not introduce server-side layout unless a clear need appears; the first version can compute layout in the browser from overview data.
- Keep the right inspector as the place for detailed slice previews and actions.
- Keep the UI usable on a laptop viewport. The canvas may scroll or zoom, but text and controls must not overlap.

## Likely Files

- `packages/ui/package.json`
- `packages/ui/src/workspace/*`
- `packages/ui/src/types.ts`
- `packages/ui/src/styles/*`
- tests or pure helper tests if practical

## Acceptance Criteria

- The selected workstream renders as a slice dependency graph.
- Nodes show title, id, status, active state, branch/base metadata when available, and related counts.
- Edges match `dependsOnSliceIds`.
- Clicking a node selects the slice and updates the inspector.
- Independent slices are visually parallel.
- Dependent slices appear after blockers.
- Invalid dependency references are reported visibly.
- The canvas includes pan/zoom controls and a minimap when supported.
- Empty workstreams show a polished empty state.

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

Verify a workstream with multiple dependent and independent slices renders correctly.
