# Packaging And Installation

Status: idea

## Summary

Make Pathfinder easy to install, update, and run as a local developer tool without cloning the repository and manually building every package.

## Gap

The current repo is developer-friendly, but product usage still assumes a local source checkout, npm workspace install, and build. A full tool should have a clean install path, predictable binary behavior, bundled UI assets, version reporting, and cross-platform smoke tests.

## Assumptions

- npm package distribution is the simplest first path.
- The UI bundle should be included in the distributed package.
- Cross-platform support matters, especially Windows, macOS, and Linux.
- No hosted service is needed for packaging.

## Requirements

- Add `pathfinder --version`.
- Add release build scripts that build all packages and UI assets.
- Ensure `pathfinder review serve` can find bundled UI assets after package installation.
- Add package files metadata so only necessary files publish.
- Add smoke tests for installed package behavior.
- Document install options:
  - local npm install
  - global npm install
  - `npx` or `npm exec`
  - source checkout for contributors
- Verify path handling on Windows and POSIX systems.
- Keep generated dist output untracked in source unless release packaging needs otherwise.

## Optional Later Distribution Paths

- Single executable packaging.
- Homebrew formula.
- Scoop or winget manifest.
- VS Code extension entry point that still talks to local Pathfinder.
- Desktop app wrapper for users who prefer a persistent local UI.

## Out Of Scope

- No hosted account.
- No license server.
- No update telemetry.
- No cloud sync.
- No marketplace dependency for core usage.

## Later Slice Candidates

- Add CLI version command.
- Add release packaging script.
- Add package file inclusion checks.
- Add installed-package smoke test.
- Document install and upgrade workflow.
- Evaluate single-binary packaging after npm distribution works.

