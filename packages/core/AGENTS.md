# AGENTS.md

## Area

`@pathfinder/core` contains platform-independent domain types and pure business logic.

## Belongs Here

- Domain models and enums.
- Validation that does not read files or run processes.
- ID and timestamp helpers.
- Planning parsers.
- Structured diff parsing and comment anchor classification.
- Review models and deterministic review rules.
- Agent next/prompt/command definitions that are pure string/data generation.
- Feedback queue markdown generation.
- PR markdown assembly.

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

## Local Map

- `src/domain.ts`: shared entity types and literal unions.
- `src/validation.ts`, `src/ids.ts`, `src/time.ts`: small pure helpers.
- `src/slices.ts`, `src/evidence.ts`, `src/repository.ts`: pure slice/evidence/repository behavior.
- `src/planning/`: markdown plan import/parsing.
- `src/diff/`: parse unified diffs into reviewable structures.
- `src/review/`: comment target helpers and deterministic review checks.
- `src/feedback/`: agent-actionable feedback markdown.
- `src/pr/`: PR markdown composition.
- `src/agent/`: deterministic agent state, prompts, and native command templates.

When behavior needs filesystem state, put only the pure decision or formatting function here and call it from `@pathfinder/state`.
