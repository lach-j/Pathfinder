# Slice 44: Artifact Preview Panel

Status: done

## Goal

Add the right-side artifact preview panel for selected workstream and slice context.

## Reason

Pathfinder already stores useful local artifacts: requirements, plans, evidence, feedback queues, review records, and PR drafts. In personal/external mode, these artifacts are not conveniently browsable from the target repository.

The workspace should let users preview those artifacts directly from the browser app without manually locating state files.

## Requirements

- Extend the right inspector into an artifact preview panel.
- Add rendered markdown previews using focused frontend dependencies, preferably:
  - `react-markdown`
  - GFM support such as `remark-gfm`
- Add tabs or equivalent navigation for:
  - slice details
  - requirements
  - plan
  - evidence
  - feedback
  - PR draft
- Slice details should show selected slice metadata from overview state.
- Requirements preview should render requirements markdown from the selected workstream.
- Plan preview should render plan markdown from the selected workstream.
- Evidence preview should show evidence records for the selected workstream and highlight records for the selected slice when one is selected.
- Feedback preview may call the existing feedback export endpoint and render returned markdown.
- Feedback preview should make clear when there are no open comments.
- PR draft preview must read stored `pr.md` content only.
- Opening the PR tab must not call `generatePrMarkdown`, must not write `pr.md`, and must not mutate state.
- If stored `pr.md` is empty, show guidance that the PR draft should be created or updated by the agent or CLI.
- The empty PR guidance may mention:

```bash
pathfinder pr generate <workstream-id>
```

but the UI must not run that command in this slice.
- Keep previews read-only.
- Preserve raw markdown in state; rendered HTML is only a browser presentation.

## Technical Notes

- Markdown rendering should be safe for local content. Do not enable arbitrary script execution.
- The panel should remain useful when no slice is selected by showing workstream-level artifacts.
- Keep artifact-fetching logic separate from rendering components.
- Do not add editing, file pickers, issue tracker imports, or external API calls.
- Do not add rich clipboard behavior in this slice; that belongs to slice 46.

## Likely Files

- `packages/ui/package.json`
- `packages/ui/src/workspace/*`
- `packages/ui/src/types.ts`
- `packages/ui/src/styles/*`
- local-server response types if the overview shape needs refinement
- tests, if practical

## Acceptance Criteria

- The right panel can preview requirements markdown.
- The right panel can preview plan markdown.
- The right panel can show evidence records and selected-slice evidence.
- The right panel can preview feedback markdown from open comments.
- The right panel can preview stored `pr.md`.
- Empty requirements, plan, feedback, evidence, and PR draft states are clear.
- Opening previews does not mutate Pathfinder state.
- Stored `pr.md` remains unchanged when previewed.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder workspace serve --port 4783
```

Verify requirements, plan, evidence, feedback, and PR tabs in a workstream with representative state.
