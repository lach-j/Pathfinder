# Agent Integration Requirements

Make `pathfinder agent next --json` the canonical first command for coding agents, then render prompts, bootstrap repo instructions, install native command wrappers, and diagnose integration readiness.

## Product Boundaries

- Pathfinder remains local-first, filesystem-first, Git-aware, open-source, and single-user by default.
- Business behavior should remain reusable by CLI, UI, local server, and agent integrations.
- UI and CLI orchestrate reusable core/state/git behavior; they should not own domain rules or state formats.
- Do not add authentication, billing, cloud sync, organisations, roles/permissions, hosted backend assumptions, or external API dependencies unless the active slice explicitly asks for them.

## Migrated Sources

- `docs/implementation-status.md`
- Legacy slice files 26 through 30
- Relevant historical commits from `git log`
