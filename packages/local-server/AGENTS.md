# AGENTS.md

## Area

`@pathfinder/local-server` owns Pathfinder's local-only HTTP interface and serves built browser UI assets.

## Belongs Here

- Local HTTP server routing for browser/API clients.
- Static serving for built browser UI assets.
- Thin orchestration across `@pathfinder/state` and `@pathfinder/git` for UI/API requests.
- UI-facing response shapes that are reusable by future local views.

## Does Not Belong Here

- CLI argument parsing or terminal formatting.
- Pure domain business logic.
- Filesystem state formats.
- Git process implementation.
- Browser UI source code.
- Hosted backend assumptions, authentication, billing, sync, organisations, or roles.

## Dependency Rules

Local server may depend on `@pathfinder/core`, `@pathfinder/git`, and `@pathfinder/state`. It must not depend on `@pathfinder/cli`.

## Contribution Pattern

Keep server routing focused. Browser UI source belongs in `@pathfinder/ui`; this package should expose local API routes and serve the built UI bundle.
