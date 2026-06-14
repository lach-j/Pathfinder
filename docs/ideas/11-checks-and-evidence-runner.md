# Checks And Evidence Runner

Status: idea

## Summary

Add local check execution that records command results as Pathfinder evidence, making test output, logs, screenshots, and manual QA notes easier to attach to slices and PR drafts.

## Gap

Evidence currently exists as manual metadata. Pathfinder does not run checks, capture command output, summarize failures, or connect check results to review sessions and feedback runs.

## Assumptions

- Checks are local commands configured by the user or repository.
- Pathfinder should not replace CI.
- Check execution should be explicit and visible.
- Outputs should be summarized in JSON and optionally stored as log files under `.pathfinder/`.
- The first version can support command checks before screenshots or browser automation.

## State Ideas

```text
.pathfinder/
  checks.json
  workstreams/
    <workstream-id>/
      check-runs.json
      evidence/
        <check-run-id>.log
```

Possible check config:

```json
{
  "checks": [
    {
      "id": "typecheck",
      "label": "Typecheck",
      "command": "npm run typecheck"
    },
    {
      "id": "test",
      "label": "Tests",
      "command": "npm test"
    }
  ]
}
```

Possible check run:

```json
{
  "id": "check-typecheck-2026-06-14",
  "sliceId": "add-report",
  "reviewSessionId": "review-add-report",
  "checkId": "typecheck",
  "command": "npm run typecheck",
  "exitCode": 0,
  "status": "passed",
  "startedAt": "2026-06-14T00:00:00.000Z",
  "completedAt": "2026-06-14T00:01:00.000Z",
  "logPath": ".pathfinder/workstreams/inventory-alerts/evidence/check-typecheck.log"
}
```

## Requirements

- Add repository-level check configuration.
- Add `pathfinder check run <check-id> [--slice <slice-id>] [--session <session-id>]`.
- Capture exit code, duration, command, output summary, and optional log path.
- Attach successful and failed check runs as evidence.
- Show latest check status in `current`, `agent next`, review UI, and PR markdown.
- Let feedback export include failing check context for the agent.
- Avoid shell injection by treating commands carefully and documenting platform behavior.

## Out Of Scope

- No CI replacement.
- No cloud logs.
- No scheduled background checks.
- No hidden command execution.
- No mandatory test framework integration.

## Later Slice Candidates

- Add check config state and CLI list/run commands.
- Store check run records and logs.
- Include check runs in evidence and PR markdown.
- Add review UI check status.
- Add feedback queue context for failed checks.
- Add optional screenshot evidence workflow later.

