# Pathfinder

Pathfinder is a local-first, open-source context and review layer for AI-assisted development. It helps turn requirements into plans, plans into reviewable slices, and slices into PR-ready output while keeping state in the local repository.

## Stage 1 Workflow

Stage 1 provides the local state model and CLI foundation only. It does not include UI, AI features, MCP, GitHub/GitLab integration, or external APIs.

Install dependencies and build:

```bash
npm install
npm run build
```

Generated TypeScript output under `packages/*/dist/` is intentionally untracked. Recreate it locally with `npm run build` after a fresh checkout or dependency install.

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

Print the current Pathfinder context for humans or agents:

```bash
npm exec -- pathfinder current
```

Add, list, and resolve local review comments for a slice:

```bash
npm exec -- pathfinder comment add add-billing-foundation --slice create-local-state --body "Needs tests."
npm exec -- pathfinder comment list add-billing-foundation
npm exec -- pathfinder comment resolve add-billing-foundation needs-tests
```

Create and inspect local review records for a slice:

```bash
npm exec -- pathfinder review create add-billing-foundation --slice create-local-state --summary "Manual review passed."
npm exec -- pathfinder review list add-billing-foundation
npm exec -- pathfinder review show add-billing-foundation manual-review-passed
```

Inspect the current local working tree diff:

```bash
npm exec -- pathfinder git diff
```

Generate a local PR markdown draft:

```bash
npm exec -- pathfinder pr generate add-billing-foundation
```

This overwrites and prints:

```text
.pathfinder/workstreams/add-billing-foundation/pr.md
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
npm run lint --if-present
npm run build
npm exec -- pathfinder help
npm exec -- pathfinder current
npm exec -- pathfinder review create add-billing-foundation --slice create-local-state --summary "Manual review passed."
npm exec -- pathfinder review list add-billing-foundation
npm exec -- pathfinder review show add-billing-foundation manual-review-passed
npm exec -- pathfinder git diff
npm exec -- pathfinder pr generate add-billing-foundation
```
