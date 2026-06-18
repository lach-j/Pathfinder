export type StateMode = "repo" | "external";

export const stateModes: readonly StateMode[] = ["repo", "external"];

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

export interface Plan {
  workstreamId: string;
  markdown: string;
}
