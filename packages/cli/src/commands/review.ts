import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentReviewImportComment,
  PathfinderError,
  ReviewCommentTarget,
  StructuredDiff,
  parseAgentReviewImportJson,
  renderAgentReviewPrompt,
  structuredDiffHasFile,
  structuredDiffHasLine
} from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { serveReviewServer } from "@pathfinder/local-server";
import { PathfinderStore } from "@pathfinder/state";
import {
  formatComment,
  formatDeterministicReview,
  formatReview,
  formatReviewApproval,
  formatReviewSession,
  formatReviewSessionSummary
} from "../formatters.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "../options.js";
import { getStructuredDiffForSession } from "./diff.js";
import {
  assertReviewSide,
  parseOptionalLineNumber,
  parsePort,
  requireBaselineCommit,
  requireCleanCommittedReviewRepo
} from "./review-helpers.js";
const store = new PathfinderStore(process.cwd());

export async function runComment(action: string | undefined, args: string[]): Promise<void> {
  if (action === "add") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.body, "--body");
    const git = new GitAdapter({ cwd: process.cwd() });

    if (options.slice && options.session) {
      throw usageError("Use either --slice or --session, not both.");
    }

    if (options.slice) {
      const comment = await store.addComment(workstreamId, options.slice, options.body);
      console.log(formatComment(comment));
      return;
    }

    if (options.session) {
      requireOption(options.file, "--file");
      const lineNumber = parseOptionalLineNumber(options.line);
      const side = options.side;

      if (lineNumber === undefined && side) {
        throw usageError("Use --side only with --line.");
      }

      const structuredDiff = await getStructuredDiffForSession(git, options.session);
      const target: ReviewCommentTarget = lineNumber === undefined
        ? {
            type: "file",
            sessionId: options.session,
            filePath: options.file
          }
        : {
            type: "line",
            sessionId: options.session,
            filePath: options.file,
            lineNumber,
            side: assertReviewSide(side)
          };
      const comment = await store.addComment(workstreamId, {
        body: options.body,
        target,
        structuredDiff
      });
      console.log(formatComment(comment));
      return;
    }

    throw usageError("Missing required option --slice or --session.");
  }

  if (action === "list") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const comments = await store.listComments(workstreamId, {
      sessionId: options.session,
      openOnly: Boolean(options.open)
    });
    if (options.json) {
      console.log(JSON.stringify(comments, null, 2));
      return;
    }
    if (comments.length === 0) {
      console.log("No comments found.");
      return;
    }
    for (const comment of comments) {
      console.log(formatComment(comment));
    }
    return;
  }

  if (action === "resolve") {
    const [workstreamId, commentId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(commentId, "comment id");
    expectNoExtraArgs(extra);
    const comment = await store.resolveComment(workstreamId, commentId);
    console.log(`Resolved comment: ${comment.id}`);
    return;
  }

  throw usageError("Unknown comment command. Expected add, list, or resolve.");
}

export async function runAgentReview(action: string | undefined, args: string[]): Promise<void> {
  const [workstreamId, ...optionArgs] = args;
  requireArgument(workstreamId, "workstream id");
  const options = parseOptions(optionArgs);
  requireOption(options.session, "--session");
  const git = new GitAdapter({ cwd: process.cwd() });
  const session = await store.getReviewSession(workstreamId, options.session);
  const diff = await getStructuredDiffForSession(git, session.id);

  if (action === "prompt") {
    const template = options.template ? await readFile(path.resolve(process.cwd(), options.template), "utf8") : undefined;
    process.stdout.write(renderAgentReviewPrompt({ mode: "workstream", session, diff, template }));
    process.stdout.write("\n");
    return;
  }

  if (action === "import") {
    const imported = parseAgentReviewImportJson(await readInputFileOrStdin(options.file));
    const comments = [];
    for (const item of imported.comments) {
      comments.push(await store.addComment(workstreamId, {
        body: item.body,
        origin: "agent",
        target: agentReviewTarget(item, session.id, diff),
        structuredDiff: diff
      }));
    }
    console.log(`Imported ${comments.length} agent review comment${comments.length === 1 ? "" : "s"}.`);
    for (const comment of comments) {
      console.log(formatComment(comment));
    }
    return;
  }

  throw usageError("Unknown agent-review command. Expected prompt or import.");
}

export async function runReview(action: string | undefined, args: string[]): Promise<void> {
  if (action === "serve") {
    const options = parseOptions(args);
    const port = parsePort(options.port);
    await serveReviewServer({ port });
    return;
  }

  if (action === "start") {
    const options = parseOptions(args);
    requireOption(options.base, "--base");
    const git = new GitAdapter({ cwd: process.cwd() });
    await requireBaselineCommit(git, "start a review session");
    if (!(await store.getActiveSlice())) {
      throw new PathfinderError("No active slice set. Use 'pathfinder slice active <workstream-id> <slice-id>' first.");
    }
    await requireCleanCommittedReviewRepo(git, "start a review session");
    const repositorySummary = await git.getCommittedSummaryAgainstBase(options.base);
    const session = await store.startReviewSession(repositorySummary);
    process.stdout.write(formatReviewSessionSummary(session));
    return;
  }

  if (action === "refresh") {
    const [workstreamId, sessionId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sessionId, "session id");
    expectNoExtraArgs(extra);
    const session = await store.getReviewSession(workstreamId, sessionId);
    const git = new GitAdapter({ cwd: process.cwd() });
    const repositorySummary = await git.getCommittedSummaryAgainstBase(session.baseRef);
    const structuredDiff = await git.getStructuredDiffBetweenRefs(repositorySummary.mergeBase, repositorySummary.headCommit);
    const result = await store.refreshReviewSession(workstreamId, sessionId, repositorySummary, structuredDiff);
    process.stdout.write(formatReviewSessionSummary(result.session));
    const staleCount = result.comments.filter((comment) => comment.anchorStatus === "stale").length;
    const unknownCount = result.comments.filter((comment) => comment.anchorStatus === "unknown").length;
    console.log(`Anchor status: ${staleCount} stale, ${unknownCount} unknown.`);
    return;
  }

  if (action === "approve") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.session, "--session");
    const result = await store.approveReviewSession(workstreamId, options.session);
    process.stdout.write(formatReviewApproval(result));
    return;
  }

  if (action === "sessions") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const sessions = await store.listReviewSessions(workstreamId);
    if (options.json) {
      console.log(JSON.stringify(sessions, null, 2));
      return;
    }
    if (sessions.length === 0) {
      console.log("No review sessions found.");
      return;
    }
    for (const session of sessions) {
      console.log(formatReviewSession(session));
    }
    return;
  }

  if (action === "session") {
    const [workstreamId, sessionId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sessionId, "session id");
    parseOptions(optionArgs);
    const session = await store.getReviewSession(workstreamId, sessionId);
    console.log(JSON.stringify(session, null, 2));
    return;
  }

  if (action === "run") {
    const options = parseOptions(args);
    requireOption(options.base, "--base");
    const git = new GitAdapter({ cwd: process.cwd() });
    const repositorySummary = await git.getCommittedSummaryAgainstBase(options.base);
    const result = await store.runDeterministicReview(options.base, repositorySummary);
    process.stdout.write(formatDeterministicReview(result.review, repositorySummary));
    return;
  }

  if (action === "create") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.slice, "--slice");
    requireOption(options.summary, "--summary");
    const review = await store.createReview(workstreamId, options.slice, options.summary);
    console.log(formatReview(review));
    return;
  }

  if (action === "list") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const reviews = await store.listReviews(workstreamId);
    if (reviews.length === 0) {
      console.log("No reviews found.");
      return;
    }
    for (const review of reviews) {
      console.log(formatReview(review));
    }
    return;
  }

  if (action === "show") {
    const [workstreamId, reviewId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(reviewId, "review id");
    expectNoExtraArgs(extra);
    const review = await store.getReview(workstreamId, reviewId);
    console.log(JSON.stringify(review, null, 2));
    return;
  }

  throw usageError("Unknown review command. Expected serve, start, refresh, approve, sessions, session, run, create, list, or show.");
}

export function agentReviewTarget(
  item: AgentReviewImportComment,
  sessionId: string,
  diff: StructuredDiff
): ReviewCommentTarget {
  if (item.filePath && item.lineNumber !== undefined && item.side) {
    if (structuredDiffHasLine(diff, item.filePath, item.lineNumber, item.side)) {
      return {
        type: "line",
        sessionId,
        filePath: item.filePath,
        lineNumber: item.lineNumber,
        side: item.side
      };
    }
  }

  if (item.filePath && structuredDiffHasFile(diff, item.filePath)) {
    return {
      type: "file",
      sessionId,
      filePath: item.filePath
    };
  }

  return { type: "workstream" };
}

export async function readInputFileOrStdin(file: string | undefined): Promise<string> {
  if (file) {
    return readFile(path.resolve(process.cwd(), file), "utf8");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
