# Slice 03: Comments CLI

Status: ready

## Goal

Add local review comment management backed by each workstream's `comments.json`.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

Implement:

```bash
pathfinder comment add <workstream-id> --slice <slice-id> --body "..."
pathfinder comment list <workstream-id>
pathfinder comment resolve <workstream-id> <comment-id>
```

Expected behavior:

- Comments are stored in `.pathfinder/workstreams/<workstream-id>/comments.json`.
- `comment add` requires an existing workstream and existing slice.
- Comment IDs are stable, URL-safe strings.
- `comment list` shows unresolved and resolved comments clearly.
- `comment resolve` marks a comment resolved and records `resolvedAt`.
- Commands fail clearly if `.pathfinder` does not exist.
- JSON remains human-readable.

## Out Of Scope

- No inline file/line comments yet.
- No review generation.
- No AI review.
- No GitHub/GitLab integration.
- No UI.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `README.md`

## Acceptance Criteria

- Comment add/list/resolve works from the CLI.
- State layer has tests for add/list/resolve behavior.
- Resolving an already resolved comment gives a useful result or clear error.
- Missing workstream, slice, or comment IDs fail with useful messages.
- README includes the comment workflow.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test in a temporary Git repo:

```bash
npm run build
npm exec -- pathfinder init
npm exec -- pathfinder workstream create --title "Comment test"
npm exec -- pathfinder slice add comment-test --title "First slice" --description "Test comments."
npm exec -- pathfinder comment add comment-test --slice first-slice --body "Needs tests."
npm exec -- pathfinder comment list comment-test
npm exec -- pathfinder comment resolve comment-test needs-tests
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/03-comments-cli.md.

Current slice goal:
Implement comment add/list/resolve using local comments.json only.

Do not build UI, AI review, MCP, GitHub/GitLab integration, auth, cloud, or external APIs.

Run npm run typecheck, npm test, and npm run lint --if-present. Smoke test the new CLI commands.

Summarise changed files and manual verification commands.
```
