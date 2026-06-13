# Slice 13: Repository Intelligence Summary

Status: done

## Goal

Add a local repository intelligence summary for committed changes against a base ref.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

The PRD calls for Git-aware analysis: changed files, categories, traceability, and scope awareness. The current Git adapter can show diffs, but it does not summarize changed files in a way that review and PR workflows can reuse.

## Scope

Implement:

```bash
pathfinder git summary --base <base-ref>
```

Expected behavior:

- Uses committed changes from merge-base with `<base-ref>` to `HEAD`.
- Prints a readable local summary:
  - base ref
  - head ref or commit
  - changed file count
  - added/modified/deleted/renamed files if Git can provide that simply
  - simple category per file based on path/extension
- Categories should be deterministic and conservative:
  - `test`
  - `documentation`
  - `source`
  - `configuration`
  - `state`
  - `other`
- No AI classification.
- No external API calls.

Prefer also exposing a reusable core/git data shape for future review and PR generation.

## Out Of Scope

- No scope drift detection yet.
- No AI review.
- No GitHub/GitLab.
- No dependency graph analysis.
- No UI.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/git/src/index.ts`
- `packages/git/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- `pathfinder git summary --base <base-ref>` works in a local Git repo with committed changes.
- Output is useful for a human reviewer.
- Tests cover summary parsing and category classification.
- Clear errors for missing/invalid base refs.
- README documents the command.

## Implementation Summary

- Added reusable repository summary and file category types in core.
- Added deterministic repository path classification for test, documentation, source, configuration, state, and other files.
- Added Git summary collection from merge-base to `HEAD` using `git diff --name-status --find-renames`.
- Added `pathfinder git summary --base <base-ref>` CLI output with changed file counts and per-file categories.
- Documented the command in `README.md`.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Completed for this slice.

Smoke test:

```bash
git checkout -b pathfinder/test-summary
# make and commit a small source/doc/test change
npm exec -- pathfinder git summary --base main
```

Completed in a temporary Git repository with committed source and documentation changes.

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/13-repository-intelligence-summary.md.

Current slice goal:
Add pathfinder git summary --base <base-ref> for deterministic local repository intelligence on committed changes.

Implement only this slice.

Do not build AI classification, scope drift detection, GitHub/GitLab integration, UI, MCP, remote calls, or external APIs.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test git summary in a local branch with committed changes.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
