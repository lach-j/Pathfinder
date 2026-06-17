# Workspace Repository Management Plan

## Scope

Build a fresh repository-management layer for the local workspace so the browser app is no longer bound to the folder where the local server process was launched. The first useful version should support explicit repository selection, recent projects, repository state detection, and UI-driven Pathfinder initialization for selected repos.

This workstream is about local project management, not remote Git hosting. It should make Pathfinder feel like one local workspace that can move between repositories while preserving repo-local and personal/external state semantics.

## Design Direction

### Repository selection model

The local server should keep a selected repository context. On startup, the selected repository defaults to the launch Git root when one exists. UI actions can switch the selected repository by submitting a local path. The server validates that path, resolves the Git root, stores it as the selected context for the current server session, and serves all workspace APIs against that repository context.

The UI should expose this through an "Open existing project" flow. Because normal browser folder pickers do not reliably provide an absolute path that a Node local server can use, the first implementation should make path entry and recent-project selection reliable. A folder-picker button can be added only if implemented through a local-server-capable mechanism; the design should not depend on a privacy-limited web directory handle.

### Known projects state

Known/recent repositories should be stored in Pathfinder external user state, not in every repository. Each record should be keyed by resolved Git root and include display name, path, last opened time, last observed state mode, and basic health/status metadata. This list is not a system-wide repo inventory; it is user-curated by opening repos.

### State resolution

The existing state resolution behavior remains authoritative. For a selected Git root, the local server should ask reusable state APIs whether Pathfinder is initialized and where state resolves. The UI should receive a compact status instead of learning internal state-root implementation details.

### Initialization flow

When the selected repo is a Git repo but has no Pathfinder state, the UI should show an init flow modeled on the CLI menu. It should support personal/external state and repo-local state, plus supported user/agent integration choices where available. Confirmation should call a local-server endpoint that reuses the same store initialization/bootstrap code as the CLI.

No init action should run just because the repo was selected. The user must confirm the mode and integrations before any `.pathfinder/`, AGENTS.md, or user-level instruction files are written.

## Architecture Notes

- `packages/state` should own reusable repository registry and state-resolution behavior.
- `packages/local-server` should own selected repository context and expose repository-management APIs.
- `packages/ui` should present project switching, recent projects, state status, and init flow through the local HTTP API only.
- `packages/core` can hold pure status/types if they are useful across state, server, and tests.
- The CLI should remain functional from the current working directory and should not need to know about the UI selected-repo session unless a future slice explicitly adds CLI controls for recent projects.

## Proposed API Shape

Initial local-server endpoints can be refined during implementation, but the workstream should cover this capability:

```http
GET /api/repositories/current
GET /api/repositories/recent
POST /api/repositories/open
POST /api/repositories/init
```

`POST /api/repositories/open` should accept a path, resolve and validate the Git root, update the selected repository context, update recent projects, and return the same workspace context shape currently returned by `GET /api/workspace`.

`POST /api/repositories/init` should initialize Pathfinder for the selected or supplied repository root using explicit options equivalent to the CLI init modes.

Existing workspace APIs should either operate against the selected repository context or accept an internal server context object that resolves the selected Git root consistently.

## Risks And Decisions

- Browser folder picker limitations are real. The plan should not promise a pure browser picker unless the server can receive an absolute local path safely.
- Multi-repo selection means server APIs must stop relying implicitly on process cwd. This should be done in a small foundation slice before UI polish.
- Personal/external state is the right place for recent repo metadata, but uninitialized users may not have external state yet. The first slice should define where a minimal user-level registry can live without forcing target repo writes.
- UI init can accidentally become too powerful. The implementation must make file-writing choices explicit and preview consequences before confirmation.
- This workstream should not scan the whole disk for repos. A later optional discovery/import slice can be proposed separately if needed.

## Slice Sequence

1. Repository context and registry foundation.
2. Repository-aware workspace API routing.
3. Open existing project UI and recent projects.
4. Uninitialized repository init flow.
5. Repository status polish and guardrails.

## Checks

Each implementation slice should run:

```bash
npm run typecheck
npm test
npm run lint --if-present
```

UI slices should also run:

```bash
npm run build
pathfinder workspace serve --port 4783
```

Manual smoke tests should cover opening an initialized repo, an uninitialized Git repo, a non-Git folder, and switching back to the launch repo.
