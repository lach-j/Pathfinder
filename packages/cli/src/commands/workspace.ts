import { serveWorkspaceServer } from "@pathfinder/local-server";

import { parseOptions, usageError } from "../options.js";
import { parsePort } from "./review-helpers.js";

export async function runWorkspace(action: string | undefined, args: string[]): Promise<void> {
  if (action === "serve") {
    const options = parseOptions(args);
    const port = parsePort(options.port);
    await serveWorkspaceServer({ port });
    return;
  }

  throw usageError("Unknown workspace command. Expected serve.");
}
