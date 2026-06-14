# Slice 32: GitHub Release Artifact Workflow

Status: ready

## Goal

Add a GitHub Actions workflow that builds Pathfinder in CI, packs the installable npm tarball, and uploads it to a GitHub Release.

## Reason

The repo should remain source-only while releases provide prebuilt install artifacts. This gives a practical personal install path before publishing to npm:

```bash
npm install -g https://github.com/<owner>/<repo>/releases/download/vX.Y.Z/pathfinder-X.Y.Z.tgz
```

## Requirements

- Add a CI release workflow under `.github/workflows/`.
- Workflow must:
  1. Check out source.
  2. Set up Node.
  3. Run `npm ci`.
  4. Run typecheck/tests/build.
  5. Run the packaging command from slice 31.
  6. Upload the `.tgz` to a GitHub Release.
- Prefer tag-triggered releases first:

```yaml
on:
  push:
    tags:
      - "v*"
```

- The workflow should use GitHub's built-in `GITHUB_TOKEN` where possible.
- The workflow should document the required repository permissions:

```yaml
permissions:
  contents: write
```

- Keep this separate from npm publishing. Do not publish to npm or GitHub Packages in this slice.

## Technical Notes

- GitHub Releases are the repository "Releases" area: versioned entries with notes and optional uploaded assets.
- A release asset can be a built npm tarball.
- `softprops/action-gh-release` is a common action for creating/updating GitHub Releases and uploading files, but using the GitHub CLI in Actions is also acceptable if simpler.
- Start with tag-triggered release, not every push to `main`. Automatic versioning comes in slice 33.

Example workflow shape:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run lint --if-present
      - run: npm run build
      - run: npm pack
      - uses: softprops/action-gh-release@v2
        with:
          files: "*.tgz"
```

## Likely Files

- `.github/workflows/release.yml`
- `README.md`
- packaging scripts from slice 31 if needed

## Acceptance Criteria

- Release workflow is valid YAML.
- Workflow uses tag-triggered release.
- Workflow does not require committed `dist/`.
- Workflow uploads the tarball artifact to the GitHub Release.
- README documents how to create a release tag and install from the release asset.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
```

Manual verification:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then install from the generated release asset URL.

