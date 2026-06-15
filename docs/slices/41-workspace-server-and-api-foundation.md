# Slice 41: Workspace Server And API Foundation

Status: ready

## Goal

Introduce the workspace server entry point and read APIs for the current repository workspace.

## Reason

The browser app is currently launched through:

```bash
pathfinder review serve
```

That name no longer matches the product shape. Review is now one part of a broader local workspace that should help users inspect workstreams, slices, plans, evidence, feedback, and PR drafts from the repository they are working in.

This slice creates the server/API foundation for that workspace without redesigning the UI yet.

## Requirements

- Add a new primary command:

```bash
pathfinder workspace serve [--port 4783]
```

- Keep this existing command working as a compatibility alias:

```bash
pathfinder review serve [--port 4783]
```

- The two commands should start the same local-only browser server.
- Keep the default host and port behavior consistent with the current review server.
- Rename or wrap local-server exports around workspace naming where it improves clarity, while preserving existing public exports needed by tests or compatibility.
- Add workspace-oriented read endpoints:

```http
GET /api/workspace
GET /api/workstreams
GET /api/workstreams/:workstreamId/overview
```

- `GET /api/workspace` should return compact current-repository workspace context:
  - project
  - current active workstream, if any
  - current active slice, if any
  - all workstreams
  - state mode or state-root location only if that information already exists in reusable state APIs and can be exposed without leaking unnecessary filesystem detail
- `GET /api/workstreams/:workstreamId/overview` should return all read data needed for the first workspace UI:
  - workstream
  - requirements markdown and path, where available
  - plan markdown and path, where available
  - slices
  - comments
  - review sessions
  - reviews, if already available through the store
  - evidence
  - stored PR draft markdown and path
- Add a read-only store method for the stored PR draft.
- Reading the PR draft must read existing `pr.md` only. It must not call `generatePrMarkdown`, must not update `pr.md`, and must not otherwise mutate state.
- Add an explicit active-slice mutation endpoint:

```http
POST /api/workstreams/:workstreamId/slices/:sliceId/active
```

- The active-slice endpoint should reuse existing store validation and return the updated active slice context.
- Existing review endpoints used by the current UI must remain compatible.
- Error responses should stay JSON and local-server style.

## Technical Notes

- Keep UI-facing response shapes in `@pathfinder/local-server`; do not make the browser import `@pathfinder/state`, `@pathfinder/git`, or `@pathfinder/cli`.
- Local server may orchestrate `PathfinderStore` and `GitAdapter`, but business rules should stay in reusable packages.
- The overview endpoint is intentionally read-heavy so later UI slices can avoid many small round trips.
- Do not add a global project browser in this slice. Scope is the current Git repository and whichever repo-local or external Pathfinder state resolves for it.
- Do not add authentication, hosted backend assumptions, cloud sync, external APIs, MCP, or agent launching.
- Do not redesign the React app in this slice except where needed for type compatibility or smoke testing.

## Likely Files

- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/local-server/src/review-server.ts`
- `packages/local-server/src/index.ts`
- `packages/state/src/store.ts`
- tests
- `README.md`

## Acceptance Criteria

- `pathfinder workspace serve --port <port>` starts the local browser server.
- `pathfinder review serve --port <port>` still starts the same server.
- Help output lists `pathfinder workspace serve [--port 4783]`.
- Existing review server API tests still pass.
- `GET /api/workspace` returns project/workstream context for a repository with Pathfinder state.
- `GET /api/workstreams/:workstreamId/overview` returns requirements, plan, slices, comments, review sessions, reviews, evidence, and stored PR draft fields.
- Reading stored PR markdown does not modify `pr.md`.
- `POST /api/workstreams/:workstreamId/slices/:sliceId/active` updates active workstream and active slice using existing validation.
- JSON errors remain clear when Pathfinder state is missing.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder workspace serve --port 4783
pathfinder review serve --port 4783
pathfinder help
```

