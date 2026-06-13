---
name: implement-stage
description: Implement one stage from a stored breakdown plan, working in small commits and pausing at each commit point, resuming cleanly across sessions. Use when the user wants to "implement", "build", "do", or "continue" a specific planned stage of a previously broken-down piece of work.
argument-hint: [stage-issue-key | epic-key stage-number]
---

# Implement Stage

Build a single planned stage created by the `plan-stages` skill. This runs in its own session, can use an implementation-capable model, and works through the stage's commit points one at a time. It updates the shared plan so the stage can be paused and resumed across sessions.

## Inputs

The user invoked this with: $ARGUMENTS

- Preferred: a stage issue key (e.g. `PROJ-1301`).
- Also accepted: an epic key plus a stage number (e.g. `PROJ-1200 2`), or a direct path to a `PLAN.md`.

## Step 1 - Locate the plan and stage

1. Resolve the epic. If given a stage key, fetch it from the issue tracker (requesting parent metadata where supported) to find the epic key; if given an epic key directly, use it.
2. Open the local stored plan, for example `~/agent-plans/<EPIC-KEY>/PLAN.md`, and find the matching stage section (by issue key or stage number). Read its scope, commit breakdown, **and its progress log and status**.
3. If no stored plan exists, fall back to the issue description and tell the user the plan was not found - offer to run `/plan-stages` first. Proceed in degraded mode only if they confirm.

## Step 2 - Confirm context against current code

Plans can be stale. Re-read the code referenced in the stage and verify the cited files, symbols, and paths still exist before relying on them. Read the repository's relevant agent instruction files. Reconcile any drift with the user before writing code.

## Step 3 - Branch

Ensure you are on an appropriate feature branch for this stage (e.g. `task/<stage-key>-<slug>`). If on `main`/`develop` or an unrelated branch, create a new branch off the integration base. Never mix this stage's work onto an unrelated ticket's branch.

## Step 4 - Implement, one commit point at a time

Use the stage's **commit breakdown** as the commit points (refine if the code demands it). For each commit point, in order:

1. Make the edits for that commit point only.
2. Follow repo conventions before committing:
   - Normalize line endings according to the repository policy.
   - Format changed files with the repository's configured formatter.
   - Build or test the affected project(s) and confirm they succeed.
3. Commit with message `"<TICKET>: <concise summary>"`, a short body if useful, ending with:
   `Co-Authored-By: <agent name> <agent@example.invalid>`
   Never use `--no-verify` or skip hooks; if a hook fails, fix the cause.
4. **Pause** and report after each commit. Continue to the next commit point only when the user says to (unless they have told you to run straight through).

Report honestly: if a build or test fails, say so with the output; do not mark a commit point done if it did not land.

## Step 5 - Update plan state (this is what enables resume)

After each successful commit, edit the local stored plan, for example `~/agent-plans/<EPIC-KEY>/PLAN.md`:

- Set the stage status to `in-progress` when you start, `done` when all commit points are committed. Keep the status table at the top in sync.
- Append a line to the stage's **Progress log**: the commit hash, the commit-point summary, and date.

## Step 6 - Resume behaviour

If the stage status is already `in-progress`, read the Progress log and continue from the **next commit point not yet logged** - do not redo committed work. Verify the prior commits exist in git history before trusting the log.

## Step 7 - Wrap up

When the stage is fully committed:

- Mark the stage `done` in `PLAN.md`.
- Offer (do not assume) to push the branch / open a PR, transition or comment on the issue tracker task, and start the next stage.
