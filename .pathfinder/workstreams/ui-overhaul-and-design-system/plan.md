# UI Overhaul And Design System Plan

## Scope

This workstream creates the durable UI foundation for Pathfinder before redesigning the application surfaces that sit on top of it. The work deliberately separates design infrastructure from page overhaul so that future UI features inherit the same visual language instead of adding more isolated CSS.

## Current System Notes

- `@pathfinder/ui` is a Vite + React app using regular CSS under `packages/ui/src/styles`.
- The current app has a workspace shell, rail navigation, slice dependency canvas, artifact preview panel, workstream review panel, and standalone branch review mode.
- The UI currently relies on global variables and page-specific class names rather than a formal component system.
- Existing UI dependencies include React, React DOM, React Markdown, remark-gfm, and `@xyflow/react`.
- Storybook is not currently configured.

## Design Strategy

1. Audit the current UI and capture target experience principles.
2. Add Storybook with realistic fixtures and decorators that match the local app environment.
3. Centralize design tokens and global foundations before changing major screens.
4. Build composable primitives for controls, lists, panels, tabs, layout, and states.
5. Refresh actual workflows using those primitives, with UX changes driven by the audit.
6. Finish with accessibility, responsive, and visual QA so the overhaul is stable rather than just attractive.

## Design-System Shape

The base design system should include:

- Token layer: color, typography, spacing, radii, borders, elevation, z-index, focus, and motion.
- Base CSS reset and app shell rules that support dense desktop-tool layouts.
- Controls: Button, IconButton, segmented controls or tabs, select-like controls where already needed, copy/status actions.
- Feedback and metadata: Badge, StatusChip, Metric, EmptyState, Notice, LoadingState, ErrorState.
- Surfaces: Panel, PanelHeader, Toolbar, Divider, ScrollArea conventions, markdown/code surface styling.
- Lists and navigation: NavItem, ListRow, metadata stacks, section headings, active/selected states.
- Layout primitives: WorkspaceFrame, Sidebar/Rail, MainSurface, InspectorPanel, responsive split layouts.
- Storybook stories for normal, dense, long-text, empty, disabled, and error states.

## UX Direction By Surface

### Workspace Shell

Improve hierarchy and scanability: clearer current repository identity, stronger distinction between workstream navigation and branch review mode, better active/selected state treatment, and responsive behavior that does not bury primary actions.

### Dependency Canvas

Keep the graph functional while making nodes easier to scan: consistent status chips, counts, active branch/base metadata, invalid dependency warnings, and selected-node affordances. The canvas should feel integrated with the workspace rather than like an embedded foreign surface.

### Artifact And Inspector Panel

Make the right panel feel like a coherent inspector. Improve tab structure, markdown readability, slice details, evidence grouping, feedback preview, PR draft copy states, and empty states. Preserve read-only semantics.

### Review Experience

Prioritize diff readability and comment ergonomics. The review UI should be denser and more focused than general artifact panels, with clear file navigation, visible anchors, accessible comment controls, and no decorative styling that competes with code.

### Branch Review

Give branch review a first-class full-width workspace mode that visually belongs to Pathfinder while making session selection, refresh, comments, and PR generation states easier to understand.

## Risks

- A visual overhaul could accidentally obscure code review readability.
- Storybook can drift from the app if stories use unrealistic fixtures.
- Large CSS rewrites can create regressions in responsive layouts.
- Dark premium styling can become one-note or decorative if tokens and hierarchy are not disciplined.
- Component extraction can become too abstract if done before current workflow needs are clear.

## Implementation Notes

- Prefer incremental CSS/component migration over a single full rewrite.
- Keep component APIs small and aligned with current UI data shapes.
- Use existing package boundaries. Add local-server changes only when a UX improvement genuinely needs new API data.
- Do not generate or mutate Pathfinder state from Storybook.
- Keep generated build output untracked.

## Checks

At minimum for implementation slices:

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Additional UI checks should be added by the relevant slices, including Storybook build and visual smoke tests once Storybook exists.
