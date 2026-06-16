# Pathfinder

Pathfinder is a local-first workflow tool for AI-assisted development. It keeps track of what you are building, breaks work into reviewable slices, helps coding agents stay scoped, gives you a local diff review loop, and generates PR-ready markdown.

It does not call AI providers or replace Claude Code, Codex, Cursor, GitHub, GitLab, Jira, or Linear. Pathfinder stores local context and tells your agent what to do next.

## Install

Install the release tarball globally:

```bash
npm install -g https://github.com/lach-j/Pathfinder/releases/download/v1.1.0/pathfinder-1.1.0.tgz
```

Then check the CLI is available:

```bash
pathfinder help
```

## First Setup

From the root of the Git repository you want to use with Pathfinder:

```bash
pathfinder init
```

The setup is interactive by default in a terminal. Use the arrow keys to choose the setup mode, then select one or more agent integrations with Space and press Enter to continue. For most personal use, choose:

- Personal setup
- Claude Code, OpenCode, Codex, or any combination

Personal setup keeps Pathfinder state outside the target repo and installs user-level agent instructions where possible. For Claude Code and Codex, Pathfinder updates your user-level agent instructions instead of writing command helpers into the repository.

For non-interactive setup with Claude Code:

```bash
pathfinder init --personal --user claude
```

To install every supported personal integration non-interactively:

```bash
pathfinder init --personal --user all
```

For repo-local setup instead:

```bash
pathfinder init --repo --agents
```

Repo-local setup writes `.pathfinder/` into the repository. With `--agents`, it also adds a managed Pathfinder section to the repo `AGENTS.md`.

## Which Setup Should I Use?

Use personal setup when Pathfinder is just for you, especially in a work or client repo where you do not want to add Pathfinder files:

```bash
pathfinder init --personal --user claude
```

Use repo-local setup when the repository itself should carry Pathfinder state and agent instructions:

```bash
pathfinder init --repo --agents
```

After setup, Pathfinder discovers the right state location for the current repo automatically.

## Using Claude Code

After personal setup, open Claude Code in the same repository and ask it to continue with Pathfinder. The installed Claude instructions tell Claude to begin with:

```bash
pathfinder agent next --json
```

That command is the source of truth for the current workflow phase. It tells the agent whether to plan, implement, address feedback, review, or prepare PR output.

If Claude needs fuller markdown instructions for the current phase, it can run:

```bash
pathfinder agent prompt
```

## Using Codex

For Codex, run personal setup with the Codex integration:

```bash
pathfinder init --personal --user codex
```

Pathfinder writes a managed section to your Codex global instructions file. By default that is `~/.codex/AGENTS.md`; if `CODEX_HOME` is set, Pathfinder uses `CODEX_HOME/AGENTS.md`.

## Basic Workflow

Create or import a workstream:

```bash
pathfinder workstream create --title "Add billing foundation"
```

Or import a markdown stage plan:

```bash
pathfinder plan import --file ./PLAN.md
```

Ask Pathfinder what the agent should do next:

```bash
pathfinder agent next --json
```

Start the selected slice on its own branch before implementing:

```bash
pathfinder slice start <workstream-id> <slice-id> --base main
```

Start a review session for the active slice:

```bash
git status --short
git add <changed-files>
git commit -m "Implement <slice>"
pathfinder review start --base main
```

Review sessions use committed Git diffs. `pathfinder review start` refuses to run while the worktree or index has uncommitted changes.

Open the local review UI:

```bash
pathfinder workspace serve
```

`pathfinder review serve` remains available as a compatibility alias.

When the review has no open comments and the human accepts the diff, record that explicit approval:

```bash
pathfinder review approve <workstream-id> --session <review-session-id>
```

Export open review feedback for the agent:

```bash
pathfinder feedback export <workstream-id>
```

Generate PR markdown:

```bash
pathfinder pr generate <workstream-id> --base main
```

## Standalone Branch Review

For small branch-only tasks, you can review the current branch without creating a workstream or slice. This is separate from the agent state workflow: `pathfinder agent next` still uses workstreams and active slices as its source of truth.

Ask an agent to use the standalone branch review state machine:

```text
Use Pathfinder branch review mode. Run `pathfinder branch-review next --json` and follow it.
```

The command reports the next step for the current branch review:

```bash
pathfinder branch-review next --json
```

For manual control, start from a clean committed branch, then create a branch review session:

```bash
pathfinder branch-review start --base main
```

Inspect the stored diff and leave local file or line comments:

```bash
pathfinder branch-review diff <session-id>
pathfinder branch-review comment add <session-id> --file src/example.ts --line 12 --side new --body "Handle the empty case."
pathfinder branch-review comment list --session <session-id> --open
```

Export open branch-review feedback for an agent, refresh the session after fixes, and approve when no open comments remain:

```bash
pathfinder branch-review feedback export --session <session-id> --file ./.pathfinder-branch-feedback.md
pathfinder branch-review refresh <session-id>
pathfinder branch-review approve <session-id>
```

Generate PR markdown for the standalone branch review:

```bash
pathfinder branch-review pr generate --base main
```

## Command Guide

The main commands are:

```text
pathfinder init
pathfinder agent next --json
pathfinder agent prompt
pathfinder workstream list --json
pathfinder workstream show <workstream-id> --json
pathfinder slice list <workstream-id> --json
pathfinder slice next <workstream-id> --json
pathfinder slice start <workstream-id> <slice-id> --base <base-ref>
pathfinder review sessions <workstream-id> --json
pathfinder comment list <workstream-id> --session <session-id> --open --json
pathfinder workspace serve
pathfinder review serve
pathfinder feedback export <workstream-id>
pathfinder pr generate <workstream-id>
pathfinder branch-review next --json
pathfinder branch-review start --base <base-ref>
pathfinder branch-review comment add <session-id> --file <path> [--line <line-number> --side old|new] --body "..."
pathfinder branch-review feedback export [--session <session-id>] [--file ./feedback.md]
pathfinder branch-review pr generate [--base <base-ref>]
```

Setup-related commands:

```text
pathfinder init --personal --user claude
pathfinder init --repo --agents
pathfinder agent install --user codex
pathfinder agent bootstrap
pathfinder agent commands install --tool claude
pathfinder agent doctor
pathfinder agent doctor --personal
```

`agent install --user claude` and `agent install --user codex` install user-level instructions.
`agent bootstrap` writes repo-local `AGENTS.md` instructions.
`agent commands install` writes optional repo-local slash/custom command wrappers for tools that support them.
`agent doctor` checks whether the current repo and agent integration are ready. Use `agent doctor --personal` after personal setup to verify external state, user-level instructions, and no repo-local Pathfinder footprint.

## Local State

Personal setup stores Pathfinder state under the Pathfinder user data directory, keyed per Git repository.

Repo-local setup stores state under:

```text
.pathfinder/
  project.json
  workstreams/
```

Workstream files are human-readable where practical: markdown for plans, requirements, feedback, and PR drafts; JSON for structured state.

## Development

Install dependencies and build from source:

```bash
npm install
npm run build
```

Run the local CLI from the source checkout:

```bash
npm exec -- pathfinder help
```

Run checks:

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Generated TypeScript output under `packages/*/dist/` is intentionally untracked.

## Releases

Create a release-style npm tarball locally:

```bash
npm run build
npm pack
```

Smoke test it with a temporary global prefix:

```bash
npm install -g --prefix <temp-prefix> ./pathfinder-*.tgz
<temp-prefix>/bin/pathfinder help
```

On Windows the binary path is usually:

```text
<temp-prefix>/pathfinder.cmd
```

GitHub release artifacts are produced by the release workflow. Conventional Commits control automated version bumps:

```text
fix: correct review session refresh
feat: add external state mode
feat!: change state layout
```

The workflow builds from source, packs the tarball, and uploads it to the matching GitHub Release. It does not publish to npm.
