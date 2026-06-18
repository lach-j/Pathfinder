import { PathfinderStore } from "@pathfinder/state";

import { runAgent } from "./commands/agent.js";
import { runFeedback, runGit, runPlan, runPr, runRequirement, runWorkstream } from "./commands/basic.js";
import { runBranchReview } from "./commands/branch-review.js";
import { runDiff } from "./commands/diff.js";
import { runEvidence } from "./commands/evidence.js";
import { runInit } from "./commands/init.js";
import { runAgentReview, runComment, runReview } from "./commands/review.js";
import { runSlice } from "./commands/slice.js";
import { runWorkspace } from "./commands/workspace.js";
import { formatCurrentContext } from "./formatters.js";
import { printHelp } from "./help.js";
import { expectNoExtraArgs, parseOptions, usageError } from "./options.js";

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
    await runInit(options, store);
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

  if (area === "agent-review") {
    await runAgentReview(action, rest);
    return;
  }

  if (area === "branch-review") {
    await runBranchReview(action, rest);
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
