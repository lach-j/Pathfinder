import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PathfinderError, StateMode, createTimestamp, isStateMode } from "@pathfinder/core";

import { exists } from "./file-system.js";
import { findGitRoot } from "./git-root.js";
import { readJson, writeJson } from "./json-file.js";

export interface PathfinderConfig {
  stateMode?: StateMode;
}

export interface PathfinderStoreOptions {
  configRoot?: string;
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

export async function getPathfinderConfig(options: PathfinderStoreOptions = {}): Promise<PathfinderConfig> {
  const configPath = path.join(getPathfinderHome(options), "config.json");
  if (!(await exists(configPath))) {
    return {};
  }

  const config = await readJson<PathfinderConfig>(configPath);
  if (config.stateMode !== undefined && !isStateMode(config.stateMode)) {
    throw new PathfinderError(
      `Invalid Pathfinder config state.mode '${config.stateMode}'. Expected repo or external.`
    );
  }

  return config;
}

export async function getConfiguredStateMode(options: PathfinderStoreOptions = {}): Promise<StateMode> {
  return (await getPathfinderConfig(options)).stateMode ?? "repo";
}

export async function setConfiguredStateMode(
  mode: StateMode,
  options: PathfinderStoreOptions = {}
): Promise<PathfinderConfig> {
  const home = getPathfinderHome(options);
  const configPath = path.join(home, "config.json");
  const current = await getPathfinderConfig(options);
  const next = {
    ...current,
    stateMode: mode
  } satisfies PathfinderConfig;

  await mkdir(home, { recursive: true });
  await writeJson(configPath, next);
  return next;
}

export async function resolveExistingStateRoot(
  cwd: string,
  options: PathfinderStoreOptions = {}
): Promise<StateRootResolution> {
  const gitRoot = await requireGitRoot(cwd);
  const mode = await getConfiguredStateMode(options);
  const repoProjectPath = path.join(gitRoot, ".pathfinder", "project.json");

  if (mode === "repo") {
    const stateRoot = path.join(gitRoot, ".pathfinder");
    if (!(await exists(repoProjectPath))) {
      throw new PathfinderError("Pathfinder state not found. Run 'pathfinder init' first.");
    }

    return { mode, gitRoot, stateRoot };
  }

  const identity = await getProjectIdentity(gitRoot);
  const stateRoot = externalStateRoot(identity.projectId, options);
  const externalProjectPath = path.join(stateRoot, "project.json");
  if (!(await exists(externalProjectPath))) {
    if (await exists(repoProjectPath)) {
      throw new PathfinderError(
        "Pathfinder state not found in external mode for this repository, but repo-local state exists. Run 'pathfinder config set state.mode repo' to use it, or choose a different repository for external state."
      );
    }

    throw new PathfinderError(
      "Pathfinder state not found in external mode for this repository. Run 'pathfinder init --personal' first, or run 'pathfinder config set state.mode repo' to use repo-local state."
    );
  }

  return { mode, gitRoot, stateRoot, projectIdentity: identity };
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
