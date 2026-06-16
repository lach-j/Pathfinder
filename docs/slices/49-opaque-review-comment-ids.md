# Slice 49: Opaque Review Comment IDs

Status: done

## Goal

Replace text-derived review comment ids with short opaque ids.

## Reason

Review comments are currently identified by hyphen-joined comment text such as `this-is-a-comment`. This is awkward for long comments, leaks mutable comment wording into stable identifiers, and becomes especially brittle once agent-authored comments, replies, or generated review passes exist.

## Requirements

- Generate opaque ids for new comments instead of slugs derived from comment body text.
- Use ids that are stable, unique within the relevant state scope, and practical to copy into CLI commands.
- Prefer UUIDs or a clear short-id strategy backed by collision handling.
- Preserve existing comments with slug-style ids.
- Do not rewrite existing comment ids during normal reads.
- Keep comment listing, resolving, feedback export, review refresh, stale anchors, branch review, and PR generation working for old and new ids.
- Update user-facing help, examples, and tests that assume text-derived ids.
- Ensure any new id generator lives in a reusable package boundary rather than UI-only code.

## Technical Notes

- This is a state compatibility slice, not a migration slice.
- If a migration is needed later, it should be explicit and reversible.
- The CLI should continue to accept existing slug ids in commands.
- Tests should cover both old slug ids and new opaque ids.
- Keep ids as strings in persisted JSON.

## Likely Files

- `packages/core/src/*`
- `packages/state/src/*`
- `packages/cli/src/*`
- `packages/local-server/src/review-server.ts`
- `packages/ui/src/*`, only where examples or assumptions surface
- `README.md`
- tests

## Acceptance Criteria

- Adding a new workstream review comment creates an opaque id.
- Adding a new branch-review comment creates an opaque id.
- Existing slug-id comments can still be listed, resolved, exported, refreshed, and included in PR output.
- Feedback export includes opaque ids without relying on comment body text.
- Tests cover new opaque ids and backwards compatibility with slug ids.
- Documentation no longer presents comment text slugs as the expected identifier format.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
pathfinder branch-review comment add <session-id> --file <path> --body "A deliberately long comment body that should not become the id."
pathfinder branch-review comment list --session <session-id> --open
```
