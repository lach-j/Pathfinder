# Slice 31: Release Packaging

Status: ready

## Goal

Make Pathfinder build into a self-contained npm tarball that can be installed globally from a GitHub Release asset without cloning the source repo or building on every device.

## Reason

Pathfinder should be easy to install as a personal tool. The source repo should continue to track source only, with no committed `dist/` output. Build artifacts should be created by CI and attached to releases.

The target install shape is:

```bash
npm install -g https://github.com/<owner>/<repo>/releases/download/vX.Y.Z/pathfinder-X.Y.Z.tgz
```

## Requirements

- `npm pack` must produce a working tarball containing:
  - built CLI JavaScript and declarations
  - built core/git/state/local-server packages
  - built UI assets required by `pathfinder review serve`
  - package metadata needed for the `pathfinder` binary
- The tarball must not require TypeScript, Vite, or source compilation on the installing machine.
- The repository should continue to ignore generated output (`dist/`, tsbuildinfo, UI build output).
- The packed artifact should exclude unnecessary source-only files where practical, but do not over-optimize packaging yet.
- Global install from the produced `.tgz` should expose:

```bash
pathfinder help
```

- Document the local packaging smoke test.

## Technical Notes

- Current root package has `"private": true`; that is fine for now if `npm pack` is used only as a release artifact, but verify whether npm refuses packing a private root package. If it does, prefer a dedicated publishable package workspace rather than making the whole monorepo public by accident.
- Current root `bin` points to `./packages/cli/dist/index.js`; that can work if the packed artifact includes workspace built output.
- If workspace dependencies using `"@pathfinder/core": "0.1.0"` do not pack/install cleanly, consider one of these:
  - pack from the root with all workspace outputs included
  - create a dedicated `packages/pathfinder` distribution package
  - rewrite internal package dependency versions during pack
- Do not use a `prepare` script as the primary solution. `prepare` makes Git installs build locally, which is specifically what we are avoiding.
- Do not commit generated build output.

## Likely Files

- `package.json`
- `package-lock.json`
- package-level `package.json` files
- `.npmignore` or `files` fields
- `README.md`
- possibly a packaging script under `scripts/`

## Acceptance Criteria

- `npm run build` succeeds.
- `npm pack` or the chosen packaging command produces a `.tgz`.
- Installing the `.tgz` into a temporary global/prefix location exposes `pathfinder`.
- `pathfinder help` works from the installed tarball.
- `pathfinder review serve` can locate built UI assets from the installed package.
- No generated `dist/` files are committed.

## Checks

```bash
npm run typecheck
npm test
npm run lint --if-present
npm run build
npm pack
```

Smoke test with a temp prefix:

```bash
npm install -g --prefix <temp-prefix> ./pathfinder-*.tgz
<temp-prefix>/bin/pathfinder help
```

On Windows the binary path may be:

```text
<temp-prefix>/pathfinder.cmd
```

