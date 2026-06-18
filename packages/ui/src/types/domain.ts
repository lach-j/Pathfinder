export interface CurrentContext {
  project?: Project;
  workstream?: {
    id: string;
    title: string;
  };
  activeSlice?: {
    id: string;
    title: string;
  };
}

export interface Project {
  schemaVersion: 1;
  name: string;
  createdAt: string;
  activeWorkstreamId?: string;
}

export interface Workstream {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeSliceId?: string;
}

export type SliceStatus = "proposed" | "ready" | "in_progress" | "review" | "complete";

export interface Slice {
  id: string;
  title: string;
  description: string;
  status: SliceStatus;
  dependsOnSliceIds?: string[];
  branchName?: string;
  baseRef?: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  sliceId: string;
  kind: string;
  description: string;
  path?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  sliceId: string;
  status: "open" | "complete" | string;
  summary: string;
}

export interface StoredMarkdownFile {
  markdown: string;
  path: string;
}
