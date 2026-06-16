# Slice 48: Review UI Polish And Syntax Highlighting

Status: done

## Goal

Improve the local diff review reading experience with tighter line layout, better inline comment controls, and syntax highlighting.

## Reason

The current review UI is functional but has rough ergonomics: line rows are too tall, code lines visually separate from each other, and the add-comment control can sit far away from the code it affects. These details make local review feel slower than GitHub or Bitbucket even when the underlying review loop works.

## Requirements

- Add syntax highlighting for common code files in the diff viewer.
- Keep syntax highlighting UI-only; review state and diff parsing must not depend on a highlighter.
- Tighten code line vertical rhythm so adjacent source lines read as code, not separated cards.
- Move the add-comment affordance close to the relevant line content or gutter.
- Keep add-comment controls discoverable on hover and keyboard focus.
- Preserve file-level comments, line-level comments, resolve actions, stale comment display, and branch-review/workstream review compatibility.
- Preserve responsive behavior in the workspace and standalone branch review modes.
- Avoid a side-by-side diff rewrite in this slice.
- Avoid comment editing, threaded replies, or new comment state semantics in this slice.

## Technical Notes

- Reuse the existing diff data model and review components.
- Prefer a small UI adapter around a maintained highlighter package if one is already acceptable in the UI bundle.
- The highlighter should gracefully fall back to plain text for unknown languages or very large files.
- Keep code text selectable.
- Watch CSS line-height, padding, grid columns, and hover hit areas together; the fix should not only move a button.
- Browser verification is important for this slice because the problem is visual.

## Likely Files

- `packages/ui/src/review/*`
- `packages/ui/src/workspace/*`
- `packages/ui/src/styles/*`
- `packages/ui/src/types.ts`
- `packages/ui/package.json`, only if adding a UI-only highlighter dependency
- tests, if practical

## Acceptance Criteria

- Diff code is syntax highlighted for common TypeScript, JavaScript, JSON, Markdown, CSS, and shell files.
- Unknown file types still render readable plain text.
- Code rows are visually dense enough that multi-line code reads continuously.
- The add-comment control is adjacent to the line it targets and no longer separated by a large empty gap.
- Users can still add and resolve line comments from workstream review and branch review modes.
- The layout remains usable on narrow screens.
- Existing review API and state tests still pass.

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

Verify a review session with TypeScript, JSON, Markdown, and unknown extension changes in the browser.
