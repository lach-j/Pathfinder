#!/usr/bin/env node
import { PathfinderError } from "@pathfinder/core";

import { run } from "./app.js";

run(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof PathfinderError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
