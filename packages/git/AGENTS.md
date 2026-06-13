# AGENTS.md

## Area

`@pathfinder/git` is the local Git adapter layer.

## Belongs Here

- Running local `git` commands.
- Translating Git failures into `PathfinderError`.
- Returning raw Git output for higher layers.
- Parsing Git-specific command output such as `--name-status`.

## Does Not Belong Here

- Pathfinder filesystem state.
- CLI output formatting.
- Review business rules.
- UI behavior.
- GitHub/GitLab API calls.

## Dependency Rules

Git may depend on `@pathfinder/core`. It must not depend on `@pathfinder/state` or `@pathfinder/cli`.

## Contribution Pattern

Keep process execution in `src/adapter.ts`. Put standalone parsers beside it, such as `src/name-status.ts` and future raw diff helpers when they are Git-specific.

If a parser becomes reusable by CLI, UI, and review comments, prefer moving the pure model/parser into `@pathfinder/core` and let this package supply the raw Git text.
