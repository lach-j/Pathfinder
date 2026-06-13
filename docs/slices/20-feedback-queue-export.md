# Slice 20: Feedback Queue Export

Status: ready

## Goal

Export open review comments as an agent-actionable markdown queue that can be handed to Claude, Codex, Cursor, or another coding agent.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/skills-replacement-examples/implement-stage.md`
- `docs/slices/19-inline-comment-anchors.md`
- This file

## Product Context

The primary loop is: review local diff, leave feedback, ask the agent to action all open feedback, then review again. The first bridge should be explicit markdown and CLI output rather than MCP or tool-specific hooks.

## Scope

Implement:

```bash
pathfinder feedback export <workstream-id> [--session <session-id>] [--file ./feedback.md]
```

Expected behavior:

- Reads open comments for the workstream or session.
- Groups comments by target: line comments first by file, then file comments, then slice/workstream comments.
- Includes active workstream, active slice, plan path, requirements path, base/head/session metadata when available.
- Includes clear instructions for an agent:
  - address every open item
  - keep changes scoped to the active slice
  - run tests/checks
  - do not resolve Pathfinder comments unless asked
- Writes markdown when `--file` is provided, otherwise prints to stdout.
- Does not call an AI provider.

## Out Of Scope

- No direct agent invocation.
- No MCP.
- No Claude/Codex hooks.
- No automatic comment resolution.
- No UI.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Export is deterministic and readable.
- Output includes enough context for a fresh agent session.
- Empty open-feedback state produces a useful empty-state message.
- Tests cover grouped output, session filtering, file writing, and no-comment output.
- README documents the manual feedback loop.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder feedback export <workstream-id>
npm exec -- pathfinder feedback export <workstream-id> --session <session-id> --file ./.pathfinder-feedback.md
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/skills-replacement-examples/implement-stage.md, and docs/slices/20-feedback-queue-export.md.

Current slice goal:
Export open Pathfinder review comments as deterministic markdown that an AI coding agent can action in bulk.

Implement only this slice.

Do not invoke agents, build MCP, build Claude/Codex hooks, add automatic comment resolution, build UI, integrate with GitHub/GitLab, call external APIs, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test feedback export.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
