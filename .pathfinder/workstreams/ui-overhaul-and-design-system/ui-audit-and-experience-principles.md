# Slice 60: UI Audit And Experience Principles

Audit date: 2026-06-17

## Scope

This audit covers the current Pathfinder browser workspace before the UI overhaul workstream begins implementation:

- Workspace shell and repository rail
- Workstream overview and slice dependency canvas
- Artifact inspector tabs for details, requirements, plan, evidence, feedback, and PR draft
- Slice review panel inside the artifact inspector
- Standalone branch review workspace
- Desktop default viewport and 390px mobile viewport behavior

The goal is to capture current experience problems and target principles so later slices can improve workflow quality instead of restyling the same layout one-for-one.

## Before Evidence

Screenshots are stored under `.pathfinder/workstreams/ui-overhaul-and-design-system/evidence/slice-60-ui-audit/`:

- `workspace-desktop.png` - workstream overview, dependency canvas, and details inspector.
- `slice-review-empty-desktop.png` - slice review tab with no review sessions.
- `branch-review-desktop.png` - standalone branch review empty state.
- `workspace-mobile-390.png` - stacked mobile workspace at 390px width.
- `branch-review-mobile-390.png` - stacked mobile branch review at 390px width.

Captured from `npm exec -- pathfinder workspace serve --port 4784` after `npm run build`.

## Current Screen Inventory

### Workspace Shell

- Left rail shows repository identity, branch review entry, and all workstreams.
- Main area shows the selected workstream title, counts, and dependency canvas.
- Right inspector shows artifact tabs and selected slice or workstream details.
- Workstream selection and active-slice selection are available through local HTTP APIs.

### Dependency Canvas

- React Flow renders slice nodes, dependency edges, controls, minimap, and background grid.
- Nodes show title, status, id, branch/base metadata, and counts for open comments, reviews, and evidence.
- Invalid dependencies and cycles can render as warning banners.

### Artifact Inspector

- Tabs include details, review, requirements, plan, evidence, feedback, and PR draft.
- Details uses markdown preview for slice descriptions, a status pill, a make-active button, metadata, and count metrics.
- Requirements, plan, feedback, and PR draft use markdown previews.
- Evidence groups selected-slice records separately from other workstream records.

### Slice Review

- The review tab embeds a split review UI inside the inspector column.
- Sidebar lists slice review sessions and changed files when available.
- Main panel reuses the unified diff pane, comment filter, refresh action, inline comment form, file comments, stale comments, and resolve controls.

### Branch Review

- Branch review is a full workspace mode with the same rail, a session/file sidebar, and a main diff area.
- Empty state explains the branch-review start command.
- It reuses the same diff pane and comment behavior as slice review.

## Current UX Problems

### Navigation And Hierarchy

- The rail is readable but long; active workstream context is buried near the bottom once many workstreams exist.
- Branch review is grouped under "Review modes", but it competes visually with workstreams instead of feeling like a distinct mode.
- Repository identity is static text with no current branch/base/ref context, so the workspace does not clearly answer "what am I reviewing right now?"
- Primary actions are inconsistent: "Make active" appears in details, "Refresh" appears in review toolbars, and CLI-only next steps appear inside empty states.

### Layout And Density

- The desktop three-column shell gives the canvas and inspector useful persistent context, but the canvas content can be very small relative to the available area.
- Slice review mode changes the grid to a very wide inspector and narrow main canvas. In the captured desktop state, workstream heading text and metric cards become cramped and visually collide in the middle column.
- The inspector tabs use a two-column grid, which is serviceable for seven tabs but consumes vertical space and reads more like form buttons than navigation.
- Empty review states have a lot of unused whitespace on desktop.

### Dependency Canvas

- Slice nodes are information-rich but visually small after `fitView`, especially in workstreams with long dependency chains.
- The minimap occupies a large visual block and can distract when the graph itself is sparse.
- Nodes rely on tiny status pills and border-left color; status and active/selected state are not strong scanning signals.
- Count labels repeat full words on every node, making dense graphs noisy while still not prioritizing which slices need action.

### Artifact And Markdown Reading

- The inspector is useful but reads as a pile of tabs and cards rather than a coherent inspector with a stable hierarchy.
- Markdown previews are functional, but long requirements or plans have limited affordances for section scanning.
- Details mixes workflow action, markdown description, metadata, and metrics without a strong order of importance.
- Feedback and PR draft tabs are hidden among peer tabs even though they are output-oriented actions in the workflow.

### Review Experience

- The slice review embedded inside the inspector is too constrained for code review. It forces the canvas, session list, toolbar, and diff into competing columns.
- Empty review instructions are clear, but the command copy is not actionable from the UI and is visually distant from the refresh/filter controls.
- The diff table is readable in isolation, but the toolbar, file list, and comments do not yet have the polish of a long-session review surface.
- The line comment affordance is a hidden plus button, which is compact but easy to miss for new users and small hit targets may be difficult on touch.

### Branch Review

- Branch review has a cleaner full-width shape than embedded slice review, but the empty state feels sparse and disconnected from the rest of the workspace.
- Branch review and workstream review share components but do not yet explain their relationship. Users may not understand when to use branch review instead of slice review.
- Session metadata uses raw ids and commit hashes without a more scannable summary.

### Responsive Behavior

- At 390px width, the workspace stacks rail, main content, and inspector into one very long page.
- The mobile rail lists every workstream before the active overview, so the user must scroll a long way before reaching current work.
- The mobile workspace screenshot shows rail content repeated after the inspector, which suggests full-page screenshots expose an awkward stacked document flow and possible scroll-position/content continuation issues.
- The canvas remains usable only as a large embedded region; graph labels are tiny and horizontal context is difficult at mobile width.
- Branch review mobile stacks predictably, but primary review controls sit below a long session area and the empty diff panel begins far down the page.

### Accessibility And Semantics

- Buttons and selects have visible focus states through global CSS.
- `aria-current` is used for selected rail/session/file items, but tab buttons rely on `role=tab` and `aria-selected` without a full keyboard tablist pattern.
- React Flow graph content is not meaningfully represented as an accessible list or table outside the canvas.
- Hidden line comment buttons appear on hover/focus, but discoverability and touch accessibility are weak.
- Status is conveyed partly through color and uppercase text; future components should add consistent labels and avoid color-only meaning.
- Command snippets in empty states are readable, but there is no copy control or keyboard shortcut path.

### Visual System

- The current UI is coherent enough to use, but it is a plain light administrative interface rather than a distinctive Pathfinder application.
- Colors are mostly neutral blue-gray with one selected blue and status colors. There is no durable token language for depth, hierarchy, or interaction.
- Borders, cards, tabs, pills, buttons, and metrics repeat similar shapes without clear component roles.
- Typography is functional but does not yet distinguish navigation, command output, metadata, code review, and markdown reading surfaces strongly enough.

## Target Experience Principles

1. Review-first, context-rich workspace.
   The UI should always make the current repository, selected workstream, active slice, review state, and next useful action obvious without requiring CLI memory.

2. Dense but calm developer-tool layout.
   Keep information close and scannable, but avoid cramming unrelated workflows into the same narrow column. Code review deserves more width than ordinary artifact inspection.

3. Workflow modes should be distinct.
   Workstream mode, slice review, and branch review should feel related but not interchangeable. Each mode needs its own hierarchy, toolbar, empty states, and navigation emphasis.

4. Inspector content should be ordered by task.
   Details, requirements, plan, evidence, feedback, and PR output should read as purposeful workflow panels, not just a tab dump.

5. Canvas should support planning, not decoration.
   The graph should help users see sequence, blockers, active state, review needs, and dependency risk. Minimap, controls, and fit behavior should never overpower slice comprehension.

6. Diff readability is sacred.
   Review styling must prioritize stable line numbers, readable code, obvious comment anchors, visible comment state, and comfortable long-session scanning over visual novelty.

7. Responsive behavior should preserve workflow priority.
   On narrow screens, active context and primary actions should come before long navigation lists. Canvas and review views may need alternate compact list modes rather than simple stacking.

8. Accessibility is part of the component contract.
   Base components need visible focus, keyboard operation, semantic labels, disabled/loading states, non-color status indicators, reduced-motion behavior, and touch-safe hit targets.

9. Local-first boundaries stay visible.
   Empty states and actions should reinforce that Pathfinder is reading local filesystem/Git state and should avoid hosted-service assumptions.

10. Design system before surface overhaul.
    Later slices should create reusable primitives and tokens first, then migrate screens through those primitives with realistic workflow examples.

## Verification Targets For Later Slices

- Workspace desktop keeps active workstream, active slice, and next action visible without squeezing the canvas or inspector.
- Slice review opens into a review-appropriate layout with enough width for diff reading.
- Branch review has a first-class empty/session state and clear distinction from slice review.
- Mobile 390px view surfaces active context before long workstream navigation or provides a compact navigation alternative.
- Canvas nodes remain readable at default fit for the UI overhaul workstream's eight-slice graph.
- Artifact tabs or navigation reduce visual button noise and preserve keyboard accessibility.
- Review comment controls are discoverable by mouse, keyboard, and touch.
- Focus states remain visible in rail buttons, tabs, canvas-adjacent controls, selects, and diff comment controls.
- Text does not overlap in desktop slice-review mode or mobile stacked layouts.
- The visual language uses tokens and component variants rather than one-off CSS.

## Out Of Scope For This Slice

- No Storybook setup.
- No design token implementation.
- No component extraction.
- No layout or styling changes to production UI.
- No local-server API changes.
- No generated PR copy changes.
