# Scope Drift And Requirement Coverage

Status: idea

## Summary

Add deterministic review checks that compare planned slice scope, expected files, acceptance criteria, requirements, and changed files to detect likely scope drift and missing coverage.

This is one of the biggest product gaps between the current implementation and the PRD vision.

## Gap

Pathfinder currently categorizes changed files and warns about missing evidence, plan, requirements, and open comments. It does not know which files a slice was expected to touch, which requirements the slice claims to satisfy, or whether a diff looks too broad for the active slice.

## Assumptions

- The first version should be deterministic and explainable.
- AI review can later augment these checks, but it should not be required.
- Expected scope belongs in local state and should be reusable by CLI, UI, MCP, and PR output.
- Scope drift warnings should guide review, not block the user by default.

## State Ideas

Extend slices with optional scope metadata:

```json
{
  "expectedFiles": ["packages/core/src/foo.ts"],
  "expectedPaths": ["packages/core/src/"],
  "outOfScopePaths": ["packages/ui/"],
  "acceptanceCriteria": [
    "Adds parser coverage for empty plans."
  ],
  "requirementRefs": ["REQ-1", "REQ-2"],
  "expectedChecks": ["npm test"]
}
```

Requirements could also gain local anchors:

```text
REQ-1: User can export open feedback.
REQ-2: Export includes active slice context.
```

## Deterministic Checks

- Changed file is outside expected paths.
- Out-of-scope path changed.
- No test file changed for a source change unless evidence explains why.
- Slice has no acceptance criteria.
- Completed slice has unchecked acceptance criteria.
- Requirements exist but no requirement refs are linked to the slice.
- Diff has many unrelated categories for a small slice.
- Generated PR has open coverage warnings.

## Requirements

- Add optional slice scope metadata through CLI and state APIs.
- Add deterministic review checks for expected paths and out-of-scope paths.
- Add acceptance criteria storage and checklist output.
- Show scope warnings in `review run`, PR markdown, feedback export, and the review UI.
- Keep warnings transparent by listing the exact files and rules involved.

## Out Of Scope

- No mandatory AI semantic review.
- No automatic rejection of diffs.
- No external issue tracker requirement parsing.
- No hidden file ownership database.

## Later Slice Candidates

- Add acceptance criteria and expected path metadata to slices.
- Add CLI commands for scope metadata editing.
- Add deterministic scope drift checks.
- Add review UI warnings panel.
- Add requirement reference rendering in PR output.
- Add optional AI-assisted coverage commentary later.

