import { writeFile } from "node:fs/promises";
import path from "node:path";

import { cancel, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import {
  AgentPromptPhase,
  AgentUserInstallTool,
  PathfinderError,
  ReviewCommentTarget,
  Slice,
  isAgentCommandTool,
  isAgentUserInstallTool,
  isAgentPromptPhase,
  isReviewCommentSide
} from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { serveReviewServer, serveWorkspaceServer } from "@pathfinder/local-server";
import { PathfinderStore } from "@pathfinder/state";

import {
  formatAgentNext,
  formatAgentDoctor,
  formatAgentCommandsInstall,
  formatAgentCommandsList,
  formatComment,
  formatCurrentContext,
  formatDeterministicReview,
  formatEvidence,
  formatRepositorySummary,
  formatReview,
  formatReviewApproval,
  formatReviewSession,
  formatReviewSessionSummary,
  formatAgentUserInstall,
  formatSlice,
  formatStructuredDiff
} from "./formatters.js";
import { printHelp } from "./help.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "./options.js";

const store = new PathfinderStore(process.cwd());

export async function run(args: string[]): Promise<void> {
  const [area, action, ...rest] = args;

  if (!area || area === "help" || area === "--help" || area === "-h") {
    printHelp(action);
    return;
  }

  if (action === "help" || action === "--help" || action === "-h") {
    printHelp(area);
    return;
  }

  if (area === "init") {
    const options = parseOptions([action, ...rest].filter((value): value is string => Boolean(value)));
    await runInit(options);
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

  if (area === "workspace") {
    await runWorkspace(action, rest);
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

  if (area === "agent") {
    await runAgent(action, rest);
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

type InitMode = "repo" | "personal";
type InitAgent = AgentUserInstallTool;

interface InitSetup {
  mode: InitMode;
  agents: InitAgent[];
  repoBootstrap: boolean;
  repoCommands: boolean;
}

const supportedInitAgents: readonly InitAgent[] = ["claude", "opencode", "codex"];

interface SliceBranchStartResult {
  branchName: string;
  updated: Slice;
  action: "created" | "checked_out";
}

async function runInit(options: ReturnType<typeof parseOptions>): Promise<void> {
  if (options.dryRun) {
    throw usageError("Unknown option '--dry-run'.");
  }

  if (options.tool) {
    throw usageError("Unknown option '--tool' for init. Use --user claude|opencode|codex|all with --personal.");
  }

  if (options.personal && options.repo) {
    throw usageError("Use either --personal or --repo, not both.");
  }

  if (options.personal && options.agents) {
    throw usageError("Use --personal --user claude|opencode|codex|all for personal agent setup.");
  }

  if (options.user && options.user !== "all" && !isAgentUserInstallTool(options.user)) {
    throw usageError("Invalid --user value. Expected claude, opencode, codex, or all.");
  }

  if (options.user && !options.personal) {
    throw usageError("Use --user only with --personal.");
  }

  const setup = shouldPromptForInit(options) ? await promptInitSetup() : getInitSetupFromOptions(options);
  await applyInitSetup(setup);
}

function shouldPromptForInit(options: ReturnType<typeof parseOptions>): boolean {
  if (options.interactive) {
    return true;
  }

  return (
    !options.personal &&
    !options.repo &&
    !options.agents &&
    !options.user &&
    Boolean(process.stdin.isTTY && process.stdout.isTTY)
  );
}

function getInitSetupFromOptions(options: ReturnType<typeof parseOptions>): InitSetup {
  const mode: InitMode = options.personal ? "personal" : "repo";
  const agents = initAgentsFromUserOption(options.user);

  return {
    mode,
    agents: mode === "personal" ? agents : [],
    repoBootstrap: mode === "repo" && Boolean(options.agents),
    repoCommands: false
  };
}

function initAgentsFromUserOption(user: string | undefined): InitAgent[] {
  if (!user) {
    return [];
  }

  if (user === "all") {
    return [...supportedInitAgents];
  }

  return isAgentUserInstallTool(user) ? [user] : [];
}

async function promptInitSetup(): Promise<InitSetup> {
  intro("Pathfinder setup");

  const mode = await select<InitMode>({
    message: "Where should Pathfinder store state for this repo?",
    initialValue: "personal",
    options: [
      {
        value: "personal",
        label: "Personal",
        hint: "Keep Pathfinder state and agent setup outside this repo"
      },
      {
        value: "repo",
        label: "Repo-local",
        hint: "Write .pathfinder/ and optional repo agent helpers"
      }
    ]
  });

  if (isCancel(mode)) {
    cancel("Setup cancelled.");
    process.exitCode = 1;
    throw new PathfinderError("Setup cancelled.");
  }

  const agents = await multiselect<InitAgent>({
    message: mode === "personal"
      ? "Install user-level instructions for which agents?"
      : "Install repo-local helpers for which agents?",
    required: false,
    initialValues: ["claude"],
    options: [
      {
        value: "claude",
        label: "Claude Code"
      },
      {
        value: "opencode",
        label: "OpenCode"
      },
      {
        value: "codex",
        label: "Codex"
      }
    ]
  });

  if (isCancel(agents)) {
    cancel("Setup cancelled.");
    process.exitCode = 1;
    throw new PathfinderError("Setup cancelled.");
  }

  outro("Setup choices saved.");

  return {
    mode,
    agents,
    repoBootstrap: mode === "repo" && agents.length > 0,
    repoCommands: mode === "repo" && agents.length > 0
  };
}

async function applyInitSetup(setup: InitSetup): Promise<void> {
  if (setup.mode === "repo" && setup.repoBootstrap) {
    try {
      const project = await store.initProject();
      console.log(`Initialised Pathfinder for ${project.name}.`);
    } catch (error) {
      if (!(error instanceof PathfinderError && error.message === "Pathfinder state already exists in this repository.")) {
        throw error;
      }
    }
  } else {
    const project = await store.initProject({ personal: setup.mode === "personal" });
    console.log(`Initialised Pathfinder for ${project.name}.`);
  }

  if (setup.mode === "personal") {
    console.log("State: personal external Pathfinder state.");
    for (const tool of setup.agents) {
      const result = await store.installUserAgentIntegration({ tool });
      process.stdout.write(formatAgentUserInstall(result));
    }
    return;
  }

  console.log("State: repo-local .pathfinder/.");
  if (setup.repoBootstrap) {
    const result = await store.bootstrapAgentInstructions();
    console.log(`${result.changed ? "Updated" : "No changes needed for"} ${result.path}.`);
  }

  if (setup.repoCommands) {
    for (const tool of setup.agents) {
      if (!isAgentCommandTool(tool)) {
        continue;
      }

      const result = await store.installAgentCommands({ tool });
      process.stdout.write(formatAgentCommandsInstall(result));
    }
  }
}

async function runAgent(action: string | undefined, args: string[]): Promise<void> {
  if (action === "install") {
    const options = parseOptions(args);
    if (!options.user) {
      throw usageError("Missing required option --user.");
    }
    if (options.user !== "all" && !isAgentUserInstallTool(options.user)) {
      throw usageError("Invalid --user value. Expected claude, opencode, codex, or all.");
    }

    const tool = options.user === "all" ? undefined : options.user;
    const result = await store.installUserAgentIntegration({
      tool,
      dryRun: options.dryRun
    });
    process.stdout.write(formatAgentUserInstall(result));
    return;
  }

  if (action === "commands") {
    const [commandAction, ...commandArgs] = args;

    if (commandAction === "install") {
      const options = parseOptions(commandArgs);
      if (options.tool && !isAgentCommandTool(options.tool)) {
        throw usageError("Invalid --tool value. Expected claude or opencode.");
      }
      const tool = options.tool && isAgentCommandTool(options.tool) ? options.tool : undefined;
      const result = await store.installAgentCommands({
        tool,
        dryRun: options.dryRun
      });
      process.stdout.write(formatAgentCommandsInstall(result));
      return;
    }

    if (commandAction === "list") {
      expectNoExtraArgs(commandArgs);
      process.stdout.write(formatAgentCommandsList(await store.listAgentCommands()));
      return;
    }

    throw usageError("Unknown agent commands command. Expected install or list.");
  }

  if (action === "bootstrap") {
    const options = parseOptions(args);
    const result = await store.bootstrapAgentInstructions({ dryRun: options.dryRun });

    if (options.dryRun) {
      process.stdout.write(result.markdown);
      return;
    }

    console.log(`${result.changed ? "Updated" : "No changes needed for"} ${result.path}.`);
    return;
  }

  if (action === "next") {
    const options = parseOptions(args);
    const git = new GitAdapter({ cwd: process.cwd() });
    const recommendation = await store.getAgentNext(
      (baseRef) => git.getCommittedSummaryAgainstBase(baseRef),
      () => git.getSuggestedBaseRef(),
      () => git.hasUncommittedChangesOutside(agentIgnoredDirtyPathPrefixes())
    );

    if (options.json) {
      console.log(JSON.stringify(recommendation, null, 2));
      return;
    }

    process.stdout.write(formatAgentNext(recommendation));
    return;
  }

  if (action === "doctor") {
    const options = parseOptions(args);
    const git = new GitAdapter({ cwd: process.cwd() });
    const result = await store.getAgentDoctor(
      (baseRef) => git.getCommittedSummaryAgainstBase(baseRef),
      () => git.hasUncommittedChangesOutside(agentIgnoredDirtyPathPrefixes()),
      { personal: options.personal }
    );

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    process.stdout.write(formatAgentDoctor(result));
    return;
  }

  if (action === "prompt") {
    const options = parseOptions(args);
    const git = new GitAdapter({ cwd: process.cwd() });

    let promptPhase: AgentPromptPhase | undefined;
    if (options.phase) {
      if (!isAgentPromptPhase(options.phase)) {
        throw usageError("Invalid --phase value. Expected plan, implement, feedback, review, or pr.");
      }
      promptPhase = options.phase as AgentPromptPhase;
    }

    const prompt = await store.getAgentPrompt(
      promptPhase,
      (baseRef) => git.getCommittedSummaryAgainstBase(baseRef),
      () => git.getSuggestedBaseRef(),
      () => git.hasUncommittedChangesOutside(agentIgnoredDirtyPathPrefixes())
    );
    process.stdout.write(prompt);
    return;
  }

  throw usageError("Unknown agent command. Expected bootstrap, commands, doctor, install, next, or prompt.");
}

function agentIgnoredDirtyPathPrefixes(): string[] {
  return [".pathfinder/", ".pathfinder-feedback.md"];
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
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const slices = await store.listSlices(workstreamId);
    if (options.json) {
      console.log(JSON.stringify(slices, null, 2));
      return;
    }
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
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const slice = await store.getNextSlice(workstreamId);

    if (!slice) {
      if (options.json) {
        console.log("null");
        return;
      }
      console.log("No actionable slices found. Proposed or ready slices may be blocked by incomplete dependencies.");
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(slice, null, 2));
      return;
    }

    console.log(formatSlice(slice));
    console.log(`Start slice: pathfinder slice start ${workstreamId} ${slice.id} --base <base-ref>`);
    console.log(`Set active manually: pathfinder slice active ${workstreamId} ${slice.id}`);
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
    const { branchName, updated, action: branchAction } = await startSliceBranch(workstreamId, sliceId, options.base);
    console.log(`${branchAction === "created" ? "Started" : "Checked out"} branch ${branchName} for slice ${workstreamId}/${updated.id}.`);
    return;
  }

  if (action === "start") {
    const [workstreamId, sliceId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    const options = parseOptions(optionArgs);
    requireOption(options.base, "--base");
    const { branchName, updated, action: branchAction } = await startSliceBranch(workstreamId, sliceId, options.base);
    const active = await store.setActiveSlice(workstreamId, sliceId);
    console.log(`${branchAction === "created" ? "Started" : "Checked out"} branch ${branchName} for slice ${workstreamId}/${updated.id}.`);
    console.log(`Active slice: ${active.workstream.id}/${active.slice.id}`);
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

  throw usageError("Unknown slice command. Expected add, list, active, depend, next, status, branch, start, or show-active.");
}

async function startSliceBranch(
  workstreamId: string,
  sliceId: string,
  baseRef: string
): Promise<SliceBranchStartResult> {
  const slices = await store.listSlices(workstreamId);
  const slice = slices.find((candidate) => candidate.id === sliceId);

  if (!slice) {
    throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
  }

  if (slice.baseRef && slice.baseRef !== baseRef) {
    throw new PathfinderError(
      `Slice '${sliceId}' is already recorded with base ref '${slice.baseRef}'. Refusing to start it from '${baseRef}'.`
    );
  }

  const git = new GitAdapter({ cwd: process.cwd() });
  if (!(await git.hasCommits())) {
    throw new PathfinderError(
      "Cannot start a slice branch because this repository has no commits. Create an initial baseline commit first."
    );
  }

  if (await git.hasUncommittedChanges()) {
    throw new PathfinderError(
      "Cannot start a slice branch with uncommitted changes. Commit, stash, or remove local changes first."
    );
  }

  const branchName = slice.branchName ?? `pathfinder/${workstreamId}/${sliceId}`;
  const action = await git.createOrCheckoutBranch(branchName, baseRef);
  const updated = await store.setSliceBranchMetadata(workstreamId, sliceId, {
    branchName,
    baseRef
  });

  return { branchName, updated, action };
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

async function runWorkspace(action: string | undefined, args: string[]): Promise<void> {
  if (action === "serve") {
    const options = parseOptions(args);
    const port = parsePort(options.port);
    await serveWorkspaceServer({ port });
    return;
  }

  throw usageError("Unknown workspace command. Expected serve.");
}

async function requireBaselineCommit(git: GitAdapter, action: string): Promise<void> {
  if (!(await git.hasCommits())) {
    throw new PathfinderError(
      `Cannot ${action} because this repository has no commits. Create a first baseline commit before using committed-diff review.`
    );
  }
}

async function requireCleanCommittedReviewRepo(git: GitAdapter, action: string): Promise<void> {
  await requireBaselineCommit(git, action);
  if (await git.hasUncommittedChanges()) {
    throw new PathfinderError(
      `Cannot ${action} with uncommitted changes. Commit the slice changes, stash or remove unrelated changes, then rerun the review command.`
    );
  }
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

