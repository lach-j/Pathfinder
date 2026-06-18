import {
  AgentNextRecommendation,
  BranchReviewNextRecommendation,
  describeReviewCommentTarget
} from "@pathfinder/core";
import {
  AgentCommandsInstallResult,
  AgentCommandsListResult,
  AgentDoctorResult,
  AgentUserInstallResult,
  CurrentContext
} from "@pathfinder/state";

export function formatAgentNext(recommendation: AgentNextRecommendation): string {
  const lines = [
    "# Pathfinder Agent Next",
    "",
    `Phase: ${recommendation.phase}`,
    `Reason: ${recommendation.reason}`
  ];

  if (recommendation.workstreamId) {
    lines.push(`Workstream: ${recommendation.workstreamId}`);
  }

  if (recommendation.sliceId) {
    lines.push(`Slice: ${recommendation.sliceId}`);
  }

  if (recommendation.reviewSessionId) {
    lines.push(`Review session: ${recommendation.reviewSessionId}`);
  }

  lines.push("");
  lines.push("## Recommended Commands");
  lines.push("");
  lines.push(...recommendation.commands.map((command) => `- ${command}`));
  lines.push("");
  lines.push("## Agent Instruction");
  lines.push("");
  lines.push(recommendation.agentInstruction);
  lines.push("");
  lines.push("## Human Instruction");
  lines.push("");
  lines.push(recommendation.humanInstruction);

  return `${lines.join("\n")}\n`;
}

export function formatBranchReviewNext(recommendation: BranchReviewNextRecommendation): string {
  const lines = [
    "# Pathfinder Branch Review Next",
    "",
    `Phase: ${recommendation.phase}`,
    `Reason: ${recommendation.reason}`
  ];

  if (recommendation.reviewSessionId) {
    lines.push(`Review session: ${recommendation.reviewSessionId}`);
  }

  if (recommendation.baseRef) {
    lines.push(`Base ref: ${recommendation.baseRef}`);
  }

  if (recommendation.feedbackQueuePath) {
    lines.push(`Feedback queue: ${recommendation.feedbackQueuePath}`);
  }

  lines.push("");
  lines.push("## Recommended Commands");
  lines.push("");
  lines.push(...recommendation.commands.map((command) => `- ${command}`));
  lines.push("");
  lines.push("## Agent Instruction");
  lines.push("");
  lines.push(recommendation.agentInstruction);
  lines.push("");
  lines.push("## Human Instruction");
  lines.push("");
  lines.push(recommendation.humanInstruction);

  return `${lines.join("\n")}\n`;
}

export function formatAgentCommandsInstall(result: AgentCommandsInstallResult): string {
  const lines = [
    result.dryRun ? "# Pathfinder Agent Commands Dry Run" : "# Pathfinder Agent Commands Install",
    ""
  ];

  for (const file of result.files) {
    const action = file.skipped
      ? "skip"
      : file.changed
        ? result.dryRun
          ? "would write"
          : "wrote"
        : "unchanged";
    const reason = file.reason ? ` (${file.reason})` : "";
    lines.push(`- ${action}: ${file.tool}/${file.commandName} -> ${file.relativePath}${reason}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatAgentCommandsList(result: AgentCommandsListResult): string {
  const lines = ["# Pathfinder Agent Commands", ""];

  for (const tool of result.tools) {
    lines.push(`## ${tool.displayName} (${tool.tool})`);
    lines.push("");

    for (const file of tool.files) {
      const status = file.installed
        ? file.managed
          ? "installed"
          : "user-owned"
        : "missing";
      const note = file.reason ? ` - ${file.reason}` : "";
      lines.push(`- ${file.commandName}: ${status} at ${file.relativePath}${note}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function formatAgentUserInstall(result: AgentUserInstallResult): string {
  const lines = [
    result.dryRun ? "# Pathfinder User Agent Install Dry Run" : "# Pathfinder User Agent Install",
    ""
  ];

  for (const file of result.files) {
    const action = file.skipped
      ? "skip"
      : file.changed
        ? result.dryRun
          ? "would write"
          : "wrote"
        : "unchanged";
    const reason = file.reason ? ` (${file.reason})` : "";
    lines.push(`- ${action}: ${file.tool} -> ${file.relativePath} (${file.path})${reason}`);
  }

  for (const manual of result.manualInstructions) {
    lines.push(`- manual: ${manual.tool} (${manual.displayName})`);
    lines.push("");
    lines.push(...manual.instructions);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function formatAgentDoctor(result: AgentDoctorResult): string {
  const lines = [
    "# Pathfinder Agent Doctor",
    "",
    `Status: ${result.ok ? "ok" : "needs attention"}`,
    `Next phase: ${result.next.phase}`,
    `Next command: ${result.next.command}`,
    "",
    "## Checks",
    ""
  ];

  for (const check of result.checks) {
    const fix = check.fixCommand ? ` Fix: ${check.fixCommand}` : "";
    lines.push(`- [${check.status}] ${check.id}: ${check.message}${fix}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatCurrentContext(context: CurrentContext): string {
  const lines = ["# Pathfinder Current Context", ""];

  lines.push(`Project: ${context.project.name}`);
  lines.push("");

  if (!context.workstream) {
    lines.push("Active workstream: none");
    lines.push("Active slice: none");
    lines.push("");
    lines.push("No active slice set. Use `pathfinder slice active <workstream-id> <slice-id>`.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(`Active workstream: ${context.workstream.title} (${context.workstream.id})`);

  if (!context.activeSlice) {
    lines.push("Active slice: none");
    lines.push("");
    lines.push("No active slice set for this workstream.");
  } else {
    lines.push(`Active slice: ${context.activeSlice.title} (${context.activeSlice.id})`);
    lines.push(`Status: ${context.activeSlice.status}`);
    lines.push("");
    lines.push("## Slice");
    lines.push("");
    lines.push(context.activeSlice.description);
  }

  lines.push("");
  lines.push("## Requirements");
  lines.push("");
  lines.push(`Location: ${context.requirementsPath}`);
  lines.push(...formatMarkdownExcerpt(context.requirementsMarkdown ?? "", "Requirements"));
  lines.push("");
  lines.push("## Plan");
  lines.push("");
  lines.push(`Location: ${context.planPath}`);
  lines.push(...formatMarkdownExcerpt(context.planMarkdown ?? "", "Plan"));
  lines.push("");
  lines.push("## Unresolved Comments");
  lines.push("");

  if (context.unresolvedComments.length === 0) {
    lines.push("No unresolved comments.");
  } else {
    for (const comment of context.unresolvedComments) {
      lines.push(`- ${comment.id} (${describeReviewCommentTarget(comment)}): ${comment.body}`);
    }
  }

  lines.push("");
  lines.push("## Evidence");
  lines.push("");

  if (context.evidence.length === 0) {
    lines.push("No evidence recorded for the active slice.");
  } else {
    for (const evidence of context.evidence) {
      const pathText = evidence.path ? ` (${evidence.path})` : "";
      lines.push(`- ${evidence.id} [${evidence.kind}]: ${evidence.description}${pathText}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatMarkdownExcerpt(markdown: string, label: string): string[] {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return [`${label} excerpt: No ${label.toLowerCase()} recorded.`];
  }

  const excerptLength = 500;
  const excerpt =
    trimmed.length > excerptLength ? `${trimmed.slice(0, excerptLength).trimEnd()}...` : trimmed;

  return [`${label} excerpt:`, "", excerpt];
}
