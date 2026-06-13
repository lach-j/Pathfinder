# Slice 02: Repo Hygiene

Status: done

## Goal

Clean up the repository baseline so future implementation sessions have a predictable source-only workflow.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- This file

## Scope

- Decide whether generated `packages/*/dist/` output should remain tracked.
- If generated output should not be tracked, remove it from Git while preserving source files.
- Ensure `.gitignore` covers generated TypeScript output and dependency folders.
- Confirm `package.json`, `package-lock.json`, and README scripts still describe the actual workflow.
- Add a brief note to README if generated output is intentionally untracked.

## Out Of Scope

- No new product commands.
- No state schema changes unless required by build hygiene.
- No UI, MCP, AI, GitHub, or external API work.

## Acceptance Criteria

- Fresh install/build/test workflow is clear.
- Generated artifacts are either intentionally tracked or intentionally ignored.
- `git status` after checks contains only intentional source/documentation changes.
- README does not suggest commands that fail in this workspace.

## Checks

```bash
npm install
npm run typecheck
npm test
npm run lint --if-present
npm run build
npm exec -- pathfinder help
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, and docs/slices/02-repo-hygiene.md.

Current slice goal:
Clean up repository hygiene for the TypeScript monorepo baseline.

Implement only this slice. Do not add product commands or future integrations.

Run npm install, npm run typecheck, npm test, npm run lint --if-present, npm run build, and npm exec -- pathfinder help.

Summarise changed files and manual verification commands.
```
