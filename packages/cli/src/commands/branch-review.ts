import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ReviewCommentTarget, parseAgentReviewImportJson, renderAgentReviewPrompt } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

import {
  formatBranchReviewApproval,
  formatBranchReviewNext,
  formatBranchReviewSession,
  formatBranchReviewSessionSummary,
  formatComment,
  formatStructuredDiff
} from "../formatters.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "../options.js";
import { agentIgnoredDirtyPathPrefixes } from "./shared.js";
import {
  agentReviewTarget,
  readInputFileOrStdin
} from "./review.js";
import {
  assertReviewSide,
  parseOptionalLineNumber,
  requireBaselineCommit,
  requireCleanCommittedReviewRepo
} from "./review-helpers.js";

const store = new PathfinderStore(process.cwd());

export async function runBranchReview(action: string | undefined, args: string[]): Promise<void> {
  if (action === "next") {
    const options = parseOptions(args);
    const git = new GitAdapter({ cwd: process.cwd() });
    const recommendation = await store.getBranchReviewNext(
      (baseRef) => git.getCommittedSummaryAgainstBase(baseRef),
      () => git.getSuggestedBaseRef(),
      () => git.hasUncommittedChangesOutside(agentIgnoredDirtyPathPrefixes())
    );

    if (options.json) {
      console.log(JSON.stringify(recommendation, null, 2));
      return;
    }

    process.stdout.write(formatBranchReviewNext(recommendation));
    return;
  }

  if (action === "start") {
    const options = parseOptions(args);
    requireOption(options.base, "--base");
    const git = new GitAdapter({ cwd: process.cwd() });
    await requireBaselineCommit(git, "start a branch review session");
    await requireCleanCommittedReviewRepo(git, "start a branch review session");
    const repositorySummary = await git.getCommittedSummaryAgainstBase(options.base);
    const session = await store.startBranchReviewSession(repositorySummary);
    process.stdout.write(formatBranchReviewSessionSummary(session));
    return;
  }

  if (action === "refresh") {
    const [sessionId, ...extra] = args;
    requireArgument(sessionId, "session id");
    expectNoExtraArgs(extra);
    const session = await store.getBranchReviewSession(sessionId);
    const git = new GitAdapter({ cwd: process.cwd() });
    const repositorySummary = await git.getCommittedSummaryAgainstBase(session.baseRef);
    const structuredDiff = await git.getStructuredDiffBetweenRefs(repositorySummary.mergeBase, repositorySummary.headCommit);
    const result = await store.refreshBranchReviewSession(sessionId, repositorySummary, structuredDiff);
    process.stdout.write(formatBranchReviewSessionSummary(result.session));
    const staleCount = result.comments.filter((comment) => comment.anchorStatus === "stale").length;
    const unknownCount = result.comments.filter((comment) => comment.anchorStatus === "unknown").length;
    console.log(`Anchor status: ${staleCount} stale, ${unknownCount} unknown.`);
    return;
  }

  if (action === "approve") {
    const [sessionId, ...extra] = args;
    requireArgument(sessionId, "session id");
    expectNoExtraArgs(extra);
    const result = await store.approveBranchReviewSession(sessionId);
    process.stdout.write(formatBranchReviewApproval(result));
    return;
  }

  if (action === "sessions") {
    const options = parseOptions(args);
    const sessions = await store.listBranchReviewSessions();
    if (options.json) {
      console.log(JSON.stringify(sessions, null, 2));
      return;
    }
    if (sessions.length === 0) {
      console.log("No branch review sessions found.");
      return;
    }
    for (const session of sessions) {
      console.log(formatBranchReviewSession(session));
    }
    return;
  }

  if (action === "session") {
    const [sessionId, ...optionArgs] = args;
    requireArgument(sessionId, "session id");
    parseOptions(optionArgs);
    const session = await store.getBranchReviewSession(sessionId);
    console.log(JSON.stringify(session, null, 2));
    return;
  }

  if (action === "diff") {
    const [sessionId, ...optionArgs] = args;
    requireArgument(sessionId, "session id");
    const options = parseOptions(optionArgs);
    const git = new GitAdapter({ cwd: process.cwd() });
    const diff = await getStructuredDiffForBranchReviewSession(git, sessionId);
    if (options.json) {
      console.log(JSON.stringify(diff, null, 2));
      return;
    }
    process.stdout.write(formatStructuredDiff(diff));
    return;
  }

  if (action === "comment") {
    await runBranchReviewComment(args);
    return;
  }

  if (action === "agent-review") {
    await runBranchReviewAgentReview(args);
    return;
  }

  if (action === "feedback") {
    await runBranchReviewFeedback(args);
    return;
  }

  if (action === "pr") {
    await runBranchReviewPr(args);
    return;
  }

  throw usageError(
    "Unknown branch-review command. Expected next, start, refresh, approve, sessions, session, diff, comment, feedback, or pr."
  );
}

async function getStructuredDiffForBranchReviewSession(git: GitAdapter, sessionId: string) {
  const session = await store.getBranchReviewSession(sessionId);
  return git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit);
}

async function runBranchReviewComment(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  if (action === "add") {
    const [sessionId, ...optionArgs] = rest;
    requireArgument(sessionId, "session id");
    const options = parseOptions(optionArgs);
    requireOption(options.file, "--file");
    requireOption(options.body, "--body");
    const lineNumber = parseOptionalLineNumber(options.line);
    const side = options.side;

    if (lineNumber === undefined && side) {
      throw usageError("Use --side only with --line.");
    }

    const git = new GitAdapter({ cwd: process.cwd() });
    const structuredDiff = await getStructuredDiffForBranchReviewSession(git, sessionId);
    const target: ReviewCommentTarget = lineNumber === undefined
      ? {
          type: "file",
          sessionId,
          filePath: options.file
        }
      : {
          type: "line",
          sessionId,
          filePath: options.file,
          lineNumber,
          side: assertReviewSide(side)
        };
    const comment = await store.addBranchReviewComment({
      body: options.body,
      target,
      structuredDiff
    });
    console.log(formatComment(comment));
    return;
  }

  if (action === "list") {
    const options = parseOptions(rest);
    const comments = await store.listBranchReviewComments({
      sessionId: options.session,
      openOnly: Boolean(options.open)
    });
    if (options.json) {
      console.log(JSON.stringify(comments, null, 2));
      return;
    }
    if (comments.length === 0) {
      console.log("No branch review comments found.");
      return;
    }
    for (const comment of comments) {
      console.log(formatComment(comment));
    }
    return;
  }

  if (action === "resolve") {
    const [commentId, ...extra] = rest;
    requireArgument(commentId, "comment id");
    expectNoExtraArgs(extra);
    const comment = await store.resolveBranchReviewComment(commentId);
    console.log(`Resolved branch review comment: ${comment.id}`);
    return;
  }

  throw usageError("Unknown branch-review comment command. Expected add, list, or resolve.");
}

async function runBranchReviewAgentReview(args: string[]): Promise<void> {
  const [action, ...rest] = args;
  const options = parseOptions(rest);
  requireOption(options.session, "--session");
  const git = new GitAdapter({ cwd: process.cwd() });
  const session = await store.getBranchReviewSession(options.session);
  const diff = await getStructuredDiffForBranchReviewSession(git, session.id);

  if (action === "prompt") {
    const template = options.template ? await readFile(path.resolve(process.cwd(), options.template), "utf8") : undefined;
    process.stdout.write(renderAgentReviewPrompt({ mode: "branch", session, diff, template }));
    process.stdout.write("\n");
    return;
  }

  if (action === "import") {
    const imported = parseAgentReviewImportJson(await readInputFileOrStdin(options.file));
    const comments = [];
    for (const item of imported.comments) {
      comments.push(await store.addBranchReviewComment({
        body: item.body,
        origin: "agent",
        target: agentReviewTarget(item, session.id, diff),
        structuredDiff: diff
      }));
    }
    console.log(`Imported ${comments.length} agent branch review comment${comments.length === 1 ? "" : "s"}.`);
    for (const comment of comments) {
      console.log(formatComment(comment));
    }
    return;
  }

  throw usageError("Unknown branch-review agent-review command. Expected prompt or import.");
}

async function runBranchReviewFeedback(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  if (action === "export") {
    const options = parseOptions(rest);
    const result = await store.exportBranchReviewFeedbackQueue({
      sessionId: options.session
    });

    if (options.file) {
      await writeFile(path.resolve(process.cwd(), options.file), result.markdown, "utf8");
      console.log(`Exported branch review feedback queue to ${options.file}.`);
      return;
    }

    if (result.defaultPath) {
      await writeFile(result.defaultPath, result.markdown, "utf8");
      console.log(`Exported branch review feedback queue to ${result.defaultPath}.`);
      return;
    }

    process.stdout.write(result.markdown);
    return;
  }

  throw usageError("Unknown branch-review feedback command. Expected export.");
}

async function runBranchReviewPr(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  if (action === "generate") {
    const options = parseOptions(rest);
    const git = new GitAdapter({ cwd: process.cwd() });
    const repositorySummary = options.base ? await git.getCommittedSummaryAgainstBase(options.base) : undefined;
    const result = await store.generateBranchReviewPrMarkdown(repositorySummary);
    console.log(`Wrote branch review PR markdown to ${result.path}.`);
    process.stdout.write(result.markdown);
    return;
  }

  throw usageError("Unknown branch-review pr command. Expected generate.");
}
