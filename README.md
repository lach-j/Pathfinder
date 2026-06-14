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

The setup is interactive by default in a terminal. For most personal use, choose:

- Personal setup
- Claude Code, OpenCode, or all supported agents

Personal setup keeps Pathfinder state outside the target repo and installs user-level agent instructions where possible. For Claude Code, Pathfinder updates your user-level Claude instructions instead of writing `.claude/commands/` into the repository.

For non-interactive setup with Claude Code:

```bash
pathfinder init --personal --user claude
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

Start a review session for the active slice:

```bash
pathfinder review start --base main
```

Open the local review UI:

```bash
pathfinder review serve
```

Export open review feedback for the agent:

```bash
pathfinder feedback export <workstream-id>
```

Generate PR markdown:

```bash
pathfinder pr generate <workstream-id> --base main
```

## Command Guide

The main commands are:

```text
pathfinder init
pathfinder agent next --json
pathfinder agent prompt
pathfinder review serve
pathfinder feedback export <workstream-id>
pathfinder pr generate <workstream-id>
```

Setup-related commands:

```text
pathfinder init --personal --user claude
pathfinder init --repo --agents
pathfinder agent install --user claude
pathfinder agent bootstrap
pathfinder agent commands install --tool claude
pathfinder agent doctor
```

`agent install --user claude` installs user-level Claude instructions.
`agent bootstrap` writes repo-local `AGENTS.md` instructions.
`agent commands install` writes optional repo-local slash/custom command wrappers for tools that support them.
`agent doctor` checks whether the current repo and agent integration are ready.

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
