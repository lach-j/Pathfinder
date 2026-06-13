# Slice 05: Review State Foundation

Status: done

## Goal

Establish local review records in `reviews.json` without AI-generated review behavior.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

Add minimal state APIs and CLI surface for local review records. Suggested commands:

```bash
pathfinder review create <workstream-id> --slice <slice-id> --summary "..."
pathfinder review list <workstream-id>
pathfinder review show <workstream-id> <review-id>
```

Expected behavior:

- Reviews are stored in `.pathfinder/workstreams/<workstream-id>/reviews.json`.
- Reviews link to an existing slice.
- Review IDs are stable, URL-safe strings.
- Review records can reference existing comments and evidence types if the current model supports it.
- JSON remains human-readable.

## Out Of Scope

- No AI review generation.
- No automatic diff analysis.
- No scope drift detection.
- No external API calls.
- No UI.

## Acceptance Criteria

- Reviews can be created, listed, and shown from the CLI.
- Missing workstream, slice, or review IDs fail clearly.
- Unit tests cover state behavior.
- README includes minimal review workflow only if commands are added.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/05-review-state-foundation.md.

Current slice goal:
Implement local review state foundation backed by reviews.json.

Do not build AI review, drift detection, GitHub/GitLab integration, UI, MCP, or external APIs.

Run npm run typecheck, npm test, and npm run lint --if-present. Smoke test the review CLI commands if added.

Summarise changed files and manual verification commands.
```
