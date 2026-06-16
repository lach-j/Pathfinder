# Pathfinder

## Overview

Pathfinder is a local-first, open-source development workflow tool that sits between:

- Requirements
- Planning
- AI coding agents
- Git
- Pull Requests

It is not intended to replace:

- GitHub
- GitLab
- Jira
- Linear
- Claude Code
- Codex
- Cursor
- IDEs

Instead, Pathfinder provides a missing layer in modern AI-assisted development:

```text
Requirement
    ↓
Implementation Plan
    ↓
Reviewable Slices
    ↓
AI-Assisted Implementation
    ↓
Local Review & Validation
    ↓
Pull Request
```

The primary goal is to help developers transform large requirements into small, reviewable implementation slices, inspect each slice in a local GitHub/Bitbucket-style diff review UI, leave structured feedback on the changed code, and hand that feedback back to an AI coding agent for bulk follow-up.

Planning is valuable because it creates better review boundaries. The product is not complete until the developer can repeatedly:

```text
Implement a slice
    ↓
Review the local diff visually
    ↓
Leave inline feedback
    ↓
Ask an agent to address the open feedback
    ↓
Review again
```

---

# Vision

Modern AI coding tools have dramatically increased implementation speed, but they have also introduced new problems:

- Massive diffs
- Scope creep
- Poor traceability
- Weak planning
- Difficult reviews

Pathfinder aims to solve these issues by becoming the local system of record for implementation intent, execution state, diff review, and unresolved feedback.

Rather than asking AI to implement an entire feature at once, Pathfinder encourages:

- Planning first
- Breaking work into slices
- Reviewing incrementally
- Validating against requirements
- Generating PR-ready outputs

---

# Core Philosophy

Pathfinder owns:

```text
Requirement
    ↓
Plan
    ↓
Reviewable Slices
    ↓
Validated Local Diffs
    ↓
PR Ready Output
```

Pathfinder does NOT own:

```text
Source Control
Issue Tracking
Code Editing
Code Hosting
```

Those remain in existing tools.

---

# Problem Statement

## Large AI-Generated Diffs

Developers frequently prompt AI to implement entire features.

This often results in:

- Hundreds of files changed
- Large pull requests
- Difficult reviews
- Hidden architectural changes

---

## Lost Intent

Weeks later it becomes difficult to determine:

- Why changes were made
- Which requirement they satisfy
- What assumptions existed
- Which alternatives were considered

---

## Missing Planning Layer

Most current workflows look like:

```text
Ticket
 ↓
Prompt
 ↓
Code
 ↓
PR
```

Missing:

```text
Ticket
 ↓
Implementation Plan
 ↓
Task Breakdown
 ↓
Incremental Validation
 ↓
Code
 ↓
PR
```

---

## AI Scope Drift

AI models often:

- Refactor unrelated code
- Solve adjacent problems
- Introduce architectural changes
- Modify files outside expected scope

without explicit developer intent.

---

# Product Goals

## Goal 0

Make local diff review the center of the workflow.

Success indicators:

- A developer can compare local changes against a base branch without reading raw `git diff`.
- A developer can leave inline comments on files and lines in the local diff.
- Open comments can be exported as a clear agent action queue.
- The review and feedback loop can repeat until the developer is satisfied.

---

## Goal 1

Reduce implementation scope per change.

Success indicators:

- Smaller commits
- Smaller pull requests
- Easier reviews

---

## Goal 2

Improve traceability.

Provide links between:

- Requirements
- Plans
- Slices
- Diffs
- Commits
- Reviews
- PRs

---

## Goal 3

Improve AI-assisted development quality.

---

## Goal 4

Enable iterative implementation.

---

## Goal 5

Generate PR-ready outputs automatically.

---

# Non-Goals

## Not a Jira Replacement

Requirements may originate elsewhere.

---

## Not a Git Hosting Platform

GitHub/GitLab remain source of truth.

---

## Not an IDE

Pathfinder integrates with IDEs and agents.

---

## Not an AI Coding Agent

Pathfinder coordinates and reviews work.

Implementation remains in coding tools.

---

# Core Concepts

## Project

A Git repository known to Pathfinder.

Contains:

- Workstreams
- Plans
- Slices
- Reviews

---

## Workstream

The primary unit of work.

Examples:

- Add SSO Support
- Build Billing System
- Migrate Authentication

A workstream contains:

- Requirements
- Plan
- Slices
- Reviews
- Evidence

---

## Plan

Implementation strategy for a workstream.

Answers:

- What are we building?
- Why are we building it?
- How will we build it?
- What systems are affected?
- What risks exist?

---

## Slice

The smallest independently reviewable implementation unit.

Bad example:

```text
Implement billing system
```

Good examples:

```text
Create subscription schema
```

```text
Add Stripe customer creation
```

```text
Implement webhook processing
```

Each slice should be:

- Independently implementable
- Independently reviewable
- Independently testable

---

## Review

Validation of a slice against:

- Requirements
- Plan
- Diff
- Acceptance criteria

Review is first a local human workflow. AI may assist later, but Pathfinder should make manual local diff review useful without calling a model.

Review comments should be able to target:

- A whole slice
- A file
- A changed line or hunk in a diff
- The whole workstream

Reviews may be performed by:

- Humans
- AI
- Both

---

## Evidence

Artifacts proving implementation quality.

Examples:

- Test results
- Screenshots
- Logs
- Manual QA notes
- Benchmarks

---

# User Workflow

## Phase 1 - Requirement Ingestion

Input:

- Markdown
- Jira
- Linear
- MCP context
- Plain text
- Documents

Output:

```text
Workstream
```

---

## Phase 2 - Planning

Create:

- Implementation strategy
- Risks
- Dependencies
- Testing approach
- Rollout approach

Output:

```text
Plan
```

---

## Phase 3 - Slice Breakdown

Convert plan into reviewable slices.

Example:

```text
Add Stripe Billing
```

becomes:

```text
Create subscription tables
Add migrations
Add repository layer
Create Stripe customer service
Add webhook endpoint
Add tests
```

---

## Phase 4 - Implementation

Developer selects an active slice.

Pathfinder provides:

- Requirements
- Constraints
- Related files
- Acceptance criteria

AI agents consume this context.

---

## Phase 5 - Review

Pathfinder opens a local review session for:

```text
Plan
+
Slice
+
Diff
```

The developer can:

- Browse changed files against a base ref
- Inspect unified or side-by-side hunks
- Add inline comments to changed lines
- Add file-level or slice-level comments
- Resolve comments after fixes land
- Re-run the review against the updated diff

Pathfinder can also produce deterministic local checks:

- Review comments
- Scope drift warnings
- Missing test warnings
- Requirement coverage feedback

---

## Phase 6 - PR Assembly

Completed slices are assembled into:

- PR title
- PR description
- Testing notes
- Review checklist
- Risk summary

---

# High-Level System Architecture

The system consists of six major components.

```text
Local UI
    ↓
Pathfinder Core
    ↓
Git + Filesystem + Agent Bridge
```

---

# Component 1 - Workspace

The main application.

Responsibilities:

- Project management
- Workstream management
- Planning
- Slice management
- Review management

Primary views:

- Projects
- Workstreams
- Plans
- Slices
- Reviews
- PR Output

---

# Component 2 - State Engine

Persistent local state store.

Responsible for:

```text
Project
  → Workstream
      → Plan
          → Slices
              → Reviews
                  → Evidence
```

Example structure:

```text
.pathfinder/
    workstream.json
    plan.md
    slices.json
    reviews.json
    comments.json
    evidence/
    pr-draft.md
```

Future option:

```text
.pathfinder/state.sqlite
```

---

# Component 3 - Agent Runtime

Maintains current execution state.

Responsible for:

- Active slice
- Current goal
- Constraints
- Progress
- Risks
- Notes

This becomes the answer to:

```text
What am I working on right now?
```

---

# Component 4 - Agent Bridge

Provides integration between Pathfinder and AI coding agents.

Possible interfaces:

## MCP

Primary integration mechanism.

---

## CLI

Examples:

```bash
pathfinder current
pathfinder next
pathfinder update
pathfinder review
pathfinder generate-pr
```

---

## Local HTTP API

Examples:

```http
GET /active-slice
POST /review-comment
```

---

# Component 5 - Repository Intelligence Engine

Git-aware analysis layer.

Responsibilities:

## Git Integration

- Branches
- Commits
- Diffs
- Working tree state

---

## Scope Analysis

Compare:

```text
Expected Files
vs
Changed Files
```

---

## Drift Detection

Identify:

- Unrelated changes
- Excessive modifications
- Architectural drift

---

## Change Categorisation

Classify changes as:

- Feature
- Refactor
- Test
- Documentation
- Infrastructure

---

## Traceability

Link:

```text
Slice
  → Files
  → Commits
  → Diff
```

---

# Component 6 - Review Engine

Responsible for validating implementation.

Checks:

## Human Review

Inline comments and notes.

---

## Local Diff Review

Parse Git diffs into stable reviewable structures:

- Changed files
- Hunks
- Old and new line numbers
- Change types
- Comment anchors

The parsed diff should be reusable by both CLI and UI.

---

## AI Review

Generated feedback.

---

## Requirement Validation

Was the slice actually implemented?

---

## Drift Detection

Did implementation exceed intended scope?

---

## Completeness Validation

Missing:

- Tests
- Documentation
- Acceptance criteria

---

# UI Areas

## Project Dashboard

Displays:

- Projects
- Active workstreams
- Review queue
- Recent activity

---

## Workstream Workspace

Displays:

- Requirements
- Plan
- Slices
- Reviews
- Evidence

---

## Planning Workspace

Supports:

- Plan authoring
- Risks
- Dependencies
- Architecture notes

---

## Slice Board

Kanban-style slice management.

Statuses:

- Proposed
- Ready
- In Progress
- Review
- Complete

---

## Slice Detail View

Displays:

- Goal
- Acceptance criteria
- Constraints
- Linked files
- Linked comments
- Evidence

---

## Diff Review View

Supports:

- Inline comments
- AI review comments
- Scope warnings
- Resolution tracking

The first version should feel like a small local version of GitHub or Bitbucket pull request review:

- File list
- Diff statistics
- Unified diff view first
- Inline comment threads anchored to changed lines
- Open/resolved filtering
- Refresh from base ref
- Copy/export open feedback for an agent

Side-by-side diff and richer navigation can follow once unified review works.

---

# AI Agent Integration

## Core Principle

Pathfinder should NOT orchestrate coding agents directly.

Instead:

```text
Pathfinder owns state.
Agents own execution.
```

This ensures compatibility across:

- Claude Code
- Codex
- Cursor
- Future tools

---

## Context Repository Pattern

Agents consume state from Pathfinder.

Example workflow:

```text
Read active slice
Implement work
Request review
Address feedback
Mark slice complete
```

The AI interacts with Pathfinder rather than Git directly.

For the primary feedback loop, the bridge can start as markdown and CLI output:

```text
Open review comments
    ↓
Agent action queue markdown
    ↓
Developer provides it to Claude, Codex, Cursor, or another agent
    ↓
Agent edits code
    ↓
Pathfinder refreshes diff and comment state
```

MCP and tool-specific hooks are optional integration concepts, not requirements for the first useful loop.

---

# MCP Design

Potential resources:

```text
project://current
plan://active
slice://active
diff://current
comments://open
evidence://slice/{id}
```

Potential tools:

```text
create_slice
update_slice_status
add_inline_comment
add_review_note
attach_evidence
generate_pr_summary
```

---

# Claude Code Integration

Claude Code currently supports lifecycle hooks.

Potential future integration:

```text
Implement slice
    ↓
Claude attempts to stop
    ↓
Stop Hook executes
    ↓
Pathfinder reviews diff
    ↓
Feedback exists?
    ↓
Yes
    ↓
Block stop
    ↓
Return unresolved review comments
    ↓
Claude continues implementation
```

Example:

```text
Claude:
"I've completed the task."
```

Stop hook:

```text
Pathfinder:
Missing tests.
Scope drift detected.
2 unresolved review comments.
```

Claude:

```text
Reads Pathfinder state.
Addresses feedback.
Attempts completion again.
```

Important:

This should be treated as an enhancement rather than a core requirement.

The core architecture should remain:

```text
Context Repository
+
Review Layer
+
Agent Bridge
```

rather than relying on tool-specific orchestration features.

---

# Review Process

Inputs:

```text
Plan
+
Active Slice
+
Git Diff
```

Outputs:

- Review comments
- Inline comment anchors
- Agent action queue
- Scope warnings
- Missing test warnings
- Requirement coverage analysis
- PR notes

---

# PR Composer

Responsible for generating:

## Pull Request Title

---

## Pull Request Description

Template:

```markdown
## Summary

## Completed Slices

## Testing

## Risks

## Review Notes

## Checklist
```

---

## Changelog

---

## Review Checklist

---

# Exploratory Ideas

Exploratory product ideas are tracked in the repo-local Pathfinder workstream `product-ideas-backlog`. They are not implementation commitments until a future planning pass promotes them into active Pathfinder slices.

## AI Planning Assistant

Suggest:

- Plans
- Risks
- Dependencies
- Slice breakdowns

---

## AI Review Assistant

Review:

- Diffs
- Scope
- Coverage
- Quality

---

## Continuous Architecture Validation

Compare implementation against planned architecture.

---

## Knowledge Graph

Link:

```text
Requirements
Plans
Slices
Files
Commits
Reviews
PRs
```

---

## Multi-Agent Validation

Independent reviewers:

- Architect
- QA
- Security
- Reviewer

all validating the same slice.

---

# Baseline Useful Scope

The first broadly useful version should contain:

- Local state and CLI
- Git diff adapter
- Review session state
- Inline review comments
- Local diff review UI
- Agent action queue export
- PR Composer

The baseline useful workflow does not require:

- AI-generated review comments
- MCP
- Claude/Codex hooks
- GitHub/GitLab API integration
- Auth
- Cloud sync

Earlier planning and slicing support remains useful, but Pathfinder should be judged by whether the developer can review local changes and drive the agent feedback loop.

Historical broader components:

- Workspace
- State Engine
- Agent Bridge
- Repository Intelligence Engine
- Review Engine
- PR Composer

Key capabilities:

- Store plans
- Break work into slices
- Track active implementation state
- Analyse diffs
- Review local diffs visually
- Capture inline feedback
- Export agent-actionable feedback
- Refresh review state after fixes
- Generate PR output

---

# One-Sentence Product Definition

Pathfinder is a local-first, open-source context and review layer that sits between Git repositories and AI coding agents, helping developers plan work, review local diffs visually, turn feedback into agent-actionable tasks, and generate pull-request-ready outputs.
