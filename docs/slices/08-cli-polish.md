# Slice 08: CLI Polish

Status: done

## Goal

Improve CLI consistency and failure paths after the foundational commands exist.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

- Review command help text for completeness.
- Make error messages consistent.
- Add focused tests for common failure paths.
- Consider shared CLI formatting helpers only if duplication is clearly hurting readability.
- Update README examples to match final command behavior.

## Out Of Scope

- No new product area unless needed to polish existing MVP commands.
- No UI.
- No MCP.
- No AI behavior.
- No external APIs.

## Acceptance Criteria

- Help text includes all MVP commands implemented so far.
- Common user mistakes produce useful messages.
- Tests cover meaningful failure behavior.
- README examples are still accurate.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
npm exec -- pathfinder help
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/08-cli-polish.md.

Current slice goal:
Polish CLI help, errors, tests, and README accuracy for the implemented MVP commands.

Do not add unrelated product features, UI, MCP, AI behavior, GitHub/GitLab integration, or external APIs.

Run npm run typecheck, npm test, npm run lint --if-present, npm run build, and npm exec -- pathfinder help.

Summarise changed files and manual verification commands.
```

## Completion Notes

- CLI usage errors now consistently point users to `pathfinder help`.
- CLI subprocess tests cover help coverage, unknown commands, missing required options, and missing Pathfinder state.
- The root test command now includes CLI tests.

Checks run:

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
npm exec -- pathfinder help
```
