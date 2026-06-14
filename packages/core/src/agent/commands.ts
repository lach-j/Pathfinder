export type AgentCommandTool = "claude" | "opencode";
export type AgentUserInstallTool = AgentCommandTool | "codex";

export interface AgentCommandFileDefinition {
  tool: AgentCommandTool;
  commandName: string;
  relativePath: string;
  markdown: string;
}

export interface AgentCommandToolDefinition {
  tool: AgentCommandTool;
  displayName: string;
  files: AgentCommandFileDefinition[];
}

export interface AgentUserInstallFileDefinition {
  tool: AgentUserInstallTool;
  relativePath: string;
  markdown: string;
  installRoot?: "user-home" | "codex-home";
}

export interface AgentUserInstallToolDefinition {
  tool: AgentUserInstallTool;
  displayName: string;
  files: AgentUserInstallFileDefinition[];
  manualInstructions: string[];
}

export const AGENT_COMMAND_MANAGED_START = "<!-- pathfinder-command:start -->";
export const AGENT_COMMAND_MANAGED_END = "<!-- pathfinder-command:end -->";
export const AGENT_USER_INSTALL_MANAGED_START = "<!-- pathfinder-user-agent:start -->";
export const AGENT_USER_INSTALL_MANAGED_END = "<!-- pathfinder-user-agent:end -->";

const COMMANDS = [
  {
    name: "pathfinder-plan",
    description: "Ask Pathfinder for deterministic planning instructions.",
    command: "pathfinder agent prompt --phase plan",
    followUp: "Follow the rendered planning prompt."
  },
  {
    name: "pathfinder-continue",
    description: "Ask Pathfinder what phase this repository is in, then continue from that phase.",
    command: "pathfinder agent next --json\npathfinder agent prompt",
    followUp: "Read both outputs, then follow the current Pathfinder phase."
  },
  {
    name: "pathfinder-feedback",
    description: "Ask Pathfinder for deterministic feedback-fixing instructions.",
    command: "pathfinder agent prompt --phase feedback",
    followUp: "Follow the rendered feedback prompt."
  }
] as const;

const TOOL_PATHS: Record<AgentCommandTool, string> = {
  claude: ".claude/commands",
  opencode: ".opencode/commands"
};

const TOOL_NAMES: Record<AgentUserInstallTool, string> = {
  claude: "Claude Code",
  opencode: "OpenCode",
  codex: "Codex"
};

export const SUPPORTED_AGENT_COMMAND_TOOLS: AgentCommandTool[] = ["claude", "opencode"];
export const SUPPORTED_AGENT_USER_INSTALL_TOOLS: AgentUserInstallTool[] = ["claude", "opencode", "codex"];

export function isAgentCommandTool(value: string): value is AgentCommandTool {
  return SUPPORTED_AGENT_COMMAND_TOOLS.includes(value as AgentCommandTool);
}

export function isAgentUserInstallTool(value: string): value is AgentUserInstallTool {
  return SUPPORTED_AGENT_USER_INSTALL_TOOLS.includes(value as AgentUserInstallTool);
}

export function getAgentCommandToolDefinitions(
  tool?: AgentCommandTool
): AgentCommandToolDefinition[] {
  const tools = tool ? [tool] : SUPPORTED_AGENT_COMMAND_TOOLS;
  return tools.map((candidate) => ({
    tool: candidate,
    displayName: TOOL_NAMES[candidate],
    files: COMMANDS.map((command) => ({
      tool: candidate,
      commandName: command.name,
      relativePath: `${TOOL_PATHS[candidate]}/${command.name}.md`,
      markdown: renderCommandMarkdown(command.name, command.description, command.command, command.followUp)
    }))
  }));
}

export function getAgentUserInstallToolDefinitions(
  tool?: AgentUserInstallTool
): AgentUserInstallToolDefinition[] {
  const tools = tool ? [tool] : SUPPORTED_AGENT_USER_INSTALL_TOOLS;
  return tools.map((candidate) => ({
    tool: candidate,
    displayName: TOOL_NAMES[candidate],
    files: candidate === "claude"
      ? [
          {
            tool: candidate,
            relativePath: ".claude/CLAUDE.md",
            markdown: renderUserInstructionsMarkdown()
          }
        ]
      : candidate === "codex"
        ? [
            {
              tool: candidate,
              relativePath: "AGENTS.md",
              installRoot: "codex-home",
              markdown: renderUserInstructionsMarkdown()
            }
          ]
        : [],
    manualInstructions: candidate === "opencode"
      ? [
          "OpenCode user-level rule and command locations vary by installation.",
          "Add the Pathfinder user instructions shown below to your OpenCode user-level rules if your installation supports them.",
          renderUserInstructionsBody()
        ]
      : []
  }));
}

function renderCommandMarkdown(
  commandName: string,
  description: string,
  command: string,
  followUp: string
): string {
  return `${AGENT_COMMAND_MANAGED_START}
# ${commandName}

${description}

Do not infer the Pathfinder workflow manually. Run the listed Pathfinder command and follow its output.

\`\`\`bash
${command}
\`\`\`

${followUp}
${AGENT_COMMAND_MANAGED_END}
`;
}

function renderUserInstructionsMarkdown(): string {
  return `${AGENT_USER_INSTALL_MANAGED_START}
${renderUserInstructionsBody()}
${AGENT_USER_INSTALL_MANAGED_END}
`;
}

function renderUserInstructionsBody(): string {
  return `# Pathfinder

Pathfinder is installed on this machine.

When working in a Git repository and the user asks to plan, implement, continue, review, or address feedback, run:

\`\`\`bash
pathfinder agent doctor --json
\`\`\`

If Pathfinder is initialized or applicable, start with:

\`\`\`bash
pathfinder agent next --json
\`\`\`

Use \`pathfinder agent prompt\` for phase-specific instructions.
Do not create unmanaged plans or task lists when Pathfinder state exists.
Do not resolve Pathfinder comments automatically.
Do not write Pathfinder setup files into the repository unless the user asks.`;
}
