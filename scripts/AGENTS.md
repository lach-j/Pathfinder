# AGENTS.md

## Area

`scripts/` contains local maintenance scripts used by root package commands.

## Belongs Here

- Small Node.js scripts for repeatable repository maintenance.
- Build, cleanup, packaging, or validation helpers that are awkward to express directly in `package.json`.

## Does Not Belong Here

- Runtime Pathfinder behavior.
- CLI command implementations.
- Domain, state, Git, server, or UI logic.
- Machine-specific paths or credentials.

## Contribution Pattern

Keep scripts deterministic, cross-platform, and rooted at the repository working directory. Prefer Node built-ins over extra dependencies unless the script would otherwise become fragile.

If a script affects generated output or packaging, make sure the relevant root `package.json` script and documentation stay aligned.
