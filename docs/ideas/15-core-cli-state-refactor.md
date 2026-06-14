# Core CLI State Refactor

Status: idea

## Summary

Refactor large command and state modules into smaller internal units while preserving the public CLI, package boundaries, and local state behavior.

## Gap

The architecture is sound, but some files are becoming coordination hubs:

- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/formatters.ts`

These files still work, but future features such as MCP, check runs, feedback runs, workspace UI endpoints, and state validation will make them harder to maintain unless command routing and store internals are split.

## Assumptions

- This should be a behavior-preserving refactor.
- Public package exports should remain stable unless a slice explicitly changes them.
- Tests should prove CLI output and state behavior remain unchanged.
- Refactor only after or alongside a concrete feature that benefits from it.

## Refactor Targets

CLI command routing:

```text
packages/cli/src/commands/agent.ts
packages/cli/src/commands/comment.ts
packages/cli/src/commands/review.ts
packages/cli/src/commands/slice.ts
packages/cli/src/commands/pr.ts
packages/cli/src/commands/state.ts
```

State internals:

```text
packages/state/src/workstreams.ts
packages/state/src/slices.ts
packages/state/src/comments.ts
packages/state/src/reviews.ts
packages/state/src/evidence.ts
packages/state/src/agent.ts
packages/state/src/state-paths.ts
```

Formatting:

```text
packages/cli/src/formatters/agent.ts
packages/cli/src/formatters/review.ts
packages/cli/src/formatters/workstream.ts
```

## Requirements

- Preserve the `PathfinderStore` facade for callers.
- Move command implementations into focused modules with explicit dependencies.
- Keep option parsing centralized or replace it with a small internal command registry.
- Keep user-facing output stable.
- Add architecture tests that prevent new reverse dependencies.
- Keep docs and help output accurate.

## Out Of Scope

- No dependency-heavy CLI framework unless it clearly pays for itself.
- No behavior changes disguised as refactor.
- No state schema change unless required by another approved slice.
- No codegen command system.

## Later Slice Candidates

- Split CLI commands by area.
- Split CLI formatters by area.
- Split `PathfinderStore` internals while keeping the facade.
- Add command registry metadata for help text and tests.
- Add endpoint response model sharing between local server and UI.

