# AGENTS.md

## Area

`@pathfinder/ui` owns Pathfinder's local browser application source.

## Belongs Here

- React components for local Pathfinder views.
- Browser-only API client code.
- CSS and static frontend assets.
- UI state for rendering and interactions.

## Does Not Belong Here

- Domain business logic.
- Filesystem persistence.
- Git process execution.
- CLI parsing or terminal formatting.
- Local HTTP route handlers.
- Hosted backend assumptions, authentication, billing, sync, organisations, or roles.

## Dependency Rules

UI should talk to Pathfinder through local HTTP endpoints. It should not import `@pathfinder/state`, `@pathfinder/git`, or `@pathfinder/cli`.

## Contribution Pattern

Prefer small components and feature folders over large page files. Keep CSS in normal stylesheet files, and keep API request helpers separate from rendering components.

