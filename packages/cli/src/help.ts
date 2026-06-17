const helpByArea = {
  agent: `Pathfinder agent commands

Usage:
  pathfinder agent bootstrap [--dry-run]
  pathfinder agent install --user claude|opencode|codex|all [--dry-run]
  pathfinder agent commands install [--tool claude|opencode] [--dry-run]
  pathfinder agent commands list
  pathfinder agent doctor [--personal] [--json]
  pathfinder agent next [--json]
  pathfinder agent prompt [--phase plan|implement|feedback|review|pr]`,
  workstream: `Pathfinder workstream commands

Usage:
  pathfinder workstream create --title "..."
  pathfinder workstream list [--json]
  pathfinder workstream show <id> [--json]`,
  slice: `Pathfinder slice commands

Usage:
  pathfinder slice add <workstream-id> --title "..." --description "..." [--depends-on <slice-id>]
  pathfinder slice list <workstream-id> [--json]
  pathfinder slice active <workstream-id> <slice-id>
  pathfinder slice depend <workstream-id> <slice-id> <dependency-slice-id>
  pathfinder slice next <workstream-id> [--json]
  pathfinder slice status <workstream-id> <slice-id> <status>
  pathfinder slice branch <workstream-id> <slice-id> --base <base-ref> [--branch <branch-name>]
  pathfinder slice start <workstream-id> <slice-id> --base <base-ref> [--branch <branch-name>]
  pathfinder slice show-active`,
  comment: `Pathfinder comment commands

Usage:
  pathfinder comment add <workstream-id> --slice <slice-id> --body "..."
  pathfinder comment add <workstream-id> --session <session-id> --file <path> [--line <line-number> --side old|new] --body "..."
  pathfinder comment list <workstream-id> [--session <session-id>] [--open] [--json]
  pathfinder comment resolve <workstream-id> <comment-id>`,
  "agent-review": `Pathfinder agent review commands

Usage:
  pathfinder agent-review prompt <workstream-id> --session <session-id> [--template ./prompt.md]
  pathfinder agent-review import <workstream-id> --session <session-id> [--file ./comments.json]`,
  review: `Pathfinder review commands

Usage:
  pathfinder review serve [--port 4783]
  pathfinder review start --base <base-ref>
  pathfinder review refresh <workstream-id> <session-id>
  pathfinder review approve <workstream-id> --session <session-id>
  pathfinder review sessions <workstream-id> [--json]
  pathfinder review session <workstream-id> <session-id> [--json]
  pathfinder review create <workstream-id> --slice <slice-id> --summary "..."
  pathfinder review run --base <base-ref>
  pathfinder review list <workstream-id>
  pathfinder review show <workstream-id> <review-id>`,
  "branch-review": `Pathfinder branch review commands

Usage:
  pathfinder branch-review next [--json]
  pathfinder branch-review start --base <base-ref>
  pathfinder branch-review refresh <session-id>
  pathfinder branch-review approve <session-id>
  pathfinder branch-review sessions [--json]
  pathfinder branch-review session <session-id> [--json]
  pathfinder branch-review diff <session-id> [--json]
  pathfinder branch-review comment add <session-id> --file <path> [--line <line-number> --side old|new] --body "..."
  pathfinder branch-review comment list [--session <session-id>] [--open] [--json]
  pathfinder branch-review comment resolve <comment-id>
  pathfinder branch-review agent-review prompt --session <session-id> [--template ./prompt.md]
  pathfinder branch-review agent-review import --session <session-id> [--file ./comments.json]
  pathfinder branch-review feedback export [--session <session-id>] [--file ./feedback.md]
  pathfinder branch-review pr generate [--base <base-ref>]`,
  workspace: `Pathfinder workspace commands

Usage:
  pathfinder workspace serve [--port 4783]`
};

export type HelpArea = keyof typeof helpByArea;

export function printHelp(area?: string): void {
  if (area && area in helpByArea) {
    console.log(helpByArea[area as HelpArea]);
    return;
  }

  console.log(`Pathfinder

Usage:
  pathfinder init [--interactive]
  pathfinder init --personal [--user claude|opencode|codex|all]
  pathfinder init --repo [--agents]
  pathfinder agent bootstrap [--dry-run]
  pathfinder agent install --user claude|opencode|codex|all [--dry-run]
  pathfinder agent commands install [--tool claude|opencode] [--dry-run]
  pathfinder agent commands list
  pathfinder agent doctor [--personal] [--json]
  pathfinder current
  pathfinder agent next [--json]
  pathfinder agent prompt [--phase plan|implement|feedback|review|pr]
  pathfinder workstream create --title "..."
  pathfinder workstream list [--json]
  pathfinder workstream show <id> [--json]
  pathfinder requirement set <workstream-id> --file ./requirements.md
  pathfinder requirement show <workstream-id>
  pathfinder plan import --file ./PLAN.md
  pathfinder plan set <workstream-id> --file ./plan.md
  pathfinder plan show <workstream-id>
  pathfinder slice add <workstream-id> --title "..." --description "..." [--depends-on <slice-id>]
  pathfinder slice list <workstream-id> [--json]
  pathfinder slice active <workstream-id> <slice-id>
  pathfinder slice depend <workstream-id> <slice-id> <dependency-slice-id>
  pathfinder slice next <workstream-id> [--json]
  pathfinder slice status <workstream-id> <slice-id> <status>
  pathfinder slice branch <workstream-id> <slice-id> --base <base-ref> [--branch <branch-name>]
  pathfinder slice start <workstream-id> <slice-id> --base <base-ref> [--branch <branch-name>]
  pathfinder slice show-active
  pathfinder comment add <workstream-id> --slice <slice-id> --body "..."
  pathfinder comment add <workstream-id> --session <session-id> --file <path> [--line <line-number> --side old|new] --body "..."
  pathfinder comment list <workstream-id> [--session <session-id>] [--open] [--json]
  pathfinder comment resolve <workstream-id> <comment-id>
  pathfinder agent-review prompt <workstream-id> --session <session-id> [--template ./prompt.md]
  pathfinder agent-review import <workstream-id> --session <session-id> [--file ./comments.json]
  pathfinder review serve [--port 4783]
  pathfinder review start --base <base-ref>
  pathfinder review refresh <workstream-id> <session-id>
  pathfinder review approve <workstream-id> --session <session-id>
  pathfinder review sessions <workstream-id> [--json]
  pathfinder review session <workstream-id> <session-id> [--json]
  pathfinder review create <workstream-id> --slice <slice-id> --summary "..."
  pathfinder review run --base <base-ref>
  pathfinder review list <workstream-id>
  pathfinder review show <workstream-id> <review-id>
  pathfinder branch-review next [--json]
  pathfinder branch-review start --base <base-ref>
  pathfinder branch-review refresh <session-id>
  pathfinder branch-review approve <session-id>
  pathfinder branch-review sessions [--json]
  pathfinder branch-review session <session-id> [--json]
  pathfinder branch-review diff <session-id> [--json]
  pathfinder branch-review comment add <session-id> --file <path> [--line <line-number> --side old|new] --body "..."
  pathfinder branch-review comment list [--session <session-id>] [--open] [--json]
  pathfinder branch-review comment resolve <comment-id>
  pathfinder branch-review agent-review prompt --session <session-id> [--template ./prompt.md]
  pathfinder branch-review agent-review import --session <session-id> [--file ./comments.json]
  pathfinder branch-review feedback export [--session <session-id>] [--file ./feedback.md]
  pathfinder branch-review pr generate [--base <base-ref>]
  pathfinder evidence add <workstream-id> --slice <slice-id> --kind <kind> --description "..." [--path ./artifact.txt]
  pathfinder evidence list <workstream-id>
  pathfinder diff show --base <base-ref> [--json]
  pathfinder diff show --session <session-id> [--json]
  pathfinder feedback export <workstream-id> [--session <session-id>] [--file ./feedback.md]
  pathfinder git diff [--base <base-ref>]
  pathfinder git summary --base <base-ref>
  pathfinder workspace serve [--port 4783]
  pathfinder pr generate <workstream-id> [--base <base-ref>]`);
}
