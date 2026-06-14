# Slice 39: Human Review Approval Gate

Status: ready

## Goal

Make the human review gate explicit, scriptable, and unambiguous for both users and agents.

## Reason

In the QuickNotes rollout transcript, Pathfinder returned `needs_human_review` after feedback comments were no longer open. The user reasonably asked whether "human approval" meant they should do something programmatically or simply say "Approved".

The current phase is directionally correct: agents should not mark comments resolved or complete a reviewed slice without human intent. But the response should make the valid approval paths obvious.

## Requirements

- Rename or supplement the phase language so it clearly means "awaiting approval", for example:

```text
awaiting_human_approval
```

- Preserve backward compatibility for existing integrations that know `needs_human_review`, either through an alias, migration, or documented compatibility behavior.
- Add a first-class command for recording approval, for example:

```bash
pathfinder review approve <workstream-id> --session <review-session-id>
```

- Approval should:
  - require no open review comments for the session
  - record an approval event or evidence entry
  - mark the active slice complete, or clearly tell the user the exact slice completion command to run
  - leave comment resolution semantics unchanged
- `pathfinder agent next --json` should include both human paths:
  - open the review UI or inspect the diff
  - approve the review with the command or explicitly tell the agent "approved"
- The agent prompt should say that generic "continue" is not approval unless the user explicitly indicates approval.
- The final user-facing text should explain that this is a real human decision gate, not hidden automation.

## Technical Notes

- Keep approval local-first and filesystem-backed. Do not add remote review or Git hosting integrations.
- If approval records are added, store them with existing review/evidence state rather than creating a parallel approval file.
- Consider whether approval should be attached to a review session, slice, or both. The command should at least validate that the session belongs to the active slice.
- Do not make agents resolve comments automatically as part of approval.

## Likely Files

- `packages/core/src/domain.ts`
- `packages/core/src/agent/next.ts`
- `packages/core/src/agent/prompt.ts`
- `packages/core/src/review/*`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- tests
- `README.md`

## Acceptance Criteria

- With an active review session and no open comments, `pathfinder agent next --json` clearly reports an approval gate.
- The response includes an explicit approval command and clear human wording.
- `pathfinder review approve <workstream-id> --session <review-session-id>` refuses approval while comments are open.
- Approval succeeds when no comments are open and records durable state.
- After approval, `pathfinder agent next --json` can advance to the next slice selection phase.
- The prompt tells agents not to treat vague "continue" messages as approval.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder agent next --json
pathfinder comment list <workstream-id> --session <review-session-id> --open
pathfinder review approve <workstream-id> --session <review-session-id>
pathfinder agent next --json
```

