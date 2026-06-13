# Slice 24: Review Refresh And Stale Comments

Status: done

## Goal

Support the repeat-review loop after an agent changes code in response to feedback.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/17-review-session-state.md`
- `docs/slices/19-inline-comment-anchors.md`
- `docs/slices/20-feedback-queue-export.md`
- `docs/slices/23-inline-commenting-ui.md`
- This file

## Product Context

The core workflow repeats: review, comment, agent fixes, review again. Pathfinder needs a safe way to refresh review sessions while preserving existing feedback.

## Scope

Implement:

```bash
pathfinder review refresh <workstream-id> <session-id>
```

Expected behavior:

- Re-reads the current diff for the session base ref.
- Updates session head ref, head commit, merge base, changed files, and refreshed timestamp.
- Preserves comments.
- Marks line comments as `current`, `stale`, or `unknown` depending on whether their file and line anchor still appears in the refreshed structured diff.
- Shows stale/unknown markers in CLI and UI comment output.
- Does not auto-resolve comments.

## Out Of Scope

- No fuzzy line remapping.
- No automatic comment resolution.
- No agent invocation.
- No AI review.
- No GitHub/GitLab sync.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- UI/static assets from slices 22-23
- `README.md`

## Acceptance Criteria

- Review sessions can be refreshed after new commits or working tree changes according to the existing diff mode.
- Existing comments remain intact.
- Comments with missing anchors are visibly marked stale or unknown.
- UI and CLI expose stale state clearly.
- Tests cover refresh with unchanged anchors, removed files, and removed lines.

## Open Product Questions

- Should refresh compare committed changes only, or include working tree changes?

Recommendation for this slice: match the session's original mode. If the session was created from a base ref against `HEAD`, refresh against `HEAD`; add working tree review later if needed.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder review refresh <workstream-id> <session-id>
npm exec -- pathfinder comment list <workstream-id> --session <session-id> --open
```

## Implementation Notes

- Added `pathfinder review refresh <workstream-id> <session-id>`.
- Refresh reuses the stored session base ref and compares the current committed `HEAD` against the new merge base.
- Review sessions now store `refreshedAt` after refresh.
- Existing comments are preserved and session file/line comments receive an `anchorStatus` of `current`, `stale`, or `unknown`.
- CLI comment output shows `anchor:<status>` when a comment has been assessed.
- The local review server exposes `POST /api/workstreams/:id/review-sessions/:sessionId/refresh`.
- The browser review UI has a Refresh button and displays anchor status badges on comments.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke tested:

```bash
npm exec -- pathfinder review refresh inventory-alerts review-add-report
npm exec -- pathfinder comment list inventory-alerts --session review-add-report --open
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/17-review-session-state.md, docs/slices/19-inline-comment-anchors.md, docs/slices/20-feedback-queue-export.md, docs/slices/23-inline-commenting-ui.md, and docs/slices/24-review-refresh-and-stale-comments.md.

Current slice goal:
Allow review sessions to refresh after agent changes while preserving comments and marking stale anchors.

Implement only this slice.

Do not add fuzzy line remapping, automatic comment resolution, agent invocation, AI review, MCP, GitHub/GitLab sync, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test review refresh and stale comment output.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
