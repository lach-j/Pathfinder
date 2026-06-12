# Slice 01: Stage 1 Foundation

Status: done

## Goal

Create the initial TypeScript monorepo, local state model, filesystem persistence, and CLI foundation.

## Completed Scope

- Added `packages/core`, `packages/state`, and `packages/cli`.
- Added domain types for project, workstream, plan, slice/status, review comment, review, and evidence.
- Added filesystem persistence under `.pathfinder/`.
- Added CLI commands:
  - `pathfinder init`
  - `pathfinder workstream create --title "..."`
  - `pathfinder workstream list`
  - `pathfinder workstream show <id>`
  - `pathfinder plan set <workstream-id> --file ./plan.md`
  - `pathfinder plan show <workstream-id>`
  - `pathfinder slice add <workstream-id> --title "..." --description "..."`
  - `pathfinder slice list <workstream-id>`
  - `pathfinder slice active <workstream-id> <slice-id>`
  - `pathfinder slice show-active`
- Added unit tests for core and state behavior.
- Added Stage 1 README workflow.

## Verification

Run:

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
npm run build
npm exec -- pathfinder help
```

## Notes For Future Slices

Generated `dist/` files may currently exist in Git history. The repo hygiene slice should decide whether to keep them tracked or remove them.
