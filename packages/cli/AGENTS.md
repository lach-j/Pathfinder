# AGENTS.md

## Area

`@pathfinder/cli` is the command-line interface for Pathfinder.

## Belongs Here

- CLI bootstrap and command routing.
- Argument parsing and usage errors.
- Terminal-oriented formatting.
- Calling `@pathfinder/state` and `@pathfinder/git` to perform user commands.

## Does Not Belong Here

- Domain business logic.
- Filesystem state formats.
- Git process implementation.
- UI or server behavior.

## Dependency Rules

CLI may depend on `@pathfinder/core`, `@pathfinder/git`, and `@pathfinder/state`. Other packages must not depend on CLI.

## Contribution Pattern

Keep `src/index.ts` as the executable bootstrap. Keep command flow in `src/app.ts`, shared option parsing in `src/options.ts`, help text in `src/help.ts`, and terminal output in `src/formatters.ts`.

When a command area grows, move it into a focused `src/commands/<area>.ts` module that receives dependencies explicitly and returns or prints the same output as before.

## Local Map

- `src/index.ts`: executable entrypoint and top-level error handling.
- `src/app.ts`: command dispatch and orchestration across store/git/server dependencies.
- `src/options.ts`: option parsing, required argument helpers, and usage errors.
- `src/formatters.ts`: terminal-oriented rendering.
- `src/help.ts`: help text; update the CLI test when commands change.
- `src/index.test.ts`: end-to-end CLI behavior tests using temporary repositories.

When adding or changing a command, update `help.ts`, add CLI coverage, and smoke test the command through `npm exec -- pathfinder ...` after a build.
