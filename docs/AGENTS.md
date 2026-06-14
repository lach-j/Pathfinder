# AGENTS.md

## Area

`docs/` contains product context, implementation status, slice handoffs, and agent-session guidance.

## Belongs Here

- PRD and product boundary updates.
- Slice handoff documents.
- Implementation status tracking.
- Agent prompts and contribution guidance.

## Does Not Belong Here

- Generated build output.
- Runtime Pathfinder state.
- Implementation code.

## Contribution Pattern

For implementation slices, update only the assigned slice handoff and `docs/implementation-status.md` unless the requested work is documentation-focused.

Keep slice documents scoped. They should define goals, constraints, likely files, acceptance criteria, checks, and smoke tests for one vertical slice.

## Documentation Placement

- Put active slice status, sequencing, and completion notes in `docs/implementation-status.md`.
- Put one-slice implementation instructions in `docs/slices/`.
- Put broad product vision and stable product boundaries in `PATHFINDER_PRD.md`.
- Put speculative ideas that are not ready for implementation in `docs/ideas/`.
- Put reusable agent handoff instructions in `docs/agent-session-prompt.md`.
- Put user-facing install and command usage in root `README.md`.
- Put package- or directory-specific implementation patterns in the nearest `AGENTS.md`.

Avoid duplicating current status or future sequencing across multiple documents. Prefer links to the owning document.
