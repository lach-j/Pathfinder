# Slice 40: Agent Prompt And Command Stability

Status: done

## Goal

Reduce noisy or misleading agent behavior by making prompts, command hints, and JSON support consistent with the repository and CLI surface.

## Reason

The QuickNotes rollout mostly worked, but the transcript exposed several avoidable agent distractions:

- `pathfinder agent prompt --phase implement` listed duplicate commands.
- The prompt told the agent to run npm checks in a Python-only repository with no `package.json`.
- The agent tried `pathfinder workstream show quicknotes --json`, but that command rejected `--json`.
- The agent tried `pathfinder workstream --help`, but help discovery for subcommands was not available.
- `agent doctor --json` returned `ok: false` because repo-local integrations were missing, even though external state existed and the user-level instructions were doing their job. Slice 36 covers the personal-mode doctor fix; this slice should ensure the prompt and command surface line up with that mode.

These do not require new product scope, but they do affect response stability.

## Requirements

- Deduplicate command lists in `pathfinder agent prompt`.
- Make check guidance repository-aware:
  - if `package.json` exists, recommend npm checks
  - if Python project markers exist, recommend detected Python checks where possible
  - if checks cannot be detected, tell the agent to inspect the repo and run applicable checks
- Keep Pathfinder's own repository slice handoffs free to require npm checks for Pathfinder development.
- Add or standardize JSON output for read-only/show/list commands commonly used by agents, including:

```bash
pathfinder workstream show <id> --json
pathfinder workstream list --json
pathfinder slice list <workstream-id> --json
pathfinder slice next <workstream-id> --json
pathfinder review sessions <workstream-id> --json
pathfinder comment list <workstream-id> --session <id> --open --json
```

- Add consistent help behavior for command groups and subcommands, for example:

```bash
pathfinder workstream --help
pathfinder slice --help
pathfinder review --help
```

- Ensure personal/external mode doctor guidance does not make agents think repo-local files are required when the user intentionally chose no-repo-footprint mode.

## Technical Notes

- Keep JSON schemas stable and compact. Avoid dumping large markdown bodies unless the command already explicitly shows content.
- Do not add external dependency detection services. Detect project type from local files only.
- Repository-aware check guidance should live in reusable agent/core logic rather than being hard-coded in one formatter.
- This slice should not implement branch start, commit gating, or approval semantics; those belong to slices 37-39.

## Likely Files

- `packages/core/src/agent/prompt.ts`
- `packages/core/src/agent/*`
- `packages/cli/src/app.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/formatters.ts`
- tests
- `README.md`

## Acceptance Criteria

- `pathfinder agent prompt --phase implement` no longer emits duplicate command lines.
- In a Python-only repo with no `package.json`, the prompt does not require `npm run typecheck`, `npm test`, or `npm run lint --if-present`.
- In a Node repo with `package.json`, the prompt still recommends npm checks.
- The listed `--json` command variants return valid JSON.
- Command-group help works for workstream, slice, review, comment, and agent groups.
- Personal/no-repo-footprint mode doctor output and prompt text do not imply repo-local integration files are required.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
pathfinder agent prompt --phase implement
pathfinder workstream --help
pathfinder workstream show <workstream-id> --json
pathfinder slice next <workstream-id> --json
pathfinder review sessions <workstream-id> --json
```

## Completion Notes

- Deduplicated agent prompt command lists.
- Added pure repository check guidance and state-layer local project detection so Node repositories get npm checks, Python repositories get detected Python checks, and unknown repositories are told to inspect and run applicable checks.
- Added `--json` support for agent-friendly read-only list/show commands.
- Added command-group help for agent, workstream, slice, comment, and review commands.
- Verified personal doctor tests continue to treat external/no-repo-footprint mode as valid when installed.

Checks run:

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```
