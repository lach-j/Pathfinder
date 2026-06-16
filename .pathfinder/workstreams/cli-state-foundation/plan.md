# CLI And State Foundation

Migrated into Pathfinder state from legacy documentation on 2026-06-16.

## Scope

Establish the monorepo, local state model, initial CLI surface, comments, Git diff access, review records, PR markdown generation, current context, and CLI polish.

## Workstream Dependencies

- Upstream: none
- Downstream: `mvp-workflow-and-pr-composer`

## Slice Sequence

| Slice | Pathfinder id | Title | Status | Depends on | Historical commits |
| ----- | ------------- | ----- | ------ | ---------- | ------------------ |
| 01 | `slice-01-stage-1-foundation` | Slice 01: Stage 1 Foundation | complete | - | ddfe85c459dc, aaffa78428cd, 561237fe8128 |
| 02 | `slice-02-repo-hygiene` | Slice 02: Repo Hygiene | complete | `slice-01-stage-1-foundation` | 561237fe8128, 95da7fa2a202 |
| 03 | `slice-03-comments-cli` | Slice 03: Comments CLI | complete | `slice-02-repo-hygiene` | 561237fe8128, e4f4c2b9f7d7 |
| 04 | `slice-04-git-diff-adapter` | Slice 04: Git Diff Adapter | complete | `slice-03-comments-cli` | 561237fe8128, 437d185f2fcc |
| 05 | `slice-05-review-state-foundation` | Slice 05: Review State Foundation | complete | `slice-04-git-diff-adapter` | 561237fe8128, 78b9fb369935 |
| 06 | `slice-06-pr-markdown-generation` | Slice 06: PR Markdown Generation | complete | `slice-05-review-state-foundation` | 561237fe8128, d5cefbcc5397 |
| 07 | `slice-07-current-context-command` | Slice 07: Current Context Command | complete | `slice-06-pr-markdown-generation` | 561237fe8128, b25b23683e49 |
| 08 | `slice-08-cli-polish` | Slice 08: CLI Polish | complete | `slice-07-current-context-command` | 561237fe8128, 447831b86608 |

## Support Commits

These commits were mapped to the workstream rather than a single slice.

- None recorded.

## Migration Notes

- Legacy slice markdown is preserved verbatim in each slice description.
- Slice statuses came from `docs/implementation-status.md` when that file disagreed with the individual handoff file.
- Commit mapping is best-effort: direct matches touched a legacy doc; inferred matches were assigned from commit subject, changed files, and nearby status updates.
