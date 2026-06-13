import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { parseUnifiedDiff, PathfinderError, RepositorySummary, StructuredDiff } from "@pathfinder/core";

import { parseNameStatus } from "./name-status.js";

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

  async getCommittedDiffAgainstBase(baseRef: string): Promise<string> {
    await this.requireGitRepository();
    await this.resolveCommit(baseRef);
    const mergeBase = (await this.runGit(["merge-base", baseRef, "HEAD"])).stdout.trim();
    const result = await this.runGit(["diff", `${mergeBase}..HEAD`]);
    return result.stdout;
  }

  async getStructuredDiffAgainstBase(baseRef: string): Promise<StructuredDiff> {
    await this.requireGitRepository();
    await this.resolveCommit(baseRef);
    const mergeBase = (await this.runGit(["merge-base", baseRef, "HEAD"])).stdout.trim();
    const result = await this.runGit(["diff", "--find-renames", `${mergeBase}..HEAD`]);
    return parseUnifiedDiff(result.stdout);
  }

  async getStructuredDiffBetweenRefs(baseRef: string, headRef: string): Promise<StructuredDiff> {
    await this.requireGitRepository();
    await this.resolveCommit(baseRef);
    await this.resolveCommit(headRef);
    const result = await this.runGit(["diff", "--find-renames", `${baseRef}..${headRef}`]);
    return parseUnifiedDiff(result.stdout);
  }

  async getCommittedSummaryAgainstBase(baseRef: string): Promise<RepositorySummary> {
    await this.requireGitRepository();
    await this.resolveCommit(baseRef);
    const mergeBase = (await this.runGit(["merge-base", baseRef, "HEAD"])).stdout.trim();
    const headCommit = (await this.runGit(["rev-parse", "--short", "HEAD"])).stdout.trim();
    const branchName = (await this.runGit(["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    const nameStatus = (await this.runGit(["diff", "--name-status", "--find-renames", `${mergeBase}..HEAD`]))
      .stdout;

    return {
      baseRef,
      headRef: branchName === "HEAD" ? headCommit : branchName,
      headCommit,
      mergeBase,
      files: parseNameStatus(nameStatus)
    };
  }

  async hasUncommittedChanges(): Promise<boolean> {
    await this.requireGitRepository();
    const result = await this.runGit(["status", "--porcelain"]);
    return result.stdout.trim().length > 0;
  }

  async createAndCheckoutBranch(branchName: string, baseRef: string): Promise<void> {
    await this.requireGitRepository();
    await this.resolveCommit(baseRef);
    await this.runGit(["checkout", "-b", branchName, baseRef]);
  }

  private async requireGitRepository(): Promise<void> {
    const result = await this.runGit(["rev-parse", "--is-inside-work-tree"]);
    if (result.stdout.trim() !== "true") {
      throw new PathfinderError("This command must be run inside a Git repository.");
    }
  }

  private async resolveCommit(ref: string): Promise<void> {
    try {
      await this.runGit(["rev-parse", "--verify", `${ref}^{commit}`]);
    } catch {
      throw new PathfinderError(`Base ref '${ref}' was not found or is not a commit.`);
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
