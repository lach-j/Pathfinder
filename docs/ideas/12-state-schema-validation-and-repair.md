# State Schema Validation And Repair

Status: idea

## Summary

Add explicit schema validation, migrations, backups, and repair tools for `.pathfinder/` state as the local data model grows.

## Gap

Pathfinder state is human-readable and simple, which is good. The current schema is still mostly implicit TypeScript types and ad hoc legacy handling. As features grow, users will need confidence that old `.pathfinder/` directories can be validated, migrated, and repaired without data loss.

## Assumptions

- Keep JSON and markdown as the default storage format.
- Avoid introducing SQLite until JSON state becomes a real constraint.
- Every migration should be local, deterministic, and reviewable.
- Repair commands should preserve original files with backups.
- Validation should be reusable by CLI, local server, MCP, and tests.

## Requirements

- Add schema versioning for workstream-level state files, not only `project.json`.
- Add validators for:
  - project
  - workstream
  - slices
  - comments
  - review sessions
  - reviews
  - evidence
  - future feedback runs and check runs
- Add `pathfinder state doctor`.
- Add `pathfinder state validate --json`.
- Add `pathfinder state migrate`.
- Create backups before mutating state during migration or repair.
- Detect dangling ids:
  - active workstream missing
  - active slice missing
  - comment target session missing
  - review session slice missing
  - evidence slice missing
  - dependency slice missing
- Add clear repair suggestions.

## Technical Refactor Opportunity

This work can also split the growing `PathfinderStore` facade into focused modules:

```text
workstreams-store.ts
slices-store.ts
comments-store.ts
review-sessions-store.ts
agent-store.ts
state-validation.ts
state-migrations.ts
```

The public facade can stay stable while internals become easier to maintain.

## Out Of Scope

- No hosted backup service.
- No cloud sync.
- No account identity.
- No automatic destructive repair.
- No database rewrite unless a later slice proves it is needed.

## Later Slice Candidates

- Add pure state validators in `@pathfinder/core` or `@pathfinder/state`.
- Add `pathfinder state validate --json`.
- Add dangling-reference diagnostics.
- Add backup and migration helpers.
- Split `PathfinderStore` into focused internal modules.
- Evaluate SQLite only after validation and migration pressure is clearer.

