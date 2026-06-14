# Generic Agent Session Prompt

Use this prompt for a fresh implementation session. Replace only `<SLICE_NUMBER>` with the slice number you want, for example `3`.

```text
You are helping build Pathfinder, a local-first open-source developer tool.

Implement slice <SLICE_NUMBER>.

Read these files first:

1. AGENTS.md
2. PATHFINDER_PRD.md
3. README.md
4. docs/implementation-status.md

From docs/implementation-status.md, find the row for slice <SLICE_NUMBER>. If the number is not zero-padded, match the equivalent zero-padded row, for example `3` matches `03`. Then read only that assigned handoff file under docs/slices/.

Restate the current slice goal before editing.

Implement only the assigned slice.

Use the assigned slice handoff for scope, acceptance criteria, likely files, checks, and smoke tests. You may edit any repository files needed to complete that slice, but do not implement other slices while doing so.

Do not infer stale phase boundaries from earlier documentation. Follow the assigned handoff and `docs/implementation-status.md`.

Do not build UI unless the assigned slice explicitly asks for local UI work.
Do not build AI features unless the assigned slice explicitly asks for them.
Do not build MCP unless the assigned slice explicitly asks for it.
Do not build Claude/Codex hooks unless the assigned slice explicitly asks for them.
Do not integrate with GitHub/GitLab unless the assigned slice explicitly asks for it.
Do not call external APIs.
Do not add auth, billing, cloud sync, organisations, roles, permissions, or hosted backend assumptions.

Before finishing, run the checks listed in the assigned slice handoff. At minimum, run:

npm run typecheck
npm test
npm run lint --if-present

Smoke test any CLI command introduced or changed by this slice.

Update progress only in:

1. docs/implementation-status.md
2. The assigned docs/slices/ file

At the end, provide:

1. Summary of changed files
2. Checks run and results
3. Manual verification commands
4. Any follow-up decisions needed
```

## Short Form

Once this prompt is in the repository, future sessions can usually start with:

```text
Use docs/agent-session-prompt.md for slice 3.
```

Swap `3` for whichever slice should be implemented.
