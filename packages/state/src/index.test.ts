import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PathfinderError } from "@pathfinder/core";

import { PathfinderStore } from "./index.js";

test("initialises Pathfinder state inside a Git repository", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  const project = await store.initProject();

  assert.equal(project.name, path.basename(repo));
  assert.equal(project.schemaVersion, 1);
  assert.match(await readFile(path.join(repo, ".pathfinder", "project.json"), "utf8"), /"schemaVersion": 1/);
});

test("creates workstreams with markdown and JSON state files", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);
  await store.initProject();

  const workstream = await store.createWorkstream("Add Billing");

  assert.equal(workstream.id, "add-billing");
  assert.deepEqual(
    await sortedFiles(path.join(repo, ".pathfinder", "workstreams", workstream.id)),
    ["comments.json", "plan.md", "pr.md", "reviews.json", "slices.json", "workstream.json"]
  );
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

test("fails clearly before init", async () => {
  const repo = await createTempRepo();
  const store = new PathfinderStore(repo);

  await assert.rejects(() => store.listWorkstreams(), PathfinderError);
});

async function createTempRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pathfinder-state-"));
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(repo, ".git")));
  return repo;
}

async function sortedFiles(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(directory)).sort();
}
