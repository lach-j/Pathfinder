export type AgentCommandTool = "claude" | "opencode";

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

export const AGENT_COMMAND_MANAGED_START = "<!-- pathfinder-command:start -->";
export const AGENT_COMMAND_MANAGED_END = "<!-- pathfinder-command:end -->";

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

const TOOL_NAMES: Record<AgentCommandTool, string> = {
  claude: "Claude Code",
  opencode: "OpenCode"
};

export const SUPPORTED_AGENT_COMMAND_TOOLS: AgentCommandTool[] = ["claude", "opencode"];

export function isAgentCommandTool(value: string): value is AgentCommandTool {
  return SUPPORTED_AGENT_COMMAND_TOOLS.includes(value as AgentCommandTool);
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
