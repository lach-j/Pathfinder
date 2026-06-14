# AGENTS.md

## Area

`@pathfinder/state` owns local Pathfinder state under `.pathfinder/`.

## Belongs Here

- Filesystem layout and path resolution.
- Reading and writing human-readable JSON and markdown state.
- The `PathfinderStore` facade used by CLI and future UI/API layers.
- State orchestration that combines persisted entities with pure core logic.
- Managed writes for repository agent instructions and native command wrappers.
- External or personal state resolution when a slice asks for state outside the target repository.

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

## Local Map

- `src/store.ts`: high-level state facade and command-oriented orchestration.
- `src/json-file.ts`: shared JSON read/write helpers with stable formatting.
- `src/file-system.ts`: small filesystem predicates.
- `src/git-root.ts`: repository root discovery.
- `src/slice-dependencies.ts`: state-layer validation that needs persisted slice context.

When adding a new persisted entity, define the structured type in `@pathfinder/core` when it is domain-level, then add state file read/write helpers here. Keep long-form content in markdown and structured collections in JSON.
