import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

import { formatStructuredDiff } from "../formatters.js";
import { parseOptions, requireOption, usageError } from "../options.js";

const store = new PathfinderStore(process.cwd());

export async function runDiff(action: string | undefined, args: string[]): Promise<void> {
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

export async function getStructuredDiffForSession(git: GitAdapter, sessionId: string | undefined) {
  requireOption(sessionId, "--session");
  const session = await store.findReviewSession(sessionId);
  return git.getStructuredDiffBetweenRefs(session.mergeBase, session.headCommit);
}
