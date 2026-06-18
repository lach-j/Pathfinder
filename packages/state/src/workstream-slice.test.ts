import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PathfinderError } from "@pathfinder/core";

import { PathfinderStore } from "./index.js";

import {
  createTempRepo,
  duplicateTitleStagePlan,
  sampleStagePlan,
  sortedFiles,
  structuredDiff,
  structuredDiffFile
} from "./state-test-helpers.js";

test("creates workstreams with markdown and JSON state files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();

  const workstream = await store.createWorkstream("Add Billing");

  assert.equal(workstream.id, "add-billing");
  assert.deepEqual(
    await sortedFiles(path.join(repo, ".pathfinder", "workstreams", workstream.id)),
    [
      "comments.json",
      "evidence.json",
      "plan.md",
      "pr.md",
      "requirements.md",
      "review-sessions.json",
      "reviews.json",
      "slices.json",
      "workstream.json"
    ]
  );
});

test("stores requirements as markdown and handles legacy missing files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Requirements Flow");
  const requirementsPath = path.join(repo, "requirements.md");
  await writeFile(requirementsPath, "# Requirements\n\nKeep original text intact.\n", "utf8");

  await store.setRequirementsFromFile(workstream.id, requirementsPath);

  assert.equal(await store.getRequirements(workstream.id), "# Requirements\n\nKeep original text intact.\n");

  await rm(path.join(repo, ".pathfinder", "workstreams", workstream.id, "requirements.md"));

  assert.equal(await store.getRequirements(workstream.id), "");

  await store.setRequirementsFromFile(workstream.id, requirementsPath);

  assert.equal(await store.getRequirements(workstream.id), "# Requirements\n\nKeep original text intact.\n");
});

test("stores plans as markdown and tracks active slices", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Stage One");
  const planPath = path.join(repo, "plan.md");
  await writeFile(planPath, "# Plan\n\nKeep markdown intact.\n", "utf8");

  await store.setPlanFromFile(workstream.id, planPath);
  const slice = await store.addSlice(workstream.id, "Create State", "Add local files.");
  const active = await store.setActiveSlice(workstream.id, slice.id);

  assert.equal(await store.getPlan(workstream.id), "# Plan\n\nKeep markdown intact.\n");
  assert.equal(active.slice.id, "create-state");
  assert.equal((await store.getActiveSlice())?.slice.title, "Create State");
});

test("imports a stored stage plan into workstream, plan, and slices", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const planPath = path.join(repo, "PLAN.md");
  const markdown = sampleStagePlan();
  await writeFile(planPath, markdown, "utf8");

  const result = await store.importStagePlanFromFile("./PLAN.md");
  const storedPlan = await readFile(
    path.join(repo, ".pathfinder", "workstreams", result.workstream.id, "plan.md"),
    "utf8"
  );
  const slices = await store.listSlices(result.workstream.id);

  assert.equal(result.workstream.id, "inventory-alerts");
  assert.equal(result.workstream.title, "Inventory Alerts");
  assert.equal(storedPlan, markdown);
  assert.deepEqual(
    slices.map((slice) => [slice.id, slice.title, slice.status]),
    [
      ["add-data-source", "Add Data Source", "proposed"],
      ["add-report", "Add Report", "proposed"]
    ]
  );
  assert.match(slices[0].description, /\*\*Acceptance criteria:\*\* Data loads from disk\./);
  assert.match(slices[1].description, /\*\*Depends on:\*\* Stage 1 data source\./);
  assert.equal(slices[1].dependsOnSliceIds, undefined);
});

test("imports duplicate stage titles with unique slice ids", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  await writeFile(path.join(repo, "PLAN.md"), duplicateTitleStagePlan(), "utf8");

  const result = await store.importStagePlanFromFile("./PLAN.md");
  const slices = await store.listSlices(result.workstream.id);

  assert.deepEqual(
    slices.map((slice) => slice.id),
    ["add-report", "add-report-2", "add-report-3"]
  );
});

test("stage plan import validates missing files and failed parses before creating state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  await writeFile(path.join(repo, "PLAN.md"), "# Inventory Alerts - Stage Plan\n\n## Context\nNo stages.\n", "utf8");

  await assert.rejects(() => store.importStagePlanFromFile("./missing.md"), /Plan file not found/);
  await assert.rejects(() => store.importStagePlanFromFile("./PLAN.md"), /no '## Stage N:' sections/);

  assert.deepEqual(await store.listWorkstreams(), []);
});

test("updates slice status and branch metadata in human-readable state", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Slice Lifecycle");
  const slice = await store.addSlice(workstream.id, "Create Branch", "Track local branch state.");

  const updatedStatus = await store.updateSliceStatus(workstream.id, slice.id, "complete");
  const updatedBranch = await store.setSliceBranchMetadata(workstream.id, slice.id, {
    branchName: "pathfinder/slice-lifecycle/create-branch",
    baseRef: "main",
    startedAt: "2026-01-01T00:00:00.000Z"
  });
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "slices.json"),
    "utf8"
  );

  assert.equal(updatedStatus.status, "complete");
  assert.equal(updatedBranch.branchName, "pathfinder/slice-lifecycle/create-branch");
  assert.equal(updatedBranch.baseRef, "main");
  assert.equal(updatedBranch.startedAt, "2026-01-01T00:00:00.000Z");
  assert.match(stored, /"status": "complete"/);
  assert.match(stored, /"branchName": "pathfinder\/slice-lifecycle\/create-branch"/);
});

test("stores slice dependencies and selects the next actionable slice", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Dependencies");
  const first = await store.addSlice(workstream.id, "Add Data Source", "Create local data.");
  const second = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.", [
    first.id
  ]);
  const stored = await readFile(
    path.join(repo, ".pathfinder", "workstreams", workstream.id, "slices.json"),
    "utf8"
  );

  assert.deepEqual(second.dependsOnSliceIds, [first.id]);
  assert.match(stored, /"dependsOnSliceIds": \[/);
  assert.equal((await store.getNextSlice(workstream.id))?.id, first.id);

  await store.updateSliceStatus(workstream.id, first.id, "complete");

  assert.equal((await store.getNextSlice(workstream.id))?.id, second.id);
});

test("adds slice dependencies after creation", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Dependencies");
  const first = await store.addSlice(workstream.id, "Add Data Source", "Create local data.");
  const second = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.");

  const updated = await store.addSliceDependency(workstream.id, second.id, first.id);

  assert.deepEqual(updated.dependsOnSliceIds, [first.id]);
});

test("validates slice dependencies", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Dependencies");
  const first = await store.addSlice(workstream.id, "Add Data Source", "Create local data.");
  const second = await store.addSlice(workstream.id, "Add Report", "Report reorder candidates.");

  await assert.rejects(
    () => store.addSlice(workstream.id, "Invalid", "Missing dependency.", ["missing"]),
    PathfinderError
  );
  await assert.rejects(() => store.addSliceDependency(workstream.id, second.id, second.id), PathfinderError);
  await assert.rejects(() => store.addSliceDependency(workstream.id, second.id, "missing"), PathfinderError);

  await store.addSliceDependency(workstream.id, second.id, first.id);

  await assert.rejects(() => store.addSliceDependency(workstream.id, second.id, first.id), PathfinderError);
  await assert.rejects(
    () => store.addSlice(workstream.id, "Duplicate", "Duplicate dependency.", [first.id, first.id]),
    PathfinderError
  );
});

test("validates slice status updates", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();
  const workstream = await store.createWorkstream("Slice Lifecycle");
  const slice = await store.addSlice(workstream.id, "Create Branch", "Track local branch state.");

  await assert.rejects(() => store.updateSliceStatus(workstream.id, slice.id, "blocked"), PathfinderError);
  await assert.rejects(() => store.updateSliceStatus(workstream.id, "missing", "complete"), PathfinderError);
});
