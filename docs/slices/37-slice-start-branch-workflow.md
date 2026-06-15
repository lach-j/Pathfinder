# Slice 37: Slice Start Branch Workflow

Status: done

## Goal

Make the normal "choose this slice" path create or switch to a slice branch from the intended base before implementation begins.

## Reason

In the QuickNotes rollout transcript, the agent set the recommended slice active and started implementing on `master`. Pathfinder already printed a `Start branch` hint from `pathfinder slice next`, but `pathfinder agent next --json` and the implementation prompt did not make branch creation part of the required path.

The desired workflow is:

```text
Choose slice
  -> start a branch from main or the configured base
  -> mark the slice active
  -> implement
```

Agents should not have to infer this from a secondary hint.

## Requirements

- Add a first-class command for starting a slice, for example:

```bash
pathfinder slice start <workstream-id> <slice-id> --base <base-ref>
```

- The command should:
  - verify the worktree is clean before switching or creating a branch
  - verify the base ref exists and is a commit
  - create or switch to a deterministic slice branch
  - record branch metadata on the slice
  - set the slice active only after the branch step succeeds
- Prefer the repository default branch as the suggested base when it can be detected.
- Fall back to `main`, then `master`, only for suggestions; do not silently create from a missing base.
- If the repository has no commits, return a clear blocking error that explains an initial baseline commit is required before a branch can be started.
- Keep the existing `pathfinder slice active` command for manual/backward-compatible use.
- Update `pathfinder agent next --json` for `needs_slice_selection` to recommend the branch-start command as the primary next command.
- Update `pathfinder agent prompt` so agents are told to start the branch before implementation, not merely set the slice active.

## Technical Notes

- Reuse the existing `pathfinder slice branch <workstream-id> <slice-id> --base <base-ref>` behavior where possible.
- Consider implementing `slice start` as orchestration over existing branch and active-slice state code rather than duplicating Git logic in the CLI layer.
- Branch names should remain deterministic and stable. A reasonable default is the existing slice branch name behavior if one already exists.
- If the branch already exists and points to a valid commit, the command may switch to it if the worktree is clean.
- If a branch exists but is based on a different recorded base, report that clearly rather than overwriting metadata.

## Likely Files

- `packages/core/src/agent/*`
- `packages/state/src/store.ts`
- `packages/git/src/adapter.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- tests
- `README.md`

## Acceptance Criteria

- `pathfinder slice start quicknotes backend-rest-api-and-tests --base main` creates or switches to a slice branch and sets the slice active.
- The command refuses to run with uncommitted changes.
- The command refuses to run when the base ref is missing.
- The command gives a clear message when the repository has no commits.
- `pathfinder agent next --json` in `needs_slice_selection` returns `pathfinder slice start ... --base <base-ref>` as the preferred command.
- `pathfinder agent prompt --phase implement` no longer implies implementation can begin before a slice branch exists.
- Existing `slice active` and `slice branch` commands remain backward compatible.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder slice next <workstream-id>
pathfinder agent next --json
pathfinder slice start <workstream-id> <slice-id> --base main
git branch --show-current
pathfinder current
```

## Completion Notes

- Added `pathfinder slice start <workstream-id> <slice-id> --base <base-ref>` to create or switch to the deterministic slice branch, record branch metadata, then set the slice active.
- Added clean-worktree, missing-base, no-commit, and recorded-base mismatch protections before changing active slice state.
- Updated `agent next --json`, `agent prompt`, `slice next`, help text, README, and tests so branch start is the preferred slice-selection path.
