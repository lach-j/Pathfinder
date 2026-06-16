# Slice 50: Agent First-Pass Review

Status: done

## Goal

Add a local workflow for an agent to perform the first review pass and write agent-authored file or inline comments before the human review pass.

## Reason

Pathfinder should help catch obvious implementation issues before the developer spends time on manual review. Agent-authored comments need distinct metadata and feedback behavior so a later implementation agent does not blindly respond to its own comments as if they were human feedback.

## Requirements

- Add explicit comment origin metadata for review comments:
  - human
  - agent
  - system or deterministic check, if already useful
- Preserve existing comments by treating missing origin as human.
- Add a command that emits an agent-review prompt for the current review session or branch-review session.
- Let users configure the agent-review prompt/template locally.
- Add a way to ingest agent-produced review comments from a structured local file or stdin.
- Support agent comments at:
  - file level
  - changed-line level where a valid anchor exists
  - whole review/session level if line anchoring is not possible
- Ensure feedback export can distinguish human comments from agent comments.
- Default feedback export for implementation agents should prioritize human comments and not cause an agent to respond to its own comments unless explicitly requested.
- Allow humans to resolve agent comments after deciding they are addressed, invalid, or intentionally accepted.
- Do not call an AI provider directly in this slice.
- Do not automatically resolve agent comments.

## Technical Notes

- Keep provider-specific invocation out of core/state.
- Start with prompt export plus structured comment import; later control-layer slices can run agents directly.
- The structured import format should be documented and validated before writing state.
- Imported comments should include enough provenance to understand which prompt or run produced them.
- If the import refers to a stale or invalid line anchor, store it as file-level or session-level feedback with a clear anchor status.

## Likely Files

- `packages/core/src/domain.ts`
- `packages/core/src/review/*`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/formatters.ts`
- `packages/local-server/src/review-server.ts`, only if UI needs origin display now
- `packages/ui/src/review/*`, only for showing agent-origin badges if practical
- `README.md`
- tests

## Acceptance Criteria

- Existing comments without origin continue to behave as human comments.
- New agent-authored comments can be persisted and listed.
- Agent comments are visually or textually distinguishable in CLI and UI output where comments are shown.
- Users can export an agent-review prompt for a workstream review session and a branch-review session.
- Users can import structured agent review output into Pathfinder comments.
- Default feedback export does not present agent-authored comments as human feedback for the same agent loop.
- Humans can resolve agent comments with existing resolution commands or controls.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
pathfinder branch-review start --base <base-ref>
pathfinder branch-review agent-review prompt --session <session-id>
pathfinder branch-review agent-review import --session <session-id> --file <comments-json>
pathfinder branch-review comment list --session <session-id> --open
```
