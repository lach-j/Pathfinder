# AGENTS.md

## Project

This repository contains Pathfinder, a local-first open-source developer tool.

Pathfinder is a context, Git, and agent middleman for AI-assisted development. It helps developers turn requirements into plans, plans into reviewable slices, slices into local diffs, and local diffs into PR-ready output.

## Product constraints

Pathfinder is:

- local-first
- open-source
- single-user by default
- filesystem-first
- Git-aware
- agent-friendly

Pathfinder is not:

- a SaaS product
- a team management platform
- a Jira replacement
- a GitHub/GitLab replacement
- an IDE
- an AI coding agent

Do not add:

- authentication
- billing
- cloud sync
- organisations
- roles/permissions
- hosted backend assumptions
- external API dependencies unless explicitly requested

## Build approach

Build in small vertical slices.

Prefer this order:

1. Local state model
2. CLI
3. Git adapter
4. Review comments
5. PR markdown generation
6. Local UI
7. Agent bridge
8. MCP
9. Claude/Codex-specific integrations

Do not jump ahead to later stages unless asked.

## Architecture principles

Core logic should be reusable by CLI, UI, and agent integrations.

Separate:

- domain model
- filesystem persistence
- Git integration
- CLI interface
- UI interface
- agent/MCP interface

The UI must not own business logic.

## State

Prefer local project state under:

```text
.pathfinder/
```

State should be human-readable where practical.

Use markdown for long-form plans and PR drafts.

Use JSON for structured entities.

Development rules
Keep changes small and reviewable.
Add tests for core behaviour.
Prefer explicit types.
Prefer simple filesystem persistence before databases.
Avoid speculative plugin systems until there is a concrete use case.
Avoid unnecessary dependencies.
Preserve existing user files.
Do not overwrite state unless the command clearly implies it.
Provide clear error messages.
Agent behaviour

When implementing a task:

Read the relevant PRD/spec files.
Restate the current slice goal.
Implement only the requested slice.
Run available checks.
Summarise changed files.
Explain how to manually verify the result.
Current MVP goal

The first MVP should support:

pathfinder init
pathfinder workstream create
pathfinder plan set/show
pathfinder slice add/list/active
pathfinder git diff
pathfinder comment add/list/resolve
pathfinder pr generate

AI review, MCP, Claude hooks, and UI are future enhancements.
