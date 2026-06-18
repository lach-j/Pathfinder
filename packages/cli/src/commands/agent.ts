import {
  AgentPromptPhase,
  isAgentCommandTool,
  isAgentPromptPhase,
  isAgentUserInstallTool
} from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

import {
  formatAgentCommandsInstall,
  formatAgentCommandsList,
  formatAgentDoctor,
  formatAgentNext,
  formatAgentUserInstall
} from "../formatters.js";
import { expectNoExtraArgs, parseOptions, usageError } from "../options.js";
import { agentIgnoredDirtyPathPrefixes } from "./shared.js";

const store = new PathfinderStore(process.cwd());

export async function runAgent(action: string | undefined, args: string[]): Promise<void> {
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
