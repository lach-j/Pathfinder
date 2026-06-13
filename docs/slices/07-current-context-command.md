# Slice 07: Current Context Command

Status: done

## Goal

Add an agent-friendly command that prints the current Pathfinder context from local state.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

Implement:

```bash
pathfinder current
```

Expected behavior:

- Shows active workstream and active slice.
- Includes slice title, description, and status.
- Includes plan location or a concise plan excerpt.
- Includes unresolved comments if comment support exists.
- Uses local state only.
- Fails clearly if `.pathfinder` does not exist.

## Out Of Scope

- No MCP resources.
- No Claude/Codex hooks.
- No AI-generated context.
- No local HTTP API.
- No UI.

## Acceptance Criteria

- Output is easy for a human or agent to read.
- No active slice is handled clearly.
- Tests cover state helpers if new ones are added.
- README includes the command.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/07-current-context-command.md.

Current slice goal:
Implement pathfinder current as a local state read command for humans and agents.

Do not build MCP, hooks, local HTTP API, AI behavior, UI, GitHub/GitLab integration, or external APIs.

Run npm run typecheck, npm test, and npm run lint --if-present. Smoke test pathfinder current.

Summarise changed files and manual verification commands.
```
