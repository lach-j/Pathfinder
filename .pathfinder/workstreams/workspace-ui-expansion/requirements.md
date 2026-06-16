# Workspace UI Expansion Requirements

Expand the local browser experience from review-only into a current-repository workspace with workstream APIs, a shell, dependency canvas, artifact previews, review panel, PR rich copy, and standalone branch review.

## Product Boundaries

- Pathfinder remains local-first, filesystem-first, Git-aware, open-source, and single-user by default.
- Business behavior should remain reusable by CLI, UI, local server, and agent integrations.
- UI and CLI orchestrate reusable core/state/git behavior; they should not own domain rules or state formats.
- Do not add authentication, billing, cloud sync, organisations, roles/permissions, hosted backend assumptions, or external API dependencies unless the active slice explicitly asks for them.

## Migrated Sources

- `docs/implementation-status.md`
- Legacy slice files 41 through 47
- Relevant historical commits from `git log`
