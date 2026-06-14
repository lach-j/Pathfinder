# Slice 36: Personal Mode Doctor

Status: ready

## Goal

Extend `pathfinder agent doctor` so it can verify a no-repo-footprint personal installation.

## Reason

Once Pathfinder supports external state and user-level agent instructions, users need a quick confidence check before using it in a work repo:

```bash
pathfinder agent doctor --personal
```

It should answer:

- Is the CLI installed?
- Is external state enabled?
- Is this repo initialized in external state?
- Is user-level Claude/OpenCode integration installed?
- Did Pathfinder avoid writing repo-local files?

## Requirements

- Add:

```bash
pathfinder agent doctor --personal
pathfinder agent doctor --personal --json
```

- Checks should include:
  - CLI command is running.
  - state mode is `external`.
  - external project state exists for the current repo, or a fix command is shown.
  - user-level Claude guidance is installed, or a fix command is shown.
  - user-level OpenCode integration if supported, or an explicit unsupported/manual status.
  - target repo does not contain Pathfinder-created `.pathfinder/`, `.claude/commands/pathfinder-*`, `.opencode/commands/pathfinder-*`, or managed `AGENTS.md` block unless the user has opted into repo-local mode.
- Output should provide fix commands, not mutate files.

## Technical Notes

- This extends the existing doctor rather than creating a separate command.
- JSON should remain stable and scriptable.
- Reuse check ids where sensible but add personal-specific ids:

```text
state-mode
external-project-state
user-claude-instructions
user-opencode-instructions
repo-footprint
agent-next
```

- A repo-local `AGENTS.md` that existed before Pathfinder should not be considered a problem unless it contains the Pathfinder managed block in personal mode.
- If `.claude/` or `.opencode/` exists for unrelated user content, only flag Pathfinder-managed files/markers.

## Likely Files

- `packages/core/src/agent/*`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- tests
- `README.md`

## Acceptance Criteria

- `pathfinder agent doctor --personal` reports missing external mode with a fix command.
- It reports missing user-level Claude install with a fix command.
- It reports repo-local Pathfinder footprint when present.
- It passes in a repo with external state and user-level install and no repo-local Pathfinder files.
- `--json` returns stable check ids and statuses.
- Existing non-personal `agent doctor` behavior remains backward compatible.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder agent doctor --personal
pathfinder agent doctor --personal --json
```

