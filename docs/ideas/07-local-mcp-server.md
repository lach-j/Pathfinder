# Local MCP Server

Status: idea

## Summary

Expose Pathfinder's local state, review sessions, diffs, comments, evidence, and PR drafts through a local MCP server so coding agents can discover and use Pathfinder without scraping CLI text.

This would make `pathfinder agent next --json` available as a structured agent resource while preserving the current local-first command workflow.

## Gap

Pathfinder has strong CLI and local HTTP primitives, but no MCP surface yet. Agents can follow generated markdown prompts, but they cannot ask for resources such as the active slice, open comments, or current diff through a standard tool protocol.

## Assumptions

- MCP should be local-only and optional.
- MCP must reuse `@pathfinder/core`, `@pathfinder/state`, and `@pathfinder/git`; it should not duplicate business logic.
- The CLI remains the baseline integration path.
- The MCP server should not invoke coding agents or call external AI providers.
- Tool mutations should map to existing Pathfinder operations with the same validation.

## Candidate Resources

```text
project://current
workstreams://all
workstream://active
requirements://active
plan://active
slice://active
slice://next
review-session://active
diff://session/{sessionId}
comments://open
feedback://queue/{workstreamId}
pr://draft/{workstreamId}
```

## Candidate Tools

```text
set_active_slice
update_slice_status
start_review_session
refresh_review_session
add_review_comment
resolve_review_comment
export_feedback_queue
attach_evidence
generate_pr_draft
agent_next
```

## Requirements

- Add a package such as `packages/mcp` with a local MCP server entry point.
- Provide read-only resources first.
- Add mutation tools only after their validation is shared with existing CLI/server paths.
- Return stable JSON shapes that match or intentionally version existing state models.
- Support running from a repository root without global configuration.
- Include clear errors when `.pathfinder/` state or Git state is missing.
- Document MCP as an optional agent interface, not a required workflow.

## Out Of Scope

- No hosted MCP server.
- No authentication, accounts, cloud sync, organisations, or roles.
- No external issue tracker or Git hosting calls.
- No AI provider calls.
- No autonomous agent execution.

## Later Slice Candidates

- Add read-only MCP resources for current workstream, active slice, open comments, and agent next.
- Add MCP tools for comment add/resolve and feedback export.
- Add MCP resources for structured diffs and PR drafts.
- Add an MCP doctor check to verify server availability.
- Update generated agent prompts to prefer MCP when the active agent supports it.

