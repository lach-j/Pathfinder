# Slice 18: Structured Diff Model

Status: done

## Goal

Parse local Git diffs into a reusable structured model for CLI, UI, and inline comment anchors.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/17-review-session-state.md`
- This file

## Product Context

The diff viewer cannot be built on raw `git diff` text alone. Pathfinder needs a typed diff model with files, hunks, line numbers, and stable anchor information.

## Scope

Add a structured diff model and parser for unified diffs.

Implement:

```bash
pathfinder diff show --base <base-ref> [--json]
pathfinder diff show --session <session-id> [--json]
```

Expected behavior:

- Uses local Git only.
- Parses file headers, change status, hunks, context lines, additions, and deletions.
- Tracks old and new line numbers where available.
- Preserves raw line text without semantic analysis.
- Supports renamed files well enough to display old and new paths.
- `--json` prints the structured model for future UI/API use.
- Non-JSON output remains human-readable.

## Out Of Scope

- No side-by-side rendering.
- No syntax highlighting.
- No inline comments.
- No UI.
- No AI analysis.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/git/src/index.ts`
- `packages/git/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Parser handles added, modified, deleted, and renamed files from representative unified diff fixtures.
- Parser records hunk headers and old/new line numbers for additions, deletions, and context lines.
- CLI can print structured JSON for a base ref or review session.
- Tests cover parser behavior without requiring live Git where practical.
- Existing `pathfinder git diff` behavior remains unchanged.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder diff show --base main
npm exec -- pathfinder diff show --base main --json
```

## Implementation Notes

- Added a reusable structured diff model and unified diff parser in `@pathfinder/core`.
- Added Git adapter helpers that parse committed diffs for a base ref or stored review-session range.
- Added `pathfinder diff show --base <base-ref> [--json]`.
- Added `pathfinder diff show --session <session-id> [--json]`.
- Human output prints files, hunks, old/new line numbers, and raw line text.
- JSON output exposes the structured model for future UI/API reuse.
- Existing `pathfinder git diff` behavior remains unchanged.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/17-review-session-state.md, and docs/slices/18-structured-diff-model.md.

Current slice goal:
Add a typed structured diff model and CLI output for local diffs.

Implement only this slice.

Do not build UI, inline comments, AI review, MCP, GitHub/GitLab integration, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test structured diff output.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
