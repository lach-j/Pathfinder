# Slice 21: Local Review Server

Status: done

## Goal

Add a local-only HTTP server that exposes Pathfinder review state and structured diffs to a browser UI.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/17-review-session-state.md`
- `docs/slices/18-structured-diff-model.md`
- `docs/slices/19-inline-comment-anchors.md`
- This file

## Product Context

The UI must not own business logic. Before building screens, Pathfinder needs a small local API over the existing state, Git, and comment operations.

## Scope

Implement:

```bash
pathfinder review serve [--port 4783]
```

Expected behavior:

- Starts a local server bound to `127.0.0.1` by default.
- Serves JSON endpoints for current context, workstreams, sessions, structured diff, comments, and feedback export preview.
- Allows adding and resolving comments through local endpoints.
- Serves a placeholder HTML page that confirms the server is running.
- Uses existing core/state/git APIs for business logic.
- Does not require authentication because it is local-only and single-user.

Suggested endpoints:

```text
GET /api/current
GET /api/workstreams
GET /api/workstreams/:id/review-sessions
GET /api/workstreams/:id/review-sessions/:sessionId/diff
GET /api/workstreams/:id/comments?session=<session-id>
POST /api/workstreams/:id/comments
POST /api/workstreams/:id/comments/:commentId/resolve
GET /api/workstreams/:id/feedback?session=<session-id>
```

## Out Of Scope

- No production server.
- No hosted backend.
- No auth.
- No external API calls.
- No UI beyond a server-running placeholder.
- No WebSockets.

## Likely Files

- `packages/core/src/index.ts`
- `packages/state/src/index.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- `pathfinder review serve` starts a local server and prints the URL.
- JSON endpoints return useful errors with non-2xx status codes when state is missing.
- Comment add/resolve endpoints reuse the same validation as CLI commands.
- Tests cover request handling where practical without relying on a long-running server.
- README documents that this is local-only and not a hosted backend.

## Open Product Questions

- Should the server use only Node built-ins first, or introduce a tiny web framework?
- Should the default port be `4783`, or do you prefer another memorable Pathfinder port?

Recommendation for this slice: use Node built-ins first to avoid a dependency before the UI proves what it needs.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder review serve --port 4783
```

Then open:

```text
http://127.0.0.1:4783
```

## Implementation Notes

- Added `pathfinder review serve [--port 4783]`.
- Added a Node built-in HTTP server bound to `127.0.0.1` by default.
- Added a placeholder HTML page at `/`.
- Added JSON endpoints for current context, workstreams, review sessions, structured session diffs, comments, comment resolution, and feedback queue preview.
- Reused `PathfinderStore` and `GitAdapter` for state, diff, comment validation, and feedback export behavior.
- Kept the server local-only with no auth, hosted backend, WebSockets, external API calls, or full UI.
- Documented the local-only review server and endpoint surface in `README.md`.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke tested the built CLI server:

```bash
node packages/cli/dist/index.js review serve --port 4783
Invoke-WebRequest http://127.0.0.1:4783
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/17-review-session-state.md, docs/slices/18-structured-diff-model.md, docs/slices/19-inline-comment-anchors.md, and docs/slices/21-local-review-server.md.

Current slice goal:
Add a local-only HTTP server that exposes Pathfinder review state, structured diffs, comments, and feedback preview.

Implement only this slice.

Do not build the full UI, hosted backend, auth, WebSockets, MCP, AI review, GitHub/GitLab integration, external APIs, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test the local server.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
