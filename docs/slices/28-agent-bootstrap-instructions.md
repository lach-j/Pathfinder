# Slice 28: Agent Bootstrap Instructions

Status: done

## Goal

Add a Pathfinder bootstrap command that installs or updates repository-level instructions so coding agents know to start with `pathfinder agent next --json`.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/26-agent-next-state-machine.md`
- `docs/slices/27-agent-prompt-rendering.md`
- This file

## Product Context

The user should not have to remember every Pathfinder command. The repository itself should teach compatible coding agents how to use Pathfinder.

The bootstrap contract is:

```text
When asked to plan, implement, continue, review, or address feedback in this repo, first run:

pathfinder agent next --json

Follow the returned phase, commands, and agentInstruction. Do not invent a parallel workflow.
```

For Codex and many other coding agents, `AGENTS.md` is the portable discovery mechanism. Pathfinder should be able to add this contract to the repo instructions idempotently.

## Scope

Implement:

```bash
pathfinder init --agents
pathfinder agent bootstrap
pathfinder agent bootstrap --dry-run
```

Expected behavior:

- Adds or updates a clearly marked Pathfinder section in root `AGENTS.md`.
- If no `AGENTS.md` exists, creates one with a minimal Pathfinder section.
- Preserves existing user content outside the Pathfinder-managed block.
- Is idempotent: running it twice does not duplicate the block.
- `--dry-run` prints the proposed change without writing.
- The managed block points agents to `pathfinder agent next --json` and `pathfinder agent prompt`.
- The managed block explicitly says:
  - Pathfinder is the source of truth for planning, slice scope, review feedback, and PR output.
  - Agents should not create unmanaged task lists or parallel plans when Pathfinder state exists.
  - Agents should not resolve Pathfinder comments automatically.
  - MCP is not required for this workflow.

Suggested managed block markers:

```markdown
<!-- pathfinder-agent:start -->
## Pathfinder Agent Workflow

...
<!-- pathfinder-agent:end -->
```

## Technical Decisions

- `AGENTS.md` bootstrap is the cross-agent baseline.
- The bootstrap command may be exposed both as `pathfinder init --agents` and `pathfinder agent bootstrap` for discoverability.
- Managed block markers are required so updates are safe.
- Do not overwrite existing `AGENTS.md` content.
- Do not edit global agent config files in this slice.

## Out Of Scope

- No Claude command generation.
- No OpenCode command generation.
- No global user-level instruction files.
- No MCP.
- No hooks.
- No external API calls.

## Likely Files

- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`
- `AGENTS.md` only if repository bootstrap is intentionally run for Pathfinder itself during the slice

## Acceptance Criteria

- Bootstrap creates `AGENTS.md` when missing.
- Bootstrap updates an existing managed block.
- Bootstrap preserves existing content outside the managed block.
- Bootstrap is idempotent.
- `--dry-run` does not write files.
- Tests cover create, update, idempotency, and dry-run behavior.
- README documents the bootstrap command as the recommended first setup step for agent integration.

## Implementation Notes

- Added `PathfinderStore.bootstrapAgentInstructions()` to create, update, and dry-run a marker-managed root `AGENTS.md` block without requiring existing `.pathfinder/` state.
- Added the managed Pathfinder agent workflow block with instructions to start from `pathfinder agent next --json`, use `pathfinder agent prompt`, avoid unmanaged parallel plans, leave comment resolution to the developer, and not require MCP.
- Added `pathfinder agent bootstrap [--dry-run]`.
- Added `pathfinder init --agents`, which initializes Pathfinder state when needed and installs the same agent instruction block.
- Added state and CLI tests covering creation, update, preservation of existing content, idempotency, dry-run behavior, and init integration.
- Updated README and CLI help with the bootstrap commands.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke tested in temporary Git repositories:

```bash
npm exec --prefix C:\Users\Lachlan\Documents\Pathfinder -- pathfinder agent bootstrap --dry-run
npm exec --prefix C:\Users\Lachlan\Documents\Pathfinder -- pathfinder agent bootstrap
npm exec --prefix C:\Users\Lachlan\Documents\Pathfinder -- pathfinder init --agents
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
npm exec -- pathfinder agent bootstrap --dry-run
npm exec -- pathfinder agent bootstrap
npm exec -- pathfinder init --agents
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/26-agent-next-state-machine.md, docs/slices/27-agent-prompt-rendering.md, and docs/slices/28-agent-bootstrap-instructions.md.

Current slice goal:
Add a Pathfinder bootstrap command that installs an idempotent AGENTS.md section telling coding agents to start with pathfinder agent next --json.

Implement only this slice.

Do not generate Claude/OpenCode command files, edit global user configs, build MCP, add hooks, call external APIs, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test dry-run and write modes.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
