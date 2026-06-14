import {
  AgentNextRecommendation,
  describeReviewCommentTarget,
  Evidence,
  RepositoryChangeStatus,
  RepositorySummary,
  Review,
  ReviewCheck,
  ReviewComment,
  ReviewSession,
  Slice,
  StructuredDiff,
  StructuredDiffLine
} from "@pathfinder/core";
import { CurrentContext } from "@pathfinder/state";
import { AgentCommandsInstallResult, AgentCommandsListResult, AgentDoctorResult } from "@pathfinder/state";

export function formatSlice(slice: Slice): string {
  const dependencies = slice.dependsOnSliceIds?.length ? `\tdepends-on:${slice.dependsOnSliceIds.join(",")}` : "";
  return `${slice.id}\t${slice.status}\t${slice.title}${dependencies}`;
}

export function formatComment(comment: ReviewComment): string {
  const status = comment.resolved ? "resolved" : "open";
  const anchorStatus = comment.anchorStatus ? `\tanchor:${comment.anchorStatus}` : "";
  return `${comment.id}\t${status}${anchorStatus}\t${describeReviewCommentTarget(comment)}\t${comment.body}`;
}

export function formatReview(review: Review): string {
  return `${review.id}\t${review.status}\t${review.sliceId}\t${review.summary}`;
}

export function formatReviewSession(session: ReviewSession): string {
  return `${session.id}\t${session.sliceId}\t${session.baseRef}\t${session.headRef}\t${session.headCommit}\t${session.changedFiles.length} file(s)`;
}

export function formatReviewSessionSummary(session: ReviewSession): string {
  const lines = [
    "# Pathfinder Review Session",
    "",
    `Session: ${session.id}`,
    `Workstream: ${session.workstreamId}`,
    `Slice: ${session.sliceId}`,
    `Base ref: ${session.baseRef}`,
    `Head ref: ${session.headRef}`,
    `Head commit: ${session.headCommit}`,
    `Merge base: ${session.mergeBase}`,
    `Changed files: ${session.changedFiles.length}`,
    ""
  ];

  if (session.changedFiles.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Files");
  lines.push("");
  lines.push(...session.changedFiles.map((file) => {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    return `- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`;
  }));

  return `${lines.join("\n")}\n`;
}

export function formatDeterministicReview(review: Review, repositorySummary: RepositorySummary): string {
  const lines = [
    "# Pathfinder Deterministic Review",
    "",
    `Review: ${review.id}`,
    `Status: ${review.status}`,
    `Slice: ${review.sliceId}`,
    `Base ref: ${repositorySummary.baseRef}`,
    `Head ref: ${repositorySummary.headRef}`,
    `Head commit: ${repositorySummary.headCommit}`,
    `Merge base: ${repositorySummary.mergeBase}`,
    "",
    "## Checks",
    "",
    ...formatReviewChecks(review.checks ?? []),
    "",
    "## Unresolved Comments",
    "",
    ...formatReviewComments(review.comments),
    "",
    "## Evidence",
    "",
    ...formatReviewEvidence(review.evidence),
    "",
    "## Changed Files",
    "",
    ...formatReviewFiles(repositorySummary)
  ];

  return `${lines.join("\n")}\n`;
}

export function formatEvidence(evidence: Evidence): string {
  const pathText = evidence.path ? `\t${evidence.path}` : "";
  return `${evidence.id}\t${evidence.kind}\t${evidence.sliceId}\t${evidence.description}${pathText}`;
}

export function formatRepositorySummary(summary: RepositorySummary): string {
  const counts = countRepositoryStatuses(summary.files);
  const lines = [
    "# Repository Summary",
    "",
    `Base ref: ${summary.baseRef}`,
    `Head ref: ${summary.headRef}`,
    `Head commit: ${summary.headCommit}`,
    `Merge base: ${summary.mergeBase}`,
    `Changed files: ${summary.files.length}`,
    `Added: ${counts.added}`,
    `Modified: ${counts.modified}`,
    `Deleted: ${counts.deleted}`,
    `Renamed: ${counts.renamed}`,
    ""
  ];

  if (summary.files.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Files");
  lines.push("");

  for (const file of summary.files) {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    lines.push(`- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatStructuredDiff(diff: StructuredDiff): string {
  const lines = ["# Pathfinder Diff", "", `Changed files: ${diff.files.length}`, ""];

  if (diff.files.length === 0) {
    lines.push("No committed file changes found.");
    return `${lines.join("\n")}\n`;
  }

  for (const file of diff.files) {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    lines.push(`## ${formatChangeStatus(file.status)} ${pathText}`);
    lines.push("");

    if (file.hunks.length === 0) {
      lines.push("No textual hunks.");
      lines.push("");
      continue;
    }

    for (const hunk of file.hunks) {
      lines.push(hunk.header);
      for (const line of hunk.lines) {
        lines.push(formatStructuredDiffLine(line));
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

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

function formatReviewChecks(checks: ReviewCheck[]): string[] {
  if (checks.length === 0) {
    return ["- [info] No deterministic checks recorded."];
  }

  return checks.map((check) => `- [${check.severity}] ${check.message}`);
}

function formatReviewComments(comments: ReviewComment[]): string[] {
  if (comments.length === 0) {
    return ["No unresolved comments for the active slice."];
  }

  return comments.map((comment) => `- ${comment.id} (${describeReviewCommentTarget(comment)}): ${comment.body}`);
}

function formatReviewEvidence(evidence: Evidence[]): string[] {
  if (evidence.length === 0) {
    return ["No evidence recorded for the active slice."];
  }

  return evidence.map((item) => {
    const pathText = item.path ? ` (${item.path})` : "";
    return `- ${item.id} [${item.kind}]: ${item.description}${pathText}`;
  });
}

function formatReviewFiles(summary: RepositorySummary): string[] {
  if (summary.files.length === 0) {
    return ["No committed file changes found."];
  }

  return summary.files.map((file) => {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    return `- ${formatChangeStatus(file.status)}\t${file.category}\t${pathText}`;
  });
}

function countRepositoryStatuses(files: RepositorySummary["files"]): Record<RepositoryChangeStatus, number> {
  return files.reduce<Record<RepositoryChangeStatus, number>>(
    (counts, file) => ({
      ...counts,
      [file.status]: counts[file.status] + 1
    }),
    {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
      copied: 0,
      other: 0
    }
  );
}

function formatChangeStatus(status: RepositoryChangeStatus): string {
  if (status === "added") {
    return "A";
  }

  if (status === "modified") {
    return "M";
  }

  if (status === "deleted") {
    return "D";
  }

  if (status === "renamed") {
    return "R";
  }

  if (status === "copied") {
    return "C";
  }

  return "?";
}

function formatStructuredDiffLine(line: StructuredDiffLine): string {
  const oldLine = line.oldLineNumber === undefined ? "    " : String(line.oldLineNumber).padStart(4, " ");
  const newLine = line.newLineNumber === undefined ? "    " : String(line.newLineNumber).padStart(4, " ");

  if (line.kind === "addition") {
    return `${oldLine} ${newLine} +${line.text}`;
  }

  if (line.kind === "deletion") {
    return `${oldLine} ${newLine} -${line.text}`;
  }

  if (line.kind === "metadata") {
    return `          ${line.text}`;
  }

  return `${oldLine} ${newLine}  ${line.text}`;
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
