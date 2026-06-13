---
name: plan-stages
description: Break an issue, story, or epic into PR-sized implementation stages. Interrogate the user on real decisions, explore the codebase, optionally create child implementation tasks, and persist a resumable plan. Use when the user wants to "plan", "break down", "slice", or "scope out" work into stages or PRs before implementing.
argument-hint: [issue-or-epic-key-or-url]
---

# Plan Stages

Turn a unit of work into an ordered set of PR-sized stages, captured in a resumable plan file and optionally mirrored into issue tracker tasks. This is the "big planning session" half of the workflow; the companion skill `implement-stage` builds one stage at a time in a fresh session.

Run this with the strongest available planning model. It is a thinking-heavy, decision-heavy task.

## Inputs

The user invoked this with: $ARGUMENTS

- Usually an issue key or URL (e.g. `PROJ-1234` or a browse link). It may be an epic, a story, or a task.
- If no ticket is given, work from the description in the conversation and still produce a stored plan.

## Example conventions for the source repo

- Issue tracker: use the configured site, project key, and implementation-task issue type for the repository. Child implementation tasks are parented directly to the epic through the tracker-supported parent field.
- **Issue text must be typable**: no em-dashes, arrows, or other non-keyboard characters in any issue summary or description. Native markdown formatting (bullets, headings, code blocks) is fine. This is a standing user preference.
- Read the repository's agent instruction files before proposing changes.

## Step 1 - Understand the work

1. Fetch the given issue with the configured issue tracker tool (request parent metadata where supported). Walk up to find the epic (group everything under it) and note the originating issue.
2. If it is a story or epic, also read linked/child issues so you understand the whole shape.
3. Read the relevant agent instruction files for conventions.

## Step 2 - Explore the codebase (read-only)

Launch up to 3 `Explore` agents in parallel to map: existing patterns and utilities to reuse, where the relevant models/services/migrations/resolvers/tests live, naming conventions, and anything already half-built. Prefer reusing existing code over inventing new patterns. Capture concrete `file:line` references.

## Step 3 - Interrogate the user

Use `AskUserQuestion` for decisions you genuinely cannot resolve from the code or ticket: scope boundaries, cardinality, what is in vs out of scope, which existing component to extend, behavioural rules, data ownership. Lead each option with your recommendation. Do **not** ask things the code already answers - find those yourself. Record every answer; they become the "Decisions" section of the plan.

## Step 4 - Slice into stages

Produce an ordered list of stages where each stage:

- Is a single PR of roughly 20 files or fewer.
- Is independently shippable where possible, and ordered by dependency.
- Stage 1 is the smallest viable foundation (often the data model / migration).

For each stage capture: **scope**, **key files** (reuse existing paths/utilities found in Step 2), **approach**, **acceptance criteria**, **open items / blockers**, **dependencies**, and a rough **commit breakdown** (the natural commit points within the stage).

Flag open items at the stage that needs them rather than blocking the whole plan.

## Step 5 - Persist the plan

Write the plan to a local plans directory such as `~/agent-plans/<EPIC-KEY>/PLAN.md` (create the directory; `<EPIC-KEY>` is the epic's issue key, e.g. `PROJ-1200`). Use this structure exactly so `implement-stage` can parse and update it:

```markdown
# <Epic title> - Stage Plan

Epic: <epic key + url>
Originating ticket: <key + url>
Created: <YYYY-MM-DD>

## Context
<Why this work is happening and the intended outcome.>

## Decisions
<Bullet list of the decisions confirmed with the user in Step 3.>

## Conventions / constraints
<Repo-specific notes that affect implementation: build commands, formatting, commit format, feature flags, etc.>

## Stages

| Stage | Issue | Title | Status |
| ----- | ---- | ----- | ------ |
| 1 | <KEY or -> | <title> | pending |
| 2 | <KEY or -> | <title> | pending |

---

## Stage 1: <title> (<issue key or TBD>) [status: pending]

**Scope:** ...
**Key files:** ...
**Approach:** ...
**Acceptance criteria:** ...
**Open items:** ...
**Depends on:** ...
**Commit breakdown:**
1. <commit point>
2. <commit point>

**Progress log:**
- (empty until implementation begins)

## Stage 2: ...
```

Status values: `pending`, `in-progress`, `done`. Keep the status table at the top in sync with the per-stage headings.

## Step 6 - Create Issue Tracker Tasks (ask first)

Ask the user whether to create the stages as issue tracker tasks. If yes:

- For each stage create the repository's configured technical-task issue type with `parent` = epic key, the configured project key, `contentFormat: markdown`, and typable characters only. Include scope, acceptance criteria, dependencies, and open items.
- If stage 1 maps to an existing ticket, keep it and append a "Technical context (added during planning)" section rather than rewriting the original text.
- Write the resulting keys back into the Stages table and stage headings in `PLAN.md`.

## Step 7 - Report

Summarise the stages with their issue keys, give the path to `PLAN.md`, and tell the user they can implement each stage in a fresh session (any model) with:

`/implement-stage <stage-issue-key>`
