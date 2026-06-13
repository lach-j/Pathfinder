# Slice 06: PR Markdown Generation

Status: done

## Goal

Generate PR-ready markdown locally from Pathfinder workstream state.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

Implement:

```bash
pathfinder pr generate <workstream-id>
```

Expected behavior:

- Reads workstream metadata, plan, slices, comments, and reviews.
- Writes `.pathfinder/workstreams/<workstream-id>/pr.md`.
- Prints the generated markdown.
- Uses a simple markdown template:

```markdown
## Summary

## Completed Slices

## Testing

## Risks

## Review Notes

## Checklist
```

## Out Of Scope

- No GitHub/GitLab PR creation.
- No AI-authored summaries.
- No external APIs.
- No UI.

## Acceptance Criteria

- Generated `pr.md` is deterministic for the same state.
- Markdown is readable and useful even when some sections have no data.
- Existing `pr.md` may be overwritten because the command explicitly implies generation.
- Tests cover markdown generation.
- README includes the PR generation workflow.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/06-pr-markdown-generation.md.

Current slice goal:
Implement pathfinder pr generate <workstream-id> as local markdown generation only.

Do not create GitHub/GitLab PRs, call external APIs, build AI summaries, UI, or MCP.

Run npm run typecheck, npm test, and npm run lint --if-present. Smoke test PR markdown generation.

Summarise changed files and manual verification commands.
```
