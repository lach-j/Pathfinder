# Agent Integration

Migrated into Pathfinder state from legacy documentation on 2026-06-16.

## Scope

Make `pathfinder agent next --json` the canonical first command for coding agents, then render prompts, bootstrap repo instructions, install native command wrappers, and diagnose integration readiness.

## Workstream Dependencies

- Upstream: `local-review-loop`
- Downstream: `distribution-and-personal-mode`

## Slice Sequence

| Slice | Pathfinder id | Title | Status | Depends on | Historical commits |
| ----- | ------------- | ----- | ------ | ---------- | ------------------ |
| 26 | `slice-26-agent-next-state-machine` | Slice 26: Agent Next State Machine | complete | - | d370b609cfc8, 5fadbf7293ae |
| 27 | `slice-27-agent-prompt-rendering` | Slice 27: Agent Prompt Rendering | complete | `slice-26-agent-next-state-machine` | d370b609cfc8, f14c3e03f1a3 |
| 28 | `slice-28-agent-bootstrap-instructions` | Slice 28: Agent Bootstrap Instructions | complete | `slice-27-agent-prompt-rendering` | d370b609cfc8, 601391395f11 |
| 29 | `slice-29-native-agent-command-wrappers` | Slice 29: Native Agent Command Wrappers | complete | `slice-28-agent-bootstrap-instructions` | d370b609cfc8, 19b4b64d0d0d |
| 30 | `slice-30-agent-integration-doctor` | Slice 30: Agent Integration Doctor | complete | `slice-29-native-agent-command-wrappers` | d370b609cfc8, 1dc83f271005 |

## Support Commits

These commits were mapped to the workstream rather than a single slice.

- None recorded.

## Migration Notes

- Legacy slice markdown is preserved verbatim in each slice description.
- Slice statuses came from `docs/implementation-status.md` when that file disagreed with the individual handoff file.
- Commit mapping is best-effort: direct matches touched a legacy doc; inferred matches were assigned from commit subject, changed files, and nearby status updates.
