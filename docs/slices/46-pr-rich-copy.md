# Slice 46: PR Rich Copy

Status: ready

## Goal

Add rich copy actions for the stored PR draft.

## Reason

The PR handoff is the most immediately valuable workspace polish. Users should be able to review the stored PR draft in Pathfinder and paste it into GitHub, GitLab, Bitbucket, or another hosting tool with formatting preserved.

The UI should make copying easy without making Pathfinder a Git hosting integration and without generating PR content implicitly.

## Requirements

- Add copy actions to the PR draft preview from slice 44:
  - copy markdown
  - copy rich text
  - copy plain text
- All copy actions must use stored `pr.md` as the source of truth.
- The UI must not call `generatePrMarkdown`.
- The UI must not write or mutate `pr.md`.
- Copy markdown should copy the exact stored markdown.
- Copy plain text should copy a readable text fallback derived from the stored draft.
- Copy rich text should place HTML on the clipboard so paste targets preserve headings, lists, code blocks, links, and checklists where supported.
- Use the browser Clipboard API.
- Use `ClipboardItem` with `text/html` and `text/plain` when available.
- Fall back to plain text copy when rich clipboard APIs are unavailable.
- Disable copy actions when stored `pr.md` is empty.
- Empty PR draft state should keep the guidance from slice 44: ask the agent to create/update the PR draft or run the CLI manually.
- Show a concise success or failure status after copy attempts.

## Technical Notes

- Reuse the rendered markdown pipeline from slice 44 where practical.
- Keep clipboard conversion browser-only.
- Do not add GitHub, GitLab, Bitbucket, or browser-extension integration.
- Do not add push, open-PR-page, or remote PR creation behavior.
- Do not add PR draft editing in this slice.
- Keep copy buttons accessible and keyboard reachable.

## Likely Files

- `packages/ui/src/workspace/*`
- `packages/ui/src/styles/*`
- `packages/ui/src/types.ts`
- tests, if practical

## Acceptance Criteria

- PR draft panel shows copy actions when stored `pr.md` has content.
- Copy markdown copies the stored markdown.
- Copy plain text copies readable text.
- Copy rich text uses `text/html` where the browser supports it.
- Browsers without rich clipboard support fall back to plain text.
- Copy buttons are disabled for an empty PR draft.
- Copying never mutates Pathfinder state.
- Opening the PR panel never generates PR markdown.

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

Verify markdown, rich text, and plain text copy from a workstream with non-empty `pr.md`.

