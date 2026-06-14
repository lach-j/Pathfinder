import { writeFile } from "node:fs/promises";
import path from "node:path";

import { PathfinderError, ReviewCommentTarget, isReviewCommentSide } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { serveReviewServer } from "@pathfinder/local-server";
import { PathfinderStore } from "@pathfinder/state";

import {
  formatComment,
  formatCurrentContext,
  formatDeterministicReview,
  formatEvidence,
  formatRepositorySummary,
  formatReview,
  formatReviewSession,
  formatReviewSessionSummary,
  formatSlice,
  formatStructuredDiff
} from "./formatters.js";
import { printHelp } from "./help.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "./options.js";

const store = new PathfinderStore(process.cwd());

export async function run(args: string[]): Promise<void> {
  const [area, action, ...rest] = args;

  if (!area || area === "help" || area === "--help" || area === "-h") {
    printHelp();
    return;
  }

  if (area === "init") {
    expectNoExtraArgs(rest);
    const project = await store.initProject();
    console.log(`Initialised Pathfinder for ${project.name}.`);
    return;
  }

  if (area === "current") {
    expectNoExtraArgs([action, ...rest].filter((value): value is string => Boolean(value)));
    const context = await store.getCurrentContext();
    process.stdout.write(formatCurrentContext(context));
    return;
  }

  if (area === "workstream") {
    await runWorkstream(action, rest);
    return;
  }

  if (area === "plan") {
    await runPlan(action, rest);
    return;
  }

  if (area === "requirement") {
    await runRequirement(action, rest);
    return;
  }

  if (area === "slice") {
    await runSlice(action, rest);
    return;
  }

  if (area === "comment") {
    await runComment(action, rest);
    return;
  }

  if (area === "review") {
    await runReview(action, rest);
    return;
  }

  if (area === "evidence") {
    await runEvidence(action, rest);
    return;
  }

  if (area === "git") {
    await runGit(action, rest);
    return;
  }

  if (area === "diff") {
    await runDiff(action, rest);
    return;
  }

  if (area === "feedback") {
    await runFeedback(action, rest);
    return;
  }

  if (area === "pr") {
    await runPr(action, rest);
    return;
  }

  throw usageError(`Unknown command '${area}'.`);
}

async function runDiff(action: string | undefined, args: string[]): Promise<void> {
  if (action === "show") {
    const options = parseOptions(args);
    const git = new GitAdapter({ cwd: process.cwd() });

    if (options.base && options.session) {
      throw usageError("Use either --base or --session, not both.");
    }

    if (!options.base && !options.session) {
      throw usageError("Missing required option --base or --session.");
    }

    const diff = options.base
      ? await git.getStructuredDiffAgainstBase(options.base)
      : await getStructuredDiffForSession(git, options.session);

    if (options.json) {
      console.log(JSON.stringify(diff, null, 2));
      return;
    }

    process.stdout.write(formatStructuredDiff(diff));
    return;
  }

  throw usageError("Unknown diff command. Expected show.");
}

async function getStructuredDiffForSession(git: GitAdapter, sessionId: string | undefined) {
  requireOption(sessionId, "--session");
  const session = await store.findReviewSession(sessionId);
  return git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit);
}

function parseOptionalLineNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const lineNumber = Number(value);
  if (!Number.isInteger(lineNumber) || lineNumber < 1) {
    throw usageError("Invalid --line value. Expected a positive integer.");
  }

  return lineNumber;
}

async function runGit(action: string | undefined, args: string[]): Promise<void> {
  if (action === "diff") {
    const options = parseOptions(args);
    const git = new GitAdapter({ cwd: process.cwd() });
    const diff = options.base
      ? await git.getCommittedDiffAgainstBase(options.base)
      : await git.getWorkingTreeDiff();
    process.stdout.write(diff);
    return;
  }

  if (action === "summary") {
    const options = parseOptions(args);
    requireOption(options.base, "--base");
    const git = new GitAdapter({ cwd: process.cwd() });
    const summary = await git.getCommittedSummaryAgainstBase(options.base);
    process.stdout.write(formatRepositorySummary(summary));
    return;
  }

  throw usageError("Unknown git command. Expected diff or summary.");
}

async function runPr(action: string | undefined, args: string[]): Promise<void> {
  if (action === "generate") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const repositorySummary = options.base
      ? await new GitAdapter({ cwd: process.cwd() }).getCommittedSummaryAgainstBase(options.base)
      : undefined;
    const result = await store.generatePrMarkdown(workstreamId, repositorySummary);
    process.stdout.write(result.markdown);
    return;
  }

  throw usageError("Unknown pr command. Expected generate.");
}

async function runFeedback(action: string | undefined, args: string[]): Promise<void> {
  if (action === "export") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const result = await store.exportFeedbackQueue(workstreamId, {
      sessionId: options.session
    });

    if (options.file) {
      const outputPath = path.resolve(process.cwd(), options.file);
      await writeFile(outputPath, result.markdown, "utf8");
      console.log(`Wrote feedback queue to ${outputPath}.`);
      return;
    }

    process.stdout.write(result.markdown);
    return;
  }

  throw usageError("Unknown feedback command. Expected export.");
}

async function runRequirement(action: string | undefined, args: string[]): Promise<void> {
  if (action === "set") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.file, "--file");
    await store.setRequirementsFromFile(workstreamId, options.file);
    console.log(`Updated requirements for ${workstreamId}.`);
    return;
  }

  if (action === "show") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const requirements = await store.getRequirements(workstreamId);
    if (!requirements.trim()) {
      console.log("No requirements recorded.");
      return;
    }
    process.stdout.write(requirements);
    return;
  }

  throw usageError("Unknown requirement command. Expected set or show.");
}

async function runWorkstream(action: string | undefined, args: string[]): Promise<void> {
  if (action === "create") {
    const options = parseOptions(args);
    requireOption(options.title, "--title");
    const workstream = await store.createWorkstream(options.title);
    console.log(`${workstream.id}\t${workstream.title}`);
    return;
  }

  if (action === "list") {
    expectNoExtraArgs(args);
    const workstreams = await store.listWorkstreams();
    if (workstreams.length === 0) {
      console.log("No workstreams found.");
      return;
    }
    for (const workstream of workstreams) {
      console.log(`${workstream.id}\t${workstream.title}`);
    }
    return;
  }

  if (action === "show") {
    const [id, ...extra] = args;
    requireArgument(id, "workstream id");
    expectNoExtraArgs(extra);
    const workstream = await store.getWorkstream(id);
    console.log(JSON.stringify(workstream, null, 2));
    return;
  }

  throw usageError("Unknown workstream command. Expected create, list, or show.");
}

async function runPlan(action: string | undefined, args: string[]): Promise<void> {
  if (action === "import") {
    const options = parseOptions(args);
    requireOption(options.file, "--file");
    const result = await store.importStagePlanFromFile(options.file);
    console.log(`Imported workstream: ${result.workstream.id}\t${result.workstream.title}`);
    for (const slice of result.slices) {
      console.log(`Imported slice: ${slice.id}\t${slice.title}`);
    }
    return;
  }

  if (action === "set") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.file, "--file");
    await store.setPlanFromFile(workstreamId, options.file);
    console.log(`Updated plan for ${workstreamId}.`);
    return;
  }

  if (action === "show") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    process.stdout.write(await store.getPlan(workstreamId));
    return;
  }

  throw usageError("Unknown plan command. Expected import, set, or show.");
}

async function runSlice(action: string | undefined, args: string[]): Promise<void> {
  if (action === "add") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.title, "--title");
    requireOption(options.description, "--description");
    const slice = await store.addSlice(workstreamId, options.title, options.description, options.dependsOn ?? []);
    console.log(formatSlice(slice));
    return;
  }

  if (action === "list") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const slices = await store.listSlices(workstreamId);
    if (slices.length === 0) {
      console.log("No slices found.");
      return;
    }
    for (const slice of slices) {
      console.log(formatSlice(slice));
    }
    return;
  }

  if (action === "active") {
    const [workstreamId, sliceId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    expectNoExtraArgs(extra);
    const active = await store.setActiveSlice(workstreamId, sliceId);
    console.log(`Active slice: ${active.workstream.id}/${active.slice.id}`);
    return;
  }

  if (action === "depend") {
    const [workstreamId, sliceId, dependencySliceId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    requireArgument(dependencySliceId, "dependency slice id");
    expectNoExtraArgs(extra);
    const slice = await store.addSliceDependency(workstreamId, sliceId, dependencySliceId);
    console.log(formatSlice(slice));
    return;
  }

  if (action === "next") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const slice = await store.getNextSlice(workstreamId);

    if (!slice) {
      console.log("No actionable slices found. Proposed or ready slices may be blocked by incomplete dependencies.");
      return;
    }

    console.log(formatSlice(slice));
    console.log(`Set active: pathfinder slice active ${workstreamId} ${slice.id}`);
    console.log(`Start branch: pathfinder slice branch ${workstreamId} ${slice.id} --base <base-ref>`);
    return;
  }

  if (action === "status") {
    const [workstreamId, sliceId, status, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    requireArgument(status, "slice status");
    expectNoExtraArgs(extra);
    const slice = await store.updateSliceStatus(workstreamId, sliceId, status);
    console.log(formatSlice(slice));
    return;
  }

  if (action === "branch") {
    const [workstreamId, sliceId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    const options = parseOptions(optionArgs);
    requireOption(options.base, "--base");
    const slices = await store.listSlices(workstreamId);
    const slice = slices.find((candidate) => candidate.id === sliceId);

    if (!slice) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    const git = new GitAdapter({ cwd: process.cwd() });
    if (await git.hasUncommittedChanges()) {
      throw new PathfinderError(
        "Cannot start a slice branch with uncommitted changes. Commit, stash, or remove local changes first."
      );
    }

    const branchName = `pathfinder/${workstreamId}/${sliceId}`;
    await git.createAndCheckoutBranch(branchName, options.base);
    const updated = await store.setSliceBranchMetadata(workstreamId, sliceId, {
      branchName,
      baseRef: options.base
    });
    console.log(`Started branch ${branchName} for slice ${workstreamId}/${updated.id}.`);
    return;
  }

  if (action === "show-active") {
    expectNoExtraArgs(args);
    const active = await store.getActiveSlice();
    if (!active) {
      console.log("No active slice set.");
      return;
    }
    console.log(`Workstream: ${active.workstream.id}\t${active.workstream.title}`);
    console.log(formatSlice(active.slice));
    console.log(active.slice.description);
    return;
  }

  throw usageError("Unknown slice command. Expected add, list, active, depend, next, status, branch, or show-active.");
}

async function runComment(action: string | undefined, args: string[]): Promise<void> {
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
      let target: ReviewCommentTarget;
      if (lineNumber === undefined) {
        target = {
          type: "file",
          sessionId: options.session,
          filePath: options.file
        };
      } else {
        requireOption(side, "--side");
        if (!isReviewCommentSide(side)) {
          throw usageError("Invalid --side value. Expected old or new.");
        }
        target = {
          type: "line",
          sessionId: options.session,
          filePath: options.file,
          lineNumber,
          side
        };
      }
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

async function runReview(action: string | undefined, args: string[]): Promise<void> {
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
    const result = await store.refreshReviewSession(
      workstreamId,
      sessionId,
      repositorySummary,
      structuredDiff
    );
    process.stdout.write(formatReviewSessionSummary(result.session));
    const staleCount = result.comments.filter((comment) => comment.anchorStatus === "stale").length;
    const unknownCount = result.comments.filter((comment) => comment.anchorStatus === "unknown").length;
    console.log(`Anchor status: ${staleCount} stale, ${unknownCount} unknown.`);
    return;
  }

  if (action === "sessions") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const sessions = await store.listReviewSessions(workstreamId);
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
    const [workstreamId, sessionId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sessionId, "session id");
    expectNoExtraArgs(extra);
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

  throw usageError("Unknown review command. Expected serve, start, refresh, sessions, session, run, create, list, or show.");
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 4783;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw usageError("Invalid --port value. Expected an integer between 1 and 65535.");
  }

  return port;
}

async function runEvidence(action: string | undefined, args: string[]): Promise<void> {
  if (action === "add") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.slice, "--slice");
    requireOption(options.kind, "--kind");
    requireOption(options.description, "--description");
    const evidence = await store.addEvidence(
      workstreamId,
      options.slice,
      options.kind,
      options.description,
      options.path
    );
    console.log(formatEvidence(evidence));
    return;
  }

  if (action === "list") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const evidence = await store.listEvidence(workstreamId);
    if (evidence.length === 0) {
      console.log("No evidence found.");
      return;
    }
    for (const item of evidence) {
      console.log(formatEvidence(item));
    }
    return;
  }

  throw usageError("Unknown evidence command. Expected add or list.");
}

