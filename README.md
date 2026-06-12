# Pathfinder

Pathfinder is a local-first, open-source context and review layer for AI-assisted development. It helps turn requirements into plans, plans into reviewable slices, and slices into PR-ready output while keeping state in the local repository.

## Stage 1 Workflow

Stage 1 provides the local state model and CLI foundation only. It does not include UI, AI features, MCP, GitHub/GitLab integration, or external APIs.

Install dependencies and build:

```bash
npm install
npm run build
```

Initialise Pathfinder state from the root of a Git repository:

```bash
npx pathfinder init
```

This creates:

```text
.pathfinder/
  project.json
  workstreams/
```

Create and inspect a workstream:

```bash
npx pathfinder workstream create --title "Add billing foundation"
npx pathfinder workstream list
npx pathfinder workstream show add-billing-foundation
```

Attach and read a markdown implementation plan:

```bash
npx pathfinder plan set add-billing-foundation --file ./plan.md
npx pathfinder plan show add-billing-foundation
```

Add slices and set the active slice:

```bash
npx pathfinder slice add add-billing-foundation --title "Create local state" --description "Add filesystem-backed Pathfinder state files."
npx pathfinder slice list add-billing-foundation
npx pathfinder slice active add-billing-foundation create-local-state
npx pathfinder slice show-active
```

Each workstream is stored as human-readable local files:

```text
.pathfinder/
  workstreams/
    <workstream-id>/
      workstream.json
      plan.md
      slices.json
      comments.json
      reviews.json
      pr.md
```

Run checks:

```bash
npm run typecheck
npm test
```
