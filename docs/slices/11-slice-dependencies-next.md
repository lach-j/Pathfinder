# Slice 11: Slice Dependencies And Next Selection

Status: done

## Implementation Summary

- Added optional `dependsOnSliceIds` metadata to slices.
- Added dependency validation for creation and post-creation updates.
- Added `pathfinder slice depend` and `pathfinder slice next`.
- Included dependencies in slice output.
- Documented dependency-aware workflow in `README.md`.

## Checks Run

- `npm run typecheck`
- `npm test`
- `npm run lint --if-present`
- `npm run build`

## Smoke Test

```bash
npm exec -- pathfinder init
npm exec -- pathfinder workstream create --title "Inventory alerts"
npm exec -- pathfinder slice add inventory-alerts --title "Add data source" --description "Create local inventory data."
npm exec -- pathfinder slice add inventory-alerts --title "Add report" --description "Report reorder candidates." --depends-on add-data-source
npm exec -- pathfinder slice next inventory-alerts
npm exec -- pathfinder slice status inventory-alerts add-data-source complete
npm exec -- pathfinder slice next inventory-alerts
```

## Goal

Let slices express simple local dependencies and add a command that selects the next ready slice.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

The workflow breaks work into reviewable slices. After slice branching landed, the next missing piece is dependency-aware selection: slice B can depend on slice A being complete, and Pathfinder can identify the next actionable slice.

## Scope

Extend slice state with optional dependency metadata:

```ts
dependsOnSliceIds?: string[];
```

Add or update CLI behavior:

```bash
pathfinder slice add <workstream-id> --title "..." --description "..." [--depends-on <slice-id>]
pathfinder slice depend <workstream-id> <slice-id> <dependency-slice-id>
pathfinder slice next <workstream-id>
```

Expected behavior:

- `--depends-on` may be supplied multiple times if the CLI parser can support that simply. If not, support one dependency in this slice and document the limitation.
- `slice depend` adds a dependency after creation.
- Dependencies must point to existing slices in the same workstream.
- A slice cannot depend on itself.
- Prevent obvious duplicate dependencies.
- `slice next` returns the first actionable slice:
  - status is `proposed` or `ready`
  - all dependency slices are `complete`
  - ordered by creation time
- If no slice is actionable, print a useful empty-state message.

## Out Of Scope

- No graph visualisation.
- No cross-workstream dependencies.
- No remote branch or PR behavior.
- No automatic branch creation in `slice next`; it may suggest the branch command if useful.
- No UI.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Slice dependencies are persisted in `slices.json`.
- Dependencies appear in `slice list` or `slice show-active` output where useful.
- `slice next` skips blocked slices and returns the correct next actionable slice.
- Tests cover dependencies, self-dependency rejection, missing dependency rejection, duplicate prevention, and next selection.
- README documents a dependency-aware slice workflow.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder init
npm exec -- pathfinder workstream create --title "Inventory alerts"
npm exec -- pathfinder slice add inventory-alerts --title "Add data source" --description "Create local inventory data."
npm exec -- pathfinder slice add inventory-alerts --title "Add report" --description "Report reorder candidates." --depends-on add-data-source
npm exec -- pathfinder slice next inventory-alerts
npm exec -- pathfinder slice status inventory-alerts add-data-source complete
npm exec -- pathfinder slice next inventory-alerts
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/11-slice-dependencies-next.md.

Current slice goal:
Add simple same-workstream slice dependencies and pathfinder slice next.

Implement only this slice.

Do not build graph visualisation, cross-workstream dependencies, UI, MCP, AI behavior, GitHub/GitLab integration, remote pushes, or external APIs.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test dependency-aware next selection.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
