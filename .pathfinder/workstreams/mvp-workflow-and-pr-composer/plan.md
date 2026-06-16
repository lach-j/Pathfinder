# MVP Workflow And PR Composer

Migrated into Pathfinder state from legacy documentation on 2026-06-16.

## Scope

Close MVP workflow gaps with status/base-branch behavior, requirements context, slice dependencies, evidence, repository summaries, deterministic checks, and richer PR composition.

## Workstream Dependencies

- Upstream: `cli-state-foundation`
- Downstream: `local-review-loop`

## Slice Sequence

| Slice | Pathfinder id | Title | Status | Depends on | Historical commits |
| ----- | ------------- | ----- | ------ | ---------- | ------------------ |
| 09 | `slice-09-mvp-review-follow-up` | Slice 09: MVP Review Follow-Up | complete | - | 7a1162942b78, ad72fd4d3833 |
| 10 | `slice-10-requirements-context` | Slice 10: Requirements Context | complete | `slice-09-mvp-review-follow-up` | 9b830bd5f46c, 88ae021e8c69 |
| 11 | `slice-11-slice-dependencies-and-next-selection` | Slice 11: Slice Dependencies And Next Selection | complete | `slice-10-requirements-context` | 9b830bd5f46c, 41e8d4689fce |
| 12 | `slice-12-evidence-attachments` | Slice 12: Evidence Attachments | complete | `slice-11-slice-dependencies-and-next-selection` | 9b830bd5f46c, 5acda8f78e9b |
| 13 | `slice-13-repository-intelligence-summary` | Slice 13: Repository Intelligence Summary | complete | `slice-12-evidence-attachments` | 9b830bd5f46c, 651e25647429 |
| 14 | `slice-14-deterministic-review-checks` | Slice 14: Deterministic Review Checks | complete | `slice-13-repository-intelligence-summary` | 9b830bd5f46c, e4b142b491bd |
| 15 | `slice-15-pr-composer-v2` | Slice 15: PR Composer V2 | complete | `slice-14-deterministic-review-checks` | 9b830bd5f46c, 98a56e162f08 |

## Support Commits

These commits were mapped to the workstream rather than a single slice.

- None recorded.

## Migration Notes

- Legacy slice markdown is preserved verbatim in each slice description.
- Slice statuses came from `docs/implementation-status.md` when that file disagreed with the individual handoff file.
- Commit mapping is best-effort: direct matches touched a legacy doc; inferred matches were assigned from commit subject, changed files, and nearby status updates.
