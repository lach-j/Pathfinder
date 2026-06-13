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

Attach and read original workstream requirements:

```bash
npm exec -- pathfinder requirement set add-billing-foundation --file ./requirements.md
npm exec -- pathfinder requirement show add-billing-foundation
```

Attach and read a markdown implementation plan:

```bash
npm exec -- pathfinder plan import --file ./PLAN.md
npm exec -- pathfinder plan set add-billing-foundation --file ./plan.md
npm exec -- pathfinder plan show add-billing-foundation
```

`plan import` reads the stored stage-plan markdown shape used by `docs/skills-replacement-examples/plan-stages.md`.
It creates one workstream from the plan title, stores the source markdown as `plan.md`, and creates one proposed
slice per `## Stage N:` section while preserving the stage details in each slice description.

Add slices and set the active slice:

```bash
npm exec -- pathfinder slice add add-billing-foundation --title "Create local state" --description "Add filesystem-backed Pathfinder state files."
npm exec -- pathfinder slice add add-billing-foundation --title "Add state tests" --description "Cover filesystem state behavior." --depends-on create-local-state
npm exec -- pathfinder slice depend add-billing-foundation add-state-tests create-local-state
npm exec -- pathfinder slice list add-billing-foundation
npm exec -- pathfinder slice next add-billing-foundation
npm exec -- pathfinder slice active add-billing-foundation create-local-state
npm exec -- pathfinder slice status add-billing-foundation create-local-state in_progress
npm exec -- pathfinder slice show-active
```

`slice next` prints the first proposed or ready slice whose dependencies are complete, ordered by creation time.
Dependencies are local to the workstream and are stored in `slices.json`.

Start a local branch for a slice from an explicit base ref:

```bash
npm exec -- pathfinder slice branch add-billing-foundation create-local-state --base main
```

This creates and checks out:

```text
pathfinder/<workstream-id>/<slice-id>
```

The branch command refuses to run when the working tree has uncommitted changes. Commit, stash, or remove local changes first.

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

Add file-level and line-level comments anchored to a review session:

```bash
npm exec -- pathfinder comment add add-billing-foundation --session review-create-local-state --file packages/core/src/index.ts --body "Review this file."
npm exec -- pathfinder comment add add-billing-foundation --session review-create-local-state --file packages/core/src/index.ts --line 12 --side new --body "Handle the empty case."
npm exec -- pathfinder comment list add-billing-foundation --session review-create-local-state --open
```

Line anchors validate against the parsed session diff. Use `--side new` for new/context
line numbers and `--side old` for old/context line numbers.

Start and inspect a durable local review session for the active slice:

```bash
npm exec -- pathfinder review start --base main
npm exec -- pathfinder review sessions add-billing-foundation
npm exec -- pathfinder review session add-billing-foundation review-create-local-state
```

Review sessions are stored under the active workstream and capture the active slice, base ref,
head ref, head commit, merge base, and changed files for that review pass.

Create and inspect local review records for a slice:

```bash
npm exec -- pathfinder review create add-billing-foundation --slice create-local-state --summary "Manual review passed."
npm exec -- pathfinder review list add-billing-foundation
npm exec -- pathfinder review show add-billing-foundation manual-review-passed
```

Run deterministic local review checks against the active slice and committed branch diff:

```bash
npm exec -- pathfinder review run --base main
```

This records a review under the active workstream and prints a checklist covering slice status,
committed diff presence, changed file categories, unresolved comments, evidence, plan, and
requirements. It is deterministic local review only; it does not call AI services or external APIs.

Attach and list local evidence for a slice:

```bash
npm exec -- pathfinder evidence add add-billing-foundation --slice create-local-state --kind test --description "npm test passed"
npm exec -- pathfinder evidence add add-billing-foundation --slice create-local-state --kind log --description "Typecheck output" --path ./typecheck.log
npm exec -- pathfinder evidence list add-billing-foundation
```

Evidence is stored as JSON under the workstream and links to an existing slice. The optional `--path` value is validated relative to the current working directory and stored exactly as provided; Pathfinder does not copy artifact files.

Inspect the current local working tree diff:

```bash
npm exec -- pathfinder git diff
```

Inspect the committed branch diff relative to a local base ref:

```bash
npm exec -- pathfinder git diff --base main
```

Inspect a structured committed branch diff for CLI/UI review tooling:

```bash
npm exec -- pathfinder diff show --base main
npm exec -- pathfinder diff show --base main --json
npm exec -- pathfinder diff show --session review-create-local-state
npm exec -- pathfinder diff show --session review-create-local-state --json
```

`diff show` parses unified Git diff output into files, hunks, old/new line numbers,
line kinds, and rename metadata. `--session` reuses a stored local review session's
merge base and head commit.

Summarise committed branch changes relative to a local base ref:

```bash
npm exec -- pathfinder git summary --base main
```

This prints the merge-base summary for `main..HEAD`, including changed file counts, added/modified/deleted/renamed counts, and conservative per-file categories (`test`, `documentation`, `source`, `configuration`, `state`, or `other`).

Generate a local PR markdown draft:

```bash
npm exec -- pathfinder pr generate add-billing-foundation
npm exec -- pathfinder pr generate add-billing-foundation --base main
```

This overwrites and prints:

```text
.pathfinder/workstreams/add-billing-foundation/pr.md
```

The PR draft is assembled from local Pathfinder state. It includes the workstream, requirements
excerpt, plan excerpt, completed and remaining slices, slice dependencies, evidence grouped by
slice/review, review notes, unresolved comments, risks, and a checklist. When `--base` is supplied,
Pathfinder also includes a committed repository summary for `<base-ref>..HEAD` using the local
merge base.

Each workstream is stored as human-readable local files:

```text
.pathfinder/
  workstreams/
    <workstream-id>/
      workstream.json
      requirements.md
      plan.md
      slices.json
      comments.json
      review-sessions.json
      reviews.json
      evidence.json
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
npm exec -- pathfinder requirement set add-billing-foundation --file ./requirements.md
npm exec -- pathfinder requirement show add-billing-foundation
npm exec -- pathfinder plan import --file ./PLAN.md
npm exec -- pathfinder slice status add-billing-foundation create-local-state complete
npm exec -- pathfinder slice next add-billing-foundation
# Requires a clean working tree before running:
npm exec -- pathfinder slice branch add-billing-foundation create-local-state --base main
npm exec -- pathfinder review start --base main
npm exec -- pathfinder review sessions add-billing-foundation
npm exec -- pathfinder review session add-billing-foundation review-create-local-state
npm exec -- pathfinder review create add-billing-foundation --slice create-local-state --summary "Manual review passed."
npm exec -- pathfinder review run --base main
npm exec -- pathfinder review list add-billing-foundation
npm exec -- pathfinder review show add-billing-foundation manual-review-passed
npm exec -- pathfinder evidence add add-billing-foundation --slice create-local-state --kind test --description "npm test passed"
npm exec -- pathfinder evidence list add-billing-foundation
npm exec -- pathfinder diff show --base main
npm exec -- pathfinder diff show --base main --json
npm exec -- pathfinder diff show --session review-create-local-state
npm exec -- pathfinder diff show --session review-create-local-state --json
npm exec -- pathfinder git diff
npm exec -- pathfinder git diff --base main
npm exec -- pathfinder git summary --base main
npm exec -- pathfinder pr generate add-billing-foundation
npm exec -- pathfinder pr generate add-billing-foundation --base main
```
