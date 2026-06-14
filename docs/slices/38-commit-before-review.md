# Slice 38: Commit Before Review

Status: ready

## Goal

Make committed changes a hard prerequisite for Pathfinder review sessions and agent review handoff.

## Reason

In the QuickNotes rollout transcript, the agent attempted to start a Pathfinder review before the implementation commit existed. It later had to create an empty baseline commit, stage files, start a review, commit, and start review again.

Pathfinder review sessions are based on committed Git diffs. The agent instructions should make that contract explicit and the CLI should guard it.

## Requirements

- Add an agent phase for completed but uncommitted implementation work, for example:

```text
needs_commit
```

- When an active slice has working tree changes and no open feedback, `pathfinder agent next --json` should return `needs_commit` instead of encouraging `review start`.
- The `needs_commit` response should include commands such as:

```bash
git status --short
git add <changed-files>
git commit -m "<slice-oriented message>"
pathfinder review start --base <base-ref>
```

- `pathfinder agent prompt` should say agents must commit the slice implementation before starting or refreshing a review session.
- `pathfinder review start --base <base-ref>` should refuse to start when the worktree or index has uncommitted changes unless an explicit future option is added for working-tree review.
- The review start error should be actionable:
  - commit the slice changes
  - stash/remove unrelated changes
  - rerun review start
- If the repository has no baseline commit, return a specific message that a first commit is needed before committed-diff review can work.
- Do not automatically commit user changes. Pathfinder may tell the agent to commit, but the agent remains responsible for choosing files and message.

## Technical Notes

- The Git adapter already exposes uncommitted-change detection. Reuse it rather than shelling out from core logic.
- Keep review sessions committed-diff based for this slice. Do not implement working-tree diff review here.
- The phase should remain scriptable in JSON and should not depend on parsing CLI prose.
- Be careful with external state: Pathfinder state may live outside the repo, but Git cleanliness must still be evaluated in the target repository.

## Likely Files

- `packages/core/src/domain.ts`
- `packages/core/src/agent/next.ts`
- `packages/core/src/agent/prompt.ts`
- `packages/git/src/adapter.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/formatters.ts`
- tests
- `README.md`

## Acceptance Criteria

- After implementing files for an active slice without committing, `pathfinder agent next --json` returns `needs_commit`.
- The JSON response includes a clear commit-before-review command sequence.
- `pathfinder review start --base main` fails with an actionable error when uncommitted changes exist.
- After committing the slice, `pathfinder review start --base main` succeeds.
- Existing committed-diff review behavior remains unchanged.
- Tests cover a dirty worktree, staged changes, a clean committed slice, and a repository with no commits.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder agent next --json
git status --short
pathfinder review start --base main
git add <changed-files>
git commit -m "Implement <slice>"
pathfinder review start --base main
```

