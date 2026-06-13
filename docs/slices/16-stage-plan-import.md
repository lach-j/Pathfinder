# Slice 16: Stage Plan Import

Status: done

## Goal

Make Pathfinder able to ingest the stage-plan workflow represented by `docs/skills-replacement-examples/plan-stages.md` without depending on Claude, Jira, or external APIs.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/skills-replacement-examples/plan-stages.md`
- This file

## Product Context

Pathfinder is meant to replace the stored-plan half of the existing agent-skill workflow. The current CLI can create workstreams and slices manually, but it cannot import a markdown stage plan into Pathfinder state.

## Scope

Implement a local markdown import command:

```bash
pathfinder plan import --file ./PLAN.md
```

Expected behavior:

- Reads the stored stage-plan shape used by `plan-stages.md`.
- Creates one Pathfinder workstream from the plan title/context.
- Stores the original markdown as `plan.md`.
- Creates one slice per `## Stage N:` section.
- Preserves stage title, scope, acceptance criteria, open items, dependencies, and commit breakdown in the slice description.
- Does not create Jira issues or call external APIs.
- Prints the created workstream id and slice ids.

If parsing cannot confidently identify stages, fail with a clear message and leave existing state unchanged.

## Out Of Scope

- No Jira import.
- No AI parsing.
- No automatic codebase exploration.
- No UI.
- No MCP or agent hooks.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Importing a valid stored stage plan creates one workstream and ordered slices.
- The imported `plan.md` exactly preserves the source markdown.
- Slice descriptions include enough stage detail for an implementation agent session.
- Import is atomic enough that a failed parse does not create a partial workstream.
- Tests cover valid import, missing file, no stages, duplicate stage titles, and dependency text preservation.

## Open Product Questions

- Should imported stage dependencies remain descriptive text for now, or should obvious stage-number dependencies become `dependsOnSliceIds`?
- Should Pathfinder keep a `sourcePlanPath` field on the workstream, or is preserving the markdown enough?

Recommendation for this slice: preserve dependency text only, and avoid new workstream metadata unless it is needed by tests.

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
npm exec -- pathfinder plan import --file ./docs/example-plan.md
npm exec -- pathfinder workstream list
npm exec -- pathfinder slice list <workstream-id>
npm exec -- pathfinder plan show <workstream-id>
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/skills-replacement-examples/plan-stages.md, and docs/slices/16-stage-plan-import.md.

Current slice goal:
Import a local stored stage plan markdown file into Pathfinder workstream, plan, and slice state.

Implement only this slice.

Do not add Jira imports, external APIs, AI parsing, UI, MCP, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test plan import.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
