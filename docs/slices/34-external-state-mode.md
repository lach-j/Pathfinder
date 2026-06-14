# Slice 34: External State Mode

Status: ready

## Goal

Add a personal external state mode so Pathfinder can be used in repositories without writing `.pathfinder/` into the repository.

## Reason

Pathfinder will often be used as a personal tool in work/client repositories where teammates do not have Pathfinder installed. The target repo should not need committed or uncommitted Pathfinder state files.

Desired state layout:

```text
~/.pathfinder/projects/<project-id>/
  project.json
  workstreams/
```

On Windows, prefer an OS-appropriate user data location if practical:

```text
%LOCALAPPDATA%\Pathfinder\projects\<project-id>\
```

If cross-platform app-data lookup is too much for this slice, start with:

```text
~/.pathfinder/projects/<project-id>/
```

## Requirements

- Add state mode support:

```text
repo
external
```

- Existing behavior remains `repo` mode by default unless explicitly changed.
- Add commands such as:

```bash
pathfinder config set state.mode external
pathfinder config get state.mode
pathfinder init --personal
```

- In external mode, Pathfinder state for the current Git repo is stored outside the repo.
- Project identity should be deterministic. Prefer:
  1. Git remote URL hash if a remote exists.
  2. Git root absolute path hash otherwise.
- State lookup should find external state when running inside the target repo.
- Existing commands should work against external state after initialization.
- Avoid writing `.pathfinder/` in external mode.

## Technical Notes

- Current state code assumes `.pathfinder` under Git root. Introduce a state root resolver rather than threading special cases through every command.
- Keep storage filesystem-first and human-readable.
- Consider a global config file:

```text
~/.pathfinder/config.json
```

Example:

```json
{
  "stateMode": "external"
}
```

- A per-project external metadata file should record the Git root and remote used to derive the id.
- Do not migrate repo-local `.pathfinder` automatically in this slice. If both repo and external state exist, fail clearly or choose based on explicit mode.

## Likely Files

- `packages/state/src/store.ts`
- `packages/state/src/git-root.ts`
- `packages/state/src/file-system.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/core/src/domain.ts`
- tests
- `README.md`

## Acceptance Criteria

- `pathfinder init --personal` creates external state and no `.pathfinder/` directory in the repo.
- Existing commands like `workstream create`, `plan import`, `agent next`, and `review start` work with external state.
- `pathfinder config set/get state.mode external` works.
- Repo mode remains backward compatible.
- Error messages are clear when state mode and existing state conflict.
- Tests cover repo mode, external mode, deterministic project id, and no repo writes.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder config set state.mode external
pathfinder init --personal
test ! -d .pathfinder
pathfinder workstream create --title "Demo"
pathfinder current
```

