import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

type PackageName = "core" | "git" | "state" | "ui" | "local-server" | "cli";

interface SourceFile {
  packageName: PackageName;
  absolutePath: string;
  relativePath: string;
}

const packageOrder: Record<PackageName, number> = {
  core: 0,
  git: 1,
  state: 1,
  ui: 2,
  "local-server": 2,
  cli: 3
};

const allowedPackageImports: Record<PackageName, readonly string[]> = {
  core: [],
  git: ["@pathfinder/core"],
  state: ["@pathfinder/core"],
  ui: [],
  "local-server": ["@pathfinder/core", "@pathfinder/git", "@pathfinder/state"],
  cli: ["@pathfinder/core", "@pathfinder/git", "@pathfinder/local-server", "@pathfinder/state"]
};

test("production package imports follow the architecture dependency direction", async () => {
  const files = await listProductionSourceFiles(path.resolve("packages"));
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file.absolutePath, "utf8");
    for (const specifier of findImportSpecifiers(source)) {
      if (specifier.startsWith("@pathfinder/")) {
        const allowed = allowedPackageImports[file.packageName];
        if (!allowed.includes(specifier)) {
          violations.push(`${file.relativePath} imports forbidden package ${specifier}`);
        }
        continue;
      }

      if (specifier.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file.absolutePath), specifier);
        const packageRoot = path.resolve("packages", file.packageName);
        if (!resolved.startsWith(packageRoot)) {
          violations.push(`${file.relativePath} reaches outside its package via ${specifier}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("core production code stays platform independent", async () => {
  const files = (await listProductionSourceFiles(path.resolve("packages", "core"))).filter(
    (file) => file.packageName === "core"
  );
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file.absolutePath, "utf8");
    for (const specifier of findImportSpecifiers(source)) {
      if (specifier.startsWith("node:")) {
        violations.push(`${file.relativePath} imports Node module ${specifier}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("declared package order documents the intended dependency layers", () => {
  assert.equal(packageOrder.core < packageOrder.git, true);
  assert.equal(packageOrder.core < packageOrder.state, true);
  assert.equal(packageOrder.ui < packageOrder.cli, true);
  assert.equal(packageOrder.git < packageOrder["local-server"], true);
  assert.equal(packageOrder.state < packageOrder["local-server"], true);
  assert.equal(packageOrder["local-server"] < packageOrder.cli, true);
  assert.equal(packageOrder.git < packageOrder.cli, true);
  assert.equal(packageOrder.state < packageOrder.cli, true);
});

async function listProductionSourceFiles(root: string): Promise<SourceFile[]> {
  const entries = await walk(root);
  return entries
    .filter((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
    .filter((filePath) => !filePath.endsWith(".test.ts"))
    .map((absolutePath) => {
      const parts = path.relative(path.resolve("packages"), absolutePath).split(path.sep);
      const packageName = parts[0] as PackageName;
      return {
        packageName,
        absolutePath,
        relativePath: path.relative(path.resolve(), absolutePath)
      };
    })
    .filter((file) => isPackageName(file.packageName));
}

async function walk(root: string): Promise<string[]> {
  const info = await stat(root);
  if (info.isFile()) {
    return [root];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.name !== "dist" && entry.name !== "node_modules")
      .map((entry) => walk(path.join(root, entry.name)))
  );
  return files.flat();
}

function findImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern = /\bimport(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g;
  const exportPattern = /\bexport\s+[^"']*?\sfrom\s+["']([^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    specifiers.push(match[1]);
  }

  for (const match of source.matchAll(exportPattern)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

function isPackageName(value: string): value is PackageName {
  return (
    value === "core" ||
    value === "git" ||
    value === "state" ||
    value === "ui" ||
    value === "local-server" ||
    value === "cli"
  );
}
