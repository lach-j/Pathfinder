#!/usr/bin/env node
import { Evidence, PathfinderError, Review, ReviewComment, Slice } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { CurrentContext, PathfinderStore } from "@pathfinder/state";

interface OptionMap {
  title?: string;
  description?: string;
  file?: string;
  slice?: string;
  body?: string;
  summary?: string;
  base?: string;
  dependsOn?: string[];
  kind?: string;
  path?: string;
}

const store = new PathfinderStore(process.cwd());

run(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof PathfinderError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});

async function run(args: string[]): Promise<void> {
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

  if (area === "pr") {
    await runPr(action, rest);
    return;
  }

  throw usageError(`Unknown command '${area}'.`);
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

  throw usageError("Unknown git command. Expected diff.");
}

async function runPr(action: string | undefined, args: string[]): Promise<void> {
  if (action === "generate") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const result = await store.generatePrMarkdown(workstreamId);
    process.stdout.write(result.markdown);
    return;
  }

  throw usageError("Unknown pr command. Expected generate.");
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

  throw usageError("Unknown plan command. Expected set or show.");
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
    requireOption(options.slice, "--slice");
    requireOption(options.body, "--body");
    const comment = await store.addComment(workstreamId, options.slice, options.body);
    console.log(formatComment(comment));
    return;
  }

  if (action === "list") {
    const [workstreamId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    expectNoExtraArgs(extra);
    const comments = await store.listComments(workstreamId);
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

  throw usageError("Unknown review command. Expected create, list, or show.");
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

function parseOptions(args: string[]): OptionMap {
  const options: OptionMap = {};

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];

    if (!flag.startsWith("--")) {
      throw usageError(`Unexpected argument '${flag}'.`);
    }

    if (!value || value.startsWith("--")) {
      throw usageError(`Missing value for ${flag}.`);
    }

    if (flag === "--title") {
      options.title = value;
    } else if (flag === "--description") {
      options.description = value;
    } else if (flag === "--file") {
      options.file = value;
    } else if (flag === "--slice") {
      options.slice = value;
    } else if (flag === "--body") {
      options.body = value;
    } else if (flag === "--summary") {
      options.summary = value;
    } else if (flag === "--base") {
      options.base = value;
    } else if (flag === "--depends-on") {
      options.dependsOn = [...(options.dependsOn ?? []), value];
    } else if (flag === "--kind") {
      options.kind = value;
    } else if (flag === "--path") {
      options.path = value;
    } else {
      throw usageError(`Unknown option '${flag}'.`);
    }

    index += 1;
  }

  return options;
}

function formatSlice(slice: Slice): string {
  const dependencies = slice.dependsOnSliceIds?.length ? `\tdepends-on:${slice.dependsOnSliceIds.join(",")}` : "";
  return `${slice.id}\t${slice.status}\t${slice.title}${dependencies}`;
}

function formatComment(comment: ReviewComment): string {
  const status = comment.resolved ? "resolved" : "open";
  const slice = comment.sliceId ?? "-";
  return `${comment.id}\t${status}\t${slice}\t${comment.body}`;
}

function formatReview(review: Review): string {
  return `${review.id}\t${review.status}\t${review.sliceId}\t${review.summary}`;
}

function formatEvidence(evidence: Evidence): string {
  const pathText = evidence.path ? `\t${evidence.path}` : "";
  return `${evidence.id}\t${evidence.kind}\t${evidence.sliceId}\t${evidence.description}${pathText}`;
}

function formatCurrentContext(context: CurrentContext): string {
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
      const sliceText = comment.sliceId ? `slice ${comment.sliceId}` : "workstream";
      lines.push(`- ${comment.id} (${sliceText}): ${comment.body}`);
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

function requireArgument(value: string | undefined, label: string): asserts value is string {
  if (!value) {
    throw usageError(`Missing ${label}.`);
  }
}

function requireOption(value: string | undefined, flag: string): asserts value is string {
  if (!value) {
    throw usageError(`Missing required option ${flag}.`);
  }
}

function expectNoExtraArgs(args: string[]): void {
  if (args.length > 0) {
    throw usageError(`Unexpected argument '${args[0]}'.`);
  }
}

function usageError(message: string): PathfinderError {
  return new PathfinderError(`${message} Run 'pathfinder help' for usage.`);
}

function printHelp(): void {
  console.log(`Pathfinder Stage 1

Usage:
  pathfinder init
  pathfinder current
  pathfinder workstream create --title "..."
  pathfinder workstream list
  pathfinder workstream show <id>
  pathfinder requirement set <workstream-id> --file ./requirements.md
  pathfinder requirement show <workstream-id>
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
  pathfinder comment list <workstream-id>
  pathfinder comment resolve <workstream-id> <comment-id>
  pathfinder review create <workstream-id> --slice <slice-id> --summary "..."
  pathfinder review list <workstream-id>
  pathfinder review show <workstream-id> <review-id>
  pathfinder evidence add <workstream-id> --slice <slice-id> --kind <kind> --description "..." [--path ./artifact.txt]
  pathfinder evidence list <workstream-id>
  pathfinder git diff [--base <base-ref>]
  pathfinder pr generate <workstream-id>`);
}
