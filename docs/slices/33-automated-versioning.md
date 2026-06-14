# Slice 33: Automated Versioning

Status: done

## Goal

Automate release versioning and GitHub Release creation from pushes to `main`, while still publishing only GitHub Release artifacts and not npm packages.

## Reason

Manual tags are acceptable at first, but the desired long-term flow is:

```text
push to main
  -> CI checks
  -> semantic version determined from commits
  -> GitHub Release created
  -> built .tgz attached
```

## Requirements

- Add automated versioning using a standard tool.
- Recommendation: `semantic-release`.
- Use Conventional Commits to determine version bumps:
  - `fix:` patch
  - `feat:` minor
  - breaking change marker major
- Generate GitHub Releases automatically.
- Attach the built `pathfinder-*.tgz` artifact to the release.
- Do not publish to npm in this slice.
- Document the commit message convention and release behavior.

## Technical Notes

- `semantic-release` is the common JavaScript tool for automated SemVer, changelog/release notes, and GitHub Releases from CI.
- Typical plugins:
  - `@semantic-release/commit-analyzer`
  - `@semantic-release/release-notes-generator`
  - `@semantic-release/github`
  - optionally `@semantic-release/exec` if a custom pack command must run before GitHub asset upload
- The release workflow should run on pushes to `main`.
- It may replace or coexist with the tag workflow from slice 32. Prefer keeping manual tag release available until automated release is proven.
- Use GitHub `contents: write` permission.
- If package version needs to be stamped into `package.json`, decide whether semantic-release should update files or whether package version remains a CI-derived release artifact name. Prefer avoiding source commits from release automation unless needed.

## Likely Files

- `.github/workflows/release.yml`
- `.releaserc.json` or `release.config.js`
- `package.json`
- `package-lock.json`
- `README.md`

## Acceptance Criteria

- Pushes to `main` can create a semantically versioned GitHub Release.
- Release notes are generated from commit messages.
- Built `.tgz` is attached to the GitHub Release.
- npm registry publishing is not configured.
- README explains how to trigger a release and what commit messages affect versioning.
- Existing manual release workflow either still works or is intentionally replaced and documented.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Manual verification:

- Use a test repository or dry-run mode first:

```bash
npx semantic-release --dry-run
```

## Completion Notes

- Added semantic-release with Conventional Commit analysis, generated release notes, and GitHub Release publishing.
- Added root release configuration that tags releases as `vX.Y.Z`, stamps the CI workspace package version, builds, packs `pathfinder-*.tgz`, and attaches that tarball to the GitHub Release.
- Updated `.github/workflows/release.yml` with an automated `main` release job while preserving the manual `v*` tag release job.
- Documented release-triggering commit messages, dry-run verification, and the retained manual tag path in `README.md`.
