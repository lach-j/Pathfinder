# Product Ideas Backlog

Migrated from `docs/ideas/` on 2026-06-16.

## Scope

Preserve exploratory Pathfinder product ideas as a proposed backlog without implying immediate implementation commitment.

## Source README

# Ideas

This directory captures future Pathfinder product ideas that are not ready to become implementation slices.

Idea records should be specific enough to preserve intent, but they should not imply immediate scope, sequencing, or implementation commitment. When an idea becomes active work, promote it into small vertical slices in an active Pathfinder workstream.

## Current Ideas

- [Workstream Intake UI](01-workstream-intake-ui.md)
- [Agent Assisted Slice Planning](02-agent-assisted-slice-planning.md)
- [Workstream Dependency Tree](03-workstream-dependency-tree.md)
- [Parallel Agent Session Launcher](04-parallel-agent-session-launcher.md)
- [Session Monitoring And Review Loop](05-session-monitoring-review-loop.md)
- [PR Handoff And Rich Copy](06-pr-handoff-rich-copy.md)
- [Local MCP Server](07-local-mcp-server.md)
- [Structured Agent Feedback Protocol](08-structured-agent-feedback-protocol.md)
- [Scope Drift And Requirement Coverage](09-scope-drift-and-requirement-coverage.md)
- [Review UI Depth](10-review-ui-depth.md)
- [Checks And Evidence Runner](11-checks-and-evidence-runner.md)
- [State Schema Validation And Repair](12-state-schema-validation-and-repair.md)
- [Traceability Knowledge Graph](13-traceability-knowledge-graph.md)
- [Workspace UI Shell](14-workspace-ui-shell.md)
- [Core CLI State Refactor](15-core-cli-state-refactor.md)
- [Packaging And Installation](16-packaging-and-installation.md)

## Shared Assumptions

- Pathfinder remains local-first, single-user by default, filesystem-first, and Git-aware.
- The UI is a local control surface over reusable core/state/git behavior.
- Pathfinder coordinates work but does not become an AI coding agent, IDE, Jira replacement, or Git hosting platform.
- External issue tracker links can be stored as metadata. Direct issue tracker API calls are optional future integration work, not a baseline requirement.
- Agent-specific launch support should sit behind explicit local commands or presets so the workflow can support Claude Code, Codex, Cursor, OpenCode, or future tools.
- Worktrees, branches, review state, PR drafts, and generated prompts should remain visible on disk where practical.
- MCP should be an optional local integration layer over Pathfinder state, not a replacement for the CLI or local UI.
- Deterministic review checks should come before AI-assisted review so warnings are explainable and reusable.
- State migrations, validation, and repair become increasingly important as `.pathfinder/` grows beyond the initial JSON files.

## Idea Slices

| Slice | Status | Historical commits |
| ----- | ------ | ------------------ |
| `idea-01-workstream-intake-ui` | proposed | 917cffd1e99d |
| `idea-02-agent-assisted-slice-planning` | proposed | 917cffd1e99d |
| `idea-03-workstream-dependency-tree` | proposed | 917cffd1e99d |
| `idea-04-parallel-agent-session-launcher` | proposed | 917cffd1e99d |
| `idea-05-session-monitoring-review-loop` | proposed | 917cffd1e99d |
| `idea-06-pr-handoff-rich-copy` | proposed | 917cffd1e99d |
| `idea-07-local-mcp-server` | proposed | 5d121d1cd87b |
| `idea-08-structured-agent-feedback-protocol` | proposed | 5d121d1cd87b |
| `idea-09-scope-drift-and-requirement-coverage` | proposed | 5d121d1cd87b |
| `idea-10-review-ui-depth` | proposed | 5d121d1cd87b |
| `idea-11-checks-and-evidence-runner` | proposed | 5d121d1cd87b |
| `idea-12-state-schema-validation-and-repair` | proposed | 5d121d1cd87b |
| `idea-13-traceability-knowledge-graph` | proposed | 5d121d1cd87b |
| `idea-14-workspace-ui-shell` | proposed | 5d121d1cd87b |
| `idea-15-core-cli-state-refactor` | proposed | 5d121d1cd87b |
| `idea-16-packaging-and-installation` | proposed | 5d121d1cd87b |

## Migration Notes

- Legacy idea markdown is preserved verbatim in each proposed slice description.
- These slices intentionally stay `proposed`; they are not active implementation commitments until promoted by a future planning pass.
