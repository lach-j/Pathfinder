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

Do not add authentication, billing, cloud sync, organisations, roles, hosted backend assumptions, external APIs, MCP, Claude hooks, or AI review unless a slice explicitly asks for it.

Local UI is now part of the planned MVP, but only in the review-viewer slices. The UI must use reusable core/state/git behavior and must not own business logic.

## Current Architecture

```text
packages/
  core/          domain types and validation
  git/           local Git adapter
  state/         filesystem persistence under .pathfinder/
  ui/            React browser app for local Pathfinder views
  local-server/  local-only HTTP API and static UI asset serving
  cli/           command-line interface
```

State currently lives under:

```text
.pathfinder/
  project.json
  workstreams/
    <workstream-id>/
      workstream.json
      requirements.md
      plan.md
      slices.json
      comments.json
      review-sessions.json
      reviews.json
      evidence.json
      pr.md
```

## Current MVP Direction

Slices 01-15 established a local CLI/state foundation with workstreams, requirements, plans, slices, comments, reviews, evidence, Git diffs, branch metadata, slice statuses, current context, deterministic review checks, repository summaries, and PR markdown generation.

The product direction has been re-centered on the original goal:

1. Replace the stored planning/implementation workflow from `docs/skills-replacement-examples/` with local Pathfinder state.
2. Create a local GitHub/Bitbucket-style diff review experience for changes against a base branch.
3. Let the developer leave inline local review comments.
4. Export open comments as an agent-actionable feedback queue.
5. Repeat review, agent follow-up, and refresh until the developer is satisfied.

Slices 16-25 built the local review loop: stage-plan import, durable review sessions, structured diffs, inline comments, feedback export, local review server/UI, refresh/stale comment handling, and PR output with review-loop state.

The next slices should make this usable from normal coding agent sessions without the user manually coordinating Pathfinder commands. The core technical decision is:

```bash
pathfinder agent next --json
```

is the canonical first command for agents. Repository instructions and optional native command wrappers should teach Codex, Claude Code, OpenCode, and similar tools to ask Pathfinder what to do next instead of inventing a parallel workflow.

MCP, hooks, direct agent invocation, AI review, and remote Git hosting integrations remain out of scope for the next slice set.

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
| 09 | done | `docs/slices/09-mvp-review.md` |
| 10 | done | `docs/slices/10-requirements-context.md` |
| 11 | done | `docs/slices/11-slice-dependencies-next.md` |
| 12 | done | `docs/slices/12-evidence-attachments.md` |
| 13 | done | `docs/slices/13-repository-intelligence-summary.md` |
| 14 | done | `docs/slices/14-deterministic-review-checks.md` |
| 15 | done | `docs/slices/15-pr-composer-v2.md` |
| 16 | done | `docs/slices/16-stage-plan-import.md` |
| 17 | done | `docs/slices/17-review-session-state.md` |
| 18 | done | `docs/slices/18-structured-diff-model.md` |
| 19 | done | `docs/slices/19-inline-comment-anchors.md` |
| 20 | done | `docs/slices/20-feedback-queue-export.md` |
| 21 | done | `docs/slices/21-local-review-server.md` |
| 22 | done | `docs/slices/22-read-only-diff-viewer-ui.md` |
| 23 | done | `docs/slices/23-inline-commenting-ui.md` |
| 24 | done | `docs/slices/24-review-refresh-and-stale-comments.md` |
| 25 | done | `docs/slices/25-pr-composer-review-loop.md` |
| 26 | done | `docs/slices/26-agent-next-state-machine.md` |
| 27 | done | `docs/slices/27-agent-prompt-rendering.md` |
| 28 | ready | `docs/slices/28-agent-bootstrap-instructions.md` |
| 29 | ready | `docs/slices/29-native-agent-command-wrappers.md` |
| 30 | ready | `docs/slices/30-agent-integration-doctor.md` |

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

Completed foundation:

01. Stage 1 foundation
02. Repo hygiene
03. Comments CLI
04. Git diff adapter
05. Review state foundation
06. PR markdown generation
07. Current context command
08. CLI polish
09. MVP review follow-up
10. Requirements context
11. Slice dependencies and next selection
12. Evidence attachments
13. Repository intelligence summary
14. Deterministic review checks
15. PR composer v2

Next review-loop order:

16. Stage plan import
17. Review session state
18. Structured diff model
19. Inline comment anchors
20. Feedback queue export
21. Local review server
22. Read-only diff viewer UI
23. Inline commenting UI
24. Review refresh and stale comments
25. PR composer review loop

Next agent-integration order:

26. Agent next state machine
27. Agent prompt rendering
28. Agent bootstrap instructions
29. Native agent command wrappers
30. Agent integration doctor

The order can change if a slice doc says it has no dependency on earlier slices.
