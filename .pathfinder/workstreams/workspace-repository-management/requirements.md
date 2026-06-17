# Workspace Repository Management Requirements

## Problem

The current browser workspace is tied to the Git repository directory where `pathfinder workspace serve` was launched. That makes the UI feel like a per-folder viewer instead of a Pathfinder workspace for managing local projects.

This is especially awkward in personal or external state mode: Pathfinder can store state outside a repository, but the UI only knows the launch repository. It cannot open another repo, discover whether Pathfinder is initialized there, or guide the user through initialization from the browser workspace.

## Goal

Make the workspace UI able to open and manage existing local Git repositories explicitly, without requiring the user to stop and restart the local server from each target repository.

## User Experience Requirements

- Add an "Open existing project" or equivalent entry point in the workspace UI.
- Let users choose a local Git repository intentionally, starting with a reliable local path entry and recent-project picker.
- Add a folder-picker affordance where the local browser/server architecture can support it safely; do not depend on a web-only picker that cannot give the server the absolute path it needs.
- Treat the launch directory as the initial repository only, not as the permanent workspace identity.
- Show which repository is currently open, including enough path/context to distinguish similarly named folders.
- Maintain a recent or known projects list in external Pathfinder user state, not inside every target repository.
- For a selected Git repository with Pathfinder state, load its workstreams, slices, reviews, branch reviews, evidence, feedback, and PR drafts as the current workspace context.
- For a selected Git repository without Pathfinder state, show an initialization flow similar to the CLI init menu.
- The UI initialization flow should support at least personal/external state and repo-local state choices, matching existing CLI semantics where practical.
- Initialization from the UI must be explicit and must not write `.pathfinder/` or agent files until the user confirms the selected mode and integrations.
- Preserve the existing CLI workflow: launching from a repository should still open that repository by default.

## Product Boundaries

- Pathfinder remains local-first, filesystem-first, Git-aware, open-source, and single-user by default.
- Do not add cloud sync, hosted accounts, authentication, organizations, roles, billing, or remote repository provider dependencies.
- Do not scan the entire filesystem automatically.
- Do not require users to initialize Pathfinder in every repo just to see that a Git repository exists.
- Do not silently mutate repository files or Pathfinder state while browsing known projects.
- Keep repo-aware business behavior reusable outside the browser UI.

## Technical Requirements

- Introduce a server-side notion of selected workspace repository, separate from process current working directory.
- Ensure local-server APIs can resolve Pathfinder state for a requested repository root instead of assuming only the launch root.
- Validate selected paths before using them:
  - path exists
  - path is a directory
  - path is inside a Git working tree or is a Git root
  - resolved Git root is what Pathfinder will operate on
- Return clear state for each selected repository:
  - not a directory
  - not a Git repository
  - Git repository but Pathfinder uninitialized
  - Pathfinder initialized with repo-local state
  - Pathfinder initialized with personal/external state
  - invalid or unreadable Pathfinder state
- Store recent/known repository metadata externally, keyed by resolved Git root, with last opened timestamps and display names.
- Keep local-server response types explicit and UI-facing; the browser must continue to call only the local HTTP API.
- Reuse existing state initialization and validation behavior instead of duplicating CLI-only rules in UI code.
- Keep error responses JSON and consistent with existing local-server style.

## Acceptance Criteria

- A user can start `pathfinder workspace serve` from one repository and open a different local Git repository from the UI.
- The workspace reloads workstream and review context for the selected repository without restarting the server.
- The UI clearly distinguishes initialized, uninitialized, non-Git, and invalid-path selections.
- A user can initialize Pathfinder for an uninitialized selected repository from the UI using choices equivalent to the CLI init flow.
- Recent repositories appear in the UI after being opened and survive server restarts in external user state.
- Existing current-repository workspace behavior remains compatible.
- No filesystem-wide scan, cloud service, hosted backend, auth, or remote provider integration is introduced.
