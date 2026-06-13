# PR Handoff And Rich Copy

Status: idea

## Summary

Improve the final handoff after a slice or workstream is reviewed by generating PR-ready output and making it easy to copy as rich formatted content for GitHub, GitLab, Bitbucket, or another hosting tool.

This extends the existing PR markdown generation idea without making Pathfinder a Git hosting replacement.

## User Story

As a developer, I want Pathfinder to generate a high-quality PR description from completed slices, review evidence, linked issues, tests, and known risks, and I want to paste it into my Git hosting tool with formatting preserved.

## Assumptions

- Markdown remains the canonical stored format.
- Rich copy is a UI convenience over generated markdown.
- The user decides when to push and open a PR.
- Later workflows may optionally run `git push` or open a remote PR through a configured command, but the local handoff should work without hosting APIs.
- The PR description should include linked issues but not require issue tracker mutation.

## Requirements

- Generate PR content from local Pathfinder state:
  - Workstream title and summary.
  - Completed slices.
  - Linked issues.
  - Implementation notes.
  - Checks run.
  - Evidence.
  - Review status.
  - Open risks.
  - Follow-up work.
- Store markdown output locally.
- Provide a UI preview of the PR description.
- Provide copy options:
  - Copy markdown.
  - Copy rich text.
  - Copy plain text fallback.
- Preserve headings, lists, code blocks, links, and checklists when copying rich text.
- Warn if open review comments or incomplete slices remain.
- Let the user regenerate the PR draft after review state changes.

## Rich Copy Behavior

The UI should use markdown as source and produce clipboard content with:

- `text/html` for rich paste targets.
- `text/markdown` where supported.
- `text/plain` fallback.

The stored artifact should remain markdown so it is diffable and reviewable.

## Optional Push And PR Flow

After local approval, a later explicit workflow could:

1. Push the branch.
2. Generate the PR description.
3. Copy rich text.
4. Optionally open the hosting provider's new PR page.

Any direct hosting API integration should be optional and user-configured.

## Out Of Scope

- No GitHub/GitLab/Bitbucket replacement.
- No mandatory hosting provider API.
- No automatic merge.
- No remote review ownership.
- No cloud sync.
- No team approval workflow.

## Later Slice Candidates

- Add richer PR draft sections.
- Add UI preview for PR output.
- Add rich clipboard copy from markdown.
- Add warnings for incomplete local review state.
- Add optional local command to push branch after approval.
- Add optional open-PR-page handoff.

