import {
  BranchReviewSession,
  ReviewCommentSide,
  ReviewSession,
  StructuredDiff
} from "./domain.js";
import { PathfinderError } from "./errors.js";
import { assertNonEmptyText } from "./validation.js";
import { isReviewCommentSide } from "./review/comment-targets.js";

export interface AgentReviewPromptInput {
  mode: "workstream" | "branch";
  session: ReviewSession | BranchReviewSession;
  diff: StructuredDiff;
  template?: string;
}

export interface AgentReviewImport {
  runId?: string;
  promptId?: string;
  comments: AgentReviewImportComment[];
}

export interface AgentReviewImportComment {
  body: string;
  filePath?: string;
  lineNumber?: number;
  side?: ReviewCommentSide;
}

export function renderAgentReviewPrompt(input: AgentReviewPromptInput): string {
  const template = input.template?.trim();
  if (template) {
    return `${template}\n\n${renderPromptContext(input)}`;
  }

  return [
    "# Pathfinder Agent Review Prompt",
    "",
    "Perform a first-pass local review of this committed diff.",
    "",
    "Do not modify files. Do not resolve Pathfinder comments. Return only structured JSON in this shape:",
    "",
    "```json",
    "{",
    '  "runId": "short-run-label",',
    '  "comments": [',
    '    { "filePath": "src/example.ts", "lineNumber": 12, "side": "new", "body": "Explain the issue." },',
    '    { "filePath": "src/example.ts", "body": "File-level issue." },',
    '    { "body": "Whole-session issue when no file anchor is reliable." }',
    "  ]",
    "}",
    "```",
    "",
    "Prefer changed-line comments when the issue clearly belongs to a changed line. Use file-level or whole-session comments when line anchoring is not reliable.",
    "",
    renderPromptContext(input)
  ].join("\n");
}

export function parseAgentReviewImportJson(value: string): AgentReviewImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PathfinderError("Agent review import must be valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new PathfinderError("Agent review import must be a JSON object.");
  }

  const commentsValue = parsed.comments;
  if (!Array.isArray(commentsValue)) {
    throw new PathfinderError("Agent review import requires a comments array.");
  }

  const comments = commentsValue.map((comment, index) => parseImportComment(comment, index));
  return {
    ...(typeof parsed.runId === "string" && parsed.runId.trim() ? { runId: parsed.runId.trim() } : {}),
    ...(typeof parsed.promptId === "string" && parsed.promptId.trim() ? { promptId: parsed.promptId.trim() } : {}),
    comments
  };
}

function parseImportComment(value: unknown, index: number): AgentReviewImportComment {
  if (!isRecord(value)) {
    throw new PathfinderError(`Agent review comment at index ${index} must be an object.`);
  }

  const body = assertNonEmptyText(String(value.body ?? ""), `Agent review comment ${index + 1} body`);
  const filePath = typeof value.filePath === "string" && value.filePath.trim()
    ? value.filePath.trim()
    : undefined;
  const lineNumber = value.lineNumber === undefined ? undefined : Number(value.lineNumber);
  const side = typeof value.side === "string" && isReviewCommentSide(value.side) ? value.side : undefined;

  if (lineNumber !== undefined && (!Number.isInteger(lineNumber) || lineNumber < 1)) {
    throw new PathfinderError(`Agent review comment ${index + 1} lineNumber must be a positive integer.`);
  }

  if (lineNumber !== undefined) {
    if (!side) {
      throw new PathfinderError(`Agent review comment ${index + 1} side must be old or new when lineNumber is provided.`);
    }
    if (!filePath) {
      throw new PathfinderError(`Agent review comment ${index + 1} requires filePath when lineNumber is provided.`);
    }
  }

  if (side && lineNumber === undefined) {
    throw new PathfinderError(`Agent review comment ${index + 1} side requires lineNumber.`);
  }

  return {
    body,
    ...(filePath ? { filePath } : {}),
    ...(lineNumber !== undefined ? { lineNumber } : {}),
    ...(side ? { side } : {})
  };
}

function renderPromptContext(input: AgentReviewPromptInput): string {
  const changedFiles = input.diff.files.map((file) => `- ${file.status} ${file.path}`).join("\n") || "- No changed files.";
  return [
    "## Review Context",
    "",
    `- Mode: ${input.mode}`,
    `- Session: ${input.session.id}`,
    `- Base ref: ${input.session.baseRef}`,
    `- Head ref: ${input.session.headRef}`,
    `- Head commit: ${input.session.headCommit}`,
    "",
    "## Changed Files",
    "",
    changedFiles
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
