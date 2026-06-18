import { PathfinderError, Slice } from "@pathfinder/core";
import { GitAdapter } from "@pathfinder/git";
import { PathfinderStore } from "@pathfinder/state";

import type { SliceBranchStartResult } from "../command-types.js";
import { formatSlice } from "../formatters.js";
import { expectNoExtraArgs, parseOptions, requireArgument, requireOption, usageError } from "../options.js";

const store = new PathfinderStore(process.cwd());

export async function runSlice(action: string | undefined, args: string[]): Promise<void> {
  if (action === "add") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    requireOption(options.title, "--title");
    requireOption(options.description, "--description");
    const slice = await store.addSlice(workstreamId, options.title, options.description, options.dependsOn ?? []);
    console.log(formatSlice(slice));
    return;
  }

  if (action === "list") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const slices = await store.listSlices(workstreamId);
    if (options.json) {
      console.log(JSON.stringify(slices, null, 2));
      return;
    }
    if (slices.length === 0) {
      console.log("No slices found.");
      return;
    }
    for (const slice of slices) {
      console.log(formatSlice(slice));
    }
    return;
  }

  if (action === "active") {
    const [workstreamId, sliceId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    expectNoExtraArgs(extra);
    const active = await store.setActiveSlice(workstreamId, sliceId);
    console.log(`Active slice: ${active.workstream.id}/${active.slice.id}`);
    return;
  }

  if (action === "depend") {
    const [workstreamId, sliceId, dependencySliceId, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    requireArgument(dependencySliceId, "dependency slice id");
    expectNoExtraArgs(extra);
    const slice = await store.addSliceDependency(workstreamId, sliceId, dependencySliceId);
    console.log(formatSlice(slice));
    return;
  }

  if (action === "next") {
    const [workstreamId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    const options = parseOptions(optionArgs);
    const slice = await store.getNextSlice(workstreamId);

    if (!slice) {
      if (options.json) {
        console.log("null");
        return;
      }
      console.log("No actionable slices found. Proposed or ready slices may be blocked by incomplete dependencies.");
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(slice, null, 2));
      return;
    }

    console.log(formatSlice(slice));
    console.log(`Start slice: pathfinder slice start ${workstreamId} ${slice.id} --base <base-ref>`);
    console.log(`Set active manually: pathfinder slice active ${workstreamId} ${slice.id}`);
    return;
  }

  if (action === "status") {
    const [workstreamId, sliceId, status, ...extra] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    requireArgument(status, "slice status");
    expectNoExtraArgs(extra);
    const slice = await store.updateSliceStatus(workstreamId, sliceId, status);
    console.log(formatSlice(slice));
    return;
  }

  if (action === "branch") {
    const [workstreamId, sliceId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    const options = parseOptions(optionArgs);
    requireOption(options.base, "--base");
    const { branchName, updated, action: branchAction } = await startSliceBranch(workstreamId, sliceId, options.base, {
      branch: options.branch
    });
    console.log(`${branchAction === "created" ? "Started" : "Checked out"} branch ${branchName} for slice ${workstreamId}/${updated.id}.`);
    return;
  }

  if (action === "start") {
    const [workstreamId, sliceId, ...optionArgs] = args;
    requireArgument(workstreamId, "workstream id");
    requireArgument(sliceId, "slice id");
    const options = parseOptions(optionArgs);
    requireOption(options.base, "--base");
    const { branchName, updated, action: branchAction } = await startSliceBranch(workstreamId, sliceId, options.base, {
      branch: options.branch
    });
    const active = await store.setActiveSlice(workstreamId, sliceId);
    console.log(`${branchAction === "created" ? "Started" : "Checked out"} branch ${branchName} for slice ${workstreamId}/${updated.id}.`);
    console.log(`Active slice: ${active.workstream.id}/${active.slice.id}`);
    return;
  }

  if (action === "show-active") {
    expectNoExtraArgs(args);
    const active = await store.getActiveSlice();
    if (!active) {
      console.log("No active slice set.");
      return;
    }
    console.log(`Workstream: ${active.workstream.id}\t${active.workstream.title}`);
    console.log(formatSlice(active.slice));
    console.log(active.slice.description);
    return;
  }

  throw usageError("Unknown slice command. Expected add, list, active, depend, next, status, branch, start, or show-active.");
}

async function startSliceBranch(
  workstreamId: string,
  sliceId: string,
  baseRef: string,
  options: { branch?: string } = {}
): Promise<SliceBranchStartResult> {
  const slices = await store.listSlices(workstreamId);
  const slice = slices.find((candidate) => candidate.id === sliceId);

  if (!slice) {
    throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
  }

  if (slice.baseRef && slice.baseRef !== baseRef) {
    throw new PathfinderError(
      `Slice '${sliceId}' is already recorded with base ref '${slice.baseRef}'. Refusing to start it from '${baseRef}'.`
    );
  }

  const git = new GitAdapter({ cwd: process.cwd() });
  if (!(await git.hasCommits())) {
    throw new PathfinderError(
      "Cannot start a slice branch because this repository has no commits. Create an initial baseline commit first."
    );
  }

  if (await git.hasUncommittedChanges()) {
    throw new PathfinderError(
      "Cannot start a slice branch with uncommitted changes. Commit, stash, or remove local changes first."
    );
  }

  const requestedBranchName = branchNameFromOptions(options);
  if (slice.branchName && requestedBranchName && slice.branchName !== requestedBranchName) {
    throw new PathfinderError(
      `Slice '${sliceId}' is already recorded with branch '${slice.branchName}'. Refusing to start it as '${requestedBranchName}'.`
    );
  }

  const branchName = slice.branchName ?? requestedBranchName ?? `pathfinder/${workstreamId}/${sliceId}`;
  const action = await git.createOrCheckoutBranch(branchName, baseRef);
  const updated = await store.setSliceBranchMetadata(workstreamId, sliceId, {
    branchName,
    baseRef
  });

  return { branchName, updated, action };
}

function branchNameFromOptions(options: { branch?: string }): string | undefined {
  return options.branch ? validateBranchNameInput(options.branch, "--branch") : undefined;
}

function validateBranchNameInput(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new PathfinderError(`${label} must not be empty.`);
  }

  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(trimmed) || trimmed.includes("..") || trimmed.endsWith(".") || trimmed.endsWith("/")) {
    throw new PathfinderError(`${label} is not a valid branch name segment.`);
  }

  return trimmed;
}
