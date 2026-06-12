# Pathfinder

Pathfinder is a local-first, open-source context and review layer for AI-assisted development. It helps turn requirements into plans, plans into reviewable slices, and slices into PR-ready output while keeping state in the local repository.

## Stage 1 Workflow

Stage 1 provides the local state model and CLI foundation only. It does not include UI, AI features, MCP, GitHub/GitLab integration, or external APIs.

Install dependencies and build:

```bash
npm install
npm run build
```

Run the local CLI with:

```bash
npm exec -- pathfinder help
```

Initialise Pathfinder state from the root of a Git repository:

```bash
npm exec -- pathfinder init
```

This creates:

```text
.pathfinder/
  project.json
  workstreams/
```

Create and inspect a workstream:

```bash
npm exec -- pathfinder workstream create --title "Add billing foundation"
npm exec -- pathfinder workstream list
npm exec -- pathfinder workstream show add-billing-foundation
```

Attach and read a markdown implementation plan:

```bash
npm exec -- pathfinder plan set add-billing-foundation --file ./plan.md
npm exec -- pathfinder plan show add-billing-foundation
```

Add slices and set the active slice:

```bash
npm exec -- pathfinder slice add add-billing-foundation --title "Create local state" --description "Add filesystem-backed Pathfinder state files."
npm exec -- pathfinder slice list add-billing-foundation
npm exec -- pathfinder slice active add-billing-foundation create-local-state
npm exec -- pathfinder slice show-active
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
