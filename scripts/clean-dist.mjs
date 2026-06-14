import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targets = [
  "packages/core/dist",
  "packages/git/dist",
  "packages/state/dist",
  "packages/local-server/dist",
  "packages/cli/dist",
  "packages/ui/dist"
];

await Promise.all(
  targets.map((target) => rm(path.join(root, target), { force: true, recursive: true }))
);
