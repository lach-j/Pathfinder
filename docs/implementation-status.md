# Pathfinder Implementation Status

This file is the lightweight handoff map for future agent sessions.

Agents should read:

1. `AGENTS.md`
2. `PATHFINDER_PRD.md`
3. `README.md`
4. This file
5. The one assigned slice file under `docs/slices/`

Do not read every slice file unless the assigned slice explicitly depends on another one.

For fresh implementation sessions, use `docs/agent-session-prompt.md` and provide only the slice number, for example:

```text
Use docs/agent-session-prompt.md for slice 3.
```

## Current Product Boundary

Pathfinder is local-first, open-source, filesystem-first, Git-aware, and single-user by default.

Do not add authentication, billing, cloud sync, organisations, roles, hosted backend assumptions, external APIs, UI, MCP, Claude hooks, or AI review unless a slice explicitly asks for it.

## Current Architecture

```text
packages/
  core/   domain types and validation
  git/    local Git adapter
  state/  filesystem persistence under .pathfinder/
  cli/    command-line interface
```

State currently lives under:

```text
.pathfinder/
  project.json
  workstreams/
    <workstream-id>/
      workstream.json
      plan.md
      slices.json
      comments.json
      reviews.json
      pr.md
```

## Progress

| Slice | Status | Handoff |
| ----- | ------ | ------- |
| 01 | done | `docs/slices/01-stage-1-foundation.md` |
| 02 | done | `docs/slices/02-repo-hygiene.md` |
| 03 | done | `docs/slices/03-comments-cli.md` |
| 04 | done | `docs/slices/04-git-diff-adapter.md` |
| 05 | done | `docs/slices/05-review-state-foundation.md` |
| 06 | done | `docs/slices/06-pr-markdown-generation.md` |
| 07 | done | `docs/slices/07-current-context-command.md` |
| 08 | done | `docs/slices/08-cli-polish.md` |
| 09 | ready | `docs/slices/09-mvp-review.md` |

Status values:

- `ready`: scoped and available for a fresh agent session
- `in_progress`: a session is actively working on it
- `done`: implemented, checked, and summarised
- `blocked`: needs product or technical decision before implementation

## Recommended Session Pattern

Each agent session should:

1. Restate its slice goal.
2. Implement only that slice.
3. Keep changes small and reviewable.
4. Add or update tests for core/state behavior.
5. Run:

```bash
npm run typecheck
npm test
npm run lint --if-present
```

6. Smoke test the relevant CLI commands where practical.
7. Update this status file only for its assigned slice.
8. Summarise changed files and manual verification commands.

## Dependency Order

The safest next order is:

1. Repo hygiene
2. Comments CLI
3. Git diff adapter
4. Review state foundation
5. PR markdown generation
6. Current context command
7. CLI polish
8. MVP review follow-up

The order can change if a slice doc says it has no dependency on earlier slices.
