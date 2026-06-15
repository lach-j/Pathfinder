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

  async hasUncommittedChangesOutside(ignoredPathPrefixes: string[]): Promise<boolean> {
    await this.requireGitRepository();
    const result = await this.runGit(["status", "--porcelain"]);
    const changedPaths = parsePorcelainChangedPaths(result.stdout);
    return changedPaths.some((changedPath) =>
      !ignoredPathPrefixes.some((prefix) => changedPath === prefix || changedPath.startsWith(prefix))
    );
  }

  async hasCommits(): Promise<boolean> {
    await this.requireGitRepository();
    return this.isCommit("HEAD");
  }

  async getSuggestedBaseRef(): Promise<string | undefined> {
    await this.requireGitRepository();

    const remoteDefault = await this.tryRunGit(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    const remoteDefaultRef = remoteDefault?.stdout.trim().replace(/^origin\//, "");
    if (remoteDefaultRef && await this.isCommit(remoteDefaultRef)) {
      return remoteDefaultRef;
    }

    for (const candidate of ["main", "master"]) {
      if (await this.isCommit(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  async createAndCheckoutBranch(branchName: string, baseRef: string): Promise<void> {
    await this.requireGitRepository();
    await this.resolveCommit(baseRef);
    await this.runGit(["checkout", "-b", branchName, baseRef]);
  }

  async createOrCheckoutBranch(branchName: string, baseRef: string): Promise<"created" | "checked_out"> {
    await this.requireGitRepository();
    await this.requireAnyCommit();
    await this.resolveCommit(baseRef);

    if (await this.branchExists(branchName)) {
      await this.runGit(["checkout", branchName]);
      return "checked_out";
    }

    await this.runGit(["checkout", "-b", branchName, baseRef]);
    return "created";
  }

  private async requireGitRepository(): Promise<void> {
    const result = await this.runGit(["rev-parse", "--is-inside-work-tree"]);
    if (result.stdout.trim() !== "true") {
      throw new PathfinderError("This command must be run inside a Git repository.");
    }
  }

  private async requireAnyCommit(): Promise<void> {
    if (!(await this.hasCommits())) {
      throw new PathfinderError(
        "Cannot start a slice branch because this repository has no commits. Create an initial baseline commit first."
      );
    }
  }

  private async resolveCommit(ref: string): Promise<void> {
    try {
      await this.runGit(["rev-parse", "--verify", `${ref}^{commit}`]);
    } catch {
      throw new PathfinderError(`Base ref '${ref}' was not found or is not a commit.`);
    }
  }

  private async branchExists(branchName: string): Promise<boolean> {
    return (await this.tryRunGit(["rev-parse", "--verify", `refs/heads/${branchName}`])) !== undefined;
  }

  private async isCommit(ref: string): Promise<boolean> {
    return (await this.tryRunGit(["rev-parse", "--verify", `${ref}^{commit}`])) !== undefined;
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

  private async tryRunGit(args: string[]): Promise<{ stdout: string; stderr: string } | undefined> {
    try {
      return await this.runGit(args);
    } catch {
      return undefined;
    }
  }
}

function parsePorcelainChangedPaths(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .flatMap((line) => {
      const statusPath = line.slice(3);
      const renameSeparator = " -> ";
      if (statusPath.includes(renameSeparator)) {
        const [from, to] = statusPath.split(renameSeparator);
        return [from, to].filter((value): value is string => Boolean(value));
      }

      return [statusPath];
    });
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
