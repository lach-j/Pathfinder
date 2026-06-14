# AGENTS.md

## Area

`@pathfinder/local-server` owns Pathfinder's local-only HTTP interface and browser UI assets.

## Belongs Here

- Local HTTP server routing for browser/API clients.
- Local browser UI page shells, styles, and client scripts.
- Thin orchestration across `@pathfinder/state` and `@pathfinder/git` for UI/API requests.
- UI-facing response shapes that are reusable by future local views.

## Does Not Belong Here

- CLI argument parsing or terminal formatting.
- Pure domain business logic.
- Filesystem state formats.
- Git process implementation.
- Hosted backend assumptions, authentication, billing, sync, organisations, or roles.

## Dependency Rules

Local server may depend on `@pathfinder/core`, `@pathfinder/git`, and `@pathfinder/state`. It must not depend on `@pathfinder/cli`.

## Contribution Pattern

Keep server routing focused and move browser assets into `src/<view>/` modules. When UI behavior grows, prefer adding a view-specific folder before expanding `review-server.ts`.

