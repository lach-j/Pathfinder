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

Source package layout:

```text
packages/core          domain types, validation, pure planning/review/PR logic
packages/state         local .pathfinder/ filesystem persistence
packages/git           local Git adapter
packages/ui            React browser app for local Pathfinder views
packages/local-server  local-only HTTP API and static UI asset serving
packages/cli           command routing, argument parsing, terminal output
```

Run the local CLI with:

```bash
npm exec -- pathfinder help
```

Install repository-level agent instructions so compatible coding agents know to ask Pathfinder what to do next:

```bash
npm exec -- pathfinder agent bootstrap
npm exec -- pathfinder agent bootstrap --dry-run
```

The bootstrap command creates or updates a marked Pathfinder section in root `AGENTS.md` while preserving user-written content.
The managed section tells agents to start with `pathfinder agent next --json`, use `pathfinder agent prompt` for tool-neutral
instructions, avoid unmanaged parallel plans when Pathfinder state exists, and leave comment resolution to the developer.

Initialise Pathfinder state from the root of a Git repository:

```bash
npm exec -- pathfinder init
npm exec -- pathfinder init --agents
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

Ask Pathfinder what an agent should do next:

```bash
npm exec -- pathfinder agent next
npm exec -- pathfinder agent next --json
npm exec -- pathfinder agent prompt
npm exec -- pathfinder agent prompt --phase implement
```

`agent next --json` is the canonical first command for coding agents. It inspects only local
Pathfinder and Git state, then returns a deterministic phase, reason, relevant workstream/slice
ids, recommended commands, and concise instructions. It does not invoke an AI provider, run
commands automatically, or mutate code.

`agent prompt` renders deterministic markdown instructions for the current `agent next` phase.
Use it as a tool-neutral fallback when native slash commands or agent-specific wrappers are not
available. Explicit phases are also available with `--phase plan`, `--phase implement`,
`--phase feedback`, `--phase review`, and `--phase pr`; missing state is shown as placeholders
instead of being guessed.

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

Export open review feedback as an agent-actionable markdown queue:

```bash
npm exec -- pathfinder feedback export add-billing-foundation
npm exec -- pathfinder feedback export add-billing-foundation --session review-create-local-state --file ./.pathfinder-feedback.md
```

The feedback queue includes the active workstream and slice, local plan and requirements paths,
review session metadata when scoped with `--session`, and grouped open comments. It is a manual
bridge for Claude, Codex, Cursor, or another coding agent: paste or attach the markdown, ask the
agent to address every item while staying scoped to the active slice, then review the refreshed diff.
Pathfinder does not invoke an AI provider and does not resolve comments automatically.

Start and inspect a durable local review session for the active slice:

```bash
npm exec -- pathfinder review start --base main
npm exec -- pathfinder review refresh add-billing-foundation review-create-local-state
npm exec -- pathfinder review sessions add-billing-foundation
npm exec -- pathfinder review session add-billing-foundation review-create-local-state
```

Review sessions are stored under the active workstream and capture the active slice, base ref,
head ref, head commit, merge base, and changed files for that review pass.
Refreshing a review session re-reads the committed diff for the original base ref against the
current `HEAD`, updates the stored session metadata, preserves comments, and marks file or line
comment anchors as `current` or `stale` in CLI and browser comment output.

Start the local-only review server for browser-based review tooling:

```bash
npm exec -- pathfinder review serve
npm exec -- pathfinder review serve --port 4783
```

The server binds to `127.0.0.1` and is not a hosted backend. It does not add authentication,
cloud sync, or external API calls; it only exposes local Pathfinder state and local Git diffs
from the current repository.

The CLI command starts the local server from `packages/local-server`. Browser UI source lives under
`packages/ui/src/` as a Vite React app, and the local server serves the built assets from
`packages/ui/dist/`.

For frontend-only development, run the API server and Vite dev server separately:

```bash
npm exec -- pathfinder review serve --port 4783
npm run dev -w @pathfinder/ui
```

Open the printed URL, such as `http://127.0.0.1:4783`, to use the local
diff viewer. The viewer shows the active workstream and slice, lets you switch
between stored review sessions, lists changed files with simple stats, renders
unified diffs, and displays file or line comments near their targets. You can
add file-level comments, add inline comments from reviewable diff lines, resolve
open comments, and filter comments by all/open/resolved without restarting the
server. Comments are persisted in `.pathfinder/` and remain visible to the CLI.

Available JSON endpoints:

```text
GET  /api/current
GET  /api/workstreams
GET  /api/workstreams/:id/review-sessions
GET  /api/workstreams/:id/review-sessions/:sessionId/diff
POST /api/workstreams/:id/review-sessions/:sessionId/refresh
GET  /api/workstreams/:id/comments?session=<session-id>
POST /api/workstreams/:id/comments
POST /api/workstreams/:id/comments/:commentId/resolve
GET  /api/workstreams/:id/feedback?session=<session-id>
```

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
slice/review, review notes, review session metadata, local feedback grouped by open/resolved/stale
comments, exported feedback queue path when `./.pathfinder-feedback.md` exists, review-loop risks,
and a checklist. When `--base` is supplied, Pathfinder also includes a committed repository summary
for `<base-ref>..HEAD` using the local merge base.

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
npm exec -- pathfinder agent next
npm exec -- pathfinder agent next --json
npm exec -- pathfinder agent prompt
npm exec -- pathfinder agent prompt --phase implement
npm exec -- pathfinder agent prompt --phase feedback
npm exec -- pathfinder requirement set add-billing-foundation --file ./requirements.md
npm exec -- pathfinder requirement show add-billing-foundation
npm exec -- pathfinder plan import --file ./PLAN.md
npm exec -- pathfinder slice status add-billing-foundation create-local-state complete
npm exec -- pathfinder slice next add-billing-foundation
# Requires a clean working tree before running:
npm exec -- pathfinder slice branch add-billing-foundation create-local-state --base main
npm exec -- pathfinder review start --base main
npm exec -- pathfinder review refresh add-billing-foundation review-create-local-state
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
npm exec -- pathfinder feedback export add-billing-foundation
npm exec -- pathfinder feedback export add-billing-foundation --session review-create-local-state --file ./.pathfinder-feedback.md
npm exec -- pathfinder git diff
npm exec -- pathfinder git diff --base main
npm exec -- pathfinder git summary --base main
npm exec -- pathfinder pr generate add-billing-foundation
npm exec -- pathfinder pr generate add-billing-foundation --base main
```
