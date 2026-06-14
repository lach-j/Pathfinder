# Slice 29: Native Agent Command Wrappers

Status: done

## Goal

Generate optional project-level native command wrappers for agent tools that support slash/custom commands, starting with Claude Code and OpenCode.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/26-agent-next-state-machine.md`
- `docs/slices/27-agent-prompt-rendering.md`
- `docs/slices/28-agent-bootstrap-instructions.md`
- This file

## Product Context

`AGENTS.md` solves passive discovery, but tools like Claude Code and OpenCode also support explicit slash/custom commands. Pathfinder should generate thin wrappers so the user can type a memorable command rather than remembering the lower-level CLI.

The wrappers should not duplicate workflow logic. They should tell the agent to run Pathfinder's canonical commands.

## Scope

Implement:

```bash
pathfinder agent commands install
pathfinder agent commands install --tool claude
pathfinder agent commands install --tool opencode
pathfinder agent commands install --dry-run
pathfinder agent commands list
```

Expected behavior:

- Writes project-level command markdown files for supported tools.
- Preserves existing user command files unless they are Pathfinder-managed.
- Uses clear managed-file markers.
- Is idempotent.
- `--dry-run` prints planned file writes.
- `list` shows supported tools, install status, and paths.

Suggested generated files:

```text
.claude/commands/pathfinder-plan.md
.claude/commands/pathfinder-continue.md
.claude/commands/pathfinder-feedback.md

.opencode/commands/pathfinder-plan.md
.opencode/commands/pathfinder-continue.md
.opencode/commands/pathfinder-feedback.md
```

Suggested command behavior:

- `pathfinder-plan`: run `pathfinder agent prompt --phase plan` and follow it.
- `pathfinder-continue`: run `pathfinder agent next --json`, then `pathfinder agent prompt`, and follow the current phase.
- `pathfinder-feedback`: run `pathfinder agent prompt --phase feedback` and follow it.

The generated prompts should include this rule:

```text
Do not infer the Pathfinder workflow manually. Run the listed Pathfinder command and follow its output.
```

## Technical Decisions

- Native command wrappers are optional convenience files, not the source of truth.
- The source of truth remains `pathfinder agent next --json` plus `pathfinder agent prompt`.
- Start with Claude Code and OpenCode because both support project-level markdown command files.
- Codex integration remains through `AGENTS.md` for now; do not invent a Codex-specific command format unless Codex exposes one in the future.
- Use project-level files only. Do not write user-global command files.

## Out Of Scope

- No MCP.
- No hooks.
- No global command installation.
- No automatic command execution.
- No VS Code custom agents yet.
- No Cursor-specific rules unless explicitly requested later.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Command installation creates Claude Code wrapper files.
- Command installation creates OpenCode wrapper files.
- `--tool` limits installation to the selected tool.
- Existing non-Pathfinder command files are not overwritten.
- Existing Pathfinder-managed command files are updated idempotently.
- `--dry-run` does not write files.
- `list` reports install status and paths.
- Tests cover install, dry-run, idempotency, and overwrite protection.

## Implementation Notes

- Added managed native command wrapper definitions for Claude Code and OpenCode under the core agent command module.
- Added state-level install and list behavior for project-level command files, with dry-run support, idempotent managed-file updates, and protection for existing user-owned files.
- Added `pathfinder agent commands install [--tool claude|opencode] [--dry-run]` and `pathfinder agent commands list`.
- Added core, state, and CLI tests covering command definitions, install, dry-run, per-tool install, idempotency, list output, and overwrite protection.
- Updated README usage and check examples for the native command wrapper commands.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke tested:

```bash
npm exec -- pathfinder agent commands list
npm exec -- pathfinder agent commands install --dry-run
npm exec -- pathfinder agent commands install --tool claude
npm exec -- pathfinder agent commands install --tool opencode
```

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder agent commands list
npm exec -- pathfinder agent commands install --dry-run
npm exec -- pathfinder agent commands install --tool claude
npm exec -- pathfinder agent commands install --tool opencode
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/26-agent-next-state-machine.md, docs/slices/27-agent-prompt-rendering.md, docs/slices/28-agent-bootstrap-instructions.md, and docs/slices/29-native-agent-command-wrappers.md.

Current slice goal:
Generate optional project-level Claude Code and OpenCode command wrappers that delegate to Pathfinder's deterministic agent commands.

Implement only this slice.

Do not build MCP, hooks, global command installation, automatic command execution, VS Code custom agents, Cursor-specific rules, external APIs, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test command list, dry-run, and per-tool install modes.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
