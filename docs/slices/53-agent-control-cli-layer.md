# Slice 53: Agent Control CLI Layer

Status: ready

## Goal

Add a minimal CLI-first control layer that lets Pathfinder represent agent actions such as continue, address review feedback, approve human review, and prepare PR output without requiring the browser UI to own agent orchestration.

## Reason

The workspace should eventually let a developer trigger an agent to continue from UI actions, but the product should first define a portable control surface that works without a full agent manager. This keeps the core workflow useful for users who prefer CLI-driven Codex, Claude Code, OpenCode, Cursor, or manual agent sessions.

## Requirements

- Add explicit local agent action records or commands for:
  - continue current slice
  - address open review feedback
  - run agent first-pass review, if slice 50 exists
  - generate or revise PR draft, if slice 51 exists
  - mark human approval intent or route to existing approval command
- Keep `pathfinder agent next --json` as the canonical state query.
- Add commands that render the exact prompt/instructions for the requested action.
- Do not require direct process spawning in this slice.
- Do not require Strands Agents or any other agent framework in this slice.
- Design the command shape so a later UI can call it through the local server.
- Keep all state local and inspectable.
- Do not automatically approve reviews or resolve comments.

## Technical Notes

- The first implementation should be "control intent plus prompt rendering", not full agent lifecycle management.
- If action records are persisted, they should include requested action, target workstream/slice/session, created timestamp, and status.
- The local server can expose these actions later; keep core behavior reusable.
- This slice may only add CLI behavior if the state model is not ready for persisted action records.
- Strands Agents can be investigated later as a runner backend, but should not be a hard dependency for the portable control contract.

## Likely Files

- `packages/core/src/agent/*`
- `packages/core/src/domain.ts`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/formatters.ts`
- `packages/local-server/src/review-server.ts`, only if exposing read-only action metadata is needed now
- `README.md`
- tests

## Acceptance Criteria

- A user can ask Pathfinder for the next agent action and receive a command-specific prompt.
- Feedback, review, and PR actions are represented distinctly rather than as one generic prompt.
- The action layer does not spawn or manage agent processes.
- The command output is suitable for copy/paste into Codex, Claude Code, OpenCode, Cursor, or manual use.
- Existing `agent next` behavior remains compatible.
- Human approval remains explicit and is not inferred from an agent action.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
pathfinder agent next --json
pathfinder agent action prompt --action address-feedback
pathfinder agent action prompt --action prepare-pr
```
