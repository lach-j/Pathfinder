# Session Monitoring And Review Loop

Status: idea

## Summary

Add UI support for observing launched agent sessions, seeing their current output, running checks, opening local reviews, exporting feedback, and driving the human review loop for each slice.

This keeps the developer in control while letting multiple agent sessions progress in separate worktrees.

## User Story

As a developer, I want to click into each active agent session, see what it is doing, inspect its branch and diff, run checks, leave review feedback, and send that feedback back to the agent until the slice is approved.

## Assumptions

- Pathfinder can track session metadata without owning the agent process internals.
- Capturing terminal output is useful, but the core state should not depend on a specific terminal emulator.
- A session may be launched by Pathfinder or registered after being started manually.
- The review loop remains human-driven.
- Checks should run locally in the relevant worktree.
- Review feedback should reuse existing Pathfinder comments and feedback export concepts.

## Requirements

- Show active sessions for a workstream.
- Display per-session:
  - Slice.
  - Branch.
  - Worktree path.
  - Agent preset.
  - Current phase.
  - Last output or transcript path.
  - Check status.
  - Review status.
  - Open comment count.
- Let the user open a session detail view.
- Let the user view current or recent agent output when available.
- Let the user run configured checks in the session worktree.
- Let the user start or refresh a Pathfinder review session against the relevant base branch.
- Let the user add and resolve review comments through the local review UI.
- Let the user export open feedback for that session.
- Let the user send or copy feedback back into the active agent session where supported.
- Prevent the UI from claiming a session is approved until the developer marks the review approved or the slice complete.

## Session Phases

Possible display phases:

```text
prepared
launched
implementing
checks_running
ready_for_review
reviewing
feedback_requested
fixing_feedback
approved
complete
blocked
abandoned
```

These should map to domain state before they become interactive UI behavior.

## Checks

Checks may include:

- Typecheck.
- Tests.
- Lint.
- Build.
- Slice-specific smoke commands.

Check results should be stored as evidence where practical, including command, exit code, timestamp, and a short output summary.

## Review Loop

Expected loop:

```text
Agent implements slice
Pathfinder runs checks
Developer reviews local diff
Developer leaves comments
Pathfinder exports feedback queue
Agent addresses feedback
Pathfinder refreshes review
Developer approves or repeats
```

The UI should make this loop feel like one workflow, but the state should stay compatible with CLI commands.

## Out Of Scope

- No autonomous approval.
- No automatic comment resolution.
- No hidden pushes.
- No hosted logs.
- No team dashboard.
- No AI review requirement.

## Later Slice Candidates

- Store agent session records.
- Register a manually started session.
- Capture or link agent transcript output.
- Run checks inside a session worktree.
- Show session detail in the UI.
- Connect session review state to existing local review UI.
- Export feedback for a specific session.

