export type SliceStatus =
  | "proposed"
  | "ready"
  | "in_progress"
  | "review"
  | "complete";

export const sliceStatuses: readonly SliceStatus[] = [
  "proposed",
  "ready",
  "in_progress",
  "review",
  "complete"
];

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
