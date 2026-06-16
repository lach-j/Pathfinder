# Agent Workflow Stability Requirements

Make normal agent-driven slice execution safer by starting branch work explicitly, requiring committed diffs before review, gating completion on human approval, and stabilizing prompt/command output.

## Product Boundaries

- Pathfinder remains local-first, filesystem-first, Git-aware, open-source, and single-user by default.
- Business behavior should remain reusable by CLI, UI, local server, and agent integrations.
- UI and CLI orchestrate reusable core/state/git behavior; they should not own domain rules or state formats.
- Do not add authentication, billing, cloud sync, organisations, roles/permissions, hosted backend assumptions, or external API dependencies unless the active slice explicitly asks for them.

## Migrated Sources

- `docs/implementation-status.md`
- Legacy slice files 37 through 40
- Relevant historical commits from `git log`
