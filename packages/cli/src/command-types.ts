import type { AgentUserInstallTool, Slice } from "@pathfinder/core";

export type InitMode = "repo" | "personal";
export type InitAgent = AgentUserInstallTool;

export interface InitSetup {
  mode: InitMode;
  agents: InitAgent[];
  repoBootstrap: boolean;
  repoCommands: boolean;
}

export interface SliceBranchStartResult {
  branchName: string;
  updated: Slice;
  action: "created" | "checked_out";
}
