import { PathfinderError } from "@pathfinder/core";

export interface OptionMap {
  title?: string;
  description?: string;
  file?: string;
  slice?: string;
  body?: string;
  summary?: string;
  base?: string;
  port?: string;
  session?: string;
  line?: string;
  side?: string;
  json?: boolean;
  open?: boolean;
  dependsOn?: string[];
  kind?: string;
  path?: string;
}

export function parseOptions(args: string[]): OptionMap {
  const options: OptionMap = {};

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];

    if (!flag.startsWith("--")) {
      throw usageError(`Unexpected argument '${flag}'.`);
    }

    if (flag === "--json") {
      options.json = true;
      continue;
    }

    if (flag === "--open") {
      options.open = true;
      continue;
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
    } else if (flag === "--port") {
      options.port = value;
    } else if (flag === "--session") {
      options.session = value;
    } else if (flag === "--line") {
      options.line = value;
    } else if (flag === "--side") {
      options.side = value;
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

export function requireArgument(value: string | undefined, label: string): asserts value is string {
  if (!value) {
    throw usageError(`Missing ${label}.`);
  }
}

export function requireOption(value: string | undefined, flag: string): asserts value is string {
  if (!value) {
    throw usageError(`Missing required option ${flag}.`);
  }
}

export function expectNoExtraArgs(args: string[]): void {
  if (args.length > 0) {
    throw usageError(`Unexpected argument '${args[0]}'.`);
  }
}

export function usageError(message: string): PathfinderError {
  return new PathfinderError(`${message} Run 'pathfinder help' for usage.`);
}
