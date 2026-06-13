# Slice 12: Evidence Attachments

Status: ready

## Goal

Let users attach local evidence to slices so reviews and PR output can reference proof of implementation quality.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Product Context

The PRD defines evidence as artifacts proving quality: test results, screenshots, logs, manual QA notes, and benchmarks. The domain type exists, but there is no workflow for adding or reading evidence.

## Scope

Add local evidence storage. Prefer a simple per-workstream file unless a better existing shape has already emerged:

```text
.pathfinder/
  workstreams/
    <workstream-id>/
      evidence.json
```

Implement:

```bash
pathfinder evidence add <workstream-id> --slice <slice-id> --kind <kind> --description "..." [--path ./artifact.txt]
pathfinder evidence list <workstream-id>
```

Valid kinds:

```text
test
screenshot
log
manual
benchmark
other
```

Expected behavior:

- Evidence links to an existing slice.
- `--path` is optional and should be stored as a path string without copying files.
- If `--path` is provided, validate that the local path exists unless that proves too restrictive. Document the choice.
- IDs are stable and URL-safe.
- JSON remains human-readable.

## Out Of Scope

- No binary artifact copying.
- No screenshot generation.
- No test runner integration.
- No AI interpretation of evidence.
- No UI.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- Evidence can be added and listed through CLI.
- Evidence is included in `current` for the active slice if it keeps output readable.
- PR generation can include test evidence in the Testing section or this slice documents that PR composer v2 will handle it.
- Tests cover valid evidence, invalid kind, missing slice, missing description, and optional path behavior.
- README documents evidence workflow.

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
npm exec -- pathfinder slice add inventory-alerts --title "Add report" --description "Report reorder candidates."
npm exec -- pathfinder evidence add inventory-alerts --slice add-report --kind test --description "npm test passed"
npm exec -- pathfinder evidence list inventory-alerts
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/12-evidence-attachments.md.

Current slice goal:
Add local evidence attachments for slices using filesystem state and CLI commands.

Implement only this slice.

Do not copy binary artifacts, generate screenshots, integrate test runners, add AI interpretation, build UI, MCP, GitHub/GitLab integration, or external APIs.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test evidence add/list.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
