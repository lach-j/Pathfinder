# AGENTS.md

## Repository Role

Pathfinder is a local-first, open-source developer tool for planning work, tracking local review state, inspecting Git diffs, collecting feedback, and producing PR-ready output for AI-assisted development.

For product vision and boundaries, read [PATHFINDER_PRD.md](PATHFINDER_PRD.md).
For active slice status, implementation sequencing, and historical slice handoffs, use repo-local Pathfinder state:

```bash
pathfinder agent next --json
pathfinder workstream list --json
pathfinder slice list <workstream-id> --json
pathfinder agent prompt
```

The migration from legacy documentation is summarized in `.pathfinder/migration-summary.md`.

## System Map

- `packages/core/`: platform-independent domain types, validation, planning parsers, diff parsing, review logic, feedback markdown, agent prompt logic, and PR markdown generation.
- `packages/state/`: filesystem persistence, `.pathfinder/` layout, state orchestration, agent bootstrap file writes, and the `PathfinderStore` facade.
- `packages/git/`: local Git process adapter and Git-output parsers.
- `packages/cli/`: command routing, argument parsing, terminal output, and CLI smoke-test surface.
- `packages/local-server/`: local-only HTTP API and static serving for the built browser UI.
- `packages/ui/`: React browser app, review UI components, browser API client, and CSS.
- `.pathfinder/`: repo-local Pathfinder state, migrated workstreams, plans, slice handoffs, historical commit mappings, and PR/review artifacts.
- `.github/`: repository automation such as release workflows.
- `scripts/`: local maintenance scripts used by package commands.

Directory-specific `AGENTS.md` files may add narrower rules. When editing inside a package or support directory, read the nearest one before changing files there.

## Architecture Rules

Keep business behavior reusable by CLI, UI, local server, and agent integrations.

Separate:

- domain model and pure logic
- filesystem persistence
- Git integration
- CLI interface
- local HTTP interface
- browser UI interface
- agent integration helpers

The UI and CLI should orchestrate reusable behavior; they should not own domain rules or state formats.

## Dependency Direction

Production code should follow this direction:

```text
core
git -> core
state -> core
local-server -> core, git, state
cli -> core, git, state, local-server
ui -> local HTTP API only
```

Do not introduce reverse imports such as `core` importing a package, `state` importing `cli`, or `ui` importing `state`.

## Product Constraints

Pathfinder is local-first, filesystem-first, Git-aware, open-source, and single-user by default.

Do not add authentication, billing, cloud sync, organisations, roles/permissions, hosted backend assumptions, or external API dependencies unless the assigned slice explicitly asks for them.

Preserve user files and local Pathfinder state. Do not overwrite state unless the command clearly implies it.

## State Format

Project state is filesystem-backed and human-readable where practical.

Use markdown for long-form plans, requirements, feedback queues, and PR drafts.
Use JSON for structured entities.

State code belongs in `packages/state/`. Pure validation or state-independent transformations belong in `packages/core/`.

## Implementation Workflow

Before starting a slice:

1. Run `pathfinder agent next --json` and follow its phase, commands, and active workstream/slice guidance.
2. Read this file, [PATHFINDER_PRD.md](PATHFINDER_PRD.md), [README.md](README.md), and the relevant Pathfinder workstream plan/slice description under `.pathfinder/workstreams/`.
3. Use `pathfinder agent prompt` when you need phase-specific implementation instructions.
4. Read the nearest directory-level `AGENTS.md` for files you expect to edit.
5. Restate the assigned slice goal.
6. Implement only the assigned slice unless the user explicitly broadens scope.

While changing code:

- Keep changes small and reviewable.
- Prefer explicit types and focused modules.
- Use existing package boundaries before adding abstractions.
- Add or update tests for behavior that changes.
- Keep generated build output out of source edits unless the slice explicitly asks for generated artifacts.

Before finishing:

1. Run the checks listed in the assigned slice.
2. At minimum run:

```bash
npm run typecheck
npm test
npm run lint --if-present
```

3. Smoke test any CLI command, server route, or UI path introduced or changed by the work.
4. Summarise changed files, checks run, and manual verification commands.

<!-- pathfinder-agent:start -->
## Pathfinder Agent Workflow

Pathfinder is the source of truth for planning, slice scope, review feedback, and PR output in this repository.

When asked to plan, implement, continue, review, or address feedback here, first run:

```bash
pathfinder agent next --json
```

Follow the returned `phase`, `commands`, and `agentInstruction`. Use `pathfinder agent prompt` when you need tool-neutral markdown instructions for the current phase.

Do not create unmanaged task lists or parallel plans when Pathfinder state exists. Keep implementation scoped to the active Pathfinder slice, and do not resolve Pathfinder comments automatically after making code changes.

MCP is not required for this workflow; use the local Pathfinder CLI commands above.
<!-- pathfinder-agent:end -->
