import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { PathfinderError } from "@pathfinder/core";

const execFileAsync = promisify(execFile);

export interface GitAdapterOptions {
  cwd?: string;
  gitBinary?: string;
}

export class GitAdapter {
  private readonly cwd: string;
  private readonly gitBinary: string;

  constructor(options: GitAdapterOptions = {}) {
    this.cwd = path.resolve(options.cwd ?? process.cwd());
    this.gitBinary = options.gitBinary ?? "git";
  }

  async getWorkingTreeDiff(): Promise<string> {
    await this.requireGitRepository();
    const result = await this.runGit(["diff"]);
    return result.stdout;
  }

  private async requireGitRepository(): Promise<void> {
    const result = await this.runGit(["rev-parse", "--is-inside-work-tree"]);
    if (result.stdout.trim() !== "true") {
      throw new PathfinderError("This command must be run inside a Git repository.");
    }
  }

  private async runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync(this.gitBinary, args, {
        cwd: this.cwd,
        encoding: "utf8",
        maxBuffer: 50 * 1024 * 1024
      });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new PathfinderError("Git executable not found. Install Git and ensure it is available on PATH.");
      }

      const message = commandErrorMessage(error);
      if (message.includes("not a git repository")) {
        throw new PathfinderError("This command must be run inside a Git repository.");
      }

      throw new PathfinderError(`Git command failed: ${message}`);
    }
  }
}

function commandErrorMessage(error: unknown): string {
  if (hasStderr(error) && error.stderr.trim()) {
    return error.stderr.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "unknown error";
}

function hasStderr(error: unknown): error is { stderr: string } {
  return typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
