# Slice 51: Agent PR Draft Generation

Status: ready

## Goal

Add a prompt-driven workflow for an agent to generate or revise Pathfinder PR draft files from local state.

## Reason

Pathfinder already generates PR markdown deterministically. Some workflows need a richer agent-written PR narrative, but it should remain controlled by local state, review status, and a configurable template instead of being generated implicitly by the browser UI.

## Requirements

- Add an agent PR generation prompt command for workstreams.
- Add an equivalent branch-review PR generation prompt command if branch-review state has enough context.
- Let users configure the PR generation template/prompt locally.
- Include relevant local context in the generated prompt:
  - workstream or branch-review identity
  - completed slices where available
  - base/head refs
  - review approval state
  - open comment warnings
  - evidence/check summaries
  - existing stored `pr.md`, if present
- Add a controlled way to write the agent-produced PR draft back to `pr.md`.
- Do not generate PR markdown just by opening the UI.
- Do not call AI providers directly in this slice.
- Preserve deterministic `pathfinder pr generate` behavior.
- The agent-generated PR draft should remain markdown on disk.

## Technical Notes

- Treat deterministic PR generation and agent-authored PR drafting as separate commands or modes.
- The write-back command should be explicit, validate non-empty markdown, and avoid overwriting without user intent.
- Prompt templates should support a simple file-based override before more complex profile management.
- The prompt should instruct the agent to respect local review state and not hide open comments or failed checks.

## Likely Files

- `packages/core/src/pr/*`
- `packages/core/src/agent/*`
- `packages/state/src/store.ts`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/formatters.ts`
- `packages/ui/src/workspace/*`, only if surfacing stored agent draft provenance is practical
- `README.md`
- tests

## Acceptance Criteria

- Users can emit a PR-draft prompt from current Pathfinder state.
- Users can provide a custom PR prompt/template file.
- Users can explicitly write agent-produced markdown to the stored PR draft.
- Existing deterministic PR generation remains available and unchanged unless explicitly invoked.
- Stored PR drafts warn or record when open review comments remain.
- Opening or previewing the PR panel never triggers generation.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
pathfinder pr agent-prompt <workstream-id>
pathfinder pr agent-write <workstream-id> --file <draft.md>
pathfinder workspace serve --port 4783
```
