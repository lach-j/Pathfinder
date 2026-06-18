import { writeFile } from "node:fs/promises";
import path from "node:path";

import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

import { formatRepositorySummary } from "../formatters.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "../options.js";

const store = new PathfinderStore(process.cwd());

export async function runGit(action: string | undefined, args: string[]): Promise<void> {
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

export async function runPr(action: string | undefined, args: string[]): Promise<void> {
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

export async function runFeedback(action: string | undefined, args: string[]): Promise<void> {
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

    if (result.defaultPath) {
      await writeFile(result.defaultPath, result.markdown, "utf8");
      console.log(`Wrote feedback queue to ${result.defaultPath}.`);
      return;
    }

    process.stdout.write(result.markdown);
    return;
  }

  throw usageError("Unknown feedback command. Expected export.");
}

export async function runRequirement(action: string | undefined, args: string[]): Promise<void> {
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

export async function runWorkstream(action: string | undefined, args: string[]): Promise<void> {
  if (action === "create") {
    const options = parseOptions(args);
    requireOption(options.title, "--title");
    const workstream = await store.createWorkstream(options.title);
    console.log(`${workstream.id}\t${workstream.title}`);
    return;
  }

  if (action === "list") {
    const options = parseOptions(args);
    const workstreams = await store.listWorkstreams();
    if (options.json) {
      console.log(JSON.stringify(workstreams, null, 2));
      return;
    }
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
    const [id, ...optionArgs] = args;
    requireArgument(id, "workstream id");
    parseOptions(optionArgs);
    const workstream = await store.getWorkstream(id);
    console.log(JSON.stringify(workstream, null, 2));
    return;
  }

  throw usageError("Unknown workstream command. Expected create, list, or show.");
}

export async function runPlan(action: string | undefined, args: string[]): Promise<void> {
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
