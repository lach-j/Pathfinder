# Distribution And Personal Mode

Migrated into Pathfinder state from legacy documentation on 2026-06-16.

## Scope

Package Pathfinder for source-built release tarballs, add GitHub release artifacts, automate versioning, support external state, support no-repo-footprint personal agent setup, and diagnose personal mode.

## Workstream Dependencies

- Upstream: `agent-integration`
- Downstream: `agent-workflow-stability`

## Slice Sequence

| Slice | Pathfinder id | Title | Status | Depends on | Historical commits |
| ----- | ------------- | ----- | ------ | ---------- | ------------------ |
| 31 | `slice-31-release-packaging` | Slice 31: Release Packaging | complete | - | b94297d34764, c2656b701fcf |
| 32 | `slice-32-github-release-artifact-workflow` | Slice 32: GitHub Release Artifact Workflow | complete | `slice-31-release-packaging` | b94297d34764, 01d7949a3d98 |
| 33 | `slice-33-automated-versioning` | Slice 33: Automated Versioning | complete | `slice-32-github-release-artifact-workflow` | b94297d34764, 9758bee29c83, 8c44460b3351, 0d23b9cac48a |
| 34 | `slice-34-external-state-mode` | Slice 34: External State Mode | complete | `slice-33-automated-versioning` | b94297d34764, 47f68111b5b3, 890f612c41d8 |
| 35 | `slice-35-no-repo-footprint-agent-mode` | Slice 35: No-Repo-Footprint Agent Mode | complete | `slice-34-external-state-mode` | b94297d34764, 60b2a78e436a, 20b5c1800ff6, e76e3641c857, 06709e1ea8ad |
| 36 | `slice-36-personal-mode-doctor` | Slice 36: Personal Mode Doctor | complete | `slice-35-no-repo-footprint-agent-mode` | b94297d34764, be21bf9775fa |

## Support Commits

These commits were mapped to the workstream rather than a single slice.

- None recorded.

## Migration Notes

- Legacy slice markdown is preserved verbatim in each slice description.
- Slice statuses came from `docs/implementation-status.md` when that file disagreed with the individual handoff file.
- Commit mapping is best-effort: direct matches touched a legacy doc; inferred matches were assigned from commit subject, changed files, and nearby status updates.
