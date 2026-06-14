# Slice 35: No-Repo-Footprint Agent Mode

Status: done

## Goal

Make Pathfinder's agent integration usable without writing `AGENTS.md`, `.claude/`, `.opencode/`, `.pathfinder-feedback.md`, or other helper files into the target repo.

## Reason

For personal use in work/client repositories, Pathfinder should not leave visible repo-local files unless the user explicitly opts in. The user wants a workflow like:

```text
Install Pathfinder once.
Install agent integration once.
Open any repo.
Tell Claude: "Use Pathfinder to plan this story."
```

## Requirements

- Add a personal/no-repo-footprint mode for agent setup.
- Do not modify project `AGENTS.md` in personal mode.
- Do not write project `.claude/commands` or `.opencode/commands` in personal mode.
- Feedback exports should default to external state storage in personal/external mode, not `./.pathfinder-feedback.md`.
- `pathfinder agent next` and `pathfinder agent prompt` should reference external feedback paths when state mode is external.
- Add commands such as:

```bash
pathfinder agent install --user claude
pathfinder agent install --user opencode
pathfinder agent install --user all
pathfinder agent install --user claude --dry-run
```

- The user-level install should write only to tool/user-level locations, never the target repo.

## Technical Notes

- Tool support varies. Implement only locations that are well understood and safe.
- For Claude, the likely first version is user-level instructions rather than relying only on commands:

```markdown
# Pathfinder

Pathfinder is installed on this machine.

When working in a Git repository and the user asks to plan, implement, continue, review, or address feedback, run:

pathfinder agent doctor --json

If Pathfinder is initialized or applicable, start with:

pathfinder agent next --json

Use `pathfinder agent prompt` for phase-specific instructions.
Do not create unmanaged plans or task lists when Pathfinder state exists.
Do not resolve Pathfinder comments automatically.
Do not write Pathfinder setup files into the repository unless the user asks.
```

- If Claude user-level command files are supported in the user's environment, generate them too. If uncertain, make this configurable and document the path.
- For OpenCode, prefer its documented user-level rules/commands if available; otherwise provide a dry-run/manual instruction output.
- This slice should not guess unsafe global config paths. If a path cannot be determined, report a clear manual instruction.

## Likely Files

- `packages/core/src/agent/*`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- tests
- `README.md`

## Acceptance Criteria

- User-level Claude install writes no target repo files.
- Dry-run shows exactly what would be written.
- In external state mode, feedback export defaults to an external file path unless `--file` is explicitly supplied.
- `agent next`/`agent prompt` mention external feedback path in feedback phase.
- Project-local bootstrap and command install still work for users who want repo-local integration.
- Tests verify no target repo files are created in personal mode.

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
pathfinder agent install --user claude --dry-run
pathfinder agent install --user claude
git status --short
```

`git status --short` should not show Pathfinder-created files in the target repo.

## Completion Notes

- Added `pathfinder agent install --user claude|opencode|all [--dry-run]`.
- Claude user-level install manages a marked Pathfinder block in the user's `.claude/CLAUDE.md` and writes no target-repo files.
- OpenCode user-level install reports manual instructions instead of guessing an unsafe global path.
- In external state mode, `pathfinder feedback export <workstream-id>` without `--file` writes `.pathfinder-feedback.md` under that repository's external Pathfinder state root.
- `agent next --json` and `agent prompt` now include the external feedback queue path in feedback phase.
- Repo-local `agent bootstrap` and `agent commands install` behavior remains available and covered.
- Added core, state, and CLI tests for user-level install, no repo writes, external feedback export defaults, and external feedback prompt text.
- Updated README usage for user-level install and external feedback exports.

Checks run:

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test run with temporary `PATHFINDER_HOME` and `PATHFINDER_USER_HOME` values:

```bash
pathfinder config set state.mode external
pathfinder agent install --user claude --dry-run
pathfinder agent install --user claude
git status --short
```
