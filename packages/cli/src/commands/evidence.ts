import { PathfinderStore } from "@pathfinder/state";

import { formatEvidence } from "../formatters.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "../options.js";

const store = new PathfinderStore(process.cwd());

export async function runEvidence(action: string | undefined, args: string[]): Promise<void> {
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
