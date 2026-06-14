# AGENTS.md

## Area

`.github/` contains repository automation.

## Belongs Here

- GitHub Actions workflows.
- Release artifact publishing configuration.
- Repository automation that runs in GitHub-hosted CI.

## Does Not Belong Here

- Local Pathfinder runtime behavior.
- Package build output.
- Product planning or slice status.
- Secrets, tokens, or machine-specific configuration.

## Contribution Pattern

Keep workflows explicit and source-based. Release jobs should install dependencies from the lockfile, run checks, build from source, create artifacts, and publish those artifacts from CI rather than relying on committed `dist/` files.

When changing release automation, smoke test the equivalent local commands where practical:

```bash
npm ci
npm run typecheck
npm test
npm run lint --if-present
npm run build
npm pack
```
