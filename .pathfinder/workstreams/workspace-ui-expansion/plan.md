# Workspace UI Expansion

Migrated into Pathfinder state from legacy documentation on 2026-06-16.

## Scope

Expand the local browser experience from review-only into a current-repository workspace with workstream APIs, a shell, dependency canvas, artifact previews, review panel, PR rich copy, and standalone branch review.

## Workstream Dependencies

- Upstream: `agent-workflow-stability`
- Downstream: `review-polish-and-agent-control`

## Slice Sequence

| Slice | Pathfinder id | Title | Status | Depends on | Historical commits |
| ----- | ------------- | ----- | ------ | ---------- | ------------------ |
| 41 | `slice-41-workspace-server-and-api-foundation` | Slice 41: Workspace Server And API Foundation | complete | - | 97e0004542a9, a4b53e5f9731 |
| 42 | `slice-42-workspace-shell-current-repo` | Slice 42: Workspace Shell Current Repo | complete | `slice-41-workspace-server-and-api-foundation` | 97e0004542a9, 92b5e36990a5 |
| 43 | `slice-43-workstream-dependency-canvas` | Slice 43: Workstream Dependency Canvas | complete | `slice-42-workspace-shell-current-repo` | 97e0004542a9, 5c343839fbea, 221061adc240 |
| 44 | `slice-44-artifact-preview-panel` | Slice 44: Artifact Preview Panel | complete | `slice-43-workstream-dependency-canvas` | 97e0004542a9, 590a41efb043 |
| 45 | `slice-45-workspace-review-panel` | Slice 45: Workspace Review Panel | complete | `slice-44-artifact-preview-panel` | 97e0004542a9, 89cf3453d932 |
| 46 | `slice-46-pr-rich-copy` | Slice 46: PR Rich Copy | ready | `slice-45-workspace-review-panel` | 97e0004542a9 |
| 47 | `slice-47-standalone-branch-review` | Slice 47: Standalone Branch Review | complete | `slice-45-workspace-review-panel` | cbceb1bfbdbd, 10379b46645f, b54edc6e0c51 |

## Support Commits

These commits were mapped to the workstream rather than a single slice.

- 620d2874ef1523e2ec36e1cd8854d50c7021a535 (2026-06-16T20:44:46+10:00) build: make running locally easier [local development server support]

## Migration Notes

- Legacy slice markdown is preserved verbatim in each slice description.
- Slice statuses came from `docs/implementation-status.md` when that file disagreed with the individual handoff file.
- Commit mapping is best-effort: direct matches touched a legacy doc; inferred matches were assigned from commit subject, changed files, and nearby status updates.
