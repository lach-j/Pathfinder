# Workstream Intake UI

Status: idea

## Summary

Add a local UI flow for creating a Pathfinder workstream from linked requirements, external issue references, local context, and user-defined boundaries.

This is the front door for a future interactive Pathfinder workspace: the developer provides enough context for Pathfinder to create a workstream, generate a plan, and prepare reviewable slices with help from an agent.

## User Story

As a developer, I want to start a new workstream from a UI by linking relevant stories, epics, documents, repository context, and constraints, so that Pathfinder can help turn the work into a plan and reviewable slices without losing the original intent.

## Assumptions

- The first version can support manual issue links before adding issue tracker API imports.
- Jira is treated as one possible external source, not a hard dependency.
- Linked issue metadata should be stored locally under `.pathfinder/`.
- The UI should collect enough information to generate or update existing Pathfinder state, but the UI should not own planning logic.
- The user can add context from local markdown files, pasted text, repository paths, existing Pathfinder requirements, or external issue URLs.
- Boundaries are first-class inputs. They may include out-of-scope files, systems not to touch, expected tests, base branch, target branch naming, and review expectations.

## Requirements

- Provide a local UI entry point to create a workstream.
- Allow the user to enter:
  - Workstream title.
  - Description or requirement summary.
  - Linked issue references, such as Jira epic/story URLs or IDs.
  - Local context files or directories.
  - Relevant repository areas.
  - Explicit boundaries and non-goals.
  - Preferred base branch.
  - Expected checks.
- Persist the resulting workstream using the existing local Pathfinder state model.
- Preserve raw imported or pasted context in human-readable files where practical.
- Show the user what context will be passed into planning before the planning step starts.
- Let the user edit or remove context before continuing.
- Make it clear when an external link is only stored as a reference versus imported through an integration.

## Future Integration Shape

Issue tracker integration can grow in stages:

1. Manual links and pasted descriptions.
2. Local configurable fetch command for user-approved import.
3. Issue tracker connector metadata stored locally.
4. Refresh imported issue context on demand.

The baseline should work without network access.

## Local State Ideas

Possible files:

```text
.pathfinder/
  workstreams/
    <workstream-id>/
      workstream.json
      requirements.md
      linked-issues.json
      context/
        imported-issues.md
        local-files.json
      boundaries.md
```

`linked-issues.json` could store:

```json
{
  "items": [
    {
      "id": "ABC-123",
      "source": "jira",
      "url": "https://example.atlassian.net/browse/ABC-123",
      "title": "Optional cached title",
      "importedAt": null
    }
  ]
}
```

## Out Of Scope

- No hosted backend.
- No authentication system.
- No team permissions.
- No replacing Jira, Linear, GitHub, or GitLab.
- No mandatory external API dependency.
- No automatic code changes during intake.
- No direct agent launch from the intake form until the plan/slice generation flow exists.

## Later Slice Candidates

- Store linked issue metadata in workstream state.
- Add a CLI command for adding external issue links.
- Build a local UI workstream creation form.
- Add optional issue import from a user-configured command.
- Add context preview before planning.

