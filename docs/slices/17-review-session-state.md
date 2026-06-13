# Slice 17: Review Session State

Status: done

## Goal

Introduce explicit local review sessions that connect an active slice to a base ref, head ref, merge base, and changed files.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

Pathfinder currently has reviews and comments, but not a durable "I reviewed this diff against this base" object. A local diff viewer needs a stable review session so comments, refreshes, and agent feedback can refer to the same review pass.

## Scope

Implement:

```bash
pathfinder review start --base <base-ref>
pathfinder review sessions <workstream-id>
pathfinder review session <workstream-id> <session-id>
```

Expected behavior:

- Requires initialized state and an active slice.
- Uses local Git to resolve base, merge base, head ref, head commit, and changed files.
- Stores sessions under the active workstream in human-readable JSON.
- Associates each session with workstream id, active slice id, base ref, head ref, head commit, merge base, created time, and changed files.
- Prints a concise session summary.
- Does not replace the existing deterministic `review run` command.

Suggested state:

```text
.pathfinder/workstreams/<workstream-id>/review-sessions.json
```

## Out Of Scope

- No parsed hunks yet.
- No UI.
- No inline comments yet.
- No AI review.
- No GitHub/GitLab integration.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/git/src/index.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Starting a review session records durable local session state.
- Sessions can be listed and shown.
- Session ids are deterministic enough to be readable and unique enough to avoid collisions.
- Commands fail clearly when no active slice exists or the base ref is invalid.
- Tests cover session creation, listing, and missing active slice/base failures.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder review start --base main
npm exec -- pathfinder review sessions <workstream-id>
npm exec -- pathfinder review session <workstream-id> <session-id>
```

## Implementation Notes

- Added `ReviewSession` core state for durable local review passes.
- Added `.pathfinder/workstreams/<workstream-id>/review-sessions.json`.
- Added `pathfinder review start --base <base-ref>`, `pathfinder review sessions <workstream-id>`, and `pathfinder review session <workstream-id> <session-id>`.
- Reused the local Git summary metadata for base ref, head ref, head commit, merge base, and changed files.
- Left deterministic `pathfinder review run` behavior unchanged.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/17-review-session-state.md.

Current slice goal:
Add durable local review sessions that anchor an active slice to a base ref and changed-file summary.

Implement only this slice.

Do not build parsed hunks, UI, inline comments, AI review, MCP, GitHub/GitLab integration, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test review session creation/list/show.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
