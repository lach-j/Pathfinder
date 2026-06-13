# Agent Assisted Slice Planning

Status: idea

## Summary

Add an interactive planning flow where Pathfinder uses the gathered workstream context to guide an agent through requirements clarification, plan creation, and slice breakdown.

The goal is to preserve the original skill-like behavior while making Pathfinder the local system of record for the plan, assumptions, questions, and generated slices.

## User Story

As a developer, I want Pathfinder to use the linked workstream context to draft a plan and slice breakdown, ask clarifying questions only when needed, and persist the final result as local Pathfinder state.

## Assumptions

- Pathfinder should render prompts and state, not become the planner model itself.
- The agent may be Claude Code, Codex, Cursor, OpenCode, or another local coding assistant.
- The planning loop can begin as generated markdown prompts that the user runs in an agent.
- Later versions may invoke configured local agent commands, but only through explicit user action.
- The user should be able to review and edit the plan and slices before accepting them.
- Generated slices should prefer small, reviewable, testable units.
- Shared foundations should be identified early so later independent slices can run in parallel.

## Requirements

- Build a planning prompt from:
  - Workstream requirements.
  - Linked issues.
  - Local context.
  - Boundaries.
  - Repository summary.
  - Existing conventions.
- Capture assumptions made during planning.
- Capture clarifying questions and answers.
- Generate or update:
  - `requirements.md`
  - `plan.md`
  - `slices.json`
  - optional slice markdown handoffs
- Mark generated slices with dependency metadata where known.
- Identify slices that are parallelizable versus serial.
- Give priority to shared setup, data model, contracts, or adapter work that unblocks later parallel work.
- Let the user accept, edit, or reject proposed slices before they become active work.
- Preserve planning output as local markdown so it can be reviewed without the UI.

## Planning Heuristics

The planner should prefer:

- Shared contracts before feature-specific implementations.
- Narrow vertical slices over broad architectural rewrites.
- Testable boundaries.
- Dependencies that explain why serial ordering exists.
- Explicit non-goals to prevent agent scope drift.
- Human-readable slice titles and descriptions.
- Reviewable changes that map cleanly to future PRs.

## Interactive Questions

The agent should ask questions only when missing information would materially change the plan. Examples:

- Which base branch should implementation branches start from?
- Which external issue is the source of truth?
- Which files or systems are out of bounds?
- Should shared foundations be one separate slice or folded into the first implementation slice?
- What checks must pass before review?

Question and answer history should be stored with the workstream.

## Out Of Scope

- No automatic implementation during planning.
- No background autonomous agent sessions.
- No hosted planner service.
- No mandatory AI provider.
- No direct issue tracker mutation.
- No full project management board.

## Later Slice Candidates

- Render planning prompts from local Pathfinder state.
- Store planning assumptions and Q&A.
- Import generated stage plans into workstream state.
- Add dependency-aware slice generation metadata.
- Add UI review and edit for proposed slices.

