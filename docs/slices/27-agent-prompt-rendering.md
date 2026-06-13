# Slice 27: Agent Prompt Rendering

Status: ready

## Goal

Render tool-neutral prompts from Pathfinder state so a coding agent can plan, implement, or address feedback without the user manually assembling context.

## Read First

- `AGENTS.md`
- `PATHFINDER_PRD.md`
- `README.md`
- `docs/implementation-status.md`
- `docs/slices/16-stage-plan-import.md`
- `docs/slices/20-feedback-queue-export.md`
- `docs/slices/26-agent-next-state-machine.md`
- This file

## Product Context

`pathfinder agent next --json` tells the agent the phase and recommended commands. The next layer should produce the full prompt text the agent can follow for that phase.

This intentionally stays tool-neutral. Claude Code, Codex, OpenCode, Cursor, and other agents can all consume plain markdown instructions.

## Scope

Implement:

```bash
pathfinder agent prompt
pathfinder agent prompt --phase plan
pathfinder agent prompt --phase implement
pathfinder agent prompt --phase feedback
pathfinder agent prompt --phase review
pathfinder agent prompt --phase pr
```

Expected behavior:

- Without `--phase`, call the same state analysis as `pathfinder agent next` and render the prompt for the current phase.
- With `--phase`, render a prompt for that phase using available state and clear placeholders for missing inputs.
- Include specific commands the agent should run.
- Include explicit constraints:
  - use Pathfinder as source of truth
  - do not create a parallel plan/checklist outside Pathfinder
  - keep changes scoped to the active slice
  - do not resolve comments automatically
  - run repo checks
  - refresh or start review session when implementation/fixes are complete
- Prefer absolute or repository-relative paths to `.pathfinder` artifacts where useful.

Suggested prompt modes:

```text
plan
implement
feedback
review
pr
```

Prompt content:

- `plan`: read requirement/context, explore repo, ask only necessary questions, create/update workstream, plan, and slices.
- `implement`: read current context, implement active/next slice only, run checks, start or refresh review session.
- `feedback`: export/read open feedback, address every open item, run checks, refresh review session, do not resolve comments.
- `review`: start local review server or review session and ask the human to review.
- `pr`: generate PR markdown from Pathfinder state and summarize remaining risks.

## Technical Decisions

- Prompt rendering is a convenience layer over the deterministic state machine, not a replacement for it.
- Prompt output should be deterministic for a given Pathfinder state.
- The prompt should include commands literally, not vague descriptions.
- The prompt should avoid agent-specific syntax so native wrappers can reuse it.
- Markdown output is the canonical prompt format.

## Out Of Scope

- No MCP.
- No agent invocation.
- No Claude/OpenCode command file generation; that is a later slice.
- No AI-written summaries beyond deterministic templates.
- No external API calls.

## Likely Files

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/state/src/index.ts`
- `packages/state/src/index.test.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `README.md`

## Acceptance Criteria

- `pathfinder agent prompt` renders a useful prompt for the current `agent next` phase.
- `--phase plan`, `--phase implement`, `--phase feedback`, `--phase review`, and `--phase pr` each produce deterministic markdown.
- Prompt output includes specific commands and constraints.
- Tests cover at least implement and feedback prompts with realistic state.
- README documents using `pathfinder agent prompt` as a fallback when native slash commands are unavailable.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Smoke test:

```bash
npm exec -- pathfinder agent prompt
npm exec -- pathfinder agent prompt --phase implement
npm exec -- pathfinder agent prompt --phase feedback
```

## Suggested Prompt

```text
Read AGENTS.md, PATHFINDER_PRD.md, README.md, docs/implementation-status.md, docs/slices/16-stage-plan-import.md, docs/slices/20-feedback-queue-export.md, docs/slices/26-agent-next-state-machine.md, and docs/slices/27-agent-prompt-rendering.md.

Current slice goal:
Add deterministic markdown prompt rendering for Pathfinder agent phases.

Implement only this slice.

Do not build MCP, invoke agents, generate Claude/OpenCode command files, call external APIs, add AI-written summaries, hosted services, auth, billing, cloud sync, organisations, or roles.

Run npm run typecheck, npm test, npm run lint --if-present, and npm run build. Smoke test agent prompt in automatic and explicit phase modes.

Summarise changed files, checks run, manual verification commands, and any follow-up decisions needed.
```
