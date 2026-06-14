# Slice 26: Agent Next State Machine

Status: done

## Goal

Add the canonical deterministic command that tells any coding agent what Pathfinder phase the repository is in and what to do next.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/20-feedback-queue-export.md`
- `docs/slices/24-review-refresh-and-stale-comments.md`
- `docs/slices/25-pr-composer-review-loop.md`
- This file

## Product Context

The current Pathfinder CLI has the primitives for planning, slices, review sessions, feedback export, and PR output. The missing integration layer is a deterministic agent contract.

The agent should not infer the workflow from prose. It should have one canonical first command:

```bash
pathfinder agent next --json
```

That command should inspect local Pathfinder and Git state and return the next recommended action as structured data.

This replaces the implicit "agent remembers the skill" behavior from the old `plan-stages` and `implement-stage` skills with a tool-neutral local state machine.

## Scope

Implement:

```bash
pathfinder agent next
pathfinder agent next --json
```

Expected behavior:

- Requires no network and no AI provider.
- Uses local `.pathfinder/` state, active workstream/slice state, review sessions, comments, and Git state.
- Returns a deterministic phase, reason, relevant ids, recommended commands, and a concise agent instruction.
- Human output is readable.
- JSON output is stable enough for Claude Code, Codex, OpenCode, Cursor, or shell scripts to consume.

Suggested JSON shape:

```json
{
  "phase": "feedback",
  "reason": "Active review session has open comments.",
  "workstreamId": "inventory-alerts",
  "sliceId": "add-report",
  "reviewSessionId": "review-add-report",
  "commands": [
    "pathfinder feedback export inventory-alerts --session review-add-report --file ./.pathfinder-feedback.md"
  ],
  "agentInstruction": "Read ./.pathfinder-feedback.md, address every open comment while staying scoped to the active slice, run checks, then run pathfinder review refresh inventory-alerts review-add-report. Do not resolve comments automatically.",
  "humanInstruction": "Review the updated diff after the agent refreshes the session."
}
```

Suggested phases:

```text
uninitialized
needs_workstream
needs_plan
needs_slice_selection
ready_to_implement
needs_review_session
needs_human_review
feedback
ready_for_pr
blocked
```

Phase guidance:

- `uninitialized`: no `.pathfinder/project.json`; recommend `pathfinder init`.
- `needs_workstream`: initialized but no workstreams; recommend planning.
- `needs_plan`: active or only workstream has no meaningful plan/slices; recommend planning/import.
- `needs_slice_selection`: workstream has actionable slices but no active slice; recommend `pathfinder slice next` and `pathfinder slice active`.
- `ready_to_implement`: active slice exists, has no open review feedback, and is not complete; recommend implementation.
- `needs_review_session`: active slice has changes but no review session; recommend `pathfinder review start --base <base-ref>`.
- `needs_human_review`: review session exists and has no open comments; recommend local UI review.
- `feedback`: open comments exist for the active workstream/session; recommend feedback export and fix loop.
- `ready_for_pr`: all slices complete or no open feedback remains after review; recommend PR generation.
- `blocked`: state is inconsistent, for example active slice id no longer exists.

## Technical Decisions

- `pathfinder agent next --json` is the canonical integration point.
- Agent integrations should not call lower-level commands first; they should ask `agent next` what to do.
- JSON is the stable contract; human text can be nicer but must not be the only contract.
- This command must not invoke an agent or mutate code.
- This command may be read-only except for no-op validation; mutation belongs in later explicit commands.
- Base ref selection should be conservative. If no base ref is known from active slice metadata or a review session, return a command with `<base-ref>` placeholder and phase `needs_review_session` or `ready_to_implement` rather than guessing.

## Out Of Scope

- No MCP.
- No Claude hooks.
- No Codex-specific APIs.
- No OpenCode-specific APIs.
- No AI review.
- No automatic command execution.
- No hosted service.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- `pathfinder agent next --json` returns valid deterministic JSON for every major phase.
- `pathfinder agent next` prints the same recommendation in readable text.
- Missing or inconsistent state produces a useful `blocked` or setup phase instead of an uncaught exception where practical.
- Tests cover at least: uninitialized, no workstream, no active slice, ready to implement, open feedback, and ready for PR.
- README documents the command as the first command an agent should run.

## Implementation Notes

- Added a pure core agent-next state machine with stable phases, reasons, ids, commands, and agent/human instructions.
- Added `PathfinderStore.getAgentNext()` to assemble local project, workstream, slice, review session, comment, plan, and optional Git summary state without mutating files.
- Added `pathfinder agent next` and `pathfinder agent next --json`.
- Base ref inspection is conservative: Git summary is requested only when a base ref is already known from active slice or review session metadata; otherwise output keeps `<base-ref>` placeholders.
- Added core, state, and CLI tests for setup, slice selection, ready-to-implement, review session, human review, feedback, and PR-ready recommendations.
- Updated README to document `agent next --json` as the canonical first agent command.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke tested:

```bash
npm exec -- pathfinder agent next
npm exec -- pathfinder agent next --json
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
npm exec -- pathfinder agent next
npm exec -- pathfinder agent next --json
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/20-feedback-queue-export.md, docs/slices/24-review-refresh-and-stale-comments.md, docs/slices/25-pr-composer-review-loop.md, and docs/slices/26-agent-next-state-machine.md.

Current slice goal:
Add pathfinder agent next and pathfinder agent next --json as the deterministic state machine that tells coding agents what Pathfinder action should happen next.

Implement only this slice.

Do not build MCP, Claude hooks, Codex-specific APIs, OpenCode-specific APIs, AI review, automatic command execution, hosted services, auth, billing, cloud sync, organisations, roles, or external API calls.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test agent next in text and JSON modes.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
