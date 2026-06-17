# UI Overhaul And Design System Requirements

Create a Pathfinder UI overhaul that makes the local workspace feel polished, coherent, and intentionally designed while preserving Pathfinder's local-first, filesystem-first, Git-aware product boundaries.

## Product Goal

Move the browser workspace from a functional but plain implementation toward a beautiful, durable developer-tool UI built from a reusable design system rather than one-off page styling.

## Primary Outcomes

- Add Storybook for `@pathfinder/ui` so base components, layout primitives, interaction states, empty states, and workflow surfaces can be developed and reviewed in isolation.
- Establish a base design system for the UI: tokens, typography, color, spacing, focus states, motion rules, density, buttons, icon buttons, lists, status chips, panels, tabs, toolbars, layout primitives, and empty/loading/error states.
- Rework the current workspace, canvas, artifact, and review layouts through the new primitives instead of applying a cosmetic one-for-one replacement.
- Improve UX for real Pathfinder workflows: selecting workstreams and slices, scanning slice dependency state, reviewing artifacts, switching into branch review, inspecting diffs, reading comments, copying PR output, and recovering from empty/error states.
- Keep the interface efficient and app-like, suitable for repeated developer use. Avoid marketing-page structure and decorative excess.

## Visual Direction

Use the attached Linear/modern prompt as inspiration, not as a strict recipe. Pathfinder should feel like a premium local developer application: precise, layered, responsive, and calm.

- Favor near-black or quiet neutral surfaces with restrained accent lighting where it clarifies hierarchy or interaction.
- Use depth, border highlights, and subtle motion deliberately; do not make the app a generic dark gradient showcase.
- Avoid pure black, harsh borders, one-note purple/blue dominance, oversized hero treatments, decorative blobs that obscure work, and large bouncy motion.
- Preserve readability for dense code, markdown, lists, graph nodes, and metadata.
- Respect `prefers-reduced-motion` and keep keyboard focus highly visible.

## Architecture Boundaries

- UI code stays in `packages/ui` and talks to Pathfinder through local HTTP APIs.
- Do not import `@pathfinder/state`, `@pathfinder/git`, or `@pathfinder/cli` into browser code.
- Business rules remain in reusable packages; the UI owns rendering, browser state, and local interaction behavior only.
- Storybook stories should use browser-safe fixtures and mocked UI-facing data. They must not require real Pathfinder state or a running local server unless a story explicitly documents that mode.
- Do not add authentication, hosted backend assumptions, cloud sync, organisations, roles, billing, or external product integrations.

## UX Requirements

- Start with a UI and UX audit of the current workspace so implementation decisions are grounded in current layout pain points, not just replacement styling.
- Treat layout changes as workflow improvements: navigation hierarchy, inspector density, review readability, status visibility, empty states, and responsive behavior should all improve.
- Ensure the branch review mode and workstream mode feel related but appropriately distinct.
- Ensure review surfaces remain usable for actual code review; decorative styling must not reduce diff readability or comment usability.
- Every base component should include accessible states: default, hover, focus, disabled, loading where relevant, and high-density usage examples.

## Verification Expectations

- Run the repository checks required by active slices.
- Add package-level scripts for Storybook and static Storybook build where practical.
- Smoke test the local workspace after layout changes with `pathfinder workspace serve --port 4783`.
- Use browser or Playwright screenshots for substantial visual changes across desktop and mobile-width viewports.
- Verify text does not overlap, controls remain reachable, focus states are visible, and motion is reduced when requested.
