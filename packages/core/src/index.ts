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

export interface Slice {
  id: string;
  title: string;
  description: string;
  status: SliceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewComment {
  id: string;
  sliceId?: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface Review {
  id: string;
  sliceId: string;
  status: "open" | "complete";
  summary: string;
  comments: ReviewComment[];
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  kind: "test" | "screenshot" | "log" | "manual" | "benchmark" | "other";
  description: string;
  path?: string;
  createdAt: string;
}

export class PathfinderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathfinderError";
  }
}

export function isSliceStatus(value: string): value is SliceStatus {
  return sliceStatuses.includes(value as SliceStatus);
}

export function assertNonEmptyText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PathfinderError(`${label} is required.`);
  }
  return trimmed;
}

export function toUrlSafeId(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) {
    throw new PathfinderError("Could not create a URL-safe id from the provided text.");
  }

  return slug;
}

export function isUrlSafeId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function nextAvailableId(baseId: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  if (!existing.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existing.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function createTimestamp(date = new Date()): string {
  return date.toISOString();
}
