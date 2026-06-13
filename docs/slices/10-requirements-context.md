# Slice 10: Requirements Context

Status: ready

## Goal

Make requirements first-class local context for a workstream, separate from the implementation plan.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

The PRD starts with requirements flowing into plans and slices. Pathfinder currently supports workstream titles and plan markdown, but it does not preserve the original requirement text as a distinct artifact.

## Scope

Add local requirements storage for each workstream:

```text
.pathfinder/
  workstreams/
    <workstream-id>/
      requirements.md
```

Implement:

```bash
pathfinder requirement set <workstream-id> --file ./requirements.md
pathfinder requirement show <workstream-id>
```

Expected behavior:

- `workstream create` initializes an empty `requirements.md`.
- `requirement set` copies markdown exactly as markdown.
- `requirement show` prints the stored requirements.
- Commands fail clearly when `.pathfinder` or the workstream does not exist.
- Existing workstreams without `requirements.md` should be handled gracefully. Prefer creating the file on first write, and show a clear empty-state message on read.

## Out Of Scope

- No Jira/Linear imports.
- No external APIs.
- No AI requirement parsing.
- No UI.
- No schema migration framework unless needed to keep the change safe.

## Likely Files

- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`
- `docs/implementation-status.md`
- This file

## Acceptance Criteria

- New workstreams include `requirements.md`.
- Requirements can be set and shown through the CLI.
- `pathfinder current` includes requirements location or a short excerpt if that fits existing output cleanly.
- Tests cover creating, setting, showing, and missing-file behavior.
- README documents requirements before plan setup.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder init
npm exec -- pathfinder workstream create --title "Inventory alerts"
npm exec -- pathfinder requirement set inventory-alerts --file ./requirements.md
npm exec -- pathfinder requirement show inventory-alerts
npm exec -- pathfinder current
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/10-requirements-context.md.

Current slice goal:
Make requirements first-class local workstream context stored as requirements.md with requirement set/show CLI commands.

Implement only this slice.

Do not add Jira/Linear imports, external APIs, AI parsing, UI, MCP, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test the requirements workflow.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
