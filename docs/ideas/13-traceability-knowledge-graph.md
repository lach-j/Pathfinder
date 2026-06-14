# Traceability Knowledge Graph

Status: idea

## Summary

Build a local traceability graph that links requirements, plan sections, slices, expected files, changed files, commits, review sessions, comments, evidence, feedback runs, and PR output.

## Gap

The PRD emphasizes traceability, but current state links are mostly direct and local: slices link to comments/evidence/reviews, review sessions link to changed files, and PR drafts summarize state. There is no reusable graph for answering "why did this file change?" or "which requirement does this comment block?"

## Assumptions

- The graph should be generated from existing local state where possible.
- The first version can be a derived JSON view rather than a separate source of truth.
- Explicit user-authored links should be stored on the entities that own them.
- The graph should power CLI, UI, MCP, and PR markdown.

## Candidate Nodes

```text
requirement
plan-section
slice
file
commit
review-session
comment
evidence
feedback-run
pr-draft
external-reference
```

## Candidate Edges

```text
slice satisfies requirement
slice implements plan-section
slice expects file
review-session reviews slice
review-session changes file
comment blocks slice
comment targets file
evidence supports slice
commit belongs-to slice
feedback-run addresses comment
pr-draft summarizes workstream
```

## Requirements

- Add a derived graph builder in core.
- Add stable ids for requirement anchors and plan sections.
- Link slices to requirement refs and plan section refs.
- Link review sessions to commits and changed files.
- Link comments and evidence into the same graph.
- Add `pathfinder trace show <workstream-id>`.
- Add `pathfinder trace show <workstream-id> --json`.
- Add UI panels that answer common traceability questions.

## Useful Questions

- Which requirements are not linked to any slice?
- Which slices changed files outside expected scope?
- Which open comments block a requirement?
- Which evidence supports this completed slice?
- Which commits belong to this slice branch?
- Which files were repeatedly commented on during review?

## Out Of Scope

- No global organization knowledge graph.
- No hosted analytics.
- No automatic issue tracker synchronization.
- No AI-required semantic linking in the first version.

## Later Slice Candidates

- Add requirement and plan anchor parsing.
- Add slice requirement refs.
- Add derived trace graph output.
- Add UI trace panel for a selected slice.
- Add PR markdown traceability summary.
- Add optional AI-suggested links later.

