# Slice 52: Configurable Git Message Generation

Status: ready

## Goal

Add configurable git commit message generation guidance for Pathfinder-driven workflows.

## Reason

Different repositories have different commit conventions. A Pathfinder workflow should be able to ask agents to use Conventional Commits, add trailers such as `Co-authored-by: Pathfinder`, include slice ids, or follow a local commit message policy without hard-coding one style globally.

## Requirements

- Add local configuration for commit message guidance.
- Support at least:
  - conventional commit preference
  - optional fixed trailers such as `Co-authored-by: Pathfinder <...>`
  - optional inclusion of workstream id, slice id, or branch-review id
  - custom freeform instructions
- Include commit message guidance in relevant agent prompts.
- Add a CLI command that renders a commit-message prompt or suggested draft from current state.
- Keep actual `git commit` execution outside this slice unless an existing command already owns it.
- Do not mutate repository history.
- Do not force a single commit convention across all repositories.

## Technical Notes

- Prefer simple local configuration first; avoid a broad settings system unless one already exists.
- Keep generated guidance deterministic and inspectable.
- If trailers are configured, render them exactly and document that the user remains responsible for valid identities.
- This should improve prompts and copyable commit messages without adding hosted integration.

## Likely Files

- `packages/core/src/agent/*`
- `packages/core/src/config/*`, if configuration helpers already exist or need to be introduced
- `packages/state/src/*`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/formatters.ts`
- `README.md`
- tests

## Acceptance Criteria

- Users can configure repository or Pathfinder-state commit message guidance.
- Agent prompts include the configured commit guidance when asking an agent to implement, address feedback, or prepare PR output.
- Users can render commit-message guidance or a suggested message from the CLI.
- Conventional Commit guidance can be enabled without hard-coding it for all users.
- Optional trailers are included when configured.
- No command in this slice commits changes automatically.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
```

Smoke test:

```bash
pathfinder config set commit.style conventional
pathfinder config set commit.trailer "Co-authored-by: Pathfinder <pathfinder@local>"
pathfinder agent prompt
```
