# Parallel Agent Session Launcher

Status: idea

## Summary

Add an explicit local workflow for launching multiple independent agent sessions for slices that can run in parallel.

Pathfinder would identify ready parallel slices, create separate branches and worktrees from a base branch, render initial prompts for each slice, and launch configured agent commands so each session works in isolation.

## User Story

As a developer, I want Pathfinder to start several independent implementation sessions at once for slices that do not depend on each other, so that parallel AI work can happen without branches or working directories colliding.

## Assumptions

- Parallel sessions should use separate Git worktrees.
- Each session should get its own branch created from the chosen base branch, commonly `main`.
- The user explicitly starts parallel sessions from the UI or CLI.
- Pathfinder should never launch hidden background agent work without a visible command or preset.
- The first supported agent can be whatever is easiest locally, but the model should allow multiple agent presets.
- Each session receives an initial prompt containing baseline instructions and a path to the slice document or state.
- Branches and worktrees should be easy to inspect and clean up manually.

## Requirements

- Identify slices that are ready to start:
  - Status is ready or equivalent.
  - Dependencies are complete.
  - No existing active session for the same slice.
  - No conflicting branch or worktree state.
- Let the user select one or more ready slices.
- Create one branch per slice from the selected base branch.
- Create one worktree per branch.
- Render one initial implementation prompt per slice.
- Launch one configured agent process per selected slice, or prepare commands for the user to run manually.
- Store session metadata locally:
  - Slice id.
  - Branch.
  - Worktree path.
  - Agent preset.
  - Launch command.
  - Start time.
  - Current state.
- Avoid cross-session interference by ensuring each agent runs inside its worktree.
- Provide clear failure handling if branch creation, worktree creation, or launch fails.

## Agent Presets

An agent preset could define:

```json
{
  "id": "claude-code-default",
  "label": "Claude Code",
  "command": "claude",
  "args": [],
  "promptMode": "stdin",
  "workingDirectory": "worktree",
  "instructionsTemplate": "default-implementation"
}
```

Initial presets can be local configuration, not a plugin system.

## Prompt Shape

Each launched session should receive a prompt like:

```text
Read AGENTS.md and the Pathfinder slice context.

Begin implementation of:
<path-to-slice-document-or-generated-context>

Stay scoped to this slice. Use the worktree and branch already prepared for you.
Run the expected checks. When implementation is ready, report back and do not push unless instructed.
```

The exact prompt should be rendered by Pathfinder from local state, not hard-coded in the UI.

## Safety And Review

- Do not mark a slice complete just because an agent exits successfully.
- Do not push automatically unless a later explicit workflow enables it.
- Do not merge branches.
- Do not resolve review comments automatically.
- Make it easy for the user to pause or abandon a session.
- Keep cleanup explicit because worktrees may contain useful investigation state.

## Out Of Scope

- No remote orchestration service.
- No multi-user scheduling.
- No hosted agent workers.
- No cloud queue.
- No automatic merge queue.
- No implicit billing or provider setup.

## Later Slice Candidates

- Add local agent preset configuration.
- Add worktree creation for a single slice.
- Add prompt rendering for implementation sessions.
- Add CLI command to prepare parallel sessions.
- Add UI action to launch ready parallel sessions.
- Add worktree cleanup and abandoned-session handling.

