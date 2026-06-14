import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PathfinderError, StateMode, createTimestamp } from "@pathfinder/core";

import { exists } from "./file-system.js";
import { findGitRoot } from "./git-root.js";
import { readJson, writeJson } from "./json-file.js";

export interface PathfinderStoreOptions {
  configRoot?: string;
  userHome?: string;
}

export interface ProjectIdentity {
  projectId: string;
  gitRoot: string;
  identitySource: "remote" | "path";
  remoteUrl?: string;
}

export interface ExternalProjectMetadata extends ProjectIdentity {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
}

export interface StateRootResolution {
  mode: StateMode;
  gitRoot: string;
  stateRoot: string;
  projectIdentity?: ProjectIdentity;
}

export async function resolveExistingStateRoot(
  cwd: string,
  options: PathfinderStoreOptions = {}
): Promise<StateRootResolution> {
  const gitRoot = await requireGitRoot(cwd);
  const repoProjectPath = path.join(gitRoot, ".pathfinder", "project.json");

  if (await exists(repoProjectPath)) {
    return {
      mode: "repo",
      gitRoot,
      stateRoot: path.join(gitRoot, ".pathfinder")
    };
  }

  const identity = await getProjectIdentity(gitRoot);
  const stateRoot = externalStateRoot(identity.projectId, options);
  const externalProjectPath = path.join(stateRoot, "project.json");
  if (await exists(externalProjectPath)) {
    return {
      mode: "external",
      gitRoot,
      stateRoot,
      projectIdentity: identity
    };
  }

  throw new PathfinderError("Pathfinder state not found. Run 'pathfinder init' first.");
}

export async function resolveStateRootForInit(
  cwd: string,
  mode: StateMode,
  options: PathfinderStoreOptions = {}
): Promise<StateRootResolution> {
  const gitRoot = await requireGitRoot(cwd);

  if (mode === "repo") {
    return {
      mode,
      gitRoot,
      stateRoot: path.join(gitRoot, ".pathfinder")
    };
  }

  const identity = await getProjectIdentity(gitRoot);
  return {
    mode,
    gitRoot,
    stateRoot: externalStateRoot(identity.projectId, options),
    projectIdentity: identity
  };
}

export async function writeExternalProjectMetadata(
  stateRoot: string,
  identity: ProjectIdentity
): Promise<ExternalProjectMetadata> {
  const metadataPath = path.join(stateRoot, "project-metadata.json");
  const now = createTimestamp();
  let createdAt = now;

  if (await exists(metadataPath)) {
    try {
      createdAt = (await readJson<ExternalProjectMetadata>(metadataPath)).createdAt;
    } catch {
      createdAt = now;
    }
  }

  const metadata = {
    schemaVersion: 1,
    ...identity,
    createdAt,
    updatedAt: now
  } satisfies ExternalProjectMetadata;

  await writeJson(metadataPath, metadata);
  return metadata;
}

export function getPathfinderHome(options: PathfinderStoreOptions = {}): string {
  if (options.configRoot) {
    return path.resolve(options.configRoot);
  }

  if (process.env.PATHFINDER_HOME) {
    return path.resolve(process.env.PATHFINDER_HOME);
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "Pathfinder");
  }

  return path.join(os.homedir(), ".pathfinder");
}

async function requireGitRoot(cwd: string): Promise<string> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    throw new PathfinderError("This command must be run inside a Git repository.");
  }

  return gitRoot;
}

async function getProjectIdentity(gitRoot: string): Promise<ProjectIdentity> {
  const remoteUrl = await readFirstRemoteUrl(gitRoot);
  const identityValue = remoteUrl ?? path.resolve(gitRoot);
  const identitySource = remoteUrl ? "remote" : "path";
  const projectId = createHash("sha256").update(identityValue).digest("hex").slice(0, 16);

  return {
    projectId,
    gitRoot,
    identitySource,
    ...(remoteUrl ? { remoteUrl } : {})
  };
}

async function readFirstRemoteUrl(gitRoot: string): Promise<string | undefined> {
  const configPath = path.join(gitRoot, ".git", "config");
  if (!(await exists(configPath))) {
    return undefined;
  }

  const config = await readFile(configPath, "utf8");
  const remoteUrlMatch = /^\s*url\s*=\s*(.+?)\s*$/m.exec(config);
  const remoteUrl = remoteUrlMatch?.[1]?.trim();
  return remoteUrl || undefined;
}

function externalStateRoot(projectId: string, options: PathfinderStoreOptions): string {
  return path.join(getPathfinderHome(options), "projects", projectId);
}
