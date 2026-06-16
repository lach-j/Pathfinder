# Local Review Loop

Migrated into Pathfinder state from legacy documentation on 2026-06-16.

## Scope

Replace the older stage-plan workflow with local Pathfinder state, durable review sessions, structured diffs, inline comments, feedback export, a local review UI, refresh/stale state, and PR output grounded in review-loop state.

## Workstream Dependencies

- Upstream: `mvp-workflow-and-pr-composer`
- Downstream: `agent-integration`

## Slice Sequence

| Slice | Pathfinder id | Title | Status | Depends on | Historical commits |
| ----- | ------------- | ----- | ------ | ---------- | ------------------ |
| 16 | `slice-16-stage-plan-import` | Slice 16: Stage Plan Import | complete | - | a2f2deb83001, 2935e6a6788f |
| 17 | `slice-17-review-session-state` | Slice 17: Review Session State | complete | `slice-16-stage-plan-import` | a2f2deb83001, 404317f83abe |
| 18 | `slice-18-structured-diff-model` | Slice 18: Structured Diff Model | complete | `slice-17-review-session-state` | a2f2deb83001, 92c8395f7d8a |
| 19 | `slice-19-inline-comment-anchors` | Slice 19: Inline Comment Anchors | complete | `slice-18-structured-diff-model` | a2f2deb83001, 5d2b35cc4409 |
| 20 | `slice-20-feedback-queue-export` | Slice 20: Feedback Queue Export | complete | `slice-19-inline-comment-anchors` | a2f2deb83001, d2ac06e718ef |
| 21 | `slice-21-local-review-server` | Slice 21: Local Review Server | complete | `slice-20-feedback-queue-export` | a2f2deb83001, 786241d4a7a8 |
| 22 | `slice-22-read-only-diff-viewer-ui` | Slice 22: Read-Only Diff Viewer UI | complete | `slice-21-local-review-server` | a2f2deb83001, 0bd265d32d27 |
| 23 | `slice-23-inline-commenting-ui` | Slice 23: Inline Commenting UI | complete | `slice-22-read-only-diff-viewer-ui` | a2f2deb83001, 72ae591fbb21 |
| 24 | `slice-24-review-refresh-and-stale-comments` | Slice 24: Review Refresh And Stale Comments | complete | `slice-23-inline-commenting-ui` | a2f2deb83001, 49720f0f838c |
| 25 | `slice-25-pr-composer-review-loop` | Slice 25: PR Composer Review Loop | complete | `slice-24-review-refresh-and-stale-comments` | a2f2deb83001, 35093c7e3630 |

## Support Commits

These commits were mapped to the workstream rather than a single slice.

- 071e13ca0afc85ebdfcc8444090cc7eb080ad867 (2026-06-13T15:54:49+10:00) Remove obsolete code paths [architecture cleanup before structured diff/review UI work]
- a1688f5e5ebfefd9bae50d8041bf7ce23c137bff (2026-06-14T10:46:49+10:00) Refactor Pathfinder state and command handling [state and command handling refactor supporting the review-loop split]
- c30e8e24b845e939b220aa6ac87b58f9f1357fc0 (2026-06-14T11:10:22+10:00) Refactor Pathfinder workstream state and CLI flows [workstream state and UI package refactor supporting the review workspace]

## Migration Notes

- Legacy slice markdown is preserved verbatim in each slice description.
- Slice statuses came from `docs/implementation-status.md` when that file disagreed with the individual handoff file.
- Commit mapping is best-effort: direct matches touched a legacy doc; inferred matches were assigned from commit subject, changed files, and nearby status updates.
