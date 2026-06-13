# Slice 19: Inline Comment Anchors

Status: ready

## Goal

Extend review comments so they can target files and changed lines in a review session.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/17-review-session-state.md`
- `docs/slices/18-structured-diff-model.md`
- This file

## Product Context

Pathfinder currently supports slice-level comments. The core product needs GitHub/Bitbucket-style inline feedback anchored to local diff lines.

## Scope

Extend comment state with optional targets:

```text
slice
file
line
workstream
```

Implement CLI support:

```bash
pathfinder comment add <workstream-id> --slice <slice-id> --body "..."
pathfinder comment add <workstream-id> --session <session-id> --file <path> --line <line-number> --side new --body "..."
pathfinder comment add <workstream-id> --session <session-id> --file <path> --body "..."
pathfinder comment list <workstream-id> [--session <session-id>] [--open]
pathfinder comment resolve <workstream-id> <comment-id>
```

Expected behavior:

- Existing slice-level comments keep working.
- Inline comments validate that the review session exists.
- Line comments validate that the file appears in the session diff.
- Prefer validating line numbers against the parsed diff if slice 18 is complete.
- List output includes target information in a readable format.

## Out Of Scope

- No UI.
- No threaded replies.
- No stale-line remapping.
- No AI review.
- No GitHub/GitLab sync.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Slice-level comments remain backward compatible.
- File-level and line-level comments can be added and listed.
- Invalid session ids and files fail clearly.
- Resolved comments retain their original target.
- Tests cover all target types and existing command compatibility.

## Open Product Questions

- Should comments support replies in MVP, or only one flat comment per feedback item?
- Should `side` be `old/new` or `left/right` in the stored model?

Recommendation for this slice: keep comments flat and use `old/new`, because it maps directly to Git line numbers.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder comment add <workstream-id> --session <session-id> --file packages/example.ts --line 12 --side new --body "Handle the empty case."
npm exec -- pathfinder comment list <workstream-id> --session <session-id> --open
npm exec -- pathfinder comment resolve <workstream-id> <comment-id>
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/17-review-session-state.md, docs/slices/18-structured-diff-model.md, and docs/slices/19-inline-comment-anchors.md.

Current slice goal:
Add file and line targets to local review comments while preserving existing slice-level comments.

Implement only this slice.

Do not build UI, threaded replies, stale-line remapping, AI review, MCP, GitHub/GitLab integration, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test inline comment add/list/resolve.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
