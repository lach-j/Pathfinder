import { serveWorkspaceServer } from "./review-server.js";

interface DevOptions {
  cwd?: string;
  port?: number;
}

const options = parseOptions(process.argv.slice(2));

await serveWorkspaceServer({
  cwd: options.cwd,
  port: options.port
});

function parseOptions(args: string[]): DevOptions {
  const options: DevOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (arg === "--cwd") {
      if (!value) {
        throw new Error("Missing value for --cwd.");
      }
      options.cwd = value;
      index += 1;
      continue;
    }

    if (arg === "--port") {
      if (!value) {
        throw new Error("Missing value for --port.");
      }
      options.port = parsePort(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option '${arg}'. Expected --cwd or --port.`);
  }

  return options;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid --port value. Expected an integer between 1 and 65535.");
  }

  return port;
}
