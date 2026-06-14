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

## Local Map

- `src/App.tsx`: top-level review workflow state, API loading, and page composition.
- `src/api.ts`: browser HTTP helper.
- `src/types.ts`: UI-facing copies of API response shapes.
- `src/review/`: review-specific components and pure UI model helpers.
- `src/styles/`: stylesheet files.

When UI logic becomes independent of React rendering, put it in a plain helper such as `src/review/review-model.ts` and test it through component or higher-level behavior where practical.

Use the local server API as the boundary. If the UI needs new data, add or adjust the local-server response rather than importing Node/state/git code into the browser app.
