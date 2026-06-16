# Legacy Agent Workflow Templates

Migrated from `docs/agent-session-prompt.md` and `docs/skills-replacement-examples/` on 2026-06-16.

## Current Replacement

Agents should now begin with:

```bash
pathfinder agent next --json
```

Use `pathfinder agent prompt` for phase-specific instructions. The legacy template documents are preserved below as completed historical context, not as current source-of-truth workflow instructions.

## Template Records

| Slice | Status | Depends on |
| ----- | ------ | ---------- |
| `generic-agent-session-prompt` | complete | - |
| `plan-stages-workflow-template` | complete | - |
| `implement-stage-workflow-template` | complete | plan-stages-workflow-template |
