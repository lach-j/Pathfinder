export function printHelp(): void {
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
  pathfinder workstream list
  pathfinder workstream show <id>
  pathfinder requirement set <workstream-id> --file ./requirements.md
  pathfinder requirement show <workstream-id>
  pathfinder plan import --file ./PLAN.md
  pathfinder plan set <workstream-id> --file ./plan.md
  pathfinder plan show <workstream-id>
  pathfinder slice add <workstream-id> --title "..." --description "..." [--depends-on <slice-id>]
  pathfinder slice list <workstream-id>
  pathfinder slice active <workstream-id> <slice-id>
  pathfinder slice depend <workstream-id> <slice-id> <dependency-slice-id>
  pathfinder slice next <workstream-id>
  pathfinder slice status <workstream-id> <slice-id> <status>
  pathfinder slice branch <workstream-id> <slice-id> --base <base-ref>
  pathfinder slice show-active
  pathfinder comment add <workstream-id> --slice <slice-id> --body "..."
  pathfinder comment add <workstream-id> --session <session-id> --file <path> [--line <line-number> --side old|new] --body "..."
  pathfinder comment list <workstream-id> [--session <session-id>] [--open]
  pathfinder comment resolve <workstream-id> <comment-id>
  pathfinder review serve [--port 4783]
  pathfinder review start --base <base-ref>
  pathfinder review refresh <workstream-id> <session-id>
  pathfinder review sessions <workstream-id>
  pathfinder review session <workstream-id> <session-id>
  pathfinder review create <workstream-id> --slice <slice-id> --summary "..."
  pathfinder review run --base <base-ref>
  pathfinder review list <workstream-id>
  pathfinder review show <workstream-id> <review-id>
  pathfinder evidence add <workstream-id> --slice <slice-id> --kind <kind> --description "..." [--path ./artifact.txt]
  pathfinder evidence list <workstream-id>
  pathfinder diff show --base <base-ref> [--json]
  pathfinder diff show --session <session-id> [--json]
  pathfinder feedback export <workstream-id> [--session <session-id>] [--file ./feedback.md]
  pathfinder git diff [--base <base-ref>]
  pathfinder git summary --base <base-ref>
  pathfinder pr generate <workstream-id> [--base <base-ref>]`);
}
