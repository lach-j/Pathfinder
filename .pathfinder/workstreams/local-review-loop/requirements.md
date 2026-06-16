# Local Review Loop Requirements

Replace the older stage-plan workflow with local Pathfinder state, durable review sessions, structured diffs, inline comments, feedback export, a local review UI, refresh/stale state, and PR output grounded in review-loop state.

## Product Boundaries

- Pathfinder remains local-first, filesystem-first, Git-aware, open-source, and single-user by default.
- Business behavior should remain reusable by CLI, UI, local server, and agent integrations.
- UI and CLI orchestrate reusable core/state/git behavior; they should not own domain rules or state formats.
- Do not add authentication, billing, cloud sync, organisations, roles/permissions, hosted backend assumptions, or external API dependencies unless the active slice explicitly asks for them.

## Migrated Sources

- `docs/implementation-status.md`
- Legacy slice files 16 through 25
- Relevant historical commits from `git log`
