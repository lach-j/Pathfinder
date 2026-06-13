# Slice 22: Read-Only Diff Viewer UI

Status: done

## Goal

Build the first local browser UI for reviewing a Pathfinder diff session.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/21-local-review-server.md`
- This file

## Product Context

This is the first visible step toward the Bitbucket/GitHub-style local diff viewer. It should prioritize review clarity over project-management screens.

## Scope

Extend the local review server to serve a read-only diff viewer.

The first screen should show:

- Active workstream and active slice.
- Review session selector.
- Changed-file list with status and simple stats.
- Unified diff view for the selected file.
- Clear old/new line numbers and added/deleted/context styling.
- Existing comments shown in the right place if inline comment anchors exist.
- Empty states for no active slice, no session, or no diff.

## Out Of Scope

- No adding comments from the UI yet.
- No resolving comments from the UI yet.
- No side-by-side diff unless it is trivial after unified diff.
- No auth.
- No hosted backend.
- No AI review.
- No external API calls.

## Likely Files

- `packages/cli/src/index.ts`
- New UI/static assets under a package or `packages/cli/src/ui/`
- `README.md`

## Acceptance Criteria

- `pathfinder review serve` opens or serves a usable read-only diff viewer.
- The UI is local-first and uses the server endpoints from slice 21.
- File selection updates the displayed diff without a page reload.
- Diff layout is readable on desktop and usable on narrow screens.
- Existing comments display near their target when target data is present.
- Browser smoke testing verifies that the page renders with a real local session.

## Open Product Questions

- Should the UI be dependency-light static HTML/CSS/JS, or should Pathfinder add a frontend toolchain such as Vite?
- Should the first UI auto-open the browser, or just print the local URL?

Recommendation for this slice: keep the first UI dependency-light and print the URL; add a frontend toolchain only if the next commenting UI becomes painful.

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

Open:

```text
http://127.0.0.1:4783
```

## Implementation Notes

- Replaced the local review server placeholder page with a dependency-light static browser app served at `/`.
- The viewer uses the existing slice 21 JSON endpoints for current context, review sessions, structured diffs, and comments.
- Added active workstream/slice display, review session selection, changed-file navigation, unified diff rendering, old/new line numbers, line styling, and in-place display for existing file and line comments.
- Added empty states for missing active workstream, missing active slice, missing review sessions, and empty diffs.
- Kept comment creation/resolution, auth, hosted backend behavior, AI review, MCP, remote Git hosting integrations, and external APIs out of scope.
- Documented the read-only viewer in `README.md`.

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

Verified `http://127.0.0.1:4783` rendered the active workstream, active slice,
review session selector, changed-file list, unified diff, and an existing inline
comment on desktop and a narrow viewport.

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/21-local-review-server.md, and docs/slices/22-read-only-diff-viewer-ui.md.

Current slice goal:
Build a local read-only browser diff viewer served by Pathfinder.

Implement only this slice.

Do not add UI comment creation/resolution, hosted backend, auth, AI review, MCP, GitHub/GitLab integration, external APIs, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test the local UI in a browser.

Summarise changed files, checks run, manual verification commands, screenshots if useful, and any follow-up decisions needed.
```
