# Workspace UI Shell

Status: idea

## Summary

Expand the local browser app from a review viewer into a broader Pathfinder workspace that covers workstream intake, requirements, planning, slices, evidence, agent readiness, review sessions, feedback, and PR drafts.

## Gap

The UI currently starts inside the local review loop. Most other Pathfinder capabilities are CLI-only: creating workstreams, importing plans, editing requirements, selecting slices, running agent doctor, viewing evidence, and generating PR drafts.

## Assumptions

- The UI remains local-only and served by the local server.
- Business logic remains in core/state/git and local server endpoints.
- The first workspace shell can be read-mostly and add mutations one workflow at a time.
- Review remains the center of the product, but surrounding context should be visible.

## Primary Views

- Workstream list and active workstream selector.
- Workstream overview.
- Requirements view.
- Plan view.
- Slice board and dependency list.
- Slice detail.
- Evidence view.
- Agent readiness view.
- Review sessions and diff review.
- Feedback queue preview.
- PR draft preview.

## Requirements

- Add local server endpoints for workstream overview data.
- Add active workstream and active slice selection from the UI.
- Show requirements and plan markdown.
- Show slices with status, dependencies, branch metadata, review sessions, evidence count, and open comments.
- Show agent doctor and agent next recommendations.
- Let the user generate and preview feedback queues.
- Let the user generate and preview PR markdown.
- Keep write actions explicit and reversible where practical.
- Maintain useful empty states for repositories without Pathfinder state.

## UX Direction

- Quiet, dense, work-focused interface.
- No SaaS-style team dashboard.
- No marketing landing page.
- No decorative hero sections.
- Optimize for repeated review and planning work.

## Out Of Scope

- No hosted backend.
- No authentication or team roles.
- No replacing an IDE.
- No issue tracker replacement.
- No automatic agent execution in the shell.

## Later Slice Candidates

- Add workstream overview endpoint.
- Add workspace navigation shell.
- Add read-only requirements and plan views.
- Add slice board with status and dependency filters.
- Add active slice selection.
- Add agent doctor panel.
- Add PR draft preview panel.

