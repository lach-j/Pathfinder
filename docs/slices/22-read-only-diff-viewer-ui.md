# Slice 22: Read-Only Diff Viewer UI

Status: ready

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
