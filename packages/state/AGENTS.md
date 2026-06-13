# AGENTS.md

## Area

`@pathfinder/state` owns local Pathfinder state under `.pathfinder/`.

## Belongs Here

- Filesystem layout and path resolution.
- Reading and writing human-readable JSON and markdown state.
- The `PathfinderStore` facade used by CLI and future UI/API layers.
- State orchestration that combines persisted entities with pure core logic.

## Does Not Belong Here

- Git command execution.
- CLI argument parsing or terminal formatting.
- UI state ownership.
- Business rules that can be pure `@pathfinder/core` functions.
- Hosted backend, auth, sync, roles, or external API assumptions.

## Dependency Rules

State may depend on `@pathfinder/core`. It must not depend on `@pathfinder/git` or `@pathfinder/cli`.

## Contribution Pattern

Keep `PathfinderStore` as the public facade. Add reusable persistence helpers to focused files such as `json-file.ts`, `git-root.ts`, or domain-specific modules before growing `store.ts`.

Preserve existing user state files unless a command clearly implies overwriting them.
