# Structured Agent Feedback Protocol

Status: idea

## Summary

Turn the current markdown feedback queue into a structured local feedback protocol that tracks exported feedback, agent attempts, addressed items, verification state, and final human resolution.

The current feedback export is useful, but the next version should let Pathfinder understand the lifecycle of an agent feedback pass instead of treating it as a one-time markdown handoff.

## Gap

Pathfinder can export open comments and tell an agent what to do next. It does not yet record that a feedback queue was exported, which agent session attempted it, which comments were touched, whether checks ran, or whether the human verified the fixes.

## Assumptions

- The human remains responsible for resolving comments.
- A feedback attempt may be performed by Codex, Claude Code, OpenCode, Cursor, or a manual user.
- The protocol should work as local JSON plus markdown before any tool-specific hook support.
- Agent output should be linked or summarized, not hidden in an external system.

## State Ideas

```text
.pathfinder/
  workstreams/
    <workstream-id>/
      feedback-runs.json
```

Possible feedback run shape:

```json
{
  "id": "feedback-review-add-report-2026-06-14",
  "workstreamId": "inventory-alerts",
  "sliceId": "add-report",
  "reviewSessionId": "review-add-report",
  "commentIds": ["handle-empty-case"],
  "status": "exported",
  "exportedPath": ".pathfinder-feedback.md",
  "agent": {
    "tool": "codex",
    "sessionPath": null
  },
  "createdAt": "2026-06-14T00:00:00.000Z",
  "updatedAt": "2026-06-14T00:00:00.000Z"
}
```

Candidate statuses:

```text
exported
in_progress
agent_reported_done
checks_failed
ready_for_human_review
verified
abandoned
```

## Requirements

- Record every feedback export as a feedback run when requested.
- Link feedback runs to the exact comment ids included in the queue.
- Allow a run to store agent output path, transcript path, or manual notes.
- Add commands to list and show feedback runs.
- Let `agent next` account for active feedback runs when deciding between `feedback`, `needs_human_review`, and `ready_for_pr`.
- Include feedback run history in PR markdown.
- Keep markdown export available as the portable handoff artifact.

## Agent Integration Path

1. Record feedback run on export.
2. Let users mark a run as agent-reported-done after an external agent pass.
3. Refresh the review session and mark the run ready for human review.
4. Later, let native wrappers or MCP tools update the run automatically.

## Out Of Scope

- No automatic comment resolution.
- No hidden agent invocation.
- No remote queue service.
- No hosted transcripts.
- No provider-specific assumptions in core state.

## Later Slice Candidates

- Add `feedback-runs.json` state and CLI list/show commands.
- Add `pathfinder feedback export --record-run`.
- Add `pathfinder feedback run update <id> --status ...`.
- Teach `agent next` about active feedback runs.
- Surface feedback run status in the local review UI.

