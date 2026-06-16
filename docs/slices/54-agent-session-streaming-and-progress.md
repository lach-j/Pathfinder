# Slice 54: Agent Session Streaming And Progress

Status: ready

## Goal

Add local session records and workspace progress views for agent runs, including a stream or transcript path that can be inspected from the UI.

## Reason

After Pathfinder has a CLI-first action layer, users need to kick off or register an agent run, see what it is doing, and decide when to review, approve, or send more feedback. The UI should become a control surface over local state and streams without making Pathfinder depend on one agent provider.

## Requirements

- Add local agent session records linked to workstreams, slices, branch reviews, review sessions, or PR draft actions.
- Support registering a manually started session.
- Support starting a configured local command only if an explicit runner contract exists from the control layer.
- Store or link:
  - session id
  - target workstream/slice/session
  - action type
  - agent preset or command name
  - working directory or worktree path
  - status
  - started/updated timestamps
  - transcript path or stream file path
  - last output summary
- Add a UI view that lists agent sessions and shows recent output or a stream when available.
- Let the UI trigger safe Pathfinder actions such as render prompt, open review, refresh review, export feedback, or mark approval through existing explicit commands/endpoints.
- Do not hide raw logs from the user.
- Do not require a hosted service.
- Do not make Strands Agents mandatory. If used later, it should be one local runner backend behind the same session contract.

## Technical Notes

- This should build on slice 53, not replace it.
- A file-backed append-only transcript is likely enough for the first version.
- The stream can start as polling a local file or endpoint before introducing websockets.
- UI controls should reflect current session state and avoid pretending an agent is done until a clear status is recorded.
- Checks and review results should continue to be stored as Pathfinder evidence or review state, not only as terminal output.

## Likely Files

- `packages/core/src/agent/*`
- `packages/core/src/domain.ts`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/local-server/src/review-server.ts`
- `packages/ui/src/workspace/*`
- `packages/ui/src/styles/*`
- `README.md`
- tests

## Acceptance Criteria

- Agent sessions can be listed locally.
- A manually started session can be registered with target metadata and a transcript path.
- The workspace can show session status and recent output.
- The workspace exposes safe action controls without bypassing explicit review approval or comment resolution.
- Session state remains local and inspectable.
- Existing CLI-first workflows still work for users who do not use the UI.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder agent session register --action continue --transcript <path>
pathfinder agent session list --json
pathfinder workspace serve --port 4783
```
