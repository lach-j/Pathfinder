# Slice 04: Git Diff Adapter

Status: ready

## Goal

Add the first Git-aware command: inspect the current local diff without integrating with any hosting provider.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

Implement:

```bash
pathfinder git diff
```

Expected behavior:

- Runs against the local repository only.
- Returns the working tree diff from Git.
- Fails clearly outside a Git repository.
- Keeps Git integration separate from CLI command parsing.
- Does not require `.pathfinder` state unless there is a strong local reason. If requiring state, document the reason.

## Out Of Scope

- No GitHub/GitLab.
- No commit creation.
- No branch management.
- No AI review or drift detection.
- No PR generation.

## Suggested Package Shape

Prefer a small `packages/git` package if that keeps Git behavior separate, or a contained state-adjacent adapter if a new package would be premature. Keep the choice boring and documented in the summary.

## Acceptance Criteria

- `pathfinder git diff` prints the same diff content as `git diff` for ordinary working tree changes.
- The command exits successfully for an empty diff and prints nothing or a clear empty message.
- Errors are useful when Git is unavailable or the command is run outside a Git repo.
- Tests cover adapter behavior where practical without depending on global Git configuration.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
npm run build
npm exec -- pathfinder git diff
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/04-git-diff-adapter.md.

Current slice goal:
Implement pathfinder git diff for local repositories only.

Do not build GitHub/GitLab integration, AI review, drift detection, commits, branches, UI, MCP, or external APIs.

Run npm run typecheck, npm test, and npm run lint --if-present. Smoke test pathfinder git diff.

Summarise changed files and manual verification commands.
```
