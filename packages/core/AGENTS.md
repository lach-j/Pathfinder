# AGENTS.md

## Area

`@pathfinder/core` contains platform-independent domain types and pure business logic.

## Belongs Here

- Domain models and enums.
- Validation that does not read files or run processes.
- ID and timestamp helpers.
- Planning parsers.
- Review models and deterministic review rules.
- PR markdown assembly.
- Future structured diff models and pure diff parsing.

## Does Not Belong Here

- Filesystem persistence.
- Git process execution.
- CLI argument parsing or terminal formatting.
- UI rendering.
- External APIs or hosted assumptions.

## Dependency Rules

Core production code should only import relative core modules. It should not import Node built-ins or other `@pathfinder/*` packages.

## Contribution Pattern

Keep `src/index.ts` as a public barrel. Add implementation to focused modules such as `src/review/`, `src/pr/`, or `src/planning/`, then re-export stable public APIs from `src/index.ts`.

Add tests for core behavior close to the public behavior being changed.
