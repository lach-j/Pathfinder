import { cancel, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import {
  isAgentCommandTool,
  isAgentUserInstallTool,
  PathfinderError
} from "@pathfinder/core";
import type { PathfinderStore } from "@pathfinder/state";

import type { InitAgent, InitMode, InitSetup } from "../command-types.js";
import { formatAgentCommandsInstall, formatAgentUserInstall } from "../formatters.js";
import { parseOptions, usageError } from "../options.js";

const supportedInitAgents: readonly InitAgent[] = ["claude", "opencode", "codex"];

export async function runInit(
  options: ReturnType<typeof parseOptions>,
  store: PathfinderStore
): Promise<void> {
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
  await applyInitSetup(setup, store);
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

async function applyInitSetup(setup: InitSetup, store: PathfinderStore): Promise<void> {
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
