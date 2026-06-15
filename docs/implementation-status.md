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

Local UI and deterministic agent integration are now implemented product areas. Any future UI or agent work must still use reusable core/state/git behavior and must not own business logic.

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

## Current Product Direction

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

The current product focus is personal installation and no-repo-footprint usage:

1. Build source-only releases where GitHub Actions produces installable npm tarballs.
2. Upload release artifacts to GitHub Releases before publishing to npm.
3. Add automated semantic versioning once manual release artifacts work.
4. Support external state outside target repositories.
5. Support user-level agent instructions/commands so work repos do not need `AGENTS.md`, `.claude/`, `.opencode/`, or `.pathfinder/` files.

After personal mode, the next focus is making normal agent-driven slice execution more stable:

1. Starting a selected slice should create or switch to a slice branch from the intended base before implementation.
2. Review sessions should be started only after slice changes are committed.
3. Human review approval should be explicit, scriptable, and clear to both users and agents.
4. Agent prompts and command output should avoid noisy, misleading, or unsupported instructions.

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
| 28 | done | `docs/slices/28-agent-bootstrap-instructions.md` |
| 29 | done | `docs/slices/29-native-agent-command-wrappers.md` |
| 30 | done | `docs/slices/30-agent-integration-doctor.md` |
| 31 | done | `docs/slices/31-release-packaging.md` |
| 32 | done | `docs/slices/32-github-release-artifact-workflow.md` |
| 33 | done | `docs/slices/33-automated-versioning.md` |
| 34 | done | `docs/slices/34-external-state-mode.md` |
| 35 | done | `docs/slices/35-no-repo-footprint-agent-mode.md` |
| 36 | done | `docs/slices/36-personal-mode-doctor.md` |
| 37 | done | `docs/slices/37-slice-start-branch-workflow.md` |
| 38 | ready | `docs/slices/38-commit-before-review.md` |
| 39 | ready | `docs/slices/39-human-review-approval-gate.md` |
| 40 | ready | `docs/slices/40-agent-prompt-command-stability.md` |

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
09. Review follow-up
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

Next distribution and personal-mode order:

31. Release packaging
32. GitHub release artifact workflow
33. Automated versioning
34. External state mode
35. No-repo-footprint agent mode
36. Personal mode doctor

Next agent workflow stability order:

37. Slice start branch workflow
38. Commit before review
39. Human review approval gate
40. Agent prompt and command stability

The order can change if a slice doc says it has no dependency on earlier slices.
