# Slice 15: PR Composer V2

Status: ready

## Goal

Improve local PR markdown generation using requirements, slice dependencies/statuses, evidence, repository summary, and deterministic reviews.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

The current PR composer creates a useful skeleton. Once requirements, evidence, repository summaries, and deterministic review records exist, PR output should better reflect the actual implementation story.

## Scope

Extend:

```bash
pathfinder pr generate <workstream-id> [--base <base-ref>]
```

Expected behavior:

- Includes workstream title and ID.
- Includes a concise requirements section if requirements exist.
- Includes a concise plan section or plan location.
- Lists completed slices first, then incomplete slices if any remain.
- Shows slice dependencies where present.
- Includes evidence grouped by slice, especially test evidence.
- Includes deterministic review notes and unresolved comments.
- If `--base <base-ref>` is provided, includes repository summary for committed changes.
- Writes and prints `.pathfinder/workstreams/<workstream-id>/pr.md`.
- Output is deterministic.

Suggested markdown sections:

```markdown
## Summary

## Requirements

## Plan

## Completed Slices

## Remaining Slices

## Changed Files

## Testing Evidence

## Review Notes

## Risks

## Checklist
```

## Out Of Scope

- No GitHub/GitLab PR creation.
- No AI-written summaries.
- No changelog generation beyond local state.
- No remote calls.
- No UI.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- PR markdown reflects completed slice statuses.
- Evidence appears in Testing Evidence.
- Unresolved comments are visible.
- Repository summary appears when `--base` is supplied.
- Empty/missing optional state produces useful placeholder text, not broken output.
- Tests cover deterministic markdown output.
- README documents the richer PR generation workflow.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder pr generate inventory-alerts --base main
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/15-pr-composer-v2.md.

Current slice goal:
Improve PR markdown generation using the richer local Pathfinder state and optional committed repository summary.

Implement only this slice.

Do not create GitHub/GitLab PRs, call external APIs, build AI summaries, add UI, MCP, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test PR generation with and without --base.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
