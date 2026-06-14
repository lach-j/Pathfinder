# Slice 30: Agent Integration Doctor

Status: done

## Goal

Add a diagnostic command that verifies Pathfinder's agent integration is installed and explains the next setup or workflow action.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/26-agent-next-state-machine.md`
- `docs/slices/28-agent-bootstrap-instructions.md`
- `docs/slices/29-native-agent-command-wrappers.md`
- This file

## Product Context

After bootstrap and native command generation exist, the user needs a simple way to answer:

```text
Is this repository ready for agent-driven Pathfinder workflow?
```

This is especially important because Pathfinder should not feel like a separate system the user has to manually manage.

## Scope

Implement:

```bash
pathfinder agent doctor
pathfinder agent doctor --json
```

Expected behavior:

- Checks whether `.pathfinder/project.json` exists.
- Checks whether `AGENTS.md` exists and contains the Pathfinder managed block.
- Checks whether supported native command wrappers are installed:
  - Claude Code project commands
  - OpenCode project commands
- Checks whether `pathfinder agent next --json` can determine a phase.
- Prints clear setup commands for missing pieces.
- JSON output is deterministic and scriptable.

Suggested JSON shape:

```json
{
  "ok": false,
  "checks": [
    {
      "id": "agents-md",
      "status": "missing",
      "message": "AGENTS.md does not contain the Pathfinder managed block.",
      "fixCommand": "pathfinder agent bootstrap"
    }
  ],
  "next": {
    "phase": "needs_slice_selection",
    "command": "pathfinder agent next --json"
  }
}
```

## Technical Decisions

- `doctor` diagnoses setup and workflow readiness; it should not mutate files.
- Fixes are printed as commands rather than applied automatically.
- JSON output should use stable check ids.
- Doctor should call or share logic with `agent next` rather than duplicate phase detection.
- This slice should also update README with the recommended end-to-end agent integration story.

## Out Of Scope

- No MCP.
- No automatic fixing.
- No global config inspection.
- No network calls.
- No agent invocation.
- No hooks.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`
- `docs/implementation-status.md`

## Acceptance Criteria

- `pathfinder agent doctor` reports missing bootstrap instructions clearly.
- `pathfinder agent doctor` reports installed native command wrappers clearly.
- `--json` returns stable machine-readable check results.
- Doctor output includes fix commands but does not write files.
- README explains the deterministic integration loop:
  1. Run bootstrap.
  2. Install optional commands.
  3. Tell the agent to continue with Pathfinder.
  4. Agent starts with `pathfinder agent next --json`.
  5. User reviews in the UI and agent addresses feedback.
- Tests cover missing setup, fully installed setup, and JSON output.

## Implementation Notes

- Added `PathfinderStore.getAgentDoctor()` as a read-only diagnostic that checks local Pathfinder state, the root `AGENTS.md` managed block, Claude Code and OpenCode command wrapper status, and the existing `agent next` phase.
- Added `pathfinder agent doctor` and `pathfinder agent doctor --json` with stable check ids and fix commands for missing or stale setup.
- Added CLI and state tests for missing setup, fully installed setup, and deterministic JSON output.
- Updated README with the end-to-end deterministic agent integration loop and doctor usage.

## Completed Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke tested:

```bash
npm exec -- pathfinder agent doctor
npm exec -- pathfinder agent doctor --json
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
npm exec -- pathfinder agent doctor
npm exec -- pathfinder agent doctor --json
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/26-agent-next-state-machine.md, docs/slices/28-agent-bootstrap-instructions.md, docs/slices/29-native-agent-command-wrappers.md, and docs/slices/30-agent-integration-doctor.md.

Current slice goal:
Add pathfinder agent doctor to verify Pathfinder's agent integration setup and document the end-to-end agent workflow.

Implement only this slice.

Do not build MCP, automatic fixing, global config inspection, network calls, agent invocation, hooks, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test doctor in text and JSON modes.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
