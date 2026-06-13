# Slice 23: Inline Commenting UI

Status: done

## Goal

Allow the developer to add and resolve Pathfinder review comments directly from the local diff viewer.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/19-inline-comment-anchors.md`
- `docs/slices/21-local-review-server.md`
- `docs/slices/22-read-only-diff-viewer-ui.md`
- This file

## Product Context

The UI becomes valuable when the developer can review like they would in GitHub or Bitbucket: click a line, write feedback, and leave it for the next agent pass.

## Scope

Extend the diff viewer UI:

- Add a comment button or affordance on reviewable diff lines.
- Add file-level comment support.
- Save comments through the local API.
- Display open and resolved comments.
- Resolve comments from the UI.
- Filter comments by open/resolved/all.
- Keep the UI responsive after add/resolve without restarting the server.

## Out Of Scope

- No threaded replies.
- No comment editing.
- No stale-line remapping.
- No batch agent execution.
- No auth.
- No hosted backend.
- No AI review.

## Likely Files

- UI/static assets from slice 22
- `packages/cli/src/index.ts` or local server handlers if endpoint changes are needed
- `packages/state/src/index.ts` only if server needs missing comment operations
- `README.md`

## Acceptance Criteria

- User can add an inline line comment from the diff UI.
- User can add a file-level comment from the diff UI.
- User can resolve a comment from the diff UI.
- Comment state persists in `.pathfinder`.
- CLI `comment list` reflects comments created in the UI.
- Browser smoke testing covers add and resolve.

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
npm exec -- pathfinder comment list <workstream-id> --session <session-id>
```

## Implementation Notes

- Added file-level and line-level comment creation controls to the local diff viewer.
- Added per-line comment affordances on reviewable diff rows, with inline forms that save through the existing local comment API.
- Added resolve buttons for open comments and live comment refresh after add/resolve without restarting the server.
- Added all/open/resolved comment filtering in the browser while still fetching persisted local state from `.pathfinder/`.
- Kept the implementation dependency-light inside the local review server UI; no auth, hosted backend, external APIs, AI review, threaded replies, editing, or stale remapping were added.
- Updated README documentation and server regression coverage for the new browser controls.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Browser smoke tested with a disposable local Git repository and real review session:

```bash
npm exec -- pathfinder review serve --port 4783
```

Verified `http://127.0.0.1:4783` can add an inline line comment, add a file-level
comment, resolve a comment, filter comments, and reflect the resulting comments
through:

```bash
npm exec -- pathfinder comment list inventory-alerts --session review-add-report
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/19-inline-comment-anchors.md, docs/slices/21-local-review-server.md, docs/slices/22-read-only-diff-viewer-ui.md, and docs/slices/23-inline-commenting-ui.md.

Current slice goal:
Add inline comment creation and resolution to the local diff viewer.

Implement only this slice.

Do not add threaded replies, comment editing, stale-line remapping, batch agent execution, hosted backend, auth, AI review, MCP, GitHub/GitLab integration, external APIs, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test UI add/resolve and CLI comment list.

Summarise changed files, checks run, manual verification commands, screenshots if useful, and any follow-up decisions needed.
```
