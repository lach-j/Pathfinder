# Slice 25: PR Composer Review Loop

Status: ready

## Goal

Update PR markdown generation so it reflects review sessions, inline comments, feedback resolution, and remaining review risk.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/15-pr-composer-v2.md`
- `docs/slices/17-review-session-state.md`
- `docs/slices/19-inline-comment-anchors.md`
- `docs/slices/24-review-refresh-and-stale-comments.md`
- This file

## Product Context

Once Pathfinder owns the local review loop, PR output should not just summarize slices. It should also tell a reviewer what was reviewed locally, what feedback was resolved, and what remains.

## Scope

Extend:

```bash
pathfinder pr generate <workstream-id> [--base <base-ref>]
```

Expected PR output additions:

- Review Sessions section with base/head/session metadata.
- Local Review Feedback section grouped by open/resolved/stale comments.
- Inline comment targets rendered as file and line references where available.
- Agent Feedback Queue section or link/path when an export file exists.
- Risk summary includes open and stale comments.
- Checklist includes local diff reviewed and feedback queue addressed.

## Out Of Scope

- No GitHub/GitLab PR creation.
- No external API calls.
- No AI-written summary.
- No changelog automation.
- No hosted services.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- PR markdown includes review session metadata when sessions exist.
- Open, resolved, and stale comments are visible and grouped.
- Inline targets are readable in markdown.
- Empty session/comment state produces useful placeholder text.
- Output remains deterministic.
- Tests cover markdown generation with sessions and inline comments.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder pr generate <workstream-id> --base main
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/15-pr-composer-v2.md, docs/slices/17-review-session-state.md, docs/slices/19-inline-comment-anchors.md, docs/slices/24-review-refresh-and-stale-comments.md, and docs/slices/25-pr-composer-review-loop.md.

Current slice goal:
Update PR markdown generation to include local review sessions, inline feedback, stale/open/resolved comments, and review-loop risk.

Implement only this slice.

Do not create GitHub/GitLab PRs, call external APIs, build AI summaries, add hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test PR generation with review sessions and comments.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
