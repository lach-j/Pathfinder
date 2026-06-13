# Slice 14: Deterministic Review Checks

Status: ready

## Goal

Add a first local review command that performs deterministic checks against the active slice and committed branch diff.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

The PRD review phase compares plan, active slice, and diff. AI review is future work, but Pathfinder can already provide useful deterministic checks without calling a model.

## Scope

Implement:

```bash
pathfinder review run --base <base-ref>
```

Expected behavior:

- Requires initialized Pathfinder state and an active slice.
- Uses committed Git summary/diff against `<base-ref>`.
- Reads workstream requirements if slice 10 is complete.
- Reads plan, active slice, comments, reviews, and evidence.
- Produces a review record in `reviews.json`.
- Prints a readable checklist-style review.

Initial deterministic checks:

- Active slice exists.
- Active slice status is `in_progress`, `review`, or `complete`; otherwise warn.
- Committed diff against base is non-empty; otherwise warn.
- There is at least one changed source/test/doc/config file; summarize categories.
- Unresolved comments for the active slice are listed.
- Evidence for the active slice is listed; warn if none exists.
- Plan exists; warn if empty.
- Requirements exist if requirements support is present; warn if empty.

Severity can be simple:

```text
info
warning
```

## Out Of Scope

- No AI review.
- No semantic code analysis.
- No blocking hooks.
- No automatic comment resolution.
- No GitHub/GitLab.
- No UI.

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

- `pathfinder review run --base <base-ref>` creates a local review record.
- Review output is useful without AI.
- Warnings are deterministic and testable.
- Existing `review create/list/show` still work.
- Tests cover review generation with and without evidence/comments/diff.
- README documents the command as deterministic local review, not AI review.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder init
npm exec -- pathfinder workstream create --title "Inventory alerts"
npm exec -- pathfinder slice add inventory-alerts --title "Add report" --description "Report reorder candidates."
npm exec -- pathfinder slice active inventory-alerts add-report
npm exec -- pathfinder slice status inventory-alerts add-report in_progress
# make and commit a small local change on a branch
npm exec -- pathfinder review run --base main
npm exec -- pathfinder review list inventory-alerts
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/14-deterministic-review-checks.md.

Current slice goal:
Add pathfinder review run --base <base-ref> for deterministic local review checks against the active slice and committed branch diff.

Implement only this slice.

Do not build AI review, semantic code analysis, blocking hooks, GitHub/GitLab integration, UI, MCP, or external APIs.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test deterministic review run.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
